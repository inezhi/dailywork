import { create } from 'zustand'

export type DrawerTab = 'detail' | 'subtasks' | 'activity'
export type AiContext = { kind: 'global' | 'task' | 'document' | 'project' | 'review'; id?: string }

interface UiState {
  drawerTaskId: string | null
  drawerTab: DrawerTab
  paletteOpen: boolean
  newTaskOpen: boolean
  sidebarCollapsed: boolean
  focusTheater: boolean
  aiOpen: boolean
  aiDraft: string | null
  aiContext: AiContext
  openTask: (id: string, tab?: DrawerTab) => void
  closeDrawer: () => void
  setDrawerTab: (tab: DrawerTab) => void
  setPalette: (open: boolean) => void
  setNewTask: (open: boolean) => void
  toggleSidebar: () => void
  setFocusTheater: (open: boolean) => void
  setAiOpen: (open: boolean) => void
  openAi: (options?: { draft?: string; context?: AiContext }) => void
  consumeAiDraft: () => string | null
}

const storedCollapsed =
  typeof localStorage !== 'undefined' && localStorage.getItem('daily:sidebar') === 'collapsed'

export const useUi = create<UiState>((set, get) => ({
  drawerTaskId: null,
  drawerTab: 'detail',
  paletteOpen: false,
  newTaskOpen: false,
  sidebarCollapsed: Boolean(storedCollapsed),
  focusTheater: false,
  aiOpen: false,
  aiDraft: null,
  aiContext: { kind: 'global' },
  openTask: (id, tab = 'detail') => set({ drawerTaskId: id, drawerTab: tab }),
  closeDrawer: () => set({ drawerTaskId: null }),
  setDrawerTab: (drawerTab) => set({ drawerTab }),
  setPalette: (paletteOpen) => set({ paletteOpen }),
  setNewTask: (newTaskOpen) => set({ newTaskOpen }),
  toggleSidebar: () =>
    set((state) => {
      const next = !state.sidebarCollapsed
      localStorage.setItem('daily:sidebar', next ? 'collapsed' : 'expanded')
      return { sidebarCollapsed: next }
    }),
  setFocusTheater: (focusTheater) => set({ focusTheater }),
  setAiOpen: (aiOpen) => set({ aiOpen }),
  openAi: (options) =>
    set({
      aiOpen: true,
      aiDraft: options?.draft ?? null,
      aiContext: options?.context ?? { kind: 'global' },
    }),
  consumeAiDraft: () => {
    const draft = get().aiDraft
    if (draft) set({ aiDraft: null })
    return draft
  },
}))
