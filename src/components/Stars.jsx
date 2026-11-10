export default function Stars({ value, count }) {
  if (value == null) return <span className="muted small">No ratings yet</span>;
  const full = Math.round(value);
  return (
    <span title={`${value.toFixed(1)} out of 5`}>
      <span className="stars" aria-hidden="true">{'★'.repeat(full)}<span className="off">{'★'.repeat(5 - full)}</span></span>{' '}
      <span className="small">{value.toFixed(1)}{count != null && <span className="muted"> ({count})</span>}</span>
      <span className="sr-only" style={{ position: 'absolute', left: -9999 }}>{value.toFixed(1)} out of 5 stars</span>
    </span>
  );
}
