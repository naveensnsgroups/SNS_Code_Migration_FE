'use client';

interface Props {
  checked: boolean;
  onToggle: () => void;
}

export default function BooleanToggle({ checked, onToggle }: Props) {
  return (
    <div className="toggle-switch" onClick={onToggle} style={{ cursor: 'pointer' }}>
      <input type="checkbox" checked={checked} onChange={() => {}} />
      <span className="toggle-slider"></span>
    </div>
  );
}
