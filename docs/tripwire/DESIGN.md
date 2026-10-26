# Tripwire design system (terminal)

One look, no themes. Taken from three references:

| From | Taken |
|---|---|
| Freshcast (`freshcast.xperiments.app`) | neutral near-black `#0A0A0A`, hairline borders, 6 to 8 px corners, white primary button, a faint diagonal weave behind the page, no colour in the chrome |
| The Daily Signal (`news.askakshay.com`) | the lime `#B8EF43` mark and JetBrains Mono for labels and figures |
| alpha (`alpha.askakshay.com`) | Inter Tight for reading text, near-black ink on paper tones (not used: Tripwire is dark only) |

Rules: colour is spent only where it means something. Green `#3DDC97` is up, red `#FF6B5E` is down, lime is live, selected or the brand. Everything numeric is monospace with tabular, slashed zeros. No gradients, blur, glow or moving colour fields. The only motion that is not a response to a tap is a price that is printing. Fonts are self-hosted (`static/fonts`, about 100 kB, with metric-matched fallbacks so the swap does not shift the page). Contrast: muted text is `#8F8F8F` on `#0A0A0A` (6.2:1). The brand mark and every app icon are flat, one colour on near-black (`tools/icons.mjs`).
