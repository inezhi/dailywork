import { useMemo, useState } from 'react'
import { ArrowUpRight, Sparkles, TriangleAlert } from 'lucide-react'
import type { DashboardResult, WeekReviewResult } from '@daily/contracts'
import { useOp } from '@/lib/query'
import { Modal, ModalHeader } from '@/components/Modal'
import { useUi } from '@/stores/ui'
import { shortDate } from '@/lib/format'

const RANGE_LABEL: Record<string, string> = {
  '7d': '最近 7 天',
  '30d': '最近 30 天',
  '90d': '最近 90 天',
  '12w': '最近 12 周',
}

const STATUS_COLORS: Record<string, string> = {
  doing: 'var(--accent)',
  next: 'var(--info)',
  waiting: 'var(--warning)',
  blocked: 'var(--danger)',
  inbox: 'var(--ink-3)',
  done: 'var(--success)',
}

const STATUS_NAMES: Record<string, string> = {
  doing: '进行中',
  next: '下一步',
  waiting: '等待中',
  blocked: '受阻',
  inbox: '收件箱',
  done: '已完成',
}

export function DashboardPage() {
  const [range, setRange] = useState<'7d' | '30d' | '90d' | '12w'>('30d')
  const [reviewOpen, setReviewOpen] = useState(false)
  const { data: review } = useOp<WeekReviewResult>('review.week', {}, { enabled: reviewOpen })
  const { data, isLoading } = useOp<DashboardResult>('analytics.dashboard', { range }, { staleTime: 20_000 })
  const openTask = useUi((s) => s.openTask)

  const trendMax = useMemo(() => {
    if (!data) return 1
    return Math.max(1, ...data.trend.map((t) => t.completed), ...data.trend.map((t) => t.focusMinutes / 10))
  }, [data])

  if (isLoading || !data) {
    return (
      <div className="page">
        <div className="page-head">
          <div>
            <h1>仪表盘</h1>
            <p className="page-sub">正在汇总最近的节奏…</p>
          </div>
        </div>
        <div className="kpi-grid">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="kpi">
              <div className="skeleton" style={{ height: 12, width: 70 }} />
              <div className="skeleton" style={{ height: 30, width: 90, marginTop: 10 }} />
            </div>
          ))}
        </div>
        <div className="skeleton" style={{ height: 240 }} />
      </div>
    )
  }

  const kpi = data.kpi
  const totalOpen = data.byStatus.filter((s) => s.status !== 'done').reduce((a, s) => a + s.count, 0)
  const maxProject = Math.max(1, ...data.byProject.map((p) => p.completed + p.open))

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>仪表盘</h1>
          <p className="page-sub">
            {RANGE_LABEL[range]} · {shortDate(data.from)} — {shortDate(data.to)}
          </p>
        </div>
        <div className="head-right">
          <button className="btn" onClick={() => setReviewOpen(true)}>
            本周复盘
          </button>
          <div className="seg">
            {(['7d', '30d', '90d', '12w'] as const).map((value) => (
              <button key={value} className={range === value ? 'on' : ''} onClick={() => setRange(value)}>
                {value}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="kpi-grid">
        <Kpi label="完成任务" value={kpi.completed} suffix="项" foot={`创建 ${kpi.created} 项`} series={data.trend.map((t) => t.completed)} />
        <Kpi label="完成率" value={Math.round(kpi.completionRate * 100)} suffix="%" foot={`准时率 ${Math.round(kpi.onTimeRate * 100)}%`} series={data.trend.map((t) => t.completed)} tone="success" />
        <Kpi label="专注时长" value={Math.round(kpi.focusMinutes / 60)} suffix="小时" foot={`${kpi.focusMinutes} 分钟`} series={data.trend.map((t) => t.focusMinutes)} tone="accent" />
        <Kpi label="逾期" value={kpi.overdue} suffix="项" foot={`活跃项目 ${kpi.activeProjects} 个`} series={data.trend.map((t) => t.created)} tone={kpi.overdue > 0 ? 'danger' : 'neutral'} />
      </div>

      <div className="dash-grid">
        <section className="panel">
          <div className="panel-head">
            <div>
              <h3>完成与专注趋势</h3>
              <p>柱状：每日完成任务 · 折线：每日专注分钟 ÷ 10</p>
            </div>
            <span className="chip soft">{RANGE_LABEL[range]}</span>
          </div>
          <TrendChart data={data.trend} max={trendMax} />
          <div className="legend">
            <span><i style={{ background: 'var(--accent)' }} /> 完成任务</span>
            <span><i style={{ background: 'var(--info)', borderRadius: 8 }} /> 专注分钟</span>
          </div>
        </section>

        <section className="panel">
          <div className="panel-head">
            <div>
              <h3>值得注意</h3>
              <p>基于最近数据自动生成，不是评价，只是提示。</p>
            </div>
            <Sparkles size={14} color="var(--ink-3)" />
          </div>
          {data.insights.map((insight) => (
            <div className="insight" key={insight.id}>
              <span className={`insight-icon ${insight.tone}`}>
                {insight.tone === 'warning' ? <TriangleAlert size={13} /> : <Sparkles size={13} />}
              </span>
              <div style={{ flex: 1 }}>
                <h4>{insight.title}</h4>
                <p>{insight.body}</p>
              </div>
              {insight.actionLabel && <ArrowUpRight size={13} color="var(--ink-3)" style={{ marginTop: 3 }} />}
            </div>
          ))}
        </section>
      </div>

      <div className="dash-grid">
        <section className="panel">
          <div className="panel-head">
            <div>
              <h3>项目推进</h3>
              <p>完成（深色）与未完成（浅色）任务对比。</p>
            </div>
          </div>
          <div>
            {data.byProject.slice(0, 8).map((project) => {
              return (
                <div className="waterfall-row" key={project.projectId ?? 'none'}>
                  <span className="name" title={project.name}>{project.name}</span>
                  <span style={{ display: 'flex', height: 9, borderRadius: 4, overflow: 'hidden', background: 'var(--sunken)' }}>
                    <i style={{ width: `${(project.completed / maxProject) * 100}%`, background: project.color, display: 'block' }} />
                    <i style={{ width: `${(project.open / maxProject) * 100}%`, background: `color-mix(in oklab, ${project.color} 28%, var(--sunken))`, display: 'block' }} />
                  </span>
                  <span className="val">
                    {project.completed}/{project.completed + project.open}
                  </span>
                </div>
              )
            })}
            {data.byProject.length === 0 && <div style={{ fontSize: 11, color: 'var(--ink-3)' }}>还没有项目数据。</div>}
          </div>
          <div className="legend">
            {data.byProject.slice(0, 4).map((p) => (
              <span key={p.projectId ?? 'none'}><i style={{ background: p.color }} /> {p.name}</span>
            ))}
          </div>
        </section>

        <section className="panel">
          <div className="panel-head">
            <div>
              <h3>任务状态</h3>
              <p>当前未完成任务的结构。</p>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            <Donut data={data.byStatus.filter((s) => s.status !== 'done')} total={totalOpen} />
            <div style={{ flex: 1 }}>
              {data.byStatus
                .filter((s) => s.status !== 'done')
                .map((s) => (
                  <div key={s.status} style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 10.5, padding: '3px 0' }}>
                    <i style={{ width: 7, height: 7, borderRadius: 2, background: STATUS_COLORS[s.status] ?? 'var(--ink-3)', display: 'inline-block' }} />
                    <span style={{ color: 'var(--ink-2)' }}>{STATUS_NAMES[s.status] ?? s.status}</span>
                    <span style={{ marginLeft: 'auto', color: 'var(--ink-3)' }} className="tnum">
                      {s.count}
                    </span>
                  </div>
                ))}
            </div>
          </div>
        </section>
      </div>

      <div className="dash-grid">
        <section className="panel">
          <div className="panel-head">
            <div>
              <h3>需要关注</h3>
              <p>逾期、受阻或长时间没有动静的任务。</p>
            </div>
            <span className="chip soft">{data.needsAttention.length}</span>
          </div>
          {data.needsAttention.length === 0 ? (
            <div style={{ fontSize: 11, color: 'var(--ink-3)' }}>没有需要特别关注的任务。保持这个节奏。</div>
          ) : (
            data.needsAttention.map((item) => (
              <button
                key={item.taskId}
                className="attention-row"
                style={{ width: '100%', border: 'none', borderBottom: '1px solid var(--line-soft)', background: 'transparent', textAlign: 'left' }}
                onClick={() => openTask(item.taskId)}
              >
                <span className="t">{item.title}</span>
                <span className={`r ${item.reason === 'stale' ? 'stale' : ''}`}>
                  {item.reason === 'overdue'
                    ? `逾期 ${item.days} 天`
                    : item.reason === 'blocked'
                      ? '受阻'
                      : item.reason === 'due-today'
                        ? '今天到期'
                        : `${item.days || 7}+ 天未更新`}
                </span>
              </button>
            ))
          )}
        </section>

        <section className="panel">
          <div className="panel-head">
            <div>
              <h3>空间负载</h3>
              <p>各空间未完成任务数量。</p>
            </div>
          </div>
          {data.bySpace.map((space) => (
            <div key={space.spaceId} style={{ marginBottom: 10 }}>
              <div style={{ display: 'flex', fontSize: 10.5, marginBottom: 3 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <i style={{ width: 7, height: 7, borderRadius: '50%', background: space.color }} />
                  {space.name}
                </span>
                <span style={{ marginLeft: 'auto', color: 'var(--ink-3)' }} className="tnum">
                  {space.open}
                </span>
              </div>
              <div className="capacity-track" style={{ height: 4 }}>
                <i style={{ width: `${Math.min(100, (space.open / Math.max(1, ...data.bySpace.map((s) => s.open))) * 100)}%`, background: space.color }} />
              </div>
            </div>
          ))}
          {data.kpi.averageEstimateError > 0 && (
            <div style={{ fontSize: 10, color: 'var(--ink-3)', marginTop: 14, borderTop: '1px solid var(--line-soft)', paddingTop: 10 }}>
              预估偏差 {Math.round(data.kpi.averageEstimateError * 100)}% · 用实际专注时长回填后，估算会越来越准。
            </div>
          )}
        </section>
      </div>

      <Modal open={reviewOpen} onClose={() => setReviewOpen(false)} width={620} label="本周复盘">
        <ModalHeader
          title="本周复盘"
          description={review ? `${shortDate(review.weekStart)} — ${shortDate(review.weekEnd)} · 完成 ${review.completed.length} 项` : '正在汇总本周数据…'}
          onClose={() => setReviewOpen(false)}
        />
        <div className="modal-body">
          {review ? (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 18 }}>
                {[
                  ['完成任务', review.completed.length, '项'],
                  ['完成率', Math.round(review.completionRate * 100), '%'],
                  ['专注时长', review.focusMinutes, '分钟'],
                  ['专注会话', review.focusSessions, '次'],
                ].map(([label, value, suffix]) => (
                  <div key={String(label)} style={{ background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: 8, padding: '10px 12px' }}>
                    <div style={{ fontSize: 10, color: 'var(--ink-3)' }}>{label}</div>
                    <div className="tnum" style={{ fontSize: 22, fontWeight: 650, letterSpacing: '-0.5px', marginTop: 3 }}>
                      {value}<span style={{ fontSize: 10, color: 'var(--ink-3)', marginLeft: 2 }}>{suffix}</span>
                    </div>
                  </div>
                ))}
              </div>

              <div style={{ fontSize: 10.5, color: 'var(--ink-3)', marginBottom: 8 }}>每日完成</div>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, height: 92, borderBottom: '1px solid var(--line-soft)', paddingBottom: 6, marginBottom: 18 }}>
                {review.byDay.map((day) => {
                  const max = Math.max(1, ...review.byDay.map((d) => d.completed))
                  return (
                    <div key={day.date} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                      <span style={{ fontSize: 9, color: 'var(--ink-3)' }}>{day.completed || ''}</span>
                      <div
                        title={`${day.date}：完成 ${day.completed} 项`}
                        style={{
                          width: '100%',
                          maxWidth: 42,
                          height: Math.max(3, (day.completed / max) * 56),
                          background: day.completed ? 'var(--accent)' : 'var(--sunken)',
                          borderRadius: '3px 3px 0 0',
                          opacity: day.completed ? 0.9 : 0.6,
                        }}
                      />
                      <span style={{ fontSize: 8.5, color: 'var(--ink-3)' }}>{day.date.slice(8)}</span>
                    </div>
                  )
                })}
              </div>

              <div style={{ fontSize: 10.5, color: 'var(--ink-3)', marginBottom: 6 }}>项目贡献</div>
              {review.byProject.length === 0 && <div style={{ fontSize: 11, color: 'var(--ink-3)', marginBottom: 14 }}>本周还没有完成项。</div>}
              {review.byProject.map((project) => (
                <div key={project.projectId ?? project.name} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, padding: '4px 0' }}>
                  <span style={{ flex: 1 }}>{project.name}</span>
                  <span className="tnum" style={{ color: 'var(--ink-3)' }}>{project.count} 项</span>
                </div>
              ))}

              <div style={{ marginTop: 18, borderTop: '1px solid var(--line-soft)', paddingTop: 12 }}>
                {review.highlights.map((line) => (
                  <div key={line} style={{ display: 'flex', gap: 7, fontSize: 11.5, color: 'var(--ink-2)', lineHeight: 1.65, marginBottom: 4 }}>
                    <span style={{ color: 'var(--accent-strong)' }}>·</span>
                    {line}
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="skeleton" style={{ height: 180 }} />
          )}
        </div>
        <div className="modal-foot">
          <button className="btn primary" onClick={() => setReviewOpen(false)}>
            收下这份复盘
          </button>
        </div>
      </Modal>
    </div>
  )
}

function Kpi({
  label,
  value,
  suffix,
  foot,
  series,
  tone = 'neutral',
}: {
  label: string
  value: number
  suffix: string
  foot: string
  series: number[]
  tone?: 'neutral' | 'success' | 'accent' | 'danger'
}) {
  const color =
    tone === 'danger' ? 'var(--danger)' : tone === 'success' ? 'var(--success)' : tone === 'accent' ? 'var(--accent)' : 'var(--ink-2)'
  return (
    <div className="kpi">
      <div className="label">{label}</div>
      <div className="value">
        {value}
        <small>{suffix}</small>
      </div>
      <div className="foot">{foot}</div>
      <div className="spark">
        <Sparkline values={series} color={color} />
      </div>
    </div>
  )
}

function Sparkline({ values, color }: { values: number[]; color: string }) {
  if (values.length < 2) return null
  const max = Math.max(1, ...values)
  const width = 120
  const height = 26
  const points = values.map((v, i) => `${(i / (values.length - 1)) * width},${height - (v / max) * (height - 3) - 1}`).join(' ')
  return (
    <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" aria-hidden>
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.4" opacity="0.75" strokeLinejoin="round" />
    </svg>
  )
}

function TrendChart({ data, max }: { data: DashboardResult['trend']; max: number }) {
  const width = 640
  const height = 190
  const padX = 8
  const padTop = 12
  const padBottom = 26
  const innerW = width - padX * 2
  const innerH = height - padTop - padBottom
  const n = data.length
  const barW = Math.max(2, Math.min(14, innerW / n - 2))
  const focusMax = Math.max(10, ...data.map((d) => d.focusMinutes))
  const focusPoints = data
    .map((d, i) => {
      const x = padX + (i / Math.max(1, n - 1)) * innerW
      const y = padTop + innerH - (d.focusMinutes / focusMax) * innerH
      return `${x},${y}`
    })
    .join(' ')
  const labelEvery = Math.max(1, Math.round(n / 7))
  return (
    <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label="完成与专注趋势">
      {[0.25, 0.5, 0.75, 1].map((f) => (
        <line
          key={f}
          x1={padX}
          x2={width - padX}
          y1={padTop + innerH * (1 - f)}
          y2={padTop + innerH * (1 - f)}
          stroke="var(--line-soft)"
          strokeWidth="1"
        />
      ))}
      {data.map((d, i) => {
        const barH = (d.completed / max) * innerH
        const x = padX + (i / n) * innerW + (innerW / n - barW) / 2
        return (
          <g key={d.date}>
            <rect
              x={x}
              y={padTop + innerH - barH}
              width={barW}
              height={Math.max(0, barH)}
              rx={Math.min(2, barW / 2)}
              fill="var(--accent)"
              opacity={0.9}
            >
              <title>{`${d.date}：完成 ${d.completed} 项`}</title>
            </rect>
            {i % labelEvery === 0 && (
              <text
                x={x + barW / 2}
                y={height - 8}
                textAnchor="middle"
                fontSize="8.5"
                fill="var(--ink-3)"
              >
                {d.date.slice(5).replace('-', '/')}
              </text>
            )}
          </g>
        )
      })}
      <polyline points={focusPoints} fill="none" stroke="var(--info)" strokeWidth="1.6" strokeLinejoin="round" opacity="0.85" />
      {data.map((d, i) => (
        <circle
          key={`f-${d.date}`}
          cx={padX + (i / Math.max(1, n - 1)) * innerW}
          cy={padTop + innerH - (d.focusMinutes / focusMax) * innerH}
          r={2.2}
          fill="var(--info)"
        >
          <title>{`${d.date}：专注 ${d.focusMinutes} 分钟`}</title>
        </circle>
      ))}
    </svg>
  )
}

function Donut({ data, total }: { data: Array<{ status: string; count: number }>; total: number }) {
  const size = 104
  const r = 40
  const c = 2 * Math.PI * r
  if (total === 0) {
    return (
      <div style={{ width: size, height: size, display: 'grid', placeItems: 'center', borderRadius: '50%', border: '8px solid var(--sunken)', fontSize: 10, color: 'var(--ink-3)' }}>
        无任务
      </div>
    )
  }
  const segments = data.map((s, index) => ({
    status: s.status,
    dash: (s.count / total) * c,
    offset: data
      .slice(0, index)
      .reduce((acc, previous) => acc + (previous.count / total) * c, 0),
  }))
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-label="任务状态分布">
      <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--sunken)" strokeWidth={11} />
        {segments.map((segment) => (
          <circle
            key={segment.status}
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={STATUS_COLORS[segment.status] ?? 'var(--ink-3)'}
            strokeWidth={11}
            strokeDasharray={`${Math.max(0, segment.dash - 2)} ${c - Math.max(0, segment.dash - 2)}`}
            strokeDashoffset={-segment.offset}
          />
        ))}
      </g>
      <text x={size / 2} y={size / 2 - 2} textAnchor="middle" fontSize="18" fontWeight="650" fill="var(--ink)">
        {total}
      </text>
      <text x={size / 2} y={size / 2 + 13} textAnchor="middle" fontSize="8.5" fill="var(--ink-3)">
        未完成
      </text>
    </svg>
  )
}
