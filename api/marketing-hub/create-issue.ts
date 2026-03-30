import type { VercelRequest, VercelResponse } from '@vercel/node';

const LINEAR_API = 'https://api.linear.app/graphql';
const TEAM_ID = 'c935c1a0-a0fc-41e5-a598-a537fcd344de';

async function linearMutation(query: string) {
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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  if (!process.env.LINEAR_API_KEY) {
    return res.status(500).json({ error: 'LINEAR_API_KEY not configured' });
  }

  const { title, dueDate, projectId } = req.body as {
    title: string;
    dueDate?: string;
    projectId?: string;
  };

  if (!title) {
    return res.status(400).json({ error: 'title is required' });
  }

  try {
    const fields: string[] = [
      `title: "${title.replace(/"/g, '\\"')}"`,
      `teamId: "${TEAM_ID}"`,
    ];
    if (dueDate) fields.push(`dueDate: "${dueDate}"`);
    if (projectId) fields.push(`projectId: "${projectId}"`);

    const data = await linearMutation(`
      mutation {
        issueCreate(input: { ${fields.join(', ')} }) {
          success
          issue {
            id title url dueDate
            state { name color }
            project { id name }
          }
        }
      }
    `);

    return res.status(200).json(data.issueCreate);
  } catch (err) {
    console.error('Create issue error:', err);
    return res.status(500).json({ error: 'Failed to create issue' });
  }
}
