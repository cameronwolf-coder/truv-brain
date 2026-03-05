import type { VercelRequest, VercelResponse } from '@vercel/node';

const LINEAR_API = 'https://api.linear.app/graphql';

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
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  if (!process.env.LINEAR_API_KEY) {
    return res.status(500).json({ error: 'LINEAR_API_KEY not configured' });
  }

  const { id, type, updates } = req.body as {
    id: string;
    type: 'project' | 'issue';
    updates: {
      title?: string;
      dueDate?: string;
      startDate?: string;
      targetDate?: string;
      assigneeId?: string;
      stateId?: string;
    };
  };

  if (!id || !type) {
    return res.status(400).json({ error: 'id and type are required' });
  }

  try {
    if (type === 'issue') {
      const fields: string[] = [];
      if (updates.title !== undefined) fields.push(`title: "${updates.title}"`);
      if (updates.dueDate !== undefined) fields.push(`dueDate: "${updates.dueDate}"`);
      if (updates.assigneeId !== undefined) fields.push(`assigneeId: "${updates.assigneeId}"`);
      if (updates.stateId !== undefined) fields.push(`stateId: "${updates.stateId}"`);

      if (fields.length === 0) {
        return res.status(400).json({ error: 'No updates provided' });
      }

      const data = await linearMutation(`
        mutation {
          issueUpdate(id: "${id}", input: { ${fields.join(', ')} }) {
            success
            issue { id title dueDate state { name color } assignee { name } }
          }
        }
      `);

      return res.status(200).json(data.issueUpdate);
    }

    if (type === 'project') {
      const fields: string[] = [];
      if (updates.title !== undefined) fields.push(`name: "${updates.title}"`);
      if (updates.startDate !== undefined) fields.push(`startDate: "${updates.startDate}"`);
      if (updates.targetDate !== undefined) fields.push(`targetDate: "${updates.targetDate}"`);

      if (fields.length === 0) {
        return res.status(400).json({ error: 'No updates provided' });
      }

      const data = await linearMutation(`
        mutation {
          projectUpdate(id: "${id}", input: { ${fields.join(', ')} }) {
            success
            project { id name startDate targetDate state }
          }
        }
      `);

      return res.status(200).json(data.projectUpdate);
    }

    return res.status(400).json({ error: 'Invalid type' });
  } catch (err) {
    console.error('Update event error:', err);
    return res.status(500).json({ error: 'Failed to update event' });
  }
}
