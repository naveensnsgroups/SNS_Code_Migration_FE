'use client';

interface Props {
  value: string;
  options: { label: string; value: string }[];
  onChange: (v: string) => void;
}

export default function SelectField({ value, options, onChange }: Props) {
  return (
    <div className="select-container" style={{ maxWidth: '240px' }}>
      <select
        className="form-select-premium"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map(opt => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}
