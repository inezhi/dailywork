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
  root.style.setProperty(
    '--accent-strong',
    `color-mix(in oklab, ${theme.accent}, ${mode === 'dark' ? 'white 14%' : 'black 14%'})`,
  )
  root.style.setProperty('--accent-contrast', contrastText(theme.accent))
  root.style.setProperty('--success', theme.success)
  root.style.setProperty('--warning', theme.warning)
  root.style.setProperty('--danger', theme.danger)
  root.style.setProperty('--info', theme.info)
  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) meta.setAttribute('content', mode === 'dark' ? '#17171A' : '#F5F7FA')
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
  { name: '经典蓝', value: '#1677FF' },
  { name: '青蓝', value: '#13C2C2' },
  { name: '品牌绿', value: '#00B42A' },
  { name: '警告橙', value: '#FA8C16' },
  { name: '品牌红', value: '#F53F3F' },
  { name: '品牌紫', value: '#722ED1' },
]

export const SEMANTIC_DEFAULTS = {
  success: '#52C41A',
  warning: '#FAAD14',
  danger: '#FF4D4F',
  info: '#13C2C2',
}
