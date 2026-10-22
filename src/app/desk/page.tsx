'use client';
/** My Desk: one personal workspace, four tabs (Following, Research cards, Journal, Conditions). See components/desk/Desk.tsx. */
import Desk from '@/components/desk/Desk';

export default function DeskPage() {
  return <Desk start="following" />;
}
