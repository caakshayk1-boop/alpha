/** How long a toast stays: 2.6 s for a short one (as before), longer in proportion to its length, at most 9 s (about 60 ms a character, a little slower than reading speed so a message
 *  with a number or a name in it can be read, not only seen). A toast is also announced politely, so nothing is lost to a screen reader either way. */
export const toastMs = (m: string): number => Math.min(9000, Math.max(2600, 1400 + m.length * 60));
