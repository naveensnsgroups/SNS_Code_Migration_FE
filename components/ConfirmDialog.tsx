// Theia-style confirm dialog — overlay + centered card + title bar + button row,
// matching the real SNS IDE (packages/core/src/browser/dialogs.ts ConfirmDialog),
// themed with our existing CSS variables instead of a native window.confirm().
'use client';

import { X } from 'lucide-react';

interface Props {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmDialog({
  open, title, message,
  confirmLabel = 'OK', cancelLabel = 'Cancel',
  onConfirm, onCancel,
}: Props) {
  if (!open) return null;

  return (
    <div className="dialog-overlay" onClick={onCancel}>
      <div className="dialog-block" onClick={e => e.stopPropagation()}>
        <div className="dialog-title">
          <span>{title}</span>
          <button type="button" className="dialog-title__close" onClick={onCancel} title="Close">
            <X size={14} />
          </button>
        </div>
        <div className="dialog-content">{message}</div>
        <div className="dialog-control">
          <button type="button" className="theia-button secondary" onClick={onCancel}>
            {cancelLabel}
          </button>
          <button type="button" className="theia-button main" onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
