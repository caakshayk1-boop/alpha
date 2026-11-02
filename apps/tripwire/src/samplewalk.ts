/** The sample walkthrough a new user sees on Today. It is TEXT about the workflow, with wording that is obviously a placeholder. It contains no company, no price, no figure, no signal and no
 *  record: nothing in it could be mistaken for data, and nothing in it is saved. A test holds every string to that (no digit, the word "sample" present, no ticker). */
export const SAMPLE_TITLE = 'Sample walkthrough';
export const SAMPLE_NOTICE = 'This is a sample. It shows the steps with made-up wording. It is not a real company, price, signal or record, and nothing here is saved.';
export interface SampleStep { title: string; body: string; /** an example of what you might write, always marked as sample wording */ example?: string }
export const SAMPLE_STEPS: readonly SampleStep[] = [
  { title: 'Find a company', body: 'Search a name or a symbol. Its page opens with the price and the time of that price, the case for and the case against, and what the screen measured.' },
  { title: 'Read both sides', body: 'The support and the countercase sit side by side. The screen flag level lists what the screen counted. It is not a finding that a company has no other risks.' },
  { title: 'Write a thesis and what would end it', body: 'In a sentence or two, say why the company interests you and what would make you drop the idea.', example: 'Sample wording: "I think sales can keep growing faster than costs. I drop the idea if that stops being true for two reports in a row."' },
  { title: 'Come back on a date you chose', body: 'Set a review date. When it arrives, Today lists the thesis as due, next to anything that changed in the companies you follow.' },
];
