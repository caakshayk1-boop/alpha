export function QuestionOrb({ label, expanded, onClick }: { label: string; expanded: boolean; onClick: () => void }) {
  return <button type="button" className="question-orb-control" aria-expanded={expanded} onClick={onClick}>
    <span className="question-orb" aria-hidden="true"><i /><i /><i /></span>
    <span className="question-orb-label">{expanded ? 'Close questions' : 'Ask a question'} <small>Explore the evidence</small></span>
    <span className="sr">{label}</span>
  </button>;
}
