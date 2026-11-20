import { useState, type ReactNode } from 'react';
import { Field } from '@base-ui/react/field'; import { Input } from '@base-ui/react/input'; import { Switch } from '@base-ui/react/switch';
export function TextField({ label, hint, value, onChange, type = 'text', readOnly = false, error, id, inputMode, placeholder }: { label: string; hint?: ReactNode; value: string; onChange?: (v: string) => void; type?: string; readOnly?: boolean; error?: string; id: string; inputMode?: 'decimal' | 'numeric' | 'text'; placeholder?: string }) {
  return (<Field.Root className="field" invalid={!!error}><Field.Label className="lbl" htmlFor={id}>{label}</Field.Label><Input id={id} type={type} value={value} readOnly={readOnly} inputMode={inputMode} placeholder={placeholder} onChange={(e) => onChange?.(e.target.value)} />{hint && <Field.Description className="hint">{hint}</Field.Description>}{error && <p className="err" role="alert">{error}</p>}</Field.Root>);
}
export function Toggle({ label, checked, onChange, hint, disabled }: { label: string; checked: boolean; onChange: (v: boolean) => void; hint?: ReactNode; disabled?: boolean }) {
  return (<div className="field"><div className="row"><Switch.Root className="sw" checked={checked} onCheckedChange={onChange} disabled={disabled} aria-label={label}><Switch.Thumb className="th" /></Switch.Root><span className="lbl">{label}</span></div>{hint && <span className="hint">{hint}</span>}</div>);
}
export const num = (s: string): number | null => { const n = parseFloat(s.replace(/,/g, '')); return Number.isFinite(n) ? n : null; };
export const SEBI = (<p className="disclaimer small"><strong>93% of individual F&amp;O traders lost money in FY22–FY24.</strong> That is SEBI's own finding from its study of the derivatives segment. The Gate does not make trading safe. It makes the habits behind those losses harder to repeat, on paper. Simulated — not real returns.</p>);

/** Ready-made answers as a radio group, with "Other" revealing a typing field. The stored value is always the plain answer (a preset's value, or what was typed). */
export function Choice({ id, label, hint, options, value, onChange, inputMode, otherLabel = 'Other', placeholder }: { id: string; label: string; hint?: ReactNode; options: [string, string][]; value: string; onChange: (v: string) => void; inputMode?: 'decimal' | 'numeric' | 'text'; otherLabel?: string; placeholder?: string }) {
  const isPreset = options.some(([v]) => v === value); const [other, setOther] = useState(value !== '' && !isPreset); const showOther = other || (value !== '' && !isPreset);
  return (<div className="field" role="radiogroup" aria-labelledby={id + '-l'}><span className="lbl" id={id + '-l'}>{label}</span>{hint && <span className="hint">{hint}</span>}
    <div className="chips" onKeyDown={(e) => {
      const keys = ['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp', 'Home', 'End']; if (!keys.includes(e.key)) return;
      const radios = Array.from(e.currentTarget.querySelectorAll<HTMLButtonElement>('[role="radio"]'));
      const at = radios.indexOf(e.target as HTMLButtonElement); if (at < 0) return;
      e.preventDefault(); const i = e.key === 'Home' ? 0 : e.key === 'End' ? radios.length - 1 : (at + (e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : -1) + radios.length) % radios.length;
      radios[i].click(); radios[i].focus();
    }}>{options.map(([v, text], i) => <button key={v} type="button" role="radio" tabIndex={!showOther && (value === v || (!isPreset && i === 0)) ? 0 : -1} aria-checked={!showOther && value === v} className="chip" onClick={() => { setOther(false); onChange(v); }}>{text}</button>)}
      <button type="button" role="radio" tabIndex={showOther ? 0 : -1} aria-checked={showOther} className="chip" onClick={() => { setOther(true); if (isPreset) onChange(''); }}>{otherLabel}</button></div>
    {showOther && <TextField id={id} label={otherLabel + ': type your own'} inputMode={inputMode} placeholder={placeholder} value={isPreset ? '' : value} onChange={onChange} />}</div>);
}
