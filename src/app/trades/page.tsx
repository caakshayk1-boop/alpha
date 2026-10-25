'use client';
// /trades/ is kept: the same Signals workspace, opened on its Paper record view.
import { SignalsWorkspace } from '@/components/signals/SignalsWorkspace';

export default function TradesPage() {
  return <SignalsWorkspace initial="record" />;
}
