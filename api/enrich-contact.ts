import type { VercelRequest, VercelResponse } from "@vercel/node";

const APOLLO_API_URL = "https://api.apollo.io";
const HUBSPOT_API_URL = "https://api.hubapi.com";

interface EnrichRequest {
  contactId: string;
  email?: string;
  firstname?: string;
  lastname?: string;
  company?: string;
  domain?: string;
}

async function apolloRequest(
  endpoint: string,
  body: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const apiKey = process.env.APOLLO_API_KEY;
  if (!apiKey) throw new Error("APOLLO_API_KEY not set");

  const resp = await fetch(`${APOLLO_API_URL}${endpoint}`, {
    method: "POST",
    headers: {
      "X-Api-Key": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    throw new Error(`Apollo ${endpoint} failed: ${resp.status}`);
  }
  return resp.json() as Promise<Record<string, unknown>>;
}

async function hubspotUpdate(
  contactId: string,
  properties: Record<string, string>
): Promise<void> {
  const token = process.env.HUBSPOT_API_TOKEN;
  if (!token) throw new Error("HUBSPOT_API_TOKEN not set");

  const resp = await fetch(
    `${HUBSPOT_API_URL}/crm/v3/objects/contacts/${contactId}`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ properties }),
    }
  );

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`HubSpot update failed: ${resp.status} ${text}`);
  }
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const {
    contactId,
    email,
    firstname,
    lastname,
    company,
    domain,
  } = req.body as EnrichRequest;

  if (!contactId) {
    return res.status(400).json({ error: "contactId is required" });
  }

  try {
    // 1. Person match
    const personBody: Record<string, unknown> = {
      reveal_personal_emails: false,
    };
    if (email) personBody.email = email;
    else personBody.run_waterfall_email = true;
    if (firstname) personBody.first_name = firstname;
    if (lastname) personBody.last_name = lastname;
    if (company) personBody.organization_name = company;
    if (domain) personBody.domain = domain;

    const personResp = await apolloRequest(
      "/api/v1/people/match",
      personBody
    );
    const person = (personResp.person || {}) as Record<string, unknown>;
    const org = (person.organization || {}) as Record<string, unknown>;

    // 2. Org enrichment (if we have a domain)
    const orgDomain =
      domain ||
      (org.primary_domain as string) ||
      "";
    let enrichedOrg: Record<string, unknown> = {};

    if (orgDomain) {
      const orgResp = await apolloRequest("/api/v1/organizations/enrich", {
        domain: orgDomain,
      });
      enrichedOrg = (orgResp.organization || {}) as Record<string, unknown>;
    }

    // 3. Build HubSpot properties
    const props: Record<string, string> = {};

    if (person.linkedin_url) {
      props.linkedin_url = person.linkedin_url as string;
    }
    if (enrichedOrg.primary_domain) {
      props.company_domain = enrichedOrg.primary_domain as string;
    }
    if (enrichedOrg.estimated_num_employees) {
      props.numberofemployees = String(enrichedOrg.estimated_num_employees);
    }
    if (enrichedOrg.estimated_annual_revenue) {
      props.annualrevenue = String(enrichedOrg.estimated_annual_revenue);
    }
    if (enrichedOrg.industry) {
      props.industry = enrichedOrg.industry as string;
    }

    const techStack = enrichedOrg.current_technologies as
      | Array<{ name: string }>
      | undefined;
    if (techStack?.length) {
      props.tech_stack = techStack
        .slice(0, 20)
        .map((t) => t.name)
        .join("; ");
    }

    // 4. Write back to HubSpot
    if (Object.keys(props).length > 0) {
      await hubspotUpdate(contactId, props);
    }

    return res.status(200).json({
      success: true,
      contactId,
      propertiesUpdated: Object.keys(props),
      person: {
        email: person.email,
        title: person.title,
        linkedin_url: person.linkedin_url,
      },
      company: {
        name: enrichedOrg.name,
        employees: enrichedOrg.estimated_num_employees,
        revenue: enrichedOrg.estimated_annual_revenue,
        industry: enrichedOrg.industry,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Enrich contact failed:", message);
    return res.status(500).json({ error: message });
  }
}
