export default function StatCard({ value, unit, label, accent }) {
  return (
    <div className="lc-stat">
      <div className={`lc-stat__value ${accent ? 'lc-stat__value--accent' : ''}`}>
        {value}{unit && <span className="lc-stat__unit">{unit}</span>}
      </div>
      <div className="lc-stat__label">{label}</div>
    </div>
  );
}
