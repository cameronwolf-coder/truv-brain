const BASE_URL = "https://api.pipedream.com/v1";
export class PipedreamService {
    apiKey;
    orgId;
    constructor(apiKey, orgId) {
        this.apiKey = apiKey;
        this.orgId = orgId;
    }
    async request(path, options = {}) {
        const { method = "GET", body, params } = options;
        const url = new URL(`${BASE_URL}${path}`);
        if (params) {
            for (const [k, v] of Object.entries(params)) {
                url.searchParams.set(k, v);
            }
        }
        // Always include org_id for workspace-scoped requests
        if (!url.searchParams.has("org_id")) {
            url.searchParams.set("org_id", this.orgId);
        }
        const headers = {
            Authorization: `Bearer ${this.apiKey}`,
            "Content-Type": "application/json",
        };
        const res = await fetch(url.toString(), {
            method,
            headers,
            body: body ? JSON.stringify(body) : undefined,
        });
        const text = await res.text();
        let data;
        try {
            data = JSON.parse(text);
        }
        catch {
            data = { raw: text };
        }
        if (!res.ok) {
            const msg = typeof data === "object" && data !== null && "error" in data
                ? data.error
                : `HTTP ${res.status}`;
            throw new Error(`Pipedream API error: ${msg}`);
        }
        return data;
    }
    // ── Workflows ──
    async getWorkflow(workflowId) {
        return this.request(`/workflows/${workflowId}`);
    }
    async updateWorkflow(workflowId, active) {
        return this.request(`/workflows/${workflowId}`, {
            method: "PUT",
            body: { active, org_id: this.orgId },
        });
    }
    async createWorkflow(params) {
        return this.request("/workflows", {
            method: "POST",
            body: {
                org_id: this.orgId,
                project_id: params.projectId,
                template_id: params.templateId,
                steps: params.steps || [],
                triggers: params.triggers || [],
                settings: {
                    name: params.name,
                    auto_deploy: params.autoDeploy ?? true,
                },
            },
        });
    }
    async triggerWorkflow(httpEndpointUrl, payload) {
        const res = await fetch(httpEndpointUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: payload ? JSON.stringify(payload) : undefined,
        });
        const text = await res.text();
        try {
            return JSON.parse(text);
        }
        catch {
            return { status: res.status, body: text };
        }
    }
    // ── Sources ──
    async listSources(limit = 10) {
        return this.request(`/orgs/${this.orgId}/sources`, {
            params: { limit: String(limit) },
        });
    }
    async getSourceEvents(sourceId, limit = 10) {
        return this.request(`/sources/${sourceId}/events`, {
            params: { limit: String(limit) },
        });
    }
    async deleteSourceEvents(sourceId) {
        return this.request(`/sources/${sourceId}/events`, { method: "DELETE" });
    }
    async updateSource(sourceId, active) {
        return this.request(`/sources/${sourceId}`, {
            method: "PATCH",
            body: { active },
        });
    }
    async deleteSource(sourceId) {
        return this.request(`/sources/${sourceId}`, { method: "DELETE" });
    }
    // ── Subscriptions ──
    async listSubscriptions(limit = 100) {
        return this.request(`/orgs/${this.orgId}/subscriptions`, {
            params: { limit: String(limit) },
        });
    }
    async createSubscription(emitterId, listenerId, eventName) {
        return this.request("/subscriptions", {
            method: "POST",
            body: {
                emitter_id: emitterId,
                listener_id: listenerId,
                event_name: eventName || "",
            },
        });
    }
    async deleteSubscription(subscriptionId) {
        return this.request(`/subscriptions/${subscriptionId}`, { method: "DELETE" });
    }
    // ── Components / Apps ──
    async searchComponents(query, limit = 10) {
        return this.request("/components", {
            params: { q: query, limit: String(limit) },
        });
    }
    async listApps(query, limit = 10) {
        const params = { limit: String(limit) };
        if (query)
            params.q = query;
        return this.request("/apps", { params });
    }
    // ── User ──
    async getCurrentUser() {
        return this.request("/users/me");
    }
    // ── Convenience: List all workflows ──
    // The API doesn't have a direct "list workflows" endpoint for orgs,
    // so we derive workflow IDs from subscriptions.
    async listWorkflows(limit = 20) {
        const subs = (await this.listSubscriptions(100));
        const workflowIds = new Set();
        for (const sub of subs.data) {
            if (sub.listener_id.startsWith("p_"))
                workflowIds.add(sub.listener_id);
        }
        const workflows = [];
        let count = 0;
        for (const id of workflowIds) {
            if (count >= limit)
                break;
            try {
                const wf = await this.getWorkflow(id);
                workflows.push({ id, ...wf });
                count++;
            }
            catch {
                workflows.push({ id, error: "Could not fetch details" });
                count++;
            }
        }
        return {
            total: workflowIds.size,
            returned: workflows.length,
            workflows,
        };
    }
}
