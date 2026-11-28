/** The four askakshay products (28 Nov 2026). No imports, so the footer on every page carries only this list, not the status
 *  calendar that judges freshness (lib/family.ts). */
export type FamilyId = 'alpha' | 'rulebook' | 'tripwire' | 'apexpro';
export interface FamilyMember { id: FamilyId; name: string; host: string; href: string; what: string }

export const FAMILY: readonly FamilyMember[] = [
  { id: 'alpha', name: 'Alpha', host: 'alpha.askakshay.com', href: '/', what: 'The research desk. Screens, company evidence and what changed today, each with its source.' },
  { id: 'rulebook', name: 'Rulebook', host: 'lockedfree.askakshay.com', href: 'https://lockedfree.askakshay.com/', what: 'Published screens, a written plan and a paper ledger that keeps every loss.' },
  { id: 'tripwire', name: 'Tripwire', host: 'tripwire.askakshay.com', href: 'https://tripwire.askakshay.com/', what: 'Which public rules fired at the last close, with the evidence for and against.' },
  { id: 'apexpro', name: 'ApexPro', host: 'apexpro.askakshay.com', href: 'https://apexpro.askakshay.com/', what: 'A research workspace: source-labelled company evidence and your private research trail.' },
];
