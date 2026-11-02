import { useEffect } from 'react';
import { PageBar } from './common.tsx';
import { EmptyState } from '../components/index.ts';
import { useSheets } from '../app.tsx';

/** The view for an address the app does not have: an unknown route, or a company that is not in the published screen. It says what was asked (as text, never as a link or markup),
 *  gives a way to search, and links to the three places that always exist. The document title is "Not found". */
export function NotFound({ asked, company, total }: { asked: string; company?: boolean; total?: number | null }) {
  const { open } = useSheets();
  useEffect(() => { document.title = 'Not found · Tripwire'; }, []);
  return <div className="read nf" data-notfound={company ? 'company' : 'route'}>
    <PageBar title={company ? 'We do not have this company' : 'Not found'} onBack />
    <EmptyState icon="search" action={<button className="btn pri" onClick={() => open({ k: 'search' })}>Search companies</button>}>
      {company
        ? <>There is no company called <b className="nf-asked" data-asked>{asked}</b> in the screen{total ? <>, which holds {total.toLocaleString('en-IN')} listed companies</> : null}. Check the symbol, or search by name.</>
        : <>There is no page at <b className="nf-asked" data-asked>{asked}</b>. The link may be old or mistyped.</>}
    </EmptyState>
    <nav className="card" aria-label="Places to go" style={{ marginTop: 'var(--sp-4)' }}><div className="list">
      <a className="li" href="#/today"><span className="grow">Today<span className="small dim" style={{ display: 'block' }}>The market read and the last close's picks</span></span></a>
      <a className="li" href="#/discover"><span className="grow">Discover<span className="small dim" style={{ display: 'block' }}>Filter the screen of listed companies</span></span></a>
      <a className="li" href="#/more"><span className="grow">More<span className="small dim" style={{ display: 'block' }}>Data, methodology, help, settings, privacy and terms</span></span></a>
    </div></nav>
  </div>;
}
