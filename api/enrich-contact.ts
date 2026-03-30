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
): Promise<{ ok: boolean; data: Record<string, unknown>; status: number; error?: string }> {
  const apiKey = process.env.APOLLO_API_KEY;
  if (!apiKey) return { ok: false, data: {}, status: 0, error: "APOLLO_API_KEY not set" };

  const resp = await fetch(`${APOLLO_API_URL}${endpoint}`, {
    method: "POST",
    headers: {
      "X-Api-Key": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    return { ok: false, data: {}, status: resp.status, error: `Apollo ${endpoint}: ${resp.status} ${text.slice(0, 200)}` };
  }
  const data = await resp.json() as Record<string, unknown>;
  return { ok: true, data, status: resp.status };
}

async function hubspotUpdate(
  contactId: string,
  properties: Record<string, string>
): Promise<{ ok: boolean; error?: string }> {
  const token = process.env.HUBSPOT_API_TOKEN;
  if (!token) return { ok: false, error: "HUBSPOT_API_TOKEN not set" };

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
    const text = await resp.text().catch(() => "");
    return { ok: false, error: `HubSpot update: ${resp.status} ${text.slice(0, 200)}` };
  }
  return { ok: true };
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

  const warnings: string[] = [];

  try {
    // Strategy: org enrichment first (cheap, 1 credit per unique domain).
    // Only fall back to person match if we have no domain at all.
    let enrichedOrg: Record<string, unknown> = {};
    let person: Record<string, unknown> = {};
    let orgDomain = domain || "";

    // 1. Try org enrichment by domain (cheapest path — no person credit)
    if (orgDomain) {
      const orgResp = await apolloRequest("/api/v1/organizations/enrich", {
        domain: orgDomain,
      });
      if (orgResp.ok) {
        enrichedOrg = (orgResp.data.organization || {}) as Record<string, unknown>;
      } else {
        warnings.push(`Org enrichment by domain failed: ${orgResp.error}`);
      }
    }

    // 2. If no domain but we have company name, search for the org
    if (!orgDomain && company) {
      const searchResp = await apolloRequest("/api/v1/mixed_companies/search", {
        q_organization_name: company,
        per_page: 1,
      });
      if (searchResp.ok) {
        const orgs = (searchResp.data.organizations || []) as Array<Record<string, unknown>>;
        if (orgs.length > 0) {
          enrichedOrg = orgs[0];
          orgDomain = (enrichedOrg.primary_domain as string) || "";
          // If we found a domain, do a full enrichment for tech stack
          if (orgDomain) {
            const fullResp = await apolloRequest("/api/v1/organizations/enrich", {
              domain: orgDomain,
            });
            if (fullResp.ok) {
              enrichedOrg = (fullResp.data.organization || {}) as Record<string, unknown>;
            }
          }
        } else {
          warnings.push(`No Apollo org match for company name: ${company}`);
        }
      } else {
        warnings.push(`Company search failed: ${searchResp.error}`);
      }
    }

    // 3. If we still have nothing and have an email, try person match as last resort
    if (Object.keys(enrichedOrg).length === 0 && email) {
      const personResp = await apolloRequest("/api/v1/people/match", {
        email,
        reveal_personal_emails: false,
      });
      if (personResp.ok) {
        person = (personResp.data.person || {}) as Record<string, unknown>;
        const personOrg = (person.organization || {}) as Record<string, unknown>;
        if (personOrg.primary_domain) {
          orgDomain = personOrg.primary_domain as string;
          const orgResp = await apolloRequest("/api/v1/organizations/enrich", {
            domain: orgDomain,
          });
          if (orgResp.ok) {
            enrichedOrg = (orgResp.data.organization || {}) as Record<string, unknown>;
          }
        }
      } else {
        warnings.push(`Person match failed: ${personResp.error}`);
      }
    }

    // 4. Build HubSpot properties from whatever we found
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
    if (enrichedOrg.annual_revenue) {
      props.annualrevenue = String(enrichedOrg.annual_revenue);
    } else if (enrichedOrg.estimated_annual_revenue) {
      props.annualrevenue = String(enrichedOrg.estimated_annual_revenue);
    }
    if (enrichedOrg.industry) {
      props.industry = enrichedOrg.industry as string;
    }

    // Tech stack (from org enrichment)
    const techStack = enrichedOrg.current_technologies as
      | Array<{ name: string; category?: string }>
      | undefined;
    if (techStack?.length) {
      props.tech_stack = techStack
        .slice(0, 20)
        .map((t) => t.name)
        .join("; ");
    }

    // Additional useful fields
    if (enrichedOrg.short_description) {
      props.company_description = String(enrichedOrg.short_description).slice(0, 500);
    }
    if (enrichedOrg.city || enrichedOrg.state) {
      const loc = [enrichedOrg.city, enrichedOrg.state].filter(Boolean).join(", ");
      if (loc) props.company_location = loc;
    }
    if (enrichedOrg.founded_year) {
      props.company_founded_year = String(enrichedOrg.founded_year);
    }

    // 5. Write back to HubSpot
    let hubspotOk = true;
    if (Object.keys(props).length > 0) {
      const hsResult = await hubspotUpdate(contactId, props);
      if (!hsResult.ok) {
        // Some properties may not exist in HubSpot — retry with only known safe properties
        const safeProps: Record<string, string> = {};
        const safeKeys = ["numberofemployees", "annualrevenue", "industry", "linkedin_url"];
        for (const k of safeKeys) {
          if (props[k]) safeProps[k] = props[k];
        }
        if (Object.keys(safeProps).length > 0) {
          const retryResult = await hubspotUpdate(contactId, safeProps);
          if (!retryResult.ok) {
            warnings.push(`HubSpot writeback failed: ${retryResult.error}`);
            hubspotOk = false;
          } else {
            warnings.push(`Some custom properties skipped (not in HubSpot schema), wrote: ${Object.keys(safeProps).join(", ")}`);
          }
        } else {
          warnings.push(`HubSpot writeback failed: ${hsResult.error}`);
          hubspotOk = false;
        }
      }
    }

    const foundData = Object.keys(enrichedOrg).length > 0;
    if (!foundData) {
      return res.status(200).json({
        success: false,
        contactId,
        error: "No enrichment data found from Apollo",
        warnings,
        propertiesUpdated: [],
      });
    }

    return res.status(200).json({
      success: true,
      contactId,
      propertiesUpdated: Object.keys(props),
      hubspotWritten: hubspotOk,
      warnings: warnings.length > 0 ? warnings : undefined,
      company: {
        name: enrichedOrg.name,
        domain: enrichedOrg.primary_domain,
        employees: enrichedOrg.estimated_num_employees,
        revenue: enrichedOrg.annual_revenue || enrichedOrg.estimated_annual_revenue,
        industry: enrichedOrg.industry,
        techStack: techStack?.slice(0, 20).map((t) => t.name),
        description: enrichedOrg.short_description,
        location: [enrichedOrg.city, enrichedOrg.state].filter(Boolean).join(", "),
        foundedYear: enrichedOrg.founded_year,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Enrich contact failed:", message);
    return res.status(500).json({ error: message, warnings });
  }
}
