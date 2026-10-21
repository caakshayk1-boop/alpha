'use client';

// Flip for the one page that animates a re-sort (the Screen), registered here so its code ships with that page only.
import { gsap } from 'gsap';
import { Flip } from 'gsap/Flip';

gsap.registerPlugin(Flip);
export { Flip };
