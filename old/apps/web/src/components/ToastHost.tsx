import { CheckCircle2, Info, AlertTriangle } from 'lucide-react'
import { useToasts } from '@/stores/toast'

export function ToastHost() {
  const items = useToasts((s) => s.items)
  return (
    <div className="toasts" aria-live="polite">
      {items.map((item) => (
        <div key={item.id} className={`toast ${item.tone}`}>
          {item.tone === 'success' ? (
            <CheckCircle2 size={14} />
          ) : item.tone === 'error' ? (
            <AlertTriangle size={14} />
          ) : (
            <Info size={14} />
          )}
          <span>{item.message}</span>
        </div>
      ))}
    </div>
  )
}
