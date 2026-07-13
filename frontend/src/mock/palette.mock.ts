import type { PaletteNode } from '../types'

export const paletteNodes: PaletteNode[] = [
  { type: 'llm', label: '大语言模型', desc: '调用大语言模型', icon: 'BrainCircuit', category: '常用节点', tone: 'violet' },
  { type: 'search', label: '知识检索', desc: '从知识库检索信息', icon: 'Search', category: '常用节点', tone: 'cyan' },
  { type: 'code', label: '代码执行', desc: '执行 Python 代码', icon: 'TerminalSquare', category: '常用节点', tone: 'green' },
  { type: 'condition', label: '条件判断', desc: '根据条件分支', icon: 'GitBranch', category: '常用节点', tone: 'amber' },
  { type: 'transform', label: '数据处理', desc: '处理和转换数据', icon: 'Shuffle', category: '常用节点', tone: 'blue' },
  { type: 'file', label: '文件读取', desc: '读取文件内容', icon: 'FileText', category: '常用节点', tone: 'violet' },
  { type: 'http', label: 'HTTP 请求', desc: '发送 HTTP 请求', icon: 'CloudCog', category: '常用节点', tone: 'blue' },
  { type: 'output', label: '结果输出', desc: '输出最终结果', icon: 'Send', category: '常用节点', tone: 'violet' }
]
