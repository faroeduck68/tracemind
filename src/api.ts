const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? ''

export type ApiResponse<T> = {
  code: number
  message: string
  data: T
}

async function request<T>(path: string, options: RequestInit = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers ?? {})
    },
    ...options
  })
  const payload = (await response.json()) as ApiResponse<T>

  if (!response.ok || payload.code >= 400) {
    throw new Error(payload.message || `Request failed: ${path}`)
  }

  return payload.data
}

export const api = {
  listWorkflows: () => request<any[]>('/api/workflows'),
  generateWorkflow: (query: string) =>
    request<any>('/api/workflows/generate', {
      method: 'POST',
      body: JSON.stringify({ query })
    }),
  updateWorkflow: (id: number, workflow: unknown) =>
    request<any>(`/api/workflows/${id}`, {
      method: 'PUT',
      body: JSON.stringify(workflow)
    }),
  runWorkflow: (id: number, input: unknown) =>
    request<any>(`/api/workflows/${id}/run`, {
      method: 'POST',
      body: JSON.stringify(input)
    }),
  getTrace: (runId: number) => request<any[]>(`/api/runs/${runId}/trace`),

  listTools: () => request<any[]>('/api/tools'),
  toggleTool: (id: number) =>
    request<any>(`/api/tools/${id}/toggle`, {
      method: 'PATCH'
    }),

  listTemplates: () => request<any[]>('/api/templates'),
  useTemplate: (id: number) =>
    request<any>(`/api/templates/${id}/use`, {
      method: 'POST'
    }),

  listKnowledgeBases: () => request<any[]>('/api/knowledge-bases'),
  createKnowledgeBase: (input: unknown) =>
    request<any>('/api/knowledge-bases', {
      method: 'POST',
      body: JSON.stringify(input)
    }),
  searchKnowledgeBase: (id: number, query: string) =>
    request<any[]>(`/api/knowledge-bases/${id}/search`, {
      method: 'POST',
      body: JSON.stringify({ query, topK: 3 })
    }),

  listMemories: () => request<any[]>('/api/memories'),
  createMemory: (input: unknown) =>
    request<any>('/api/memories', {
      method: 'POST',
      body: JSON.stringify(input)
    }),
  listSettings: () => request<any>('/api/settings'),
  saveSettings: (settings: unknown) =>
    request<any[]>('/api/settings', {
      method: 'PUT',
      body: JSON.stringify(settings)
    })
}
