import { ReactNode } from 'react'

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
    return (
        <div className="modal" onClick={onClose}>
            <div className="modal__box" onClick={e => e.stopPropagation()}>
                <div className="modal__head">
                    <h2 className="modal__title">{title}</h2>
                    <button className="btn btn--ghost" onClick={onClose} aria-label="Close">✕</button>
                </div>
                {children}
            </div>
        </div>
    )
}