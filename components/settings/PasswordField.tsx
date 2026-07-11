'use client';

import { Eye, EyeOff } from 'lucide-react';

interface Props {
  value: string;
  visible: boolean;
  onChange: (v: string) => void;
  onToggleVisible: () => void;
  onFocus: () => void;
  onBlur: () => void;
}

export default function PasswordField({ value, visible, onChange, onToggleVisible, onFocus, onBlur }: Props) {
  return (
    <div className="input-with-button" style={{ maxWidth: '480px' }}>
      <input
        type={visible ? 'text' : 'password'}
        className="form-input-premium settings-text-input"
        placeholder="key not set (uses env variable fallback)"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={onFocus}
        onBlur={onBlur}
      />
      <button type="button" className="input-visibility-toggle" onClick={onToggleVisible}>
        {visible ? <EyeOff size={14} /> : <Eye size={14} />}
      </button>
    </div>
  );
}
