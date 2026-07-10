export type NodeStatus =
  | 'idle'
  | 'queued'
  | 'running'
  | 'success'
  | 'partial_success'
  | 'failed'
  | 'skipped'
  | 'waiting_approval'
  | 'permission_denied'
  | 'cancelled'

export type JsonRecord = Record<string, unknown>
