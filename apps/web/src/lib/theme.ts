import type { Settings, ThemeSettings } from '@daily/contracts'

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '')
  return [
    parseInt(clean.slice(0, 2), 16),
    parseInt(clean.slice(2, 4), 16),
    parseInt(clean.slice(4, 6), 16),
  ]
}

function luminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((v) => {
    const c = v / 255
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
  }) as [number, number, number]
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

export function contrastText(hex: string): string {
  return luminance(hex) > 0.48 ? '#141413' : '#ffffff'
}

export function effectiveMode(mode: ThemeSettings['mode']): 'light' | 'dark' {
  if (mode === 'system') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  }
  return mode
}

export function applyTheme(theme: ThemeSettings): void {
  const root = document.documentElement
  const mode = effectiveMode(theme.mode)
  root.dataset.theme = mode
  root.dataset.neutral = theme.neutral
  root.dataset.density = theme.density
  root.style.setProperty('--accent', theme.accent)
  root.style.setProperty('--accent-contrast', contrastText(theme.accent))
  root.style.setProperty('--success', theme.success)
  root.style.setProperty('--warning', theme.warning)
  root.style.setProperty('--danger', theme.danger)
  root.style.setProperty('--info', theme.info)
  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) meta.setAttribute('content', mode === 'dark' ? '#1B1A18' : '#FAF9F5')
}

export function applySettings(settings: Settings | undefined): void {
  if (!settings) return
  applyTheme(settings.theme)
}

export function watchSystemTheme(theme: ThemeSettings): () => void {
  const mq = window.matchMedia('(prefers-color-scheme: dark)')
  const handler = () => {
    if (theme.mode === 'system') applyTheme(theme)
  }
  mq.addEventListener('change', handler)
  return () => mq.removeEventListener('change', handler)
}

export const ACCENT_PRESETS = [
  { name: '陶土橙', value: '#D97757' },
  { name: '松林绿', value: '#5E7D6B' },
  { name: '雾蓝', value: '#6A8CAF' },
  { name: '山楂红', value: '#B5514A' },
  { name: '麦金', value: '#B08A4C' },
  { name: '紫灰', value: '#7C6C8A' },
]

export const SEMANTIC_DEFAULTS = {
  success: '#788C5D',
  warning: '#A8761C',
  danger: '#B5473C',
  info: '#6A9BCC',
}
