import { useEffect, useState } from 'react'
import {
  ChevronRight,
  Database,
  Download,
  KeyRound,
  Laptop,
  Moon,
  Palette,
  Plus,
  RefreshCw,
  Settings2,
  Sparkles,
  Sun,
  Trash2,
  Upload,
} from 'lucide-react'
import type {
  GeneralSettings,
  MetaInfo,
  Provider,
  SaveProviderInput,
  Settings,
  TestProviderResult,
  ThemeSettings,
  UpdateSettingsInput,
} from '@daily/contracts'
import { useOp, useOpMutation } from '@/lib/query'
import { callOp } from '@/lib/api'
import { applyTheme, ACCENT_PRESETS } from '@/lib/theme'
import { toast } from '@/stores/toast'
import { Modal, ModalHeader, ConfirmDialog } from '@/components/Modal'
import { formatDuration } from '@/lib/format'

type Section = 'appearance' | 'general' | 'ai' | 'data' | 'about'

const SECTIONS: Array<{ key: Section; label: string; icon: React.ComponentType<{ size?: number }> }> = [
  { key: 'appearance', label: '外观', icon: Palette },
  { key: 'general', label: '通用', icon: Settings2 },
  { key: 'ai', label: 'AI 供应商', icon: Sparkles },
  { key: 'data', label: '数据与备份', icon: Database },
  { key: 'about', label: '关于', icon: Laptop },
]

export function SettingsPage() {
  const [section, setSection] = useState<Section>('appearance')
  const { data: settings } = useOp<Settings>('settings.get')
  const update = useOpMutation<UpdateSettingsInput, Settings>('settings.update', {
    silent: true,
    onSuccess: (next) => applyTheme(next.theme),
  })

  const setTheme = (patch: Partial<ThemeSettings>) => {
    if (!settings) return
    applyTheme({ ...settings.theme, ...patch })
    update.mutate({ theme: patch })
  }
  const setGeneral = (patch: Partial<GeneralSettings>) => {
    update.mutate({ general: patch })
  }

  return (
    <div className="page" style={{ maxWidth: 1000 }}>
      <div className="page-head">
        <div>
          <h1>设置</h1>
          <p className="page-sub">所有偏好只保存在本机。调整后立即生效。</p>
        </div>
      </div>

      <div className="settings-layout">
        <nav className="settings-nav" aria-label="设置分区">
          {SECTIONS.map((item) => {
            const Icon = item.icon
            return (
              <button key={item.key} className={section === item.key ? 'on' : ''} onClick={() => setSection(item.key)}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                  <Icon size={14} /> {item.label}
                </span>
              </button>
            )
          })}
        </nav>

        <div>
          {section === 'appearance' && settings && (
            <>
              <section className="settings-section">
                <h2>主题模式</h2>
                <p className="desc">晨光暖白与深夜墨色都是完整设计，不是简单的反色。</p>
                <div className="seg">
                  <button className={settings.theme.mode === 'light' ? 'on' : ''} onClick={() => setTheme({ mode: 'light' })}>
                    <Sun size={12} style={{ verticalAlign: -1, marginRight: 4 }} /> 浅色
                  </button>
                  <button className={settings.theme.mode === 'dark' ? 'on' : ''} onClick={() => setTheme({ mode: 'dark' })}>
                    <Moon size={12} style={{ verticalAlign: -1, marginRight: 4 }} /> 深色
                  </button>
                  <button className={settings.theme.mode === 'system' ? 'on' : ''} onClick={() => setTheme({ mode: 'system' })}>
                    <Laptop size={12} style={{ verticalAlign: -1, marginRight: 4 }} /> 跟随系统
                  </button>
                </div>
              </section>

              <section className="settings-section">
                <h2>强调色</h2>
                <p className="desc">只用于主操作、进度与选中态。默认是陶土橙。</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <div className="swatches">
                    {ACCENT_PRESETS.map((preset) => (
                      <button
                        key={preset.value}
                        className={`swatch ${settings.theme.accent.toLowerCase() === preset.value.toLowerCase() ? 'on' : ''}`}
                        style={{ background: preset.value }}
                        onClick={() => setTheme({ accent: preset.value })}
                        title={preset.name}
                        aria-label={preset.name}
                      />
                    ))}
                  </div>
                  <input
                    className="color-input"
                    type="color"
                    value={settings.theme.accent}
                    onChange={(event) => setTheme({ accent: event.target.value })}
                    title="自定义强调色"
                  />
                  <span style={{ fontSize: 10, color: 'var(--ink-3)' }}>{settings.theme.accent.toUpperCase()}</span>
                </div>
              </section>

              <section className="settings-section">
                <h2>语义色</h2>
                <p className="desc">成功、警告、危险、信息。只表达含义，不做装饰。</p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
                  {(
                    [
                      ['success', '成功'],
                      ['warning', '警告'],
                      ['danger', '危险'],
                      ['info', '信息'],
                    ] as const
                  ).map(([key, label]) => (
                    <div key={key}>
                      <div style={{ fontSize: 10.5, color: 'var(--ink-3)', marginBottom: 5 }}>{label}</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                        <input
                          className="color-input"
                          type="color"
                          value={settings.theme[key]}
                          onChange={(event) => setTheme({ [key]: event.target.value })}
                        />
                        <span style={{ fontSize: 9.5, color: 'var(--ink-3)' }}>{settings.theme[key].toUpperCase()}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              <section className="settings-section">
                <h2>中性色温度</h2>
                <p className="desc">把画布从暖米色调到中性或冷灰，其他颜色会一并保持协调。</p>
                <div className="seg">
                  {(
                    [
                      ['warm', '暖'],
                      ['neutral', '中性'],
                      ['cool', '冷'],
                    ] as const
                  ).map(([value, label]) => (
                    <button
                      key={value}
                      className={settings.theme.neutral === value ? 'on' : ''}
                      onClick={() => setTheme({ neutral: value })}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </section>

              <section className="settings-section">
                <h2>信息密度</h2>
                <p className="desc">紧凑模式减少行高，适合小屏幕或任务很多的日子。</p>
                <div className="seg">
                  <button className={settings.theme.density === 'comfortable' ? 'on' : ''} onClick={() => setTheme({ density: 'comfortable' })}>
                    舒适
                  </button>
                  <button className={settings.theme.density === 'compact' ? 'on' : ''} onClick={() => setTheme({ density: 'compact' })}>
                    紧凑
                  </button>
                </div>
              </section>
            </>
          )}

          {section === 'general' && settings && (
            <>
              <section className="settings-section">
                <h2>计划与专注</h2>
                <p className="desc">这些默认值会出现在新建任务、今天页和专注计时里。</p>
                <div className="setting-row">
                  <div>
                    <div className="label">每周起始日</div>
                    <div className="hint">影响日历、时间轴与周复盘的对齐。</div>
                  </div>
                  <select
                    className="field"
                    style={{ width: 140 }}
                    value={settings.general.weekStartsOn}
                    onChange={(event) => setGeneral({ weekStartsOn: Number(event.target.value) })}
                  >
                    <option value={1}>周一</option>
                    <option value={0}>周日</option>
                  </select>
                </div>
                <div className="setting-row">
                  <div>
                    <div className="label">默认专注时长</div>
                    <div className="hint">当前 {formatDuration(settings.general.defaultFocusMinutes)}。</div>
                  </div>
                  <select
                    className="field"
                    style={{ width: 120 }}
                    value={settings.general.defaultFocusMinutes}
                    onChange={(event) => setGeneral({ defaultFocusMinutes: Number(event.target.value) })}
                  >
                    {[15, 25, 45, 60, 90].map((m) => (
                      <option key={m} value={m}>
                        {m} 分钟
                      </option>
                    ))}
                  </select>
                </div>
                <div className="setting-row">
                  <div>
                    <div className="label">每日默认容量</div>
                    <div className="hint">今天页的容量条以它作为基准，可逐日调整。</div>
                  </div>
                  <select
                    className="field"
                    style={{ width: 120 }}
                    value={settings.general.defaultCapacityMinutes}
                    onChange={(event) => setGeneral({ defaultCapacityMinutes: Number(event.target.value) })}
                  >
                    {[180, 240, 300, 360, 480].map((m) => (
                      <option key={m} value={m}>
                        {m} 分钟
                      </option>
                    ))}
                  </select>
                </div>
              </section>

              <section className="settings-section">
                <h2>体验</h2>
                <div className="setting-row">
                  <div>
                    <div className="label">减少动效</div>
                    <div className="hint">关闭过渡与入场动画，尊重系统偏好。</div>
                  </div>
                  <Toggle on={settings.general.reduceMotion} onChange={(v) => setGeneral({ reduceMotion: v })} />
                </div>
                <div className="setting-row">
                  <div>
                    <div className="label">启用 AI 功能</div>
                    <div className="hint">关闭后不会向任何模型发送数据，AI 操作入口隐藏。</div>
                  </div>
                  <Toggle on={settings.general.aiEnabled} onChange={(v) => setGeneral({ aiEnabled: v })} />
                </div>
                <div className="setting-row">
                  <div>
                    <div className="label">局域网访问</div>
                    <div className="hint">允许同一 Wi-Fi 下的手机 / 平板通过配对码访问。数据只在 Mac 上。</div>
                  </div>
                  <Toggle on={settings.general.lanEnabled} onChange={(v) => setGeneral({ lanEnabled: v })} />
                </div>
                {settings.general.lanEnabled && <LanInfo />}
              </section>
            </>
          )}

          {section === 'ai' && (
            <AiSettings />
          )}

          {section === 'data' && <DataSettings />}

          {section === 'about' && <AboutSection />}
        </div>
      </div>
    </div>
  )
}

function LanInfo() {
  const { data } = useOp<{ enabled: boolean; urls: string[]; port: number | null; pairingCode: string | null }>(
    'lan.info',
    {},
    { refetchInterval: 15_000 },
  )
  if (!data) return null
  if (data.urls.length === 0) {
    return (
      <div className="setting-row" style={{ paddingTop: 0 }}>
        <div className="hint" style={{ color: 'var(--warning)' }}>
          未检测到局域网地址。请确认 Mac 与手机连接同一 Wi-Fi。开发模式下服务只监听本机。
        </div>
      </div>
    )
  }
  return (
    <div style={{ background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: 8, padding: '11px 12px', margin: '4px 0 10px' }}>
      <div style={{ fontSize: 10.5, color: 'var(--ink-3)', marginBottom: 6 }}>在手机或平板的浏览器打开：</div>
      {data.urls.map((url) => (
        <div key={url} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <code style={{ fontSize: 11.5, color: 'var(--accent-strong)', flex: 1 }}>{url}</code>
          <button
            className="btn sm"
            onClick={() => {
              void navigator.clipboard?.writeText(url)
              toast.info('地址已复制')
            }}
          >
            复制
          </button>
        </div>
      ))}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--line-soft)' }}>
        <span style={{ fontSize: 10.5, color: 'var(--ink-3)' }}>配对码</span>
        <b className="tnum" style={{ fontSize: 18, letterSpacing: 4 }}>{data.pairingCode ?? '······'}</b>
        <span style={{ fontSize: 9.5, color: 'var(--ink-3)', marginLeft: 'auto' }}>打开地址后输入配对码</span>
      </div>
    </div>
  )
}

function Toggle({ on, onChange }: { on: boolean; onChange: (value: boolean) => void }) {
  return (
    <button className={`toggle ${on ? 'on' : ''}`} onClick={() => onChange(!on)} aria-pressed={on}>
      <i />
    </button>
  )
}

function AiSettings() {
  const { data: providers } = useOp<Provider[]>('ai.provider.list')
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Provider | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Provider | null>(null)
  const [testing, setTesting] = useState<string | null>(null)
  const [testResult, setTestResult] = useState<Record<string, TestProviderResult>>({})
  const remove = useOpMutation<{ id: string; confirm: boolean }, { id: string }>('ai.provider.delete', {
    onSuccess: () => {
      toast.success('供应商已删除')
      setDeleteTarget(null)
    },
  })

  const test = async (provider: Provider) => {
    setTesting(provider.id)
    try {
      const result = await callOp<TestProviderResult>('ai.provider.test', { id: provider.id })
      setTestResult((prev) => ({ ...prev, [provider.id]: result }))
      if (result.ok) toast.success('连接成功')
      else toast.error(result.message)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '测试失败')
    } finally {
      setTesting(null)
    }
  }

  return (
    <>
      <section className="settings-section">
        <h2>AI 供应商</h2>
        <p className="desc">
          默认推荐 DeepSeek（OpenAI 兼容）。密钥用本机密钥加密后存入本地数据库（会随备份文件导出），不会写入日志。
        </p>
        {(providers ?? []).map((provider) => (
          <div key={provider.id} className="setting-row" style={{ alignItems: 'flex-start' }}>
            <div style={{ flex: 1 }}>
              <div className="label" style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                {provider.name}
                {provider.isDefault && <span className="chip soft">默认</span>}
                {provider.hasKey ? <span className="chip tag">已配置密钥</span> : <span className="chip tag" style={{ color: 'var(--danger)' }}>缺少密钥</span>}
              </div>
              <div className="hint">
                {provider.model} · {provider.baseUrl}
              </div>
              {testResult[provider.id] && (
                <div style={{ fontSize: 10, marginTop: 4, color: testResult[provider.id]!.ok ? 'var(--success)' : 'var(--danger)' }}>
                  {testResult[provider.id]!.ok ? '连接正常' : testResult[provider.id]!.message}
                  {testResult[provider.id]!.latencyMs ? ` · ${testResult[provider.id]!.latencyMs}ms` : ''}
                </div>
              )}
            </div>
            <div style={{ display: 'flex', gap: 6, flex: 'none' }}>
              <button className="btn sm" onClick={() => void test(provider)} disabled={testing === provider.id}>
                {testing === provider.id ? <RefreshCw size={12} className="spin" /> : <RefreshCw size={12} />} 测试
              </button>
              <button
                className="btn sm"
                onClick={() => {
                  setEditing(provider)
                  setFormOpen(true)
                }}
              >
                编辑
              </button>
              <button className="btn sm danger" onClick={() => setDeleteTarget(provider)}>
                <Trash2 size={12} />
              </button>
            </div>
          </div>
        ))}
        {(providers ?? []).length === 0 && (
          <div className="empty" style={{ padding: '28px 12px' }}>
            <div className="empty-icon"><KeyRound size={18} /></div>
            <h3>还没有 AI 供应商</h3>
            <p>添加 DeepSeek 或任意 OpenAI 兼容端点后，任务助理、文档 AI 与周复盘才会启用。</p>
          </div>
        )}
        <div style={{ marginTop: 12 }}>
          <button
            className="btn"
            onClick={() => {
              setEditing(null)
              setFormOpen(true)
            }}
          >
            <Plus size={13} /> 添加供应商
          </button>
        </div>
      </section>

      <ProviderModal open={formOpen} onClose={() => setFormOpen(false)} provider={editing} />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="删除这个 AI 供应商？"
        description="密钥会一并删除。已有对话记录不受影响。"
        busy={remove.isPending}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && remove.mutate({ id: deleteTarget.id, confirm: true })}
      />
    </>
  )
}

function ProviderModal({ open, onClose, provider }: { open: boolean; onClose: () => void; provider: Provider | null }) {
  const [name, setName] = useState(provider?.name ?? 'DeepSeek')
  const [baseUrl, setBaseUrl] = useState(provider?.baseUrl ?? 'https://api.deepseek.com')
  const [model, setModel] = useState(provider?.model ?? 'deepseek-chat')
  const [apiKey, setApiKey] = useState('')
  const [isDefault, setIsDefault] = useState(provider?.isDefault ?? true)

  useEffect(() => {
    if (!open) return
    setName(provider?.name ?? 'DeepSeek')
    setBaseUrl(provider?.baseUrl ?? 'https://api.deepseek.com')
    setModel(provider?.model ?? 'deepseek-chat')
    setApiKey('')
    setIsDefault(provider?.isDefault ?? true)
  }, [open, provider])

  const save = useOpMutation<SaveProviderInput, Provider>('ai.provider.save', {
    onSuccess: () => {
      toast.success('供应商已保存')
      onClose()
    },
  })

  return (
    <Modal open={open} onClose={onClose} width={500} label="AI 供应商">
      <ModalHeader
        title={provider ? '编辑 AI 供应商' : '添加 AI 供应商'}
        description="支持 DeepSeek、OpenAI 或任意 OpenAI 兼容端点（含 Ollama）。"
        onClose={onClose}
      />
      <div className="modal-body">
        <div className="form-row">
          <label>名称</label>
          <input className="field" value={name} onChange={(event) => setName(event.target.value)} placeholder="DeepSeek" />
        </div>
        <div className="form-row">
          <label>Base URL</label>
          <input className="field" value={baseUrl} onChange={(event) => setBaseUrl(event.target.value)} placeholder="https://api.deepseek.com" />
        </div>
        <div className="form-row">
          <label>模型</label>
          <input className="field" value={model} onChange={(event) => setModel(event.target.value)} placeholder="deepseek-chat" />
        </div>
        <div className="form-row">
          <label>API Key {provider?.hasKey ? '（留空保持不变）' : ''}</label>
          <input
            className="field"
            type="password"
            value={apiKey}
            onChange={(event) => setApiKey(event.target.value)}
            placeholder="sk-…"
            autoComplete="off"
          />
        </div>
        <div className="setting-row" style={{ borderTop: 'none', paddingBottom: 0 }}>
          <div>
            <div className="label">设为默认供应商</div>
            <div className="hint">AI 助理与自动复盘会使用它。</div>
          </div>
          <Toggle on={isDefault} onChange={setIsDefault} />
        </div>
      </div>
      <div className="modal-foot">
        <button className="btn" onClick={onClose}>
          取消
        </button>
        <button
          className="btn primary"
          disabled={!name.trim() || !baseUrl.trim() || !model.trim() || save.isPending}
          onClick={() =>
            save.mutate({
              id: provider?.id,
              name: name.trim(),
              baseUrl: baseUrl.trim(),
              model: model.trim(),
              apiKey: apiKey.trim() || undefined,
              isDefault,
            })
          }
        >
          {save.isPending ? '保存中…' : '保存'}
        </button>
      </div>
    </Modal>
  )
}

function DataSettings() {
  const { data: meta } = useOp<MetaInfo>('meta.get')
  const [exporting, setExporting] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [importPath, setImportPath] = useState('')

  const exportData = async () => {
    setExporting(true)
    try {
      const result = await callOp<{ path: string; bytes: number }>('backup.export', {})
      toast.success(`已导出到 ${result.path}`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '导出失败')
    } finally {
      setExporting(false)
    }
  }

  return (
    <>
      <section className="settings-section">
        <h2>本地数据</h2>
        <p className="desc">数据只存在这台 Mac。没有云端副本，也不需要账号。</p>
        <div className="setting-row">
          <div>
            <div className="label">数据目录</div>
            <div className="hint" style={{ wordBreak: 'break-all' }}>{meta?.dataDir ?? '…'}</div>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            {window.dailywork && (
              <button className="btn sm" onClick={() => void window.dailywork?.revealDataDir()}>
                打开目录
              </button>
            )}
            <button
              className="btn sm"
              onClick={() => {
                if (meta?.dataDir) {
                  void navigator.clipboard?.writeText(meta.dataDir)
                  toast.info('路径已复制')
                }
              }}
            >
              复制路径
            </button>
          </div>
        </div>
        <div className="setting-row">
          <div>
            <div className="label">数据库</div>
            <div className="hint">SQLite · WAL · 图片以 BLOB 存库并按哈希去重</div>
          </div>
          <span className="chip soft">v{meta?.schemaVersion ?? 1}</span>
        </div>
      </section>

      <section className="settings-section">
        <h2>备份与迁移</h2>
        <p className="desc">
          导出一个 `.dailywork` 文件（数据库 + 图片 + 清单），可以在新机器上完整恢复。导入前会自动备份当前数据库。
        </p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="btn" onClick={() => void exportData()} disabled={exporting}>
            <Download size={13} /> {exporting ? '导出中…' : '导出备份'}
          </button>
          <button
            className="btn"
            onClick={async () => {
              if (window.dailywork?.pickBackup) {
                const picked = await window.dailywork.pickBackup()
                if (picked) {
                  setImportPath(picked)
                  setImportOpen(true)
                }
              } else {
                setImportOpen(true)
              }
            }}
          >
            <Upload size={13} /> 导入备份
          </button>
        </div>
        <div className="hint" style={{ marginTop: 10 }}>
          每日会自动生成快照，保存在数据目录的 backups 文件夹。
        </div>
      </section>

      <section className="settings-section">
        <h2>命令行</h2>
        <p className="desc">`daily` 覆盖界面全部操作，AI 可直接调用，也提供 MCP Server。</p>
        <pre
          style={{
            background: 'var(--sunken)',
            border: '1px solid var(--line)',
            borderRadius: 8,
            padding: '10px 12px',
            fontSize: 10.5,
            lineHeight: 1.8,
            overflowX: 'auto',
            margin: 0,
          }}
        >{`daily today --json
daily task create "写周报" --due 2026-10-30 --json
daily task list --status doing --json
daily mcp serve`}</pre>
      </section>

      <Modal open={importOpen} onClose={() => setImportOpen(false)} label="导入备份">
        <ModalHeader
          title="导入 .dailywork 备份"
          description="会校验文件完整性，先备份当前数据库，再原子替换。导入后需要立即重启应用；当前会话里未导出的改动会丢失。"
          onClose={() => setImportOpen(false)}
        />
        <div className="modal-body">
          <div className="form-row">
            <label>备份文件绝对路径</label>
            <input
              className="field"
              value={importPath}
              onChange={(event) => setImportPath(event.target.value)}
              placeholder="/Users/…/dailywork-2026-10-27.dailywork"
            />
          </div>
        </div>
        <div className="modal-foot">
          <button className="btn" onClick={() => setImportOpen(false)}>取消</button>
          <button
            className="btn primary"
            disabled={!importPath.trim()}
            onClick={async () => {
              try {
                const result = await callOp<{ restored: boolean; restartRequired?: boolean; tasks: number }>('backup.import', {
                  sourcePath: importPath.trim(),
                  confirm: true,
                })
                toast.success(`备份已校验并暂存（${result.tasks} 个任务），重启应用后生效`)
                setImportOpen(false)
              } catch (error) {
                toast.error(error instanceof Error ? error.message : '导入失败')
              }
            }}
          >
            开始导入
          </button>
        </div>
      </Modal>
    </>
  )
}

function AboutSection() {
  const { data: meta } = useOp<MetaInfo>('meta.get')
  return (
    <>
      <section className="settings-section">
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <img src="/logo.png" alt="时序标识" style={{ width: 72, height: 72, objectFit: 'contain' }} />
          <div>
            <h2 style={{ fontSize: 18, marginBottom: 4 }}>时序 · Dailywork</h2>
            <div className="hint">时间有序，专注有度。</div>
            <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
              <span className="chip soft">版本 {meta?.version ?? '0.1.0'}</span>
              <span className="chip soft">本地优先</span>
              <span className="chip soft">macOS</span>
            </div>
          </div>
        </div>
      </section>

      <section className="settings-section">
        <h2>关于这份工作台</h2>
        <p className="desc" style={{ marginBottom: 0, lineHeight: 1.8 }}>
          时序把任务、时间与知识放在同一张桌面上：捕获想法、安排今天的容量、进入专注、在周末回看。
          它不追求让你做更多，而是让重要的那件事更容易开始。
        </p>
      </section>

      <section className="settings-section">
        <h2>文档</h2>
        <div className="setting-row">
          <div>
            <div className="label">产品与设计文档</div>
            <div className="hint">PRD、架构、设计系统、ADR、测试与发布流程，归档在飞书知识库。</div>
          </div>
          <a className="btn sm" href="https://my.feishu.cn/wiki/HjuOwAe34iZPbmkzOJhcMYK1nb4" target="_blank" rel="noreferrer">
            打开 <ChevronRight size={12} />
          </a>
        </div>
        <div className="setting-row">
          <div>
            <div className="label">快捷键</div>
            <div className="hint">⌘K 搜索 · ⌘N 新建任务 · Esc 关闭抽屉</div>
          </div>
          <span className="chip soft">键盘友好</span>
        </div>
      </section>
    </>
  )
}
