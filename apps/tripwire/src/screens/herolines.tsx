import { useState } from 'react';
import { HERO_LINE, HERO_NOTE, dismissHero, heroDue } from '../hero.ts';
import { Icon } from '../ui.tsx';

/** The first-visit line on Today (hero.ts holds the rule). A plain section, not a dialog: no focus trap, nothing over the page, nothing on a timer. */
export function HeroLine() {
  const [due, setDue] = useState(() => heroDue());
  if (!due) return null;
  return <section className="tsec t-heroline" aria-labelledby="t-heroline" data-hero-line>
    <p className="hl-copy" id="t-heroline"><b className="hl-h">{HERO_LINE}</b> <span className="small dim hl-p">{HERO_NOTE}</span></p>
    <button type="button" className="hl-x" aria-label="Dismiss this introduction" data-hero-dismiss onClick={() => { dismissHero(); setDue(false); }}><Icon n="x" /></button>
  </section>;
}
