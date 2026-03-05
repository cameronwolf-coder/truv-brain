import type { VercelRequest, VercelResponse } from '@vercel/node';

const LINEAR_API = 'https://api.linear.app/graphql';
const TEAM_ID = 'c935c1a0-a0fc-41e5-a598-a537fcd344de';

interface LinearProject {
  id: string;
  name: string;
  url: string;
  state: string;
  startDate?: string;
  targetDate?: string;
  lead?: { name: string };
  labels: { nodes: { name: string; color: string }[] };
}

interface LinearIssue {
  id: string;
  title: string;
  url: string;
  state: { name: string; color: string };
  dueDate: string;
  assignee?: { name: string };
  project?: { id: string; name: string };
  labels: { nodes: { name: string; color: string }[] };
}

const PROJECT_STATE_COLORS: Record<string, string> = {
  planned: '#6b7280',
  started: '#2c64e3',
  paused: '#f59e0b',
  completed: '#10b981',
  cancelled: '#ef4444',
};

function parseCategory(name: string): string {
  const match = name.match(/\[MKTG-(\w+)\]/i);
  if (!match) return 'Other';
  const tag = match[1].toUpperCase();
  if (tag === 'EVENT') return 'Event';
  if (tag === 'GROWTH') return 'Growth';
  if (tag === 'PMM') return 'PMM';
  if (tag === 'OPS') return 'Ops';
  return 'Other';
}

async function linearQuery(query: string, variables: Record<string, unknown> = {}) {
  const res = await fetch(LINEAR_API, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: process.env.LINEAR_API_KEY!,
    },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) throw new Error(`Linear API ${res.status}`);
  const json = await res.json();
  if (json.errors) throw new Error(json.errors[0].message);
  return json.data;
}

async function fetchProjects() {
  const data = await linearQuery(`
    query {
      team(id: "${TEAM_ID}") {
        projects(first: 100) {
          nodes {
            id name url state
            startDate targetDate
            lead { name }
            labels { nodes { name color } }
          }
        }
      }
    }
  `);
  const activeProjects = (data.team.projects.nodes as LinearProject[])
    .filter((p) => p.state === 'planned' || p.state === 'started');

  // Fetch issue counts per project in parallel (one query each, stays under complexity limit)
  const issueCounts = await Promise.all(
    activeProjects.map(async (p) => {
      try {
        const d = await linearQuery(`{
          project(id: "${p.id}") {
            issues { nodes { state { type } } }
          }
        }`);
        const nodes = d.project.issues.nodes as { state: { type: string } }[];
        return {
          total: nodes.length,
          completed: nodes.filter((i) => i.state.type === 'completed').length,
        };
      } catch {
        return { total: 0, completed: 0 };
      }
    }),
  );

  return activeProjects.map((p, i) => ({
    id: p.id,
    title: p.name,
    start: p.startDate || p.targetDate || new Date().toISOString().split('T')[0],
    end: p.targetDate || undefined,
    type: 'project' as const,
    status: p.state,
    statusColor: PROJECT_STATE_COLORS[p.state] || '#6b7280',
    assignee: p.lead?.name,
    category: parseCategory(p.name),
    labels: (p.labels?.nodes || []).map((l) => ({ name: l.name, color: l.color })),
    url: p.url,
    totalIssues: issueCounts[i].total,
    completedIssues: issueCounts[i].completed,
  }));
}

async function fetchIssues(startDate: string, endDate: string) {
  const allIssues: LinearIssue[] = [];
  let cursor: string | undefined;

  do {
    const data = await linearQuery(
      `query($after: String) {
        team(id: "${TEAM_ID}") {
          issues(
            filter: { dueDate: { gte: "${startDate}", lte: "${endDate}" } }
            first: 100
            after: $after
          ) {
            pageInfo { hasNextPage endCursor }
            nodes {
              id title url
              state { name color }
              dueDate
              assignee { name }
              project { id name }
              labels { nodes { name color } }
            }
          }
        }
      }`,
      { after: cursor },
    );

    const { nodes, pageInfo } = data.team.issues;
    allIssues.push(...nodes);
    cursor = pageInfo.hasNextPage ? pageInfo.endCursor : undefined;
  } while (cursor);

  return (allIssues as LinearIssue[]).map((i) => ({
    id: i.id,
    title: i.title,
    start: i.dueDate,
    type: 'issue' as const,
    status: i.state.name,
    statusColor: i.state.color,
    assignee: i.assignee?.name,
    project: i.project?.name,
    category: parseCategory(i.project?.name || i.title),
    labels: (i.labels?.nodes || []).map((l) => ({ name: l.name, color: l.color })),
    url: i.url,
  }));
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  if (!process.env.LINEAR_API_KEY) {
    return res.status(500).json({ error: 'LINEAR_API_KEY not configured' });
  }

  const months = parseInt((req.query.months as string) || '3', 10);
  const now = new Date();
  const startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split('T')[0];
  const endDate = new Date(now.getFullYear(), now.getMonth() + months, 0).toISOString().split('T')[0];

  try {
    const [projects, issues] = await Promise.all([fetchProjects(), fetchIssues(startDate, endDate)]);

    return res.status(200).json({ projects, issues });
  } catch (err) {
    console.error('Linear calendar error:', err);
    return res.status(500).json({ error: 'Failed to fetch calendar data' });
  }
}
