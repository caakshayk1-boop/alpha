import { Pill } from '../components/pills.tsx';
import { SAMPLE_NOTICE, SAMPLE_STEPS, SAMPLE_TITLE } from '../samplewalk.ts';

/** For a new user: how Tripwire is used, in four steps, in made-up wording. Marked SAMPLE in the heading and the notice, collapsed by default, and holding no company, price, signal or record. */
export function SampleWalkthrough() {
  return <section className="tsec card sample" aria-labelledby="t-sample" data-sec="sample" data-sample>
    <details>
      <summary><span className="row" style={{ gap: 8, flexWrap: 'wrap' }}><h2 id="t-sample" className="sec" style={{ margin: 0 }}>{SAMPLE_TITLE}</h2><Pill className="sample-pill">Sample, not real data</Pill></span></summary>
      <p className="small dim" style={{ margin: '10px 0' }} data-sample-notice>{SAMPLE_NOTICE}</p>
      <ol className="sample-steps">{SAMPLE_STEPS.map((x) => <li key={x.title}><b>{x.title}</b><span className="dim">{x.body}</span>{x.example && <em className="sample-ex">{x.example}</em>}</li>)}</ol>
    </details>
  </section>;
}
