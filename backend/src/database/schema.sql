-- TraceMind 主数据库：保存工作流、节点、运行记录、Trace、工具、知识库、记忆和设置。
CREATE DATABASE IF NOT EXISTS tracemind CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE tracemind;

CREATE TABLE IF NOT EXISTS tools (
  id BIGINT PRIMARY KEY AUTO_INCREMENT COMMENT '工具主键ID',
  name VARCHAR(100) NOT NULL UNIQUE COMMENT '工具唯一名称，后端 Tool Registry 使用',
  display_name VARCHAR(100) NOT NULL COMMENT '工具展示名称，前端工具库显示使用',
  version VARCHAR(50) DEFAULT 'v1.0.0' COMMENT '工具版本号',
  category VARCHAR(50) COMMENT '工具分类，如输入、数据处理、数据分析、内容生成',
  description TEXT COMMENT '工具能力描述',
  enabled TINYINT DEFAULT 1 COMMENT '是否启用：1启用，0禁用',
  success_rate DECIMAL(5,2) DEFAULT 0 COMMENT '历史成功率，百分比数值',
  avg_latency_ms INT DEFAULT 0 COMMENT '平均调用耗时，单位毫秒',
  call_count INT DEFAULT 0 COMMENT '累计调用次数',
  config_schema JSON COMMENT '工具配置 JSON Schema',
  input_schema JSON COMMENT '工具输入 JSON Schema',
  output_schema JSON COMMENT '工具输出 JSON Schema',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='工具库表，记录可被工作流节点调用的工具';

CREATE TABLE IF NOT EXISTS workflows (
  id BIGINT PRIMARY KEY AUTO_INCREMENT COMMENT '工作流主键ID',
  name VARCHAR(200) NOT NULL COMMENT '工作流名称',
  description TEXT COMMENT '工作流描述',
  source_type VARCHAR(50) DEFAULT 'manual' COMMENT '来源类型：manual手动创建，generated自然语言生成，template模板创建',
  original_query TEXT COMMENT '生成工作流时的原始自然语言需求',
  intent VARCHAR(100) COMMENT '识别出的任务意图',
  confidence DECIMAL(5,4) COMMENT '工作流生成或意图识别置信度',
  status VARCHAR(30) DEFAULT 'draft' COMMENT '工作流状态：draft草稿，active启用，archived归档等',
  workflow_json JSON COMMENT '完整工作流 JSON，适配前端节点和连线结构',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='工作流主表，保存工作流基础信息和完整图结构';

CREATE TABLE IF NOT EXISTS workflow_nodes (
  id BIGINT PRIMARY KEY AUTO_INCREMENT COMMENT '节点记录主键ID',
  workflow_id BIGINT NOT NULL COMMENT '所属工作流ID',
  node_key VARCHAR(100) NOT NULL COMMENT '节点业务ID，对应前端 WorkflowNode.id',
  node_type VARCHAR(100) NOT NULL COMMENT '节点类型，对应前端 WorkflowNode.type',
  label VARCHAR(100) COMMENT '节点标题',
  sub_label VARCHAR(200) COMMENT '节点副标题',
  icon VARCHAR(100) COMMENT '前端图标名称',
  x INT DEFAULT 0 COMMENT '节点画布横坐标',
  y INT DEFAULT 0 COMMENT '节点画布纵坐标',
  status VARCHAR(30) DEFAULT 'idle' COMMENT '节点状态：idle、running、success、failed、skipped',
  tone VARCHAR(30) COMMENT '节点视觉色调，如 green、blue、violet、amber、cyan',
  tool_name VARCHAR(100) COMMENT '节点绑定工具名称，对应 tools.name 和 Tool Registry key',
  confidence DECIMAL(5,4) COMMENT '节点生成或工具选择置信度',
  reason TEXT COMMENT '生成该节点或选择该工具的解释原因',
  config JSON COMMENT '节点运行配置',
  input_schema JSON COMMENT '节点输入 Schema',
  output_schema JSON COMMENT '节点输出 Schema',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',

  UNIQUE KEY uq_workflow_node_key (workflow_id, node_key),
  INDEX idx_workflow_nodes_workflow_id (workflow_id),
  CONSTRAINT fk_workflow_nodes_workflow
    FOREIGN KEY (workflow_id) REFERENCES workflows(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='工作流节点表，拆分保存前端节点以便后端执行';

CREATE TABLE IF NOT EXISTS workflow_edges (
  id BIGINT PRIMARY KEY AUTO_INCREMENT COMMENT '连线记录主键ID',
  workflow_id BIGINT NOT NULL COMMENT '所属工作流ID',
  edge_key VARCHAR(100) COMMENT '连线业务ID，对应前端 WorkflowEdge.id',
  source_node_key VARCHAR(100) NOT NULL COMMENT '源节点业务ID，对应 WorkflowEdge.source',
  target_node_key VARCHAR(100) NOT NULL COMMENT '目标节点业务ID，对应 WorkflowEdge.target',
  branch VARCHAR(50) DEFAULT 'main' COMMENT '分支类型：main主路径，alt备选路径',
  condition_expr TEXT COMMENT '条件表达式，第一版可为空',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',

  INDEX idx_workflow_edges_workflow_id (workflow_id),
  CONSTRAINT fk_workflow_edges_workflow
    FOREIGN KEY (workflow_id) REFERENCES workflows(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='工作流连线表，描述节点之间的有向依赖关系';

CREATE TABLE IF NOT EXISTS workflow_runs (
  id BIGINT PRIMARY KEY AUTO_INCREMENT COMMENT '运行记录主键ID',
  workflow_id BIGINT NOT NULL COMMENT '被运行的工作流ID',
  status VARCHAR(30) DEFAULT 'running' COMMENT '运行状态：running、success、failed',
  input_data JSON COMMENT '本次运行输入数据，如 query、files 等',
  output_data JSON COMMENT '本次运行最终输出数据',
  total_latency_ms INT DEFAULT 0 COMMENT '总运行耗时，单位毫秒',
  total_tokens INT DEFAULT 0 COMMENT 'Token 消耗量，第一版可为0',
  error_message TEXT COMMENT '运行失败时的错误信息',
  failure_analysis JSON COMMENT '运行失败时的失败分析结果',
  started_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '开始运行时间',
  finished_at DATETIME NULL COMMENT '结束运行时间',

  INDEX idx_workflow_runs_workflow_id (workflow_id),
  CONSTRAINT fk_workflow_runs_workflow
    FOREIGN KEY (workflow_id) REFERENCES workflows(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='工作流运行记录表，每次点击运行生成一条记录';

CREATE TABLE IF NOT EXISTS trace_steps (
  id BIGINT PRIMARY KEY AUTO_INCREMENT COMMENT 'Trace步骤主键ID',
  run_id BIGINT NOT NULL COMMENT '所属运行记录ID',
  workflow_id BIGINT NOT NULL COMMENT '所属工作流ID',
  node_key VARCHAR(100) COMMENT '对应节点业务ID',
  step_name VARCHAR(100) NOT NULL COMMENT '步骤名称，前端 TraceStep.stepName 使用',
  step_type VARCHAR(100) COMMENT '步骤类型，通常对应节点类型',
  status VARCHAR(30) DEFAULT 'running' COMMENT '步骤状态：running、success、failed、skipped',
  tool_name VARCHAR(100) COMMENT '本步骤调用的工具名称',
  reason TEXT COMMENT '步骤执行或工具选择原因',
  confidence DECIMAL(5,4) COMMENT '步骤置信度',
  input_data JSON COMMENT '步骤输入数据',
  output_data JSON COMMENT '步骤输出数据',
  error_message TEXT COMMENT '步骤失败时的错误信息',
  latency_ms INT COMMENT '步骤耗时，单位毫秒',
  started_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '步骤开始时间',
  finished_at DATETIME NULL COMMENT '步骤结束时间',

  INDEX idx_trace_steps_run_id (run_id),
  INDEX idx_trace_steps_workflow_id (workflow_id),
  CONSTRAINT fk_trace_steps_run
    FOREIGN KEY (run_id) REFERENCES workflow_runs(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_trace_steps_workflow
    FOREIGN KEY (workflow_id) REFERENCES workflows(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='执行轨迹步骤表，记录工作流运行时每个节点的执行过程';

CREATE TABLE IF NOT EXISTS tool_ranking_logs (
  id BIGINT PRIMARY KEY AUTO_INCREMENT COMMENT '工具评分日志主键ID',
  run_id BIGINT NOT NULL COMMENT '所属运行记录ID',
  node_key VARCHAR(100) COMMENT '对应节点业务ID',
  tool_name VARCHAR(100) NOT NULL COMMENT '候选工具名称',
  keyword_score DECIMAL(5,4) DEFAULT 0 COMMENT '关键词匹配分数',
  semantic_score DECIMAL(5,4) DEFAULT 0 COMMENT '语义匹配分数，第一版为模拟值',
  history_score DECIMAL(5,4) DEFAULT 0 COMMENT '历史表现分数，第一版为模拟值',
  preference_score DECIMAL(5,4) DEFAULT 0 COMMENT '用户偏好分数，第一版为模拟值',
  final_score DECIMAL(5,4) NOT NULL COMMENT '最终综合评分',
  selected TINYINT DEFAULT 0 COMMENT '是否被选中：1选中，0未选中',
  reason TEXT COMMENT '评分或选择原因',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',

  INDEX idx_tool_ranking_logs_run_id (run_id),
  CONSTRAINT fk_tool_ranking_logs_run
    FOREIGN KEY (run_id) REFERENCES workflow_runs(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='工具候选评分日志表，记录每个节点的工具排序依据';

CREATE TABLE IF NOT EXISTS tool_call_logs (
  id BIGINT PRIMARY KEY AUTO_INCREMENT COMMENT '工具调用日志主键ID',
  run_id BIGINT COMMENT '所属运行记录ID，可为空',
  node_key VARCHAR(100) COMMENT '调用工具的节点业务ID',
  tool_name VARCHAR(100) NOT NULL COMMENT '被调用工具名称',
  input_data JSON COMMENT '工具调用输入',
  output_data JSON COMMENT '工具调用输出',
  status VARCHAR(30) DEFAULT 'running' COMMENT '调用状态：running、success、failed',
  error_message TEXT COMMENT '调用失败时的错误信息',
  latency_ms INT COMMENT '工具调用耗时，单位毫秒',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',

  INDEX idx_tool_call_logs_run_id (run_id),
  CONSTRAINT fk_tool_call_logs_run
    FOREIGN KEY (run_id) REFERENCES workflow_runs(id)
    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='工具调用日志表，记录每次工具真实调用过程';

CREATE TABLE IF NOT EXISTS workflow_templates (
  id BIGINT PRIMARY KEY AUTO_INCREMENT COMMENT '模板主键ID',
  title VARCHAR(200) NOT NULL COMMENT '模板标题',
  description TEXT COMMENT '模板描述',
  category VARCHAR(100) COMMENT '模板分类',
  badge VARCHAR(50) COMMENT '模板徽标，如 official、popular',
  is_official TINYINT DEFAULT 0 COMMENT '是否官方模板：1是，0否',
  workflow_json JSON NOT NULL COMMENT '模板工作流 JSON',
  view_count INT DEFAULT 0 COMMENT '查看次数',
  like_count INT DEFAULT 0 COMMENT '点赞次数',
  use_count INT DEFAULT 0 COMMENT '使用次数',
  starred_count INT DEFAULT 0 COMMENT '收藏次数',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='工作流模板表，保存可复用的工作流模板';

CREATE TABLE IF NOT EXISTS knowledge_bases (
  id BIGINT PRIMARY KEY AUTO_INCREMENT COMMENT '知识库主键ID',
  name VARCHAR(200) NOT NULL COMMENT '知识库名称',
  description TEXT COMMENT '知识库描述',
  embedding_model VARCHAR(100) COMMENT '向量模型名称，第一版可为 mock',
  chunk_size INT DEFAULT 800 COMMENT '文档切片大小',
  chunk_overlap INT DEFAULT 120 COMMENT '文档切片重叠长度',
  retrieval_mode VARCHAR(50) DEFAULT 'hybrid' COMMENT '检索模式：keyword、vector、hybrid',
  top_k INT DEFAULT 5 COMMENT '默认召回数量',
  document_count INT DEFAULT 0 COMMENT '文档数量',
  chunk_count INT DEFAULT 0 COMMENT '切片数量',
  status VARCHAR(30) DEFAULT 'normal' COMMENT '知识库状态：normal、indexing、disabled',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='知识库表，保存知识库配置和统计信息';

CREATE TABLE IF NOT EXISTS knowledge_documents (
  id BIGINT PRIMARY KEY AUTO_INCREMENT COMMENT '知识文档主键ID',
  knowledge_base_id BIGINT NOT NULL COMMENT '所属知识库ID',
  filename VARCHAR(255) NOT NULL COMMENT '文件名',
  file_type VARCHAR(50) COMMENT '文件类型或 MIME 类型',
  file_size BIGINT COMMENT '文件大小，单位字节',
  file_path VARCHAR(500) COMMENT '文件存储路径',
  parse_status VARCHAR(30) DEFAULT 'pending' COMMENT '解析状态：pending、parsed、failed',
  chunk_count INT DEFAULT 0 COMMENT '该文档切片数量',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',

  INDEX idx_knowledge_documents_base_id (knowledge_base_id),
  CONSTRAINT fk_knowledge_documents_base
    FOREIGN KEY (knowledge_base_id) REFERENCES knowledge_bases(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='知识库文档表，记录上传或导入的原始文档';

CREATE TABLE IF NOT EXISTS knowledge_chunks (
  id BIGINT PRIMARY KEY AUTO_INCREMENT COMMENT '知识切片主键ID',
  knowledge_base_id BIGINT NOT NULL COMMENT '所属知识库ID',
  document_id BIGINT NOT NULL COMMENT '所属文档ID',
  chunk_index INT NOT NULL COMMENT '切片序号，从0开始',
  content TEXT NOT NULL COMMENT '切片文本内容',
  token_count INT DEFAULT 0 COMMENT '切片 Token 数量或近似字符统计',
  embedding_id VARCHAR(100) COMMENT '向量存储ID，第一版可为空',
  metadata JSON COMMENT '切片元数据，如来源页码、标题等',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',

  INDEX idx_knowledge_chunks_base_id (knowledge_base_id),
  INDEX idx_knowledge_chunks_document_id (document_id),
  CONSTRAINT fk_knowledge_chunks_base
    FOREIGN KEY (knowledge_base_id) REFERENCES knowledge_bases(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_knowledge_chunks_document
    FOREIGN KEY (document_id) REFERENCES knowledge_documents(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='知识切片表，保存文档解析后的可检索文本片段';

CREATE TABLE IF NOT EXISTS memories (
  id BIGINT PRIMARY KEY AUTO_INCREMENT COMMENT '记忆主键ID',
  memory_type VARCHAR(50) NOT NULL COMMENT '记忆类型，如 preference、task_history、tool_preference',
  title VARCHAR(200) NOT NULL COMMENT '记忆标题',
  content TEXT NOT NULL COMMENT '记忆内容',
  importance VARCHAR(20) DEFAULT 'medium' COMMENT '重要性等级：low、medium、high',
  importance_score INT DEFAULT 3 COMMENT '重要性分值，通常1到5',
  source_type VARCHAR(50) COMMENT '记忆来源类型，如 seed、workflow、manual',
  source_id BIGINT NULL COMMENT '来源业务ID',
  enabled TINYINT DEFAULT 1 COMMENT '是否启用：1启用，0禁用',
  last_used_at DATETIME NULL COMMENT '最近使用时间',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='长期记忆表，保存用户偏好、历史任务和工具偏好';

CREATE TABLE IF NOT EXISTS memory_usage_logs (
  id BIGINT PRIMARY KEY AUTO_INCREMENT COMMENT '记忆使用日志主键ID',
  memory_id BIGINT NOT NULL COMMENT '被使用的记忆ID',
  run_id BIGINT NULL COMMENT '关联运行记录ID',
  workflow_id BIGINT NULL COMMENT '关联工作流ID',
  usage_type VARCHAR(50) COMMENT '使用类型，如 workflow_generate、workflow_run',
  reason TEXT COMMENT '使用该记忆的原因',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',

  INDEX idx_memory_usage_logs_memory_id (memory_id),
  CONSTRAINT fk_memory_usage_logs_memory
    FOREIGN KEY (memory_id) REFERENCES memories(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_memory_usage_logs_run
    FOREIGN KEY (run_id) REFERENCES workflow_runs(id)
    ON DELETE SET NULL,
  CONSTRAINT fk_memory_usage_logs_workflow
    FOREIGN KEY (workflow_id) REFERENCES workflows(id)
    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='记忆使用日志表，记录记忆被工作流生成或运行引用的过程';

CREATE TABLE IF NOT EXISTS user_settings (
  id BIGINT PRIMARY KEY AUTO_INCREMENT COMMENT '设置主键ID，第一版固定使用1',
  language VARCHAR(50) DEFAULT 'zh-CN' COMMENT '界面语言',
  default_model VARCHAR(100) COMMENT '默认模型名称',
  theme VARCHAR(50) DEFAULT 'system' COMMENT '主题设置：light、dark、system',
  auto_save TINYINT DEFAULT 1 COMMENT '是否自动保存：1启用，0禁用',
  auto_save_interval INT DEFAULT 5 COMMENT '自动保存间隔，单位分钟',
  webhook_url VARCHAR(500) COMMENT 'Webhook 回调地址',
  settings_json JSON COMMENT '扩展设置 JSON',
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户设置表，第一版保存单用户全局设置';
