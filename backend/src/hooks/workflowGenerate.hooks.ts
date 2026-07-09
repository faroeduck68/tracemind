import type { WorkflowGraph, WorkflowNode } from '../types/workflow'
import type { HookContext, HookResult } from './hookTypes'

export function cleanWorkflowJsonHook(ctx: HookContext): HookResult | void {
  const graph = ctx.input as WorkflowGraph | undefined
  if (!graph || !Array.isArray(graph.nodes) || !Array.isArray(graph.edges)) return

  const nodes = graph.nodes.map((node) => ({
    ...node,
    status: node.status ?? 'idle',
    tone: node.tone ?? 'blue',
    confidence: Number(node.confidence ?? 0)
  }))

  return {
    outcome: 'success',
    updatedInput: {
      ...graph,
      status: graph.status ?? 'draft',
      nodes
    }
  }
}

export function fillNodePositionHook(ctx: HookContext): HookResult | void {
  const graph = ctx.input as WorkflowGraph | undefined
  if (!graph || !Array.isArray(graph.nodes)) return

  let changed = false
  const nodes = graph.nodes.map((node, index) => {
    if (hasPosition(node)) return node
    changed = true
    return {
      ...node,
      position: {
        x: 80 + (index % 4) * 180,
        y: 160 + Math.floor(index / 4) * 180
      }
    }
  })

  if (!changed) return { outcome: 'success' }

  return {
    outcome: 'success',
    updatedInput: {
      ...graph,
      nodes
    }
  }
}

function hasPosition(node: WorkflowNode) {
  return Number.isFinite(node.position?.x) && Number.isFinite(node.position?.y)
}
