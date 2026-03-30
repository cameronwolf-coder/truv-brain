import type { VercelRequest, VercelResponse } from '@vercel/node';
import { google } from 'googleapis';

const LINEAR_API = 'https://api.linear.app/graphql';
const TEAM_ID = 'c935c1a0-a0fc-41e5-a598-a537fcd344de';

interface CalendarItem {
  id: string;
  title: string;
  start: string;
  end?: string;
  type: 'project' | 'issue';
  assignee?: string;
  url: string;
}

function getServiceAccountCredentials() {
  const jsonStr = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!jsonStr) return null;
  try {
    try {
      return JSON.parse(jsonStr);
    } catch {
      return JSON.parse(Buffer.from(jsonStr, 'base64').toString('utf-8'));
    }
  } catch {
    return null;
  }
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

async function fetchLinearItems(): Promise<CalendarItem[]> {
  const now = new Date();
  const startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split('T')[0];
  const endDate = new Date(now.getFullYear(), now.getMonth() + 3, 0).toISOString().split('T')[0];

  const [projectsData, issuesData] = await Promise.all([
    linearQuery(`
      query {
        team(id: "${TEAM_ID}") {
          projects(first: 100) {
            nodes { id name url state startDate targetDate lead { name } }
          }
        }
      }
    `),
    linearQuery(`
      query {
        team(id: "${TEAM_ID}") {
          issues(filter: { dueDate: { gte: "${startDate}", lte: "${endDate}" } }, first: 100) {
            nodes { id title url dueDate assignee { name } project { name } }
          }
        }
      }
    `),
  ]);

  const items: CalendarItem[] = [];

  for (const p of projectsData.team.projects.nodes) {
    if (p.state !== 'planned' && p.state !== 'started') continue;
    if (!p.targetDate && !p.startDate) continue;
    items.push({
      id: p.id,
      title: `[Project] ${p.name}`,
      start: p.startDate || p.targetDate,
      end: p.targetDate || undefined,
      type: 'project',
      assignee: p.lead?.name,
      url: p.url,
    });
  }

  for (const i of issuesData.team.issues.nodes) {
    if (!i.dueDate) continue;
    items.push({
      id: i.id,
      title: i.project ? `[${i.project.name}] ${i.title}` : i.title,
      start: i.dueDate,
      type: 'issue',
      assignee: i.assignee?.name,
      url: i.url,
    });
  }

  return items;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // Simple shared secret auth for Pipedream
  const authHeader = req.headers.authorization;
  const expectedToken = process.env.GCAL_SYNC_SECRET;
  if (expectedToken && authHeader !== `Bearer ${expectedToken}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const calendarId = process.env.GOOGLE_CALENDAR_ID;
  if (!calendarId) return res.status(500).json({ error: 'GOOGLE_CALENDAR_ID not configured' });
  if (!process.env.LINEAR_API_KEY) return res.status(500).json({ error: 'LINEAR_API_KEY not configured' });

  const credentials = getServiceAccountCredentials();
  if (!credentials) return res.status(500).json({ error: 'Google service account not configured' });

  try {
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/calendar'],
    });
    const calendar = google.calendar({ version: 'v3', auth });

    // Fetch Linear items and existing GCal events in parallel
    const [linearItems, existingEventsRes] = await Promise.all([
      fetchLinearItems(),
      calendar.events.list({
        calendarId,
        privateExtendedProperty: 'source=linear-sync',
        maxResults: 500,
        singleEvents: true,
      }),
    ]);

    const existingEvents = existingEventsRes.data.items || [];
    const existingByLinearId = new Map(
      existingEvents
        .filter((e) => e.extendedProperties?.private?.linearId)
        .map((e) => [e.extendedProperties!.private!.linearId!, e]),
    );

    const linearIds = new Set(linearItems.map((i) => i.id));
    let created = 0;
    let updated = 0;
    let deleted = 0;

    // Upsert events
    for (const item of linearItems) {
      const eventBody = {
        summary: item.title,
        description: `${item.assignee ? `Assignee: ${item.assignee}\n` : ''}Linear: ${item.url}`,
        start: item.end
          ? { date: item.start }
          : { date: item.start },
        end: item.end
          ? { date: item.end }
          : { date: item.start },
        extendedProperties: {
          private: {
            linearId: item.id,
            source: 'linear-sync',
            type: item.type,
          },
        },
      };

      const existing = existingByLinearId.get(item.id);
      if (existing) {
        // Update if title or dates changed
        if (
          existing.summary !== eventBody.summary ||
          existing.start?.date !== eventBody.start.date ||
          existing.end?.date !== eventBody.end.date
        ) {
          await calendar.events.update({
            calendarId,
            eventId: existing.id!,
            requestBody: eventBody,
          });
          updated++;
        }
      } else {
        await calendar.events.insert({
          calendarId,
          requestBody: eventBody,
        });
        created++;
      }
    }

    // Delete events no longer in Linear
    for (const [linearId, event] of existingByLinearId) {
      if (!linearIds.has(linearId)) {
        await calendar.events.delete({
          calendarId,
          eventId: event.id!,
        });
        deleted++;
      }
    }

    return res.status(200).json({ created, updated, deleted, total: linearItems.length });
  } catch (err) {
    console.error('GCal sync error:', err);
    return res.status(500).json({ error: 'Failed to sync calendar' });
  }
}
