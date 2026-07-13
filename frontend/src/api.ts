const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? ''

export type ApiResponse<T> = {
  code: number
  message: string
  data: T
}

export type UploadFileResponse = {
  id?: string | number
  fileId?: string | number
  name?: string
  filename?: string
  storedName?: string
  originalName?: string
  filePath?: string
  path?: string
  mimeType?: string
  size?: number
  status?: string
  error?: string
}

async function request<T>(path: string, options: RequestInit = {}) {
  const userId = localStorage.getItem('tracemind_user_id') || 'default_user'
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      'X-User-Id': userId,
      ...(options.headers ?? {})
    },
    ...options
  })
  const text = await response.text()
  let payload: ApiResponse<T>

  try {
    payload = text ? (JSON.parse(text) as ApiResponse<T>) : ({ code: response.status, message: response.statusText, data: null as T } as ApiResponse<T>)
  } catch {
    throw new Error(`Request failed: ${path} returned non-JSON response (${response.status})`)
  }

  if (!response.ok || payload.code >= 400) {
    throw new Error(payload.message || `Request failed: ${path}`)
  }

  return payload.data
}

async function uploadRequest<T>(path: string, formData: FormData) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: 'POST',
    body: formData
  })
  const text = await response.text()
  let payload: ApiResponse<T>

  try {
    payload = text ? (JSON.parse(text) as ApiResponse<T>) : ({ code: response.status, message: response.statusText, data: null as T } as ApiResponse<T>)
  } catch {
    throw new Error(`Request failed: ${path} returned non-JSON response (${response.status})`)
  }

  if (!response.ok || payload.code >= 400) {
    throw new Error(payload.message || `Request failed: ${path}`)
  }

  return payload.data
}

export const api = {
  listWorkflows: () => request<any[]>('/api/workflows'),
  listWorkflowHistory: () => request<any[]>('/api/workflows/history'),
  getWorkflow: (id: number) => request<any>(`/api/workflows/${id}`),
  generateWorkflow: (query: string, files?: unknown[], conversationId?: string | null) =>
    request<any>('/api/workflows/generate', {
      method: 'POST',
      body: JSON.stringify({ query, files: files ?? [], conversationId: conversationId ?? undefined })
    }),
  listWorkflowRuns: (workflowId: number) => request<any[]>(`/api/workflows/${workflowId}/runs`),
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
  testWorkflowNode: (workflowId: number, nodeId: string, input: unknown) =>
    request<any>(`/api/workflows/${workflowId}/nodes/${encodeURIComponent(nodeId)}/test`, {
      method: 'POST',
      body: JSON.stringify(input)
    }),
  getRun: (runId: number) => request<any>(`/api/runs/${runId}`),
  getTrace: (runId: number) => request<any[]>(`/api/runs/${runId}/trace`),
  listRunHistory: () => request<any[]>('/api/runs/history'),
  getRunReplay: (runId: number) => request<any>(`/api/runs/${runId}/replay`),
  sendChat: (input: {
    conversationId?: string
    message: string
    mode?: string
    fileIds?: number[]
    files?: any[]
    workflowId?: number | null
    runId?: number | null
  }) =>
    request<any>('/api/chat/send', {
      method: 'POST',
      body: JSON.stringify(input)
    }),
  listConversations: () => request<any[]>('/api/conversations'),
  createConversation: () =>
    request<any>('/api/conversations', {
      method: 'POST',
      body: JSON.stringify({})
    }),
  deleteConversation: (id: string) =>
    request<any>(`/api/conversations/${encodeURIComponent(id)}`, {
      method: 'DELETE'
    }),
  getConversationMessages: (conversationId: string) => request<any[]>(`/api/conversations/${conversationId}/messages`),
  listConversationWorkflows: (conversationId: string) => request<any[]>(`/api/conversations/${conversationId}/workflows`),
  appendConversationMessage: (
    conversationId: string,
    input: { role: 'user' | 'assistant' | 'system'; content: string; metadata?: unknown; model?: string; usage?: unknown; sequence?: number }
  ) =>
    request<any>(`/api/conversations/${encodeURIComponent(conversationId)}/messages`, {
      method: 'POST',
      body: JSON.stringify(input)
    }),
  uploadFile: (file: File) => {
    const formData = new FormData()
    formData.append('file', file)
    return uploadRequest<UploadFileResponse>('/api/files/upload', formData)
  },

  listTools: () => request<any[]>('/api/tools'),
  checkToolName: (name: string) => request<any>(`/api/tools/check-name?name=${encodeURIComponent(name)}`),
  createTool: (input: unknown) =>
    request<any>('/api/tools', {
      method: 'POST',
      body: JSON.stringify(input)
    }),
  updateTool: (id: number | string, input: unknown) =>
    request<any>(`/api/tools/${id}`, {
      method: 'PUT',
      body: JSON.stringify(input)
    }),
  testDraftTool: (input: unknown) =>
    request<any>('/api/tools/test-draft', {
      method: 'POST',
      body: JSON.stringify(input)
    }),
  testTool: (id: number | string, input: unknown) =>
    request<any>(`/api/tools/${id}/test`, {
      method: 'POST',
      body: JSON.stringify({ input })
    }),
  testWebSearch: (query: string) =>
    request<any>('/api/tools/web-search/test', {
      method: 'POST',
      body: JSON.stringify({ query })
    }),
  toggleTool: (id: number) =>
    request<any>(`/api/tools/${id}/toggle`, {
      method: 'PATCH'
    }),

  listMcpServers: () => request<any[]>('/api/mcp-servers'),
  createMcpServer: (input: unknown) =>
    request<any>('/api/mcp-servers', {
      method: 'POST',
      body: JSON.stringify(input)
    }),
  updateMcpServer: (id: number | string, input: unknown) =>
    request<any>(`/api/mcp-servers/${id}`, {
      method: 'PUT',
      body: JSON.stringify(input)
    }),
  toggleMcpServer: (id: number | string) =>
    request<any>(`/api/mcp-servers/${id}/toggle`, {
      method: 'PATCH'
    }),
  testMcpServer: (id: number | string) =>
    request<any>(`/api/mcp-servers/${id}/test`, {
      method: 'POST'
    }),
  syncMcpServerTools: (id: number | string, tools: unknown[] = []) =>
    request<any>(`/api/mcp-servers/${id}/sync-tools`, {
      method: 'POST',
      body: JSON.stringify({ tools })
    }),

  listSecrets: () => request<any[]>('/api/secrets'),
  saveSecret: (input: { name: string; provider?: string; value: string }) =>
    request<any>('/api/secrets', {
      method: 'POST',
      body: JSON.stringify(input)
    }),
  deleteSecret: (name: string) =>
    request<any>(`/api/secrets/${encodeURIComponent(name)}`, {
      method: 'DELETE'
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
  updateKnowledgeBase: (id: number, input: unknown) =>
    request<any>(`/api/knowledge-bases/${id}`, {
      method: 'PUT',
      body: JSON.stringify(input)
    }),
  deleteKnowledgeBase: (id: number) =>
    request<any>(`/api/knowledge-bases/${id}`, {
      method: 'DELETE'
    }),
  importKnowledgeDocumentFromFile: (knowledgeBaseId: number, input: unknown) =>
    request<any>(`/api/knowledge-bases/${knowledgeBaseId}/documents/import-file`, {
      method: 'POST',
      body: JSON.stringify(input)
    }),
  addKnowledgeDocument: (knowledgeBaseId: number, input: unknown) =>
    request<any>(`/api/knowledge-bases/${knowledgeBaseId}/documents`, {
      method: 'POST',
      body: JSON.stringify(input)
    }),
  listKnowledgeDocuments: (knowledgeBaseId: number) =>
    request<any[]>(`/api/knowledge-bases/${knowledgeBaseId}/documents`),
  getKnowledgeDocument: (documentId: number | string) => request<any>(`/api/knowledge-bases/documents/${documentId}`),
  deleteKnowledgeDocument: (documentId: number | string) =>
    request<any>(`/api/knowledge-bases/documents/${documentId}`, {
      method: 'DELETE'
    }),
  searchKnowledgeBase: (id: number, query: string) =>
    request<any>(`/api/knowledge-bases/${id}/search`, {
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
