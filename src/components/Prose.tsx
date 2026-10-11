import type { ReactNode } from 'react';

/** Renders the small markdown subset the studies use (## headings, - or * bullets, **bold**) without touching innerHTML. */
function inline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith('**') && part.endsWith('**') ? <strong key={i}>{part.slice(2, -2)}</strong> : part,
  );
}

export default function Prose({ md }: { md: string }) {
  const out: ReactNode[] = [];
  let bullets: string[] = [];
  const flush = () => {
    if (bullets.length) {
      out.push(<ul key={`u${out.length}`}>{bullets.map((b, i) => <li key={i}>{inline(b)}</li>)}</ul>);
      bullets = [];
    }
  };
  for (const raw of md.split('\n')) {
    const line = raw.trimEnd();
    if (/^\s*[*-]\s+/.test(line)) { bullets.push(line.replace(/^\s*[*-]\s+/, '')); continue; }
    flush();
    if (/^##\s+/.test(line)) out.push(<h2 key={`h${out.length}`}>{line.replace(/^##\s+/, '')}</h2>);
    else if (line.trim()) out.push(<p key={`p${out.length}`}>{inline(line.trim())}</p>);
  }
  flush();
  return <div className="prose">{out}</div>;
}
