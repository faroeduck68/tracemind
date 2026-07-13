<script setup lang="ts">
import { ref } from 'vue'
import AnimatedSelect from './AnimatedSelect.vue'

type SettingsForm = {
  language: string
  model: string
  theme: string
  autoSave: boolean
  interval: string
  webhook: string
  modelProvider: string
  temperature: string
  maxTokens: string
  memoryEnabled: boolean
  memoryLimit: string
  memoryScope: string
  auditLog: boolean
  allowExport: boolean
  ipAllowlist: string
}

type SettingOptions = {
  language: string[]
  model: string[]
  theme: string[]
  interval: string[]
  modelProvider: string[]
  temperature: string[]
  maxTokens: string[]
  memoryLimit: string[]
  memoryScope: string[]
}

const props = defineProps<{
  form: SettingsForm
  options: SettingOptions
}>()

const emit = defineEmits<{
  (event: 'update:form', value: SettingsForm): void
  (event: 'save'): void
}>()

const tabs = ['通用设置', '模型设置', '记忆设置', '安全设置']
const settingsTab = ref(tabs[0])

function updateField<Key extends keyof SettingsForm>(key: Key, value: SettingsForm[Key]) {
  emit('update:form', {
    ...props.form,
    [key]: value
  })
}
</script>

<template>
  <main class="settings-page">
    <header class="settings-page-head">
      <h1>设置</h1>
      <p>管理系统偏好、模型配置和集成设置。</p>
    </header>

    <section class="settings-content">
      <div class="settings-layout">
        <aside class="settings-menu panel">
          <button
            v-for="tab in tabs"
            :key="tab"
            type="button"
            :class="{ active: settingsTab === tab }"
            @click="settingsTab = tab"
          >
            {{ tab }}
          </button>
        </aside>

        <section class="settings-form panel">
          <div class="settings-form-head">
            <h2>{{ settingsTab }}</h2>
            <button type="button" class="template-create" @click="emit('save')">保存设置</button>
          </div>

          <template v-if="settingsTab === '通用设置'">
            <div class="setting-row">
              <label>语言</label>
              <AnimatedSelect :model-value="form.language" :options="options.language" @update:model-value="updateField('language', $event)" />
            </div>
            <div class="setting-row">
              <label>主题模式</label>
              <AnimatedSelect :model-value="form.theme" :options="options.theme" @update:model-value="updateField('theme', $event)" />
            </div>
            <div class="setting-row">
              <div>
                <label>自动保存</label>
                <p>自动保存编辑内容，避免数据丢失</p>
              </div>
              <button
                type="button"
                class="settings-switch"
                :class="{ off: !form.autoSave }"
                :aria-pressed="form.autoSave"
                @click="updateField('autoSave', !form.autoSave)"
              ></button>
            </div>
            <div class="setting-row">
              <div>
                <label>自动保存间隔</label>
                <p>设置自动保存的时间间隔</p>
              </div>
              <AnimatedSelect compact :model-value="form.interval" :options="options.interval" @update:model-value="updateField('interval', $event)" />
            </div>
          </template>

          <template v-else-if="settingsTab === '模型设置'">
            <div class="setting-row">
              <label>模型供应商</label>
              <AnimatedSelect :model-value="form.modelProvider" :options="options.modelProvider" @update:model-value="updateField('modelProvider', $event)" />
            </div>
            <div class="setting-row">
              <label>默认模型</label>
              <AnimatedSelect :model-value="form.model" :options="options.model" @update:model-value="updateField('model', $event)" />
            </div>
            <div class="setting-row">
              <div>
                <label>Temperature</label>
                <p>控制回答随机性，数值越高越发散</p>
              </div>
              <AnimatedSelect compact :model-value="form.temperature" :options="options.temperature" @update:model-value="updateField('temperature', $event)" />
            </div>
            <div class="setting-row">
              <div>
                <label>最大输出 Token</label>
                <p>限制单次模型输出长度</p>
              </div>
              <AnimatedSelect compact :model-value="form.maxTokens" :options="options.maxTokens" @update:model-value="updateField('maxTokens', $event)" />
            </div>
          </template>

          <template v-else-if="settingsTab === '记忆设置'">
            <div class="setting-row">
              <div>
                <label>启用记忆</label>
                <p>允许工作流生成和执行时参考数据库记忆</p>
              </div>
              <button
                type="button"
                class="settings-switch"
                :class="{ off: !form.memoryEnabled }"
                :aria-pressed="form.memoryEnabled"
                @click="updateField('memoryEnabled', !form.memoryEnabled)"
              ></button>
            </div>
            <div class="setting-row">
              <label>参考记忆数量</label>
              <AnimatedSelect compact :model-value="form.memoryLimit" :options="options.memoryLimit" @update:model-value="updateField('memoryLimit', $event)" />
            </div>
            <div class="setting-row">
              <label>记忆作用域</label>
              <AnimatedSelect :model-value="form.memoryScope" :options="options.memoryScope" @update:model-value="updateField('memoryScope', $event)" />
            </div>
          </template>

          <template v-else>
            <div class="setting-row">
              <div>
                <label>审计日志</label>
                <p>记录设置修改、工作流运行与工具调用</p>
              </div>
              <button
                type="button"
                class="settings-switch"
                :class="{ off: !form.auditLog }"
                :aria-pressed="form.auditLog"
                @click="updateField('auditLog', !form.auditLog)"
              ></button>
            </div>
            <div class="setting-row">
              <div>
                <label>允许导出</label>
                <p>控制工作流 JSON 和报告导出能力</p>
              </div>
              <button
                type="button"
                class="settings-switch"
                :class="{ off: !form.allowExport }"
                :aria-pressed="form.allowExport"
                @click="updateField('allowExport', !form.allowExport)"
              ></button>
            </div>
            <div class="setting-row webhook">
              <div>
                <label>Webhook URL（可选）</label>
                <p>当事件触发时发送 POST 请求到此地址</p>
              </div>
              <input :value="form.webhook" @input="updateField('webhook', ($event.target as HTMLInputElement).value)" />
            </div>
            <div class="setting-row webhook">
              <div>
                <label>IP 白名单（可选）</label>
                <p>多个 IP 用英文逗号分隔</p>
              </div>
              <input
                :value="form.ipAllowlist"
                placeholder="127.0.0.1, 192.168.1.10"
                @input="updateField('ipAllowlist', ($event.target as HTMLInputElement).value)"
              />
            </div>
          </template>
        </section>
      </div>

      <section class="settings-changes panel">
        <h2>最近配置变更</h2>
        <div class="settings-empty">暂无数据库配置变更记录</div>
      </section>
    </section>
  </main>
</template>
