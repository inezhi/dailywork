import { create } from 'zustand'

export type DrawerTab = 'detail' | 'subtasks' | 'activity'

interface UiState {
  drawerTaskId: string | null
  drawerTab: DrawerTab
  paletteOpen: boolean
  newTaskOpen: boolean
  sidebarCollapsed: boolean
  focusTheater: boolean
  aiOpen: boolean
  openTask: (id: string, tab?: DrawerTab) => void
  closeDrawer: () => void
  setDrawerTab: (tab: DrawerTab) => void
  setPalette: (open: boolean) => void
  setNewTask: (open: boolean) => void
  toggleSidebar: () => void
  setFocusTheater: (open: boolean) => void
  setAiOpen: (open: boolean) => void
}

const storedCollapsed =
  typeof localStorage !== 'undefined' && localStorage.getItem('daily:sidebar') === 'collapsed'

export const useUi = create<UiState>((set) => ({
  drawerTaskId: null,
  drawerTab: 'detail',
  paletteOpen: false,
  newTaskOpen: false,
  sidebarCollapsed: Boolean(storedCollapsed),
  focusTheater: false,
  aiOpen: false,
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
}))
