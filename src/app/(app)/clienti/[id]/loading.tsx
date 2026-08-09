export default function SchedaClienteLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-4 w-24 rounded" style={{ background: 'rgba(255,255,255,0.06)' }} />
      <div className="h-8 w-64 rounded" style={{ background: 'rgba(255,255,255,0.08)' }} />
      <div className="h-4 w-48 rounded" style={{ background: 'rgba(255,255,255,0.05)' }} />
      <div
        className="mt-8 h-40 rounded-xl border"
        style={{ borderColor: 'var(--bordo-tenue)', background: 'rgba(255,255,255,0.03)' }}
      />
    </div>
  )
}
