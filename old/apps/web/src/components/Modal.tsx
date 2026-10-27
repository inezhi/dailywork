import { useEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'

export function Modal({
  open,
  onClose,
  children,
  width,
  label,
}: {
  open: boolean
  onClose: () => void
  children: ReactNode
  width?: number
  label?: string
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation()
        onClose()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null
  return createPortal(
    <div
      className="modal-scrim"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div className="modal" role="dialog" aria-modal="true" aria-label={label} style={{ width }}>
        {children}
      </div>
    </div>,
    document.body,
  )
}

export function ModalHeader({
  title,
  description,
  onClose,
}: {
  title: string
  description?: string
  onClose?: () => void
}) {
  return (
    <div className="modal-head">
      <div style={{ flex: 1 }}>
        <h3>{title}</h3>
        {description && <p>{description}</p>}
      </div>
      {onClose && (
        <button className="icon-btn ghost" style={{ width: 28, height: 28 }} onClick={onClose} aria-label="关闭">
          <X size={15} />
        </button>
      )}
    </div>
  )
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = '确认删除',
  danger = true,
  onConfirm,
  onClose,
  busy,
}: {
  open: boolean
  title: string
  description: string
  confirmLabel?: string
  danger?: boolean
  onConfirm: () => void
  onClose: () => void
  busy?: boolean
}) {
  return (
    <Modal open={open} onClose={onClose} label={title}>
      <ModalHeader title={title} description={description} onClose={onClose} />
      <div className="modal-foot">
        <button className="btn" onClick={onClose} disabled={busy}>
          取消
        </button>
        <button className={`btn ${danger ? 'danger' : 'primary'}`} onClick={onConfirm} disabled={busy}>
          {busy ? '处理中…' : confirmLabel}
        </button>
      </div>
    </Modal>
  )
}
