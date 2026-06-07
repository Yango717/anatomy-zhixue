function getBarClass(pct) {
  if (pct >= 85) return 'lc-heatmap__bar--high';
  if (pct >= 70) return 'lc-heatmap__bar--mid';
  if (pct >= 55) return 'lc-heatmap__bar--low';
  return 'lc-heatmap__bar--critical';
}

export default function KnowledgeHeatmap({ sections }) {
  if (!sections || sections.length === 0) {
    return (
      <div className="lc-heatmap">
        <h3 className="lc-heatmap__title">知识掌握热力图</h3>
        <p style={{ textAlign: 'center', color: 'var(--color-text-hint)', padding: 16, fontSize: 13 }}>
          完成学习后这里会显示你的掌握热力图
        </p>
      </div>
    );
  }

  return (
    <div className="lc-heatmap">
      <h3 className="lc-heatmap__title">知识掌握热力图</h3>
      {sections.map((s) => (
        <div className="lc-heatmap__item" key={s.sectionId}>
          <span className="lc-heatmap__name">{s.name}</span>
          <div className="lc-heatmap__bar-wrap">
            <div
              className={`lc-heatmap__bar ${getBarClass(s.pct)}`}
              style={{ width: `${Math.max(s.pct, 8)}%` }}
            >
              <span className="lc-heatmap__pct">{s.pct}%</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
