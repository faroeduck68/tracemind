import { ref } from 'vue'

export type PageKey = 'home' | 'agent' | 'workflow' | 'template' | 'knowledge' | 'memory' | 'tools' | 'settings'

const pages = new Set<PageKey>(['home', 'agent', 'workflow', 'template', 'knowledge', 'memory', 'tools', 'settings'])

export function pageFromHash(hash = window.location.hash): PageKey {
  const candidate = hash.replace(/^#/, '') as PageKey
  return pages.has(candidate) ? candidate : 'home'
}

export function usePageNavigation() {
  const activePage = ref<PageKey>(pageFromHash())

  function setPage(page: PageKey) {
    activePage.value = page
    window.location.hash = page
  }

  return {
    activePage,
    setPage
  }
}
