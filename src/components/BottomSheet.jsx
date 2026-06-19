import { useState } from 'react'

export default function BottomSheet({ children, onClose }) {
  const [startY, setStartY] = useState(null)

  const onTouchStart = (e) => setStartY(e.touches[0].clientY)
  const onTouchEnd = (e) => {
    if (startY !== null && e.changedTouches[0].clientY - startY > 80) onClose()
    setStartY(null)
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-sheet"
        onClick={e => e.stopPropagation()}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        <div className="modal-handle" />
        {children}
      </div>
    </div>
  )
}
