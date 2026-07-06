<script setup lang="ts">
import { Bell, ChevronDown, FileText, MoreVertical, Plus, Search, Upload } from 'lucide-vue-next'

defineProps<{
  knowledgeSearch: string
  knowledgeStats: any[]
  filteredKnowledgeBases: any[]
  selectedKnowledgeBase?: any
  knowledgeDocuments: any[]
  retrievalSnippets: any[]
}>()

const emit = defineEmits<{
  (event: 'update:knowledgeSearch', value: string): void
  (event: 'createKnowledgeBase'): void
  (event: 'notify', message: string): void
  (event: 'selectKnowledgeBase', kb: any): void
}>()
</script>

<template>
  <main class="knowledge-page">
    <header class="knowledge-header">
      <div class="title-wrap">
        <h1>知识库</h1>
        <span class="online-dot">在线</span>
      </div>
      <div class="knowledge-actions">
        <button class="template-create" @click="emit('createKnowledgeBase')"><Plus :size="17" />新建知识库</button>
        <button @click="emit('notify', '请通过后端文档接口导入后刷新')"><Upload :size="17" />导入文档</button>
        <label><Search :size="16" /><input :value="knowledgeSearch" placeholder="搜索知识库" @input="emit('update:knowledgeSearch', ($event.target as HTMLInputElement).value)" /></label>
        <Bell :size="19" class="muted-icon" />
        <div class="avatar">Z</div>
      </div>
    </header>

    <section class="knowledge-content">
      <div class="knowledge-stats">
        <article v-for="stat in knowledgeStats" :key="stat.label" class="knowledge-stat panel">
          <span :class="['knowledge-stat-icon', stat.tone]"><component :is="stat.icon" :size="25" /></span>
          <div>
            <p>{{ stat.label }}</p>
            <strong>{{ stat.value }} <small>{{ stat.suffix }}</small></strong>
            <em>较昨日 <b>{{ stat.delta }}</b></em>
          </div>
        </article>
      </div>

      <section class="knowledge-main">
        <aside class="kb-list panel">
          <div class="kb-list-head">
            <h3>知识库列表</h3>
            <button>全部状态 <ChevronDown :size="14" /></button>
          </div>
          <article v-for="kb in filteredKnowledgeBases" :key="kb.name" class="kb-item" :class="{ active: kb.active }" @click="emit('selectKnowledgeBase', kb)">
            <span :class="['kb-icon', kb.tone]"><component :is="kb.icon" :size="28" /></span>
            <div>
              <h4>{{ kb.name }} <small>正常</small></h4>
              <p>{{ kb.desc }}</p>
              <div class="kb-meta">
                <span>文档数 {{ kb.docs }}</span>
                <span>向量片段 {{ kb.chunks }}</span>
                <span>更新于 {{ kb.updated }}</span>
                <b>正常</b>
              </div>
            </div>
            <button @click.stop="emit('selectKnowledgeBase', kb)">{{ kb.active ? '进入' : '查看' }}</button>
            <MoreVertical :size="18" />
          </article>
          <div class="kb-pagination">
            <span>共 {{ filteredKnowledgeBases.length }} 条</span>
            <div><button disabled><ChevronDown :size="14" /></button><button class="active">1</button><button>2</button><button><ChevronDown :size="14" /></button><button>10 条/页</button></div>
          </div>
        </aside>

        <section class="kb-detail panel">
          <div class="kb-detail-head">
            <h3>{{ selectedKnowledgeBase?.name }} <span>正常</span></h3>
            <div><button @click="emit('notify', '知识库编辑将在下一版开放')">编辑</button><button><MoreVertical :size="16" /></button></div>
          </div>
          <div class="kb-detail-tabs">
            <button class="active">概览</button>
            <button>文档管理</button>
            <button>检索测试</button>
            <button>设置</button>
          </div>

          <div class="kb-section">
            <h4>基本信息</h4>
            <div class="kb-info-grid">
              <span>知识库名称<b>{{ selectedKnowledgeBase?.name }}</b></span>
              <span>创建时间<b>{{ selectedKnowledgeBase?.createdAt ?? '-' }}</b></span>
              <span>更新时间<b>{{ selectedKnowledgeBase?.updated }}</b></span>
              <span>创建人<b>张晓明</b></span>
            </div>
          </div>

          <div class="kb-section">
            <h4>检索配置</h4>
            <div class="kb-config-row">
              <span>Embedding 模型<b>{{ selectedKnowledgeBase?.embeddingModel ?? '-' }}</b></span>
              <span>Chunk 大小<b>{{ selectedKnowledgeBase?.chunkSize ?? '-' }}</b></span>
              <span>Chunk 重叠<b>{{ selectedKnowledgeBase?.chunkOverlap ?? '-' }}</b></span>
              <span>检索模式<b>{{ selectedKnowledgeBase?.retrievalMode ?? '-' }}</b></span>
              <span>Top K<b>{{ selectedKnowledgeBase?.topK ?? '-' }}</b></span>
            </div>
          </div>

          <div class="kb-bottom-grid">
            <div class="kb-mini-chart">
              <div><h4>检索趋势（近7天）</h4><strong>总检索量 {{ retrievalSnippets.length }} 次</strong></div>
              <svg viewBox="0 0 420 150">
                <polyline points="8,112 70,82 132,62 194,38 256,74 318,34 386,48 414,40" />
                <path d="M8 112 L70 82 L132 62 L194 38 L256 74 L318 34 L386 48 L414 40 L414 142 L8 142 Z" />
              </svg>
            </div>

            <div class="kb-docs-simple">
              <div class="kb-docs-head"><h4>已关联文档（{{ selectedKnowledgeBase?.docs ?? 0 }}）</h4><button @click="emit('notify', '文档列表已是当前页展示')">查看全部</button></div>
              <div v-for="doc in knowledgeDocuments" :key="doc.name" class="kb-doc-row">
                <FileText :size="15" />
                <span>{{ doc.name }}</span>
                <b :class="doc.tone">{{ doc.type }}</b>
                <small>{{ doc.size }}</small>
              </div>
            </div>
          </div>

          <div class="kb-retrieval-simple">
            <div>
              <h4>检索结果</h4>
              <p>当前 Workflow 知识检索节点选择“{{ selectedKnowledgeBase?.name }}”后，可返回以下相关片段。</p>
            </div>
            <article v-for="item in retrievalSnippets" :key="item.title">
              <span>{{ item.title }}</span>
              <p>{{ item.text }}</p>
              <b>相关度 {{ item.score.toFixed(2) }}</b>
            </article>
          </div>
        </section>
      </section>
    </section>
  </main>
</template>
