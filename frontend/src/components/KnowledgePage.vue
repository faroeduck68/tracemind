<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { Database, FileText, Pencil, Plus, Search, Trash2, Upload, X } from 'lucide-vue-next'
import PaginationBar from './PaginationBar.vue'
import { usePagination } from '../composables/usePagination'

const props = defineProps<{
  knowledgeSearch: string
  knowledgeStats: any[]
  filteredKnowledgeBases: any[]
  selectedKnowledgeBase?: any
  knowledgeDocuments: any[]
  retrievalSnippets: any[]
  importingKnowledge?: boolean
}>()

const emit = defineEmits<{
  (event: 'update:knowledgeSearch', value: string): void
  (event: 'createKnowledgeBase', input: Record<string, unknown>): void
  (event: 'updateKnowledgeBase', payload: { id: number; input: Record<string, unknown> }): void
  (event: 'deleteKnowledgeBase', kb: any): void
  (event: 'deleteKnowledgeDocument', doc: any): void
  (event: 'selectKnowledgeBase', kb: any): void
  (event: 'importKnowledgeFiles', files: FileList): void
  (event: 'searchKnowledge', query: string): void
}>()

type DetailTab = 'overview' | 'documents' | 'retrieval' | 'settings'
type EditorMode = 'create' | 'edit'

const activeTab = ref<DetailTab>('overview')
const retrievalQuery = ref('')
const editorOpen = ref(false)
const editorMode = ref<EditorMode>('create')
const confirmTarget = ref<{ type: 'knowledge-base' | 'document'; item: any } | null>(null)
const form = reactive({
  name: '',
  description: '',
  chunkSize: 800,
  chunkOverlap: 120,
  topK: 5
})

const editorTitle = computed(() => editorMode.value === 'create' ? '新建知识库' : '编辑知识库')
const canSubmit = computed(() => form.name.trim().length > 0 && form.chunkSize >= 300 && form.chunkOverlap >= 0 && form.chunkOverlap < form.chunkSize && form.topK >= 1)
const knowledgeBaseSource = computed(() => props.filteredKnowledgeBases)
const documentSource = computed(() => props.knowledgeDocuments)
const {
  page: knowledgeBasePage,
  pageSize: knowledgeBasePageSize,
  total: knowledgeBaseTotal,
  paginatedItems: paginatedKnowledgeBases,
  setPage: setKnowledgeBasePage,
  setPageSize: setKnowledgeBasePageSize,
  resetPage: resetKnowledgeBasePage
} = usePagination(knowledgeBaseSource, 5)
const {
  page: documentPage,
  pageSize: documentPageSize,
  total: documentTotal,
  paginatedItems: paginatedDocuments,
  setPage: setDocumentPage,
  setPageSize: setDocumentPageSize,
  resetPage: resetDocumentPage
} = usePagination(documentSource, 5)

watch(() => props.knowledgeSearch, resetKnowledgeBasePage)

watch(() => props.selectedKnowledgeBase?.id, () => {
  activeTab.value = 'overview'
  retrievalQuery.value = ''
  resetDocumentPage()
})

function handleImport(event: Event) {
  const input = event.target as HTMLInputElement
  if (input.files?.length) emit('importKnowledgeFiles', input.files)
  input.value = ''
}

function openCreateEditor() {
  editorMode.value = 'create'
  Object.assign(form, { name: '', description: '', chunkSize: 800, chunkOverlap: 120, topK: 5 })
  editorOpen.value = true
}

function openEditEditor() {
  const kb = props.selectedKnowledgeBase
  if (!kb) return
  editorMode.value = 'edit'
  Object.assign(form, {
    name: kb.name ?? '',
    description: kb.desc === '暂无描述' ? '' : kb.desc ?? '',
    chunkSize: Number(kb.chunkSize ?? 800),
    chunkOverlap: Number(kb.chunkOverlap ?? 120),
    topK: Number(kb.topK ?? 5)
  })
  editorOpen.value = true
}

function submitEditor() {
  if (!canSubmit.value) return
  const input = {
    name: form.name.trim(),
    description: form.description.trim(),
    embeddingModel: 'local-keyword-v1',
    chunkSize: Number(form.chunkSize),
    chunkOverlap: Number(form.chunkOverlap),
    retrievalMode: 'keyword',
    topK: Number(form.topK)
  }

  if (editorMode.value === 'create') {
    emit('createKnowledgeBase', input)
  } else if (props.selectedKnowledgeBase?.id) {
    emit('updateKnowledgeBase', { id: Number(props.selectedKnowledgeBase.id), input })
  }
  editorOpen.value = false
}

function requestDeleteKnowledgeBase(kb: any) {
  confirmTarget.value = { type: 'knowledge-base', item: kb }
}

function requestDeleteDocument(doc: any) {
  confirmTarget.value = { type: 'document', item: doc }
}

function confirmDelete() {
  if (!confirmTarget.value) return
  const { type, item } = confirmTarget.value
  if (type === 'knowledge-base') emit('deleteKnowledgeBase', item)
  else emit('deleteKnowledgeDocument', item)
  confirmTarget.value = null
}

function runSearch() {
  emit('searchKnowledge', retrievalQuery.value.trim())
}

function statusLabel(status?: string) {
  if (status === 'disabled') return '已停用'
  if (status === 'indexing') return '处理中'
  return '正常'
}
</script>

<template>
  <main class="knowledge-page">
    <header class="knowledge-header">
      <div class="title-wrap">
        <h1>知识库</h1>
        <span class="online-dot">已连接</span>
      </div>
      <div class="knowledge-actions">
        <button class="template-create" @click="openCreateEditor"><Plus :size="17" />新建知识库</button>
        <label class="knowledge-import" :class="{ importing: importingKnowledge }">
          <Upload :size="17" />{{ importingKnowledge ? '导入中' : '导入文档' }}
          <input type="file" multiple accept=".pdf,.txt,.md,.markdown,.csv" :disabled="importingKnowledge" @change="handleImport" />
        </label>
        <label><Search :size="16" /><input :value="knowledgeSearch" placeholder="搜索知识库" @input="emit('update:knowledgeSearch', ($event.target as HTMLInputElement).value)" /></label>
      </div>
    </header>

    <section class="knowledge-content">
      <div class="knowledge-stats">
        <article v-for="stat in knowledgeStats" :key="stat.label" class="knowledge-stat panel">
          <span :class="['knowledge-stat-icon', stat.tone]"><component :is="stat.icon" :size="25" /></span>
          <div>
            <p>{{ stat.label }}</p>
            <strong>{{ stat.value }} <small>{{ stat.suffix }}</small></strong>
          </div>
        </article>
      </div>

      <section class="knowledge-main">
        <aside class="kb-list panel">
          <div class="kb-list-head">
            <h3>知识库列表</h3>
            <span>{{ filteredKnowledgeBases.length }} 个</span>
          </div>

          <article v-for="kb in paginatedKnowledgeBases" :key="kb.id" class="kb-item" :class="{ active: kb.active }" @click="emit('selectKnowledgeBase', kb)">
            <span :class="['kb-icon', kb.tone]"><component :is="kb.icon" :size="26" /></span>
            <div>
              <h4>{{ kb.name }} <small>{{ statusLabel(kb.status) }}</small></h4>
              <p>{{ kb.desc }}</p>
              <div class="kb-meta">
                <span>文档 {{ kb.docs }}</span>
                <span>片段 {{ kb.chunks }}</span>
                <span>更新于 {{ kb.updated }}</span>
              </div>
            </div>
            <button @click.stop="emit('selectKnowledgeBase', kb)">{{ kb.active ? '当前' : '查看' }}</button>
            <button class="kb-icon-button danger" title="删除知识库" aria-label="删除知识库" @click.stop="requestDeleteKnowledgeBase(kb)"><Trash2 :size="16" /></button>
          </article>

          <p v-if="filteredKnowledgeBases.length === 0" class="kb-empty">没有匹配的知识库</p>
          <PaginationBar
            :page="knowledgeBasePage"
            :page-size="knowledgeBasePageSize"
            :total="knowledgeBaseTotal"
            item-label="个知识库"
            @update:page="setKnowledgeBasePage"
            @update:page-size="setKnowledgeBasePageSize"
          />
        </aside>

        <section class="kb-detail panel">
          <template v-if="selectedKnowledgeBase">
            <div class="kb-detail-head">
              <h3>{{ selectedKnowledgeBase.name }} <span>{{ statusLabel(selectedKnowledgeBase.status) }}</span></h3>
              <div>
                <button @click="openEditEditor"><Pencil :size="15" />编辑</button>
                <button class="danger" title="删除知识库" @click="requestDeleteKnowledgeBase(selectedKnowledgeBase)"><Trash2 :size="15" />删除</button>
              </div>
            </div>

            <div class="kb-detail-tabs">
              <button :class="{ active: activeTab === 'overview' }" @click="activeTab = 'overview'">概览</button>
              <button :class="{ active: activeTab === 'documents' }" @click="activeTab = 'documents'">文档管理</button>
              <button :class="{ active: activeTab === 'retrieval' }" @click="activeTab = 'retrieval'">检索测试</button>
              <button :class="{ active: activeTab === 'settings' }" @click="activeTab = 'settings'">设置</button>
            </div>

            <template v-if="activeTab === 'overview'">
              <div class="kb-section">
                <h4>基本信息</h4>
                <div class="kb-info-grid">
                  <span>知识库名称<b>{{ selectedKnowledgeBase.name }}</b></span>
                  <span>创建时间<b>{{ selectedKnowledgeBase.createdAt ?? '-' }}</b></span>
                  <span>更新时间<b>{{ selectedKnowledgeBase.updated }}</b></span>
                  <span>所有者<b>{{ selectedKnowledgeBase.ownerUserId ?? '-' }}</b></span>
                </div>
              </div>

              <div class="kb-section">
                <h4>检索配置</h4>
                <div class="kb-config-row">
                  <span>检索引擎<b>{{ selectedKnowledgeBase.embeddingModel }}</b></span>
                  <span>Chunk 大小<b>{{ selectedKnowledgeBase.chunkSize }}</b></span>
                  <span>Chunk 重叠<b>{{ selectedKnowledgeBase.chunkOverlap }}</b></span>
                  <span>检索模式<b>{{ selectedKnowledgeBase.retrievalMode }}</b></span>
                  <span>Top K<b>{{ selectedKnowledgeBase.topK }}</b></span>
                </div>
              </div>

              <div class="kb-overview-grid">
                <div class="kb-data-summary">
                  <h4>数据状态</h4>
                  <div><Database :size="18" /><span>文档数量</span><b>{{ selectedKnowledgeBase.docs }}</b></div>
                  <div><FileText :size="18" /><span>切片数量</span><b>{{ selectedKnowledgeBase.chunks }}</b></div>
                </div>
                <div class="kb-docs-simple">
                  <div class="kb-docs-head"><h4>最近文档</h4><button @click="activeTab = 'documents'">文档管理</button></div>
                  <div v-for="doc in knowledgeDocuments.slice(0, 4)" :key="doc.id" class="kb-doc-row">
                    <FileText :size="15" /><span>{{ doc.name }}</span><b :class="doc.tone">{{ doc.type }}</b><small>{{ doc.size }}</small>
                  </div>
                  <p v-if="knowledgeDocuments.length === 0" class="kb-empty">当前知识库暂无文档</p>
                </div>
              </div>
            </template>

            <section v-else-if="activeTab === 'documents'" class="kb-tab-panel">
              <div class="kb-tab-head">
                <div><h4>文档管理</h4><p>共 {{ knowledgeDocuments.length }} 个文档，删除文档会同时删除对应切片。</p></div>
                <label class="knowledge-import compact" :class="{ importing: importingKnowledge }">
                  <Upload :size="15" />{{ importingKnowledge ? '导入中' : '导入文档' }}
                  <input type="file" multiple accept=".pdf,.txt,.md,.markdown,.csv" :disabled="importingKnowledge" @change="handleImport" />
                </label>
              </div>
              <div v-for="doc in paginatedDocuments" :key="doc.id" class="kb-document-item">
                <FileText :size="18" />
                <div><strong>{{ doc.name }}</strong><small>{{ doc.createdAt }}</small></div>
                <span>{{ doc.type }}</span><span>{{ doc.size }}</span>
                <button title="删除文档" aria-label="删除文档" @click="requestDeleteDocument(doc)"><Trash2 :size="16" /></button>
              </div>
              <p v-if="knowledgeDocuments.length === 0" class="kb-empty">当前知识库暂无文档，请先导入文档</p>
              <PaginationBar
                v-if="knowledgeDocuments.length > 0"
                :page="documentPage"
                :page-size="documentPageSize"
                :total="documentTotal"
                item-label="个文档"
                @update:page="setDocumentPage"
                @update:page-size="setDocumentPageSize"
              />
            </section>

            <section v-else-if="activeTab === 'retrieval'" class="kb-tab-panel">
              <div class="kb-search-form">
                <label><Search :size="16" /><input v-model.trim="retrievalQuery" placeholder="输入要检索的关键词" @keyup.enter="runSearch" /></label>
                <button :disabled="!retrievalQuery" @click="runSearch"><Search :size="15" />检索</button>
              </div>
              <div class="kb-retrieval-simple tab-results">
                <article v-for="item in retrievalSnippets" :key="`${item.title}-${item.text}`">
                  <span>{{ item.title }}</span><p>{{ item.text }}</p><b>相关度 {{ item.score.toFixed(2) }}</b>
                </article>
                <p v-if="retrievalSnippets.length === 0" class="kb-empty">暂无检索结果</p>
              </div>
            </section>

            <section v-else class="kb-tab-panel kb-settings-panel">
              <div><h4>知识库设置</h4><p>Chunk 配置只影响之后导入的新文档。</p></div>
              <dl>
                <div><dt>名称</dt><dd>{{ selectedKnowledgeBase.name }}</dd></div>
                <div><dt>描述</dt><dd>{{ selectedKnowledgeBase.desc }}</dd></div>
                <div><dt>检索模式</dt><dd>关键词检索</dd></div>
                <div><dt>切片配置</dt><dd>{{ selectedKnowledgeBase.chunkSize }} / 重叠 {{ selectedKnowledgeBase.chunkOverlap }}</dd></div>
              </dl>
              <button class="kb-primary-action" @click="openEditEditor"><Pencil :size="15" />编辑设置</button>
            </section>
          </template>

          <div v-else class="kb-detail-empty"><Database :size="34" /><p>请先新建或选择一个知识库</p></div>
        </section>
      </section>
    </section>

    <Teleport to="body">
      <div v-if="editorOpen" class="tool-modal-backdrop" @click.self="editorOpen = false">
        <section class="knowledge-modal" role="dialog" aria-modal="true" :aria-label="editorTitle">
          <header class="tool-modal-head"><div><h2>{{ editorTitle }}</h2><p>配置知识库名称、切片参数和关键词检索数量。</p></div><button aria-label="关闭" @click="editorOpen = false"><X :size="18" /></button></header>
          <div class="knowledge-form-grid">
            <label class="full"><span>知识库名称</span><input v-model.trim="form.name" maxlength="200" /></label>
            <label class="full"><span>描述</span><textarea v-model.trim="form.description" maxlength="1000" /></label>
            <label><span>Chunk 大小</span><input v-model.number="form.chunkSize" type="number" min="300" max="3000" /></label>
            <label><span>Chunk 重叠</span><input v-model.number="form.chunkOverlap" type="number" min="0" :max="Math.max(form.chunkSize - 1, 0)" /></label>
            <label><span>Top K</span><input v-model.number="form.topK" type="number" min="1" max="20" /></label>
            <label><span>检索模式</span><input value="关键词检索" disabled /></label>
          </div>
          <p v-if="form.chunkOverlap >= form.chunkSize" class="knowledge-form-error">Chunk 重叠必须小于 Chunk 大小</p>
          <footer class="tool-modal-actions"><button @click="editorOpen = false">取消</button><button class="primary" :disabled="!canSubmit" @click="submitEditor">{{ editorMode === 'create' ? '创建' : '保存' }}</button></footer>
        </section>
      </div>

      <div v-if="confirmTarget" class="tool-modal-backdrop" @click.self="confirmTarget = null">
        <section class="knowledge-confirm-modal" role="alertdialog" aria-modal="true">
          <span class="knowledge-confirm-icon"><Trash2 :size="22" /></span>
          <h2>确认删除{{ confirmTarget.type === 'knowledge-base' ? '知识库' : '文档' }}？</h2>
          <p v-if="confirmTarget.type === 'knowledge-base'">“{{ confirmTarget.item.name }}”及其全部文档和切片将被删除，此操作无法撤销。</p>
          <p v-else>“{{ confirmTarget.item.name }}”及其对应切片将被删除，此操作无法撤销。</p>
          <div><button @click="confirmTarget = null">取消</button><button class="danger" @click="confirmDelete">确认删除</button></div>
        </section>
      </div>
    </Teleport>
  </main>
</template>
