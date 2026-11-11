import type { ReactNode } from 'react';
import { Icon } from '../ui.tsx';
import { PageBar } from './common.tsx';
import { Fold } from './fold.tsx';
import { contactView } from '../contact.ts';
import { LEGAL_UPDATED, legalDate } from '../legal.ts';
import { MIN_TRADES } from '../ledger.ts';

/** Privacy and Terms: two standalone pages written from what the app really does (read from the source: store.ts, persist.ts, backupfile.ts, worker.js, news/*, pwa.ts, sw.js, _headers).
 *  A plain-language summary, not legal advice. Where a fact cannot be checked from the code, the page says "not verified" instead of guessing. */

/** The contact line: an address as a mailto link only when SUPPORT_EMAIL (src/contact.ts) is set; otherwise the plain sentence "Contact: not set up yet". */
export function ContactLine({ email }: { email?: string }) {
  const c = email === undefined ? contactView() : contactView(email);
  return <p className="small" data-contact={c.href ? 'set' : 'unset'} style={{ margin: 0 }}>{c.href ? <>Contact: <a href={c.href}>{c.email}</a></> : c.line}</p>;
}

function LegalPage({ id, title, lead, children }: { id: 'privacy' | 'terms'; title: string; lead: string; children: ReactNode }) {
  return <div className="mp read legal" data-legal={id}>
    {/* 11 Nov 2026 (revamp v2): the Print button left the header (with back, print and search the title wrapped under its own buttons on a phone); it sits under the lead */}
    <PageBar title={title} onBack sub={<span data-legal-updated>Last updated {legalDate(LEGAL_UPDATED)}</span>} />
    <p className="mp-meta legal-lead">{lead}</p>
    <button className="btn sm noprint legal-print" onClick={() => window.print()} aria-label="Print or save as PDF"><Icon n="print" />Print or save as PDF</button>
    {children}
    <section className="legal-end" aria-label="Contact and the other page">
      <ContactLine />
      <p className="small mute" style={{ margin: 'var(--sp-2) 0 0' }}>{id === 'privacy' ? <>The rules for using Tripwire are in the <a href="#/terms">terms of use</a>.</> : <>What Tripwire does with your information is in the <a href="#/privacy">privacy page</a>.</>}</p>
    </section>
  </div>;
}

const Body = ({ children }: { children: ReactNode }) => <div className="card small legal-body">{children}</div>;

export function Privacy() {
  return <LegalPage id="privacy" title="Privacy" lead="A plain-language account of what Tripwire does with your information, written from what the app does. The short version comes first; where something could not be checked, the page says so. Not legal advice.">
    <Fold id="short" title="In short" summary="Four facts, then the detail." open>
      <Body><ul>
        <li>Your notes, journal, plans, paper trades, follows and settings are saved in this browser, on this device. They are not sent to Tripwire or to anyone else.</li>
        <li>There is no account, no sign-in and no sync. Another device starts empty.</li>
        <li>Tripwire sets no cookies and runs no analytics, advertising or tracking of its own.</li>
        <li>To show prices and news, the app asks its own server, which asks public sources for the companies on your screen. Those requests name companies, not your notes.</li>
      </ul></Body>
    </Fold>
    <Fold id="device" title="What is kept on this device" summary="In this browser only: local storage, plus the offline copy of the app.">
      <Body>
        <p>Everything below stays in your browser. Tripwire has no server-side place to put it.</p>
        <ul>
          <li><b>What you write and choose:</b> followed companies, journal entries (with every earlier version), plans, paper trades, saved screens and comparisons, review notes, and your preferences, including the hypothetical equity and risk figures you type. Kept in local storage under one key.</li>
          <li><b>Small conveniences:</b> your last Discover search and where you had scrolled, the news list last shown and when you last looked, which paper trades you have already seen booked, the date of your last backup, the Lab settings, and the day of the data the page last showed. A one-time hand-off between Discover and the Lab uses session storage and ends with the tab.</li>
          <li><b>Screen lock, if you turn it on:</b> an identifier of a passkey on your device. It is a screen lock, not encryption.</li>
          <li><b>Offline copy:</b> a service worker keeps the app's own files and the last published data files (the screen and signals) so the app opens without a network. It never keeps live prices, news or any other <code>/api</code> answer, and it never holds your notes.</li>
        </ul>
        <p>Not used: cookies, IndexedDB, or any account. Clearing this site's data in your browser erases all of it, and a device you have not used starts empty.</p>
      </Body>
    </Fold>
    <Fold id="not" title="What is not collected" summary="No account, no analytics, no cookies, no third-party scripts.">
      <Body><ul>
        <li>No name, email address, phone number or password: there is no sign-up and no sign-in.</li>
        <li>No analytics, advertising, session recording or fingerprinting, and no third-party scripts, fonts or embedded widgets. The page's security policy lets your browser talk only to Tripwire's own address, so a third-party script could not load even by mistake.</li>
        <li>The app sets no cookies. Whether the hosting provider adds any of its own was not verified.</li>
        <li>An email sign-up box exists in the code but is switched off and sends nothing.</li>
        <li>Tripwire is not a place to enter broker details or account numbers, and it asks for none.</li>
      </ul></Body>
    </Fold>
    <Fold id="leaves" title="What leaves your device, and where it goes" summary="Company symbols and search words, to Tripwire's server, which asks public sources.">
      <Body>
        <p>Your browser talks to one place: <b>tripwire.askakshay.com</b>, hosted on Cloudflare. As for any website, Cloudflare receives your IP address and the address you asked for. The requests the app makes carry only these things: the symbols of the companies on the page you are viewing, the companies you follow or hold on paper (so their prices can be fetched), a company's name or symbol for its news and chart, and your choice of timeframe. They never carry notes, journal text, plans, amounts or your preferences.</p>
        <p>The server then asks these public sources on your behalf. The source sees the server's request, not your browser or your IP address:</p>
        <ul>
          <li><b>Yahoo Finance</b> for prices, charts, index levels, gold, silver, oil, currencies and Bitcoin. This is an unofficial source: it can be late, throttle or change without notice.</li>
          <li><b>Google News and Bing News</b> (their public news searches) for company headlines, searched with the company's name; and the press-release feeds of the <b>Reserve Bank of India</b> and <b>SEBI</b>. A scheduled job on GitHub reads these every 15 to 30 minutes and publishes one snapshot.</li>
          <li><b>GitHub</b> (raw.githubusercontent.com): the server reads the published news snapshot and status, the forward record of rule picks (the ledger), the factor sheet and the RSI sheet. These are the project's own files.</li>
        </ul>
        <p>The screen of companies and the company pages are static files published with the app. They are built daily from Yahoo Finance bars and annual statements.</p>
        <p>When you tap a headline, the publisher's own site opens and sees your visit under its own policy, outside Tripwire's control. Tripwire sends no referrer, so the site is not told which page you came from.</p>
      </Body>
    </Fold>
    <Fold id="server" title="What the server logs and keeps" summary="No database. Public answers are cached briefly. Request logs are held by Cloudflare: not verified.">
      <Body><ul>
        <li><b>No stored user data.</b> The server has no database and no user storage. Its only stored files are the app and the published data.</li>
        <li><b>Short-lived caches.</b> Public answers (a company's prices, a chart, a news search) are kept in Cloudflare's cache for between a few seconds and about six hours so the same question is not sent to the source again. A copy is stored under the company or search words, not under who asked.</li>
        <li><b>Two exceptions, both to stop abuse.</b> The Worker keeps a short-lived counter keyed by your IP address, for about a minute at a time, so one device cannot flood the price and news sources; and when you press Refresh now on News, a marker keyed by your IP address is kept for 30 seconds to stop repeated presses. These are kept in Cloudflare's cache only and expire on their own. Nothing else is keyed to you.</li>
        <li><b>Request logs: not verified.</b> The server's configuration turns on Cloudflare's request observability, so Cloudflare keeps request logs for the owner. Which fields they hold (such as the address requested, time, status and timing), whether your IP address is among them, and how long they are kept are set by Cloudflare and the owner's account, and were not verified for this page. The server's own code writes no log lines about visitors.</li>
        <li><b>Scheduled work.</b> Every 15 minutes the server may ask GitHub to run the news job. That request carries no visitor information.</li>
      </ul></Body>
    </Fold>
    <Fold id="backup" title="The backup file" summary="A file you ask for, made on your device, never received by Tripwire.">
      <Body>
        <p>Settings can save a backup (JSON) and a journal copy (CSV). Both are built in your browser and handed to your browser's downloads. Tripwire never receives them. Importing a backup reads the file locally and merges it.</p>
        <p>The backup holds the saved state: your journal with every version, plans, paper trades, followed names, saved screens and comparisons, review notes, preferences (including the hypothetical equity and risk figures you typed), a record of what you were last shown for followed names, and the time it was made. <b>It is plain text and not encrypted</b>: anyone who has the file can read it, so keep it as private as the notes in it.</p>
      </Body>
    </Fold>
    <Fold id="links" title="TradingView and other links" summary="A plain link. Nothing from TradingView is loaded into Tripwire.">
      <Body>
        <p>A TradingView button opens TradingView's own chart for a company in a new tab. It is a link, not an embed: no TradingView script or widget runs inside Tripwire, and the page's security policy would block one. TradingView sees your visit under its own terms and privacy policy, and the company's symbol is in the link.</p>
      </Body>
    </Fold>
    <Fold id="erase" title="Erasing your data" summary="Settings, then Delete all my data. Clearing site data removes the rest.">
      <Body>
        <p><b>Settings, Erase data, Delete all my data</b> removes your notes, plans, paper trades, follows and preferences from this device, and the kept copy of any unreadable saved data. It does not remove the small conveniences listed above or the offline copy of the app. To remove everything Tripwire stores, also clear this site's data in your browser's settings. Backup files you downloaded are yours and are not touched: delete them yourself.</p>
        <p>Because Tripwire holds no account or copy of your notes, there is nothing on its side to correct, export or delete. For the standard request records described above, write to the contact below.</p>
      </Body>
    </Fold>
    <Fold id="changes" title="Changes to this page" summary={`Last updated ${legalDate(LEGAL_UPDATED)}.`}>
      <Body><p>This page changes when what Tripwire does changes, for example if an account, sync or analytics were ever added. The date at the top changes with it.</p></Body>
    </Fold>
  </LegalPage>;
}

export function Terms() {
  return <LegalPage id="terms" title="Terms of use" lead="The rules for using Tripwire, in plain language. The short version comes first; each heading below opens its detail.">
    <Fold id="short" title="In short" summary="Six facts, then the detail." open>
      <Body><ul>
        <li>Research and education only. Every trade in Tripwire is a paper trade.</li>
        <li>Not investment advice, and no recommendation to buy, sell or hold anything.</li>
        <li>No order is ever placed, and Tripwire is connected to no broker or account.</li>
        <li>Data may be late, incomplete or wrong. Check the exchange before you rely on a figure.</li>
        <li>A short record proves nothing. Paper results are not real results.</li>
        <li>You are responsible for your own decisions.</li>
      </ul></Body>
    </Fold>
    <Fold id="what" title="What Tripwire is" summary="A paper-only research workspace for Indian listed companies.">
      <Body>
        <p>Tripwire shows which public rules fired at the last close, the evidence on each side, and keeps your own notes, plans and review dates on your device. It covers companies listed on the NSE, with prices in rupees and times in Indian Standard Time.</p>
        <p><b>Paper trading only.</b> Positions, plans and profit and loss in Tripwire are calculations on historical and delayed prices. They assume fills that real markets may not give you: prices can gap past a stop, orders can fail to fill, and costs, taxes and your own timing are not those in the model. Paper results are not real results.</p>
      </Body>
    </Fold>
    <Fold id="advice" title="Not investment advice" summary="Nothing here is a recommendation. No order is placed.">
      <Body>
        <p>Tripwire does not give investment advice and does not hold itself out as an investment adviser or research analyst. A rule that fired, a score, a flag or a case and countercase is a statement about data, not a suggestion to act. A name with no flags is not a name with no risks.</p>
        <p>No order is placed by Tripwire. It has no connection to any broker, exchange account or payment, and it cannot buy or sell anything for you. Trading and investing in securities carries a risk of loss, including loss of everything you put in. Speak to a qualified adviser about your own situation.</p>
        <p>Tripwire is not affiliated with or endorsed by the NSE, BSE, SEBI, Yahoo, Google, Microsoft, TradingView, GitHub or Cloudflare. Names are used only to say where data comes from.</p>
      </Body>
    </Fold>
    <Fold id="data" title="Data may be late or wrong" summary="Sources are public and some are unofficial. Every figure carries its date.">
      <Body>
        <p>Prices come from Yahoo Finance through Tripwire's server, and Yahoo is not an official exchange feed: it can lag, throttle, return gaps or change without notice. The screen and company figures are built daily from public bars and annual statements, and can be a session or more behind. Tripwire labels a price Live, Delayed, Last traded or Unavailable, and dates every figure; where the date is old, treat the figure as old. News is gathered by search and press-release feeds and can be incomplete, duplicated or wrong. The exchange's own figures and a company's own filings are the record, not Tripwire.</p>
      </Body>
    </Fold>
    <Fold id="record" title="A short record is not evidence" summary={`No win rate is shown until ${MIN_TRADES} trades have closed.`}>
      <Body>
        <p>The forward record is short and new. Tripwire states no win rate or average result until at least {MIN_TRADES} trades have closed, because fewer say nothing, and even then closed picks overlap and are not independent. Its own back-test did not find a supported edge for the momentum rule, and it says so. Nothing in Tripwire predicts prices, and nothing here is a claim that a rule will work in future. Do not treat any figure on a short record as a promise or a track record.</p>
      </Body>
    </Fold>
    <Fold id="warranty" title="No warranty" summary="Provided as it is, as a beta, without promises.">
      <Body>
        <p>Tripwire is an experimental, closed research beta provided as it is and as available. It comes with no warranty of any kind: not that it is accurate, complete, current, uninterrupted or fit for any purpose. It can be slow, wrong or unavailable, and a feature can be changed or removed.</p>
      </Body>
    </Fold>
    <Fold id="change" title="Rules and data can change" summary="Thresholds, rule versions and sources are versioned and can change.">
      <Body>
        <p>The rules, thresholds, cost assumptions, data sources and the screen's coverage can change. Tripwire labels results by the rule version in force when they were made, and an earlier result is not re-stated as if it had always followed the new rule. Because your notes live on your device, keep a backup (Settings) before you rely on them.</p>
      </Body>
    </Fold>
    <Fold id="you" title="You are responsible for your decisions" summary="What you do with what you read is your choice and your risk.">
      <Body>
        <p>You decide whether and how to use anything you read here, and you accept the risk of doing so. You are responsible for checking the data, for the notes and plans you write, for keeping your own backups, and for following the laws and tax rules that apply to you.</p>
      </Body>
    </Fold>
    <Fold id="liability" title="Limit of liability" summary="To the extent the law allows, no liability for losses from use.">
      <Body>
        <p>To the extent the law allows, the person who runs Tripwire is not liable for any loss or damage, including financial loss, loss of data or lost profit, that comes from using Tripwire or relying on anything in it. Nothing here limits a liability that cannot be limited by law.</p>
      </Body>
    </Fold>
    <Fold id="changes" title="Changes to these terms" summary={`Last updated ${legalDate(LEGAL_UPDATED)}.`}>
      <Body><p>These terms can change; the date at the top changes with them. Using Tripwire after a change means you accept the new terms.</p></Body>
    </Fold>
  </LegalPage>;
}
