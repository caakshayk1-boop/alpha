'use client';
// Signals: three views (Setups, Paper record, Method and validation), hash-addressable. The views live in components/signals.
import { SignalsWorkspace } from '@/components/signals/SignalsWorkspace';

export default function SignalsPage() {
  return <SignalsWorkspace initial="setups" />;
}
