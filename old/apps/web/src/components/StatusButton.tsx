import { Check } from 'lucide-react'
import type { Task } from '@daily/contracts'

export function StatusButton({
  status,
  onClick,
  size = 17,
}: {
  status: Task['status']
  onClick?: (event: React.MouseEvent) => void
  size?: number
}) {
  return (
    <button
      type="button"
      aria-label={status === 'done' ? '重新打开任务' : '完成任务'}
      title={status === 'done' ? '重新打开' : '标记完成'}
      className={`status-btn ${status}`}
      style={{ width: size, height: size }}
      onClick={(event) => {
        event.stopPropagation()
        onClick?.(event)
      }}
    >
      {status === 'done' && <Check size={Math.max(9, size - 8)} strokeWidth={3} />}
    </button>
  )
}
