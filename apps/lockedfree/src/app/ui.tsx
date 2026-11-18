import type { ReactNode } from 'react';
import { Field } from '@base-ui/react/field'; import { Input } from '@base-ui/react/input'; import { Switch } from '@base-ui/react/switch';
export function TextField({ label, hint, value, onChange, type = 'text', readOnly = false, error, id, inputMode, placeholder }: { label: string; hint?: ReactNode; value: string; onChange?: (v: string) => void; type?: string; readOnly?: boolean; error?: string; id: string; inputMode?: 'decimal' | 'numeric' | 'text'; placeholder?: string }) {
  return (<Field.Root className="field" invalid={!!error}><Field.Label className="lbl" htmlFor={id}>{label}</Field.Label><Input id={id} type={type} value={value} readOnly={readOnly} inputMode={inputMode} placeholder={placeholder} onChange={(e) => onChange?.(e.target.value)} />{hint && <Field.Description className="hint">{hint}</Field.Description>}{error && <p className="err" role="alert">{error}</p>}</Field.Root>);
}
export function Toggle({ label, checked, onChange, hint, disabled }: { label: string; checked: boolean; onChange: (v: boolean) => void; hint?: ReactNode; disabled?: boolean }) {
  return (<div className="field"><div className="row"><Switch.Root className="sw" checked={checked} onCheckedChange={onChange} disabled={disabled} aria-label={label}><Switch.Thumb className="th" /></Switch.Root><span className="lbl">{label}</span></div>{hint && <span className="hint">{hint}</span>}</div>);
}
export const num = (s: string): number | null => { const n = parseFloat(s.replace(/,/g, '')); return Number.isFinite(n) ? n : null; };
export const SEBI = (<p className="disclaimer small"><strong>93% of individual F&amp;O traders lost money in FY22–FY24.</strong> That is SEBI's own finding from its study of the derivatives segment. The Gate does not make trading safe. It makes the habits behind those losses harder to repeat, on paper. Simulated — not real returns.</p>);
