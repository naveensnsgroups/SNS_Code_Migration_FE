'use client';

interface Props {
  value: string;
  onChange: (v: string) => void;
  onFocus: () => void;
  onBlur: () => void;
}

export default function StringField({ value, onChange, onFocus, onBlur }: Props) {
  return (
    <input
      type="text"
      className="form-input-premium settings-text-input"
      style={{ maxWidth: '480px' }}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onFocus={onFocus}
      onBlur={onBlur}
    />
  );
}
