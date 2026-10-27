import { Check, ChevronRight, Download, Plus, Search, Sparkles, Timer } from 'lucide-react'
import { FocusRing } from '@/components/FocusRing'
import { StatusButton } from '@/components/StatusButton'
import { PriorityFlag, ProjectChip, TagChip } from '@/components/Chips'
import { EmptyState } from '@/components/EmptyState'

const TOKENS = [
  { name: 'canvas', value: 'var(--bg)', label: '画布' },
  { name: 'sunken', value: 'var(--sunken)', label: '侧栏' },
  { name: 'card', value: 'var(--card)', label: '卡片' },
  { name: 'line', value: 'var(--line)', label: '分隔线' },
  { name: 'ink', value: 'var(--ink)', label: '正文' },
  { name: 'ink-3', value: 'var(--ink-3)', label: '辅助' },
  { name: 'accent', value: 'var(--accent)', label: '强调' },
  { name: 'success', value: 'var(--success)', label: '成功' },
  { name: 'warning', value: 'var(--warning)', label: '警告' },
  { name: 'danger', value: 'var(--danger)', label: '危险' },
  { name: 'info', value: 'var(--info)', label: '信息' },
]

export function DesignPage() {
  return (
    <div className="page" style={{ maxWidth: 1080 }}>
      <div className="page-head">
        <div>
          <h1>设计系统</h1>
          <p className="page-sub">tokens、组件与状态的活文档。修改主题后这里会同步变化。</p>
        </div>
        <div className="head-right">
          <span className="chip soft">Living gallery</span>
        </div>
      </div>

      <section className="panel" style={{ marginBottom: 16 }}>
        <div className="panel-head">
          <div>
            <h3>色彩</h3>
            <p>冷白画布 + 经典蓝强调。语义色只表达含义。</p>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 10 }}>
          {TOKENS.map((token) => (
            <div key={token.name} style={{ border: '1px solid var(--line)', borderRadius: 8, overflow: 'hidden' }}>
              <div style={{ height: 46, background: token.value, borderBottom: '1px solid var(--line)' }} />
              <div style={{ padding: '7px 9px' }}>
                <div style={{ fontSize: 11, fontWeight: 550 }}>{token.label}</div>
                <div style={{ fontSize: 9, color: 'var(--ink-3)', marginTop: 2 }}>{token.name}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
        <section className="panel">
          <div className="panel-head">
            <div>
              <h3>字体</h3>
              <p>Inter + PingFang SC；文档阅读用 Source Serif。</p>
            </div>
          </div>
          <div style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-0.5px' }}>今天，做一件重要的事</div>
          <div style={{ fontSize: 18, fontWeight: 650, marginTop: 10 }}>二级标题 / Section</div>
          <div style={{ fontSize: 13, marginTop: 8, color: 'var(--ink-2)' }}>
            正文 13px，行高 1.55。中文优先 PingFang SC，数字使用 tabular numerals。
          </div>
          <div className="serif" style={{ fontSize: 16, marginTop: 12, color: 'var(--ink-2)' }}>
            文档阅读态使用 Source Serif 4，给长文一点呼吸。
          </div>
          <div className="muted" style={{ fontSize: 10.5, marginTop: 10 }}>辅助说明 / 10.5px · 用于时间、状态与元信息</div>
        </section>

        <section className="panel">
          <div className="panel-head">
            <div>
              <h3>签名元素</h3>
              <p>专注环：今天页、专注模式与仪表盘共用。</p>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 26 }}>
            <FocusRing size={92} stroke={6} value={0.62} label="62%" sublabel="今日进度" showHalo />
            <FocusRing size={64} stroke={5} value={0.3} label="15" sublabel="分钟" />
            <FocusRing size={44} stroke={4} value={0.85} label="85%" />
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 18, alignItems: 'center' }}>
            <button className="btn primary"><Timer size={14} /> 开始专注</button>
            <button className="btn">稍后</button>
            <button className="btn danger">删除</button>
          </div>
        </section>
      </div>

      <section className="panel" style={{ marginBottom: 14 }}>
        <div className="panel-head">
          <div>
            <h3>组件</h3>
            <p>按钮、输入、状态、标签与列表行。</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
          <button className="btn primary">主操作 <ChevronRight size={13} /></button>
          <button className="btn">次操作</button>
          <button className="btn sm">小按钮</button>
          <button className="btn lg">大按钮</button>
          <button className="icon-btn"><Search size={15} /></button>
          <button className="icon-btn"><Plus size={15} /></button>
          <span className="chip soft">默认标签</span>
          <span className="chip tag">#设计</span>
          <ProjectChip name="时序 1.0" color="#D97757" />
          <TagChip name="深度工作" color="#5E7D6B" />
        </div>
        <div style={{ display: 'flex', gap: 20, alignItems: 'center', flexWrap: 'wrap', marginBottom: 14 }}>
          <StatusButton status="next" />
          <StatusButton status="doing" />
          <StatusButton status="waiting" />
          <StatusButton status="blocked" />
          <StatusButton status="done" />
          <PriorityFlag priority="urgent" showLabel />
          <PriorityFlag priority="high" showLabel />
          <PriorityFlag priority="medium" showLabel />
          <PriorityFlag priority="low" showLabel />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <input className="field" placeholder="输入框，聚焦时出现 3px 强调光晕" />
          <select className="field">
            <option>下拉选择</option>
          </select>
        </div>
        <div className="list-card" style={{ marginTop: 14 }}>
          <div className="task-row">
            <StatusButton status="doing" />
            <div className="task-main">
              <div className="task-title">完成时序的行走骨架</div>
              <div className="task-sub">
                <ProjectChip name="时序 1.0" color="#D97757" />
                <span className="icon-pill">◷ 今天</span>
                <TagChip name="工程" />
              </div>
            </div>
            <div className="task-meta"><PriorityFlag priority="high" /></div>
            <div className="task-est">2 小时</div>
            <span className="task-arrow"><ChevronRight size={14} /></span>
          </div>
          <div className="task-row is-done">
            <StatusButton status="done" />
            <div className="task-main">
              <div className="task-title">写完设计 tokens</div>
              <div className="task-sub">完成于 2 小时前</div>
            </div>
            <div className="task-est">45 分钟</div>
          </div>
        </div>
      </section>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <section className="panel">
          <div className="panel-head">
            <div>
              <h3>空状态</h3>
              <p>空不是错误，是邀请。</p>
            </div>
          </div>
          <EmptyState
            icon={<Sparkles size={18} />}
            title="今天还没有安排"
            description="从一件小事开始。你可以随时把它放进项目或安排到某个时段。"
            action={<button className="btn primary"><Plus size={13} /> 新建任务</button>}
          />
        </section>
        <section className="panel">
          <div className="panel-head">
            <div>
              <h3>反馈</h3>
              <p>按钮、状态与保存提示都使用一致的语言。</p>
            </div>
          </div>
          <div className="insight">
            <span className="insight-icon positive"><Check size={13} /></span>
            <div>
              <h4>本周完成 12 项</h4>
              <p>比上周多 3 项。保持每天一件重要的事，比一次性冲刺更稳。</p>
            </div>
          </div>
          <div className="insight">
            <span className="insight-icon"><Download size={13} /></span>
            <div>
              <h4>保存是自动的</h4>
              <p>文档正文 850ms 防抖保存，任务标题 550ms，备注 750ms。状态会显示在标题右侧。</p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button className="toast" style={{ position: 'static', transform: 'none' }}>已保存</button>
            <button className="toast success" style={{ position: 'static', transform: 'none' }}>任务已完成</button>
          </div>
        </section>
      </div>

      <div style={{ marginTop: 20, fontSize: 10.5, color: 'var(--ink-3)', lineHeight: 1.8 }}>
        规则：单一强调色；半径按层级（输入 6 / 卡片 10 / 抽屉 14）；阴影极浅，靠 1px 边框分层；图标统一 Lucide；
        动效 120–200ms 且只响应用户动作；正文对比度不低于 WCAG AA。
      </div>
    </div>
  )
}
