#!/usr/bin/env node

// Safe smoke test: creates one uniquely named task, reads it, updates it,
// moves it to done, archives it, and deletes only that exact record.
const baseUrl = process.env.BPE_AGENT_API_BASE_URL?.replace(/\/$/, '')
const apiKey = process.env.BPE_WENDY_AGENT_API_KEY || process.env.BPE_ELLIE_AGENT_API_KEY
if (!baseUrl || !apiKey) {
  console.error('Set BPE_AGENT_API_BASE_URL and one agent API key before running this smoke test.')
  process.exit(1)
}

async function request(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  })
  if (!response.ok) throw new Error(`${options.method ?? 'GET'} ${path} failed (${response.status}): ${await response.text()}`)
  return response.status === 204 ? null : response.json()
}

let taskId
try {
  const created = await request('/api/agent/tasks', {
    method: 'POST', body: JSON.stringify({ title: `Agent API smoke test ${new Date().toISOString()}`, status: 'idea', notes: 'Created by safe integration smoke test.' }),
  })
  taskId = created.task.id
  await request(`/api/agent/tasks/${taskId}`)
  await request(`/api/agent/tasks/${taskId}`, { method: 'PATCH', body: JSON.stringify({ notes: 'Updated by safe integration smoke test.', priority: 'low' }) })
  await request(`/api/agent/tasks/${taskId}`, { method: 'PATCH', body: JSON.stringify({ status: 'done' }) })
  await request(`/api/agent/tasks/${taskId}`, { method: 'PATCH', body: JSON.stringify({ archive: true }) })
  await request(`/api/agent/tasks/${taskId}`, { method: 'DELETE' })
  console.log('Agent task API smoke test passed.')
} finally {
  if (taskId) {
    try { await request(`/api/agent/tasks/${taskId}`, { method: 'DELETE' }) } catch { /* cleanup is best effort */ }
  }
}
