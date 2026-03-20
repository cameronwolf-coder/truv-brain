import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Redis } from '@upstash/redis';

const LINEAR_API = 'https://api.linear.app/graphql';
const TEAM_ID = 'c935c1a0-a0fc-41e5-a598-a537fcd344de';

interface ActivityItem {
  id: string;
  title: string;
  type: 'campaign' | 'event' | 'content' | 'ops';
  source: 'hubspot' | 'linear';
  timestamp: string;
  description?: string;
  url?: string;
}

async function linearQuery(query: string) {
  const res = await fetch(LINEAR_API, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: process.env.LINEAR_API_KEY!,
    },
    body: JSON.stringify({ query }),
  });
  if (!res.ok) throw new Error(`Linear API ${res.status}`);
  const json = await res.json();
  if (json.errors) throw new Error(json.errors[0].message);
  return json.data;
}

function classifyByLabels(labels: { name: string }[]): ActivityItem['type'] {
  const names = labels.map((l) => l.name.toLowerCase());
  if (names.some((n) => n.includes('event'))) return 'event';
  if (names.some((n) => n.includes('content'))) return 'content';
  if (names.some((n) => n.includes('ops') || n.includes('operations'))) return 'ops';
  return 'campaign';
}

async function fetchCompletedIssues(sinceDate: string): Promise<ActivityItem[]> {
  const data = await linearQuery(`
    query {
      team(id: "${TEAM_ID}") {
        issues(
          filter: {
            completedAt: { gte: "${sinceDate}" }
            state: { type: { eq: "completed" } }
          }
          first: 50
          orderBy: updatedAt
        ) {
          nodes {
            id title url completedAt
            project { name }
            labels { nodes { name } }
          }
        }
      }
    }
  `);

  return data.team.issues.nodes.map(
    (i: { id: string; title: string; url: string; completedAt: string; project?: { name: string }; labels: { nodes: { name: string }[] } }) => ({
      id: `linear-${i.id}`,
      title: i.title,
      type: classifyByLabels(i.labels.nodes),
      source: 'linear' as const,
      timestamp: i.completedAt,
      description: i.project ? `Project: ${i.project.name}` : undefined,
      url: i.url,
    }),
  );
}

async function fetchCampaignActivity(redis: Redis, days: number): Promise<ActivityItem[]> {
  const workflowKeys = (await redis.smembers('campaigns:index')) as string[];
  if (workflowKeys.length === 0) return [];

  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;

  const campaigns = await Promise.all(
    workflowKeys.map(async (key) => {
      const meta = (await redis.hgetall(`campaign:${key}:meta`)) as Record<string, string> | null;
      if (!meta) return null;

      const lastEvent = parseInt(meta.last_event || '0', 10) * 1000;
      if (lastEvent < cutoff) return null;

      return {
        id: `hubspot-${key}`,
        title: meta.name || key.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
        type: 'campaign' as const,
        source: 'hubspot' as const,
        timestamp: new Date(lastEvent).toISOString(),
        description: `Email campaign delivered`,
      };
    }),
  );

  return campaigns.filter((c): c is ActivityItem => c !== null);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const days = parseInt((req.query.days as string) || '30', 10);
  const sinceDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  try {
    const promises: Promise<ActivityItem[]>[] = [];

    if (process.env.LINEAR_API_KEY) {
      promises.push(fetchCompletedIssues(sinceDate));
    }

    if (process.env.UPSTASH_REDIS_REST_URL) {
      const redis = new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL!,
        token: process.env.UPSTASH_REDIS_REST_TOKEN!,
      });
      promises.push(fetchCampaignActivity(redis, days));
    }

    const results = await Promise.all(promises);
    const items = results.flat().sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return res.status(200).json(items);
  } catch (err) {
    console.error('Activity feed error:', err);
    return res.status(500).json({ error: 'Failed to fetch activity feed' });
  }
}
