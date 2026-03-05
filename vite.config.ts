import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  return {
    plugins: [react()],
    define: {
      __GIT_COMMIT_SHA__: JSON.stringify(process.env.VERCEL_GIT_COMMIT_SHA || 'dev'),
      __GIT_COMMIT_MESSAGE__: JSON.stringify(process.env.VERCEL_GIT_COMMIT_MESSAGE || ''),
    },
    server: {
      proxy: {
        '/api/marketing-hub/linear-calendar': {
          target: 'https://api.linear.app',
          changeOrigin: true,
          configure: (_proxy, _options) => {},
          bypass: async (req, res) => {
            if (!env.LINEAR_API_KEY) {
              res.writeHead(500, { 'Content-Type': 'application/json' })
              res.end(JSON.stringify({ error: 'LINEAR_API_KEY not set' }))
              return
            }

            const teamId = 'c935c1a0-a0fc-41e5-a598-a537fcd344de'
            const url = new URL(req.url!, `http://${req.headers.host}`)
            const months = parseInt(url.searchParams.get('months') || '3', 10)
            const now = new Date()
            const startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split('T')[0]
            const endDate = new Date(now.getFullYear(), now.getMonth() + months, 0).toISOString().split('T')[0]

            const stateColors: Record<string, string> = { planned: '#6b7280', started: '#2c64e3', paused: '#f59e0b', completed: '#10b981' }

            const gql = async (query: string, variables = {}) => {
              const r = await fetch('https://api.linear.app/graphql', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: env.LINEAR_API_KEY },
                body: JSON.stringify({ query, variables }),
              })
              const json = await r.json()
              return json.data
            }

            try {
              const [pd, id] = await Promise.all([
                gql(`query { team(id: "${teamId}") { projects(first: 100) { nodes { id name url state startDate targetDate lead { name } labels { nodes { name color } } } } } }`),
                gql(`query { team(id: "${teamId}") { issues(filter: { dueDate: { gte: "${startDate}", lte: "${endDate}" } }, first: 100) { nodes { id title url dueDate state { name color } assignee { name } project { id name } labels { nodes { name color } } } } } }`),
              ])

              const projects = pd.team.projects.nodes
                .filter((p: any) => p.state === 'planned' || p.state === 'started')
                .map((p: any) => ({
                  id: p.id, title: p.name,
                  start: p.startDate || p.targetDate || now.toISOString().split('T')[0],
                  end: p.targetDate || undefined,
                  type: 'project', status: p.state,
                  statusColor: stateColors[p.state] || '#6b7280',
                  assignee: p.lead?.name,
                  labels: (p.labels?.nodes || []).map((l: any) => ({ name: l.name, color: l.color })),
                  url: p.url,
                }))

              const issues = id.team.issues.nodes.map((i: any) => ({
                id: i.id, title: i.title, start: i.dueDate,
                type: 'issue', status: i.state.name, statusColor: i.state.color,
                assignee: i.assignee?.name, project: i.project?.name,
                labels: (i.labels?.nodes || []).map((l: any) => ({ name: l.name, color: l.color })),
                url: i.url,
              }))

              res.writeHead(200, { 'Content-Type': 'application/json' })
              res.end(JSON.stringify({ projects, issues }))
            } catch (e: any) {
              res.writeHead(500, { 'Content-Type': 'application/json' })
              res.end(JSON.stringify({ error: e.message }))
            }
          },
        },
        '/api/marketing-hub/activity-feed': {
          target: 'https://api.linear.app',
          changeOrigin: true,
          bypass: async (req, res) => {
            if (!env.LINEAR_API_KEY) {
              res.writeHead(200, { 'Content-Type': 'application/json' })
              res.end(JSON.stringify([]))
              return
            }

            const teamId = 'c935c1a0-a0fc-41e5-a598-a537fcd344de'
            const url = new URL(req.url!, `http://${req.headers.host}`)
            const days = parseInt(url.searchParams.get('days') || '30', 10)
            const sinceDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

            try {
              const r = await fetch('https://api.linear.app/graphql', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: env.LINEAR_API_KEY },
                body: JSON.stringify({
                  query: `query { team(id: "${teamId}") { issues(filter: { completedAt: { gte: "${sinceDate}" }, state: { type: { eq: "completed" } } }, first: 50, orderBy: updatedAt) { nodes { id title url completedAt project { name } labels { nodes { name } } } } } }`,
                }),
              })
              const json = await r.json()
              const items = json.data.team.issues.nodes.map((i: any) => {
                const labels = i.labels?.nodes || []
                const names = labels.map((l: any) => l.name.toLowerCase())
                let type = 'campaign'
                if (names.some((n: string) => n.includes('event'))) type = 'event'
                else if (names.some((n: string) => n.includes('content'))) type = 'content'
                else if (names.some((n: string) => n.includes('ops'))) type = 'ops'
                return {
                  id: `linear-${i.id}`, title: i.title, type, source: 'linear',
                  timestamp: i.completedAt,
                  description: i.project ? `Project: ${i.project.name}` : undefined,
                  url: i.url,
                }
              })
              res.writeHead(200, { 'Content-Type': 'application/json' })
              res.end(JSON.stringify(items))
            } catch (e: any) {
              res.writeHead(500, { 'Content-Type': 'application/json' })
              res.end(JSON.stringify({ error: e.message }))
            }
          },
        },
      },
    },
  }
})
