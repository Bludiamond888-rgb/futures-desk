import { useEffect, type ReactNode } from 'react'

interface Props { title: string; onClose: () => void; children: ReactNode; wide?: boolean; footer?: ReactNode }

export function Modal({ title, onClose, children, wide, footer }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev }
  }, [onClose])
  return (
    <div className="modal-back" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className={`modal ${wide ? 'wide' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
        <header className="modal-head">
          <h3>{title}</h3>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">✕</button>
        </header>
        <div className="modal-body">{children}</div>
        {footer && <footer className="modal-foot">{footer}</footer>}
      </div>
    </div>
  )
}

interface ConfirmProps { title: string; message: ReactNode; confirmLabel?: string; danger?: boolean; onConfirm: () => void; onCancel: () => void }

export function ConfirmDialog({ title, message, confirmLabel = 'Confirm', danger, onConfirm, onCancel }: ConfirmProps) {
  return (
    <Modal title={title} onClose={onCancel} footer={<>
      <button type="button" className="btn ghost" onClick={onCancel}>Cancel</button>
      <button type="button" className={`btn ${danger ? 'danger' : 'primary'}`} onClick={onConfirm} data-testid="confirm">{confirmLabel}</button>
    </>}>
      <div className="confirm-msg">{message}</div>
    </Modal>
  )
}
