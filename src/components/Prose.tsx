import type { ReactNode } from 'react';

/** Renders the small markdown subset the studies use, without touching innerHTML:
 *  ## headings, - or * bullets, | tables |, **bold**, *italic* and [links](https://...). Links open only http(s) addresses. */
function inline(text: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|\*[^*\s][^*]*\*|\[[^\]]+\]\(https?:\/\/[^)\s]+\))/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let k = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const t = m[0];
    if (t.startsWith('**')) out.push(<strong key={k++}>{t.slice(2, -2)}</strong>);
    else if (t.startsWith('[')) { const [, label, url] = /^\[([^\]]+)\]\((.+)\)$/.exec(t)!; out.push(<a key={k++} href={url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-2)', textDecoration: 'underline' }}>{label}</a>); }
    else out.push(<em key={k++}>{t.slice(1, -1)}</em>);
    last = m.index + t.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

const cells = (line: string) => line.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
const isDivider = (line: string) => /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(line);

/** URL-safe id for a heading, so an article index can link to it. */
export const slug = (t: string) => t.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
/** The `##` headings of a study, in order. */
export const headingsOf = (md: string) => md.split('\n').filter((l) => /^##\s+/.test(l)).map((l) => l.replace(/^##\s+/, '').trim());

export default function Prose({ md }: { md: string }) {
  const out: ReactNode[] = [];
  let bullets: string[] = [];
  let table: string[][] = [];
  const flush = () => {
    if (bullets.length) {
      out.push(<ul key={`u${out.length}`}>{bullets.map((b, i) => <li key={i}>{inline(b)}</li>)}</ul>);
      bullets = [];
    }
    if (table.length) {
      const [head, ...body] = table;
      out.push(
        <div className="tbl-wrap" key={`t${out.length}`} style={{ maxHeight: 'none', margin: '14px 0' }}>
          <table className="tbl" style={{ minWidth: 0 }}>
            <thead><tr>{head.map((c, i) => <th key={i}>{inline(c)}</th>)}</tr></thead>
            <tbody>{body.map((r, i) => <tr key={i} style={{ cursor: 'default' }}>{r.map((c, j) => <td key={j}>{inline(c)}</td>)}</tr>)}</tbody>
          </table>
        </div>,
      );
      table = [];
    }
  };
  for (const raw of md.split('\n')) {
    const line = raw.trimEnd();
    if (/^\s*\|.*\|\s*$/.test(line)) { if (!isDivider(line)) table.push(cells(line)); continue; }
    if (/^\s*[*-]\s+/.test(line)) { if (table.length) flush(); bullets.push(line.replace(/^\s*[*-]\s+/, '')); continue; }
    flush();
    if (/^##\s+/.test(line)) out.push(<h2 key={`h${out.length}`} id={slug(line.replace(/^##\s+/, ''))}>{line.replace(/^##\s+/, '')}</h2>);
    else if (line.trim()) out.push(<p key={`p${out.length}`}>{inline(line.trim())}</p>);
  }
  flush();
  return <div className="prose">{out}</div>;
}
