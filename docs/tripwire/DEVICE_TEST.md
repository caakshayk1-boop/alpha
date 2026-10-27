# Device test: what only a real phone can answer

Status: **not run.** The automated checks (`comfort.mjs`, `beta.mjs`, `a11y.mjs`) use desktop Chromium with emulated sizes. They can show that a field is 16px, that a sticky bar does not cover a focused input when the viewport shrinks by a keyboard's height, and that nothing animates under reduced motion. They cannot show how an iPhone's keyboard, notch, haptics, or text-size setting actually behave. Nothing below has been done; do not report it as done.

Run on one recent iPhone (Safari, and the app added to the Home Screen) and one Android phone (Chrome). Fresh profile. 20 minutes. Tick or write what happened; do not fix anything during the run.

## Keyboard and sticky bars
- [ ] Discover: tap the search field. The field stays visible between the top bar and the tab bar, and nothing important is hidden behind the keyboard.
- [ ] Discover: tap "Ask in words" and type a sentence. Does the Apply button remain reachable without dismissing the keyboard?
- [ ] "+ Condition": tap the exact-value box; the slider and the live count are still visible.
- [ ] Company, "Thesis": type two lines into the thesis box, then the invalidation box; the Save button is reachable.
- [ ] Rotate to landscape on Discover and a company page. Bars do not take more than a third of the height.
- [ ] iPhone: no page zoom when a field gets focus (fields are 16px; this checks it for real).

## Reading
- [ ] Settings, Display & Brightness, Text Size: move to the largest "Larger Text" step, then the smallest. Open Today, a company page and the Lab. Nothing overlaps or is cut off; the mono figures and the proportional prose still sit on one baseline in cards.
- [ ] Read one company page for two minutes outdoors or in a bright room. Can you read the muted text (grey on black)? Note any line you could not.
- [ ] Bold Text on (iOS). Increase Contrast on (iOS). Note anything that disappears.

## Motion and haptics
- [ ] Reduce Motion on (iOS: Accessibility, Motion): open Today, Live and Discover. No glow pulse, no sliding, no rolling digits.
- [ ] Reduce Motion off: the live card glow is slow and does not distract. Scrolling Discover stays smooth.
- [ ] Haptics: toggle a switch in Profile and follow a name. Note whether anything is felt (Safari 17.4+ renders a system tap for a switch; other browsers may give nothing).

## Lock, offline, storage
- [ ] Turn on Screen lock; close the app; reopen. The phone's own unlock appears.
- [ ] Airplane mode, then open the app from the Home Screen. It says it is offline and shows the saved copy.
- [ ] Follow a name, write a thesis, close the app completely (swipe it away), open it again. They are there.
- [ ] Export all (JSON), then on a second device or a fresh profile import it. The follow, thesis and paper trade appear.

## Data
- [ ] Open the Data screen. Does "Pipeline health" match what you can see on the exchange (market open or shut, today's date)?
- [ ] Open the Live screen during market hours with the nightly picks held. Is the number of open positions plausible against the picks of the last two sessions?
