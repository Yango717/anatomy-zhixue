import { useState, useEffect } from 'react';
import { api } from '../utils/api';

function ModuleGroup({ label, modules, pctClass }) {
  const ICONS = {
    '运动系统': '🦴', '骨学': '🦴', '关节学': '🦴', '肌学': '💪',
    '消化系统': '🫁', '呼吸系统': '🫁', '泌尿系统': '🫘',
    '生殖系统': '🧬', '循环系统': '🫀', '脉管系统': '🫀',
    '感觉器': '👁', '神经系统': '🧠', '内分泌系统': '🧪', '绪论': '📖',
  };

  return (
    <div className="lp-module-group">
      <div className="lp-module-group__label">{label}</div>
      {modules.length === 0 ? (
        <p style={{ textAlign: 'center', color: 'var(--color-text-hint)', padding: 8, fontSize: 13 }}>
          暂无数据，开始学习后将显示
        </p>
      ) : (
        modules.map((m, i) => (
          <div className="lp-module-card" key={m.chapterId || i}>
            <span className="lp-module-card__icon">{ICONS[m.name] || '📘'}</span>
            <div className="lp-module-card__info">
              <div className="lp-module-card__name">{m.name}</div>
              {m.sub && <div className="lp-module-card__sub">{m.sub}</div>}
            </div>
            <span className={`lp-module-card__pct ${pctClass}`}>{m.pct}%</span>
          </div>
        ))
      )}
    </div>
  );
}

function TraitsCard({ traits }) {
  if (!traits || traits.length === 0) return null;
  return (
    <div className="lp-traits-card">
      <h3 className="lp-traits-card__title">📊 学习特点</h3>
      {traits.map((t) => (
        <div className="lp-trait-bar" key={t.label}>
          <span className="lp-trait-bar__label">{t.label}</span>
          <div className="lp-trait-bar__track">
            <div
              className="lp-trait-bar__fill"
              style={{ width: `${t.score}%`, background: t.color }}
            />
          </div>
          <span className="lp-trait-bar__score" style={{ color: t.color }}>
            {Math.round(t.score)}
          </span>
        </div>
      ))}
    </div>
  );
}

function AccuracyTrend({ dailyAccuracy }) {
  const validValues = dailyAccuracy.filter(v => v !== null);
  if (validValues.length === 0) {
    return (
      <div className="lp-trend">
        <h3 className="lp-trend__title">📈 近30天正确率趋势</h3>
        <p style={{ textAlign: 'center', color: 'var(--color-text-hint)', padding: 8, fontSize: 13 }}>
          完成测验后这里会显示正确率趋势
        </p>
      </div>
    );
  }
  const maxVal = Math.max(...validValues, 1);

  return (
    <div className="lp-trend">
      <h3 className="lp-trend__title">📈 近30天正确率趋势</h3>
      <div className="lp-trend__chart">
        {dailyAccuracy.map((v, i) => (
          <div
            key={i}
            className="lp-trend__bar"
            style={{
              height: v ? `${(v / maxVal) * 100}%` : '2%',
              opacity: v ? 0.5 + (v / maxVal) * 0.5 : 0.15,
            }}
          />
        ))}
      </div>
      <div className="lp-trend__labels">
        <span>Day 1</span>
        <span>Day 15</span>
        <span>Day 30</span>
      </div>
    </div>
  );
}

function ErrorDistribution({ errorDist }) {
  const totalCount = errorDist.reduce((s, e) => s + e.count, 0);
  return (
    <div className="lp-error-dist">
      <h3 className="lp-error-dist__title">📝 错误分布（近30天）</h3>
      {totalCount === 0 ? (
        <p style={{ textAlign: 'center', color: 'var(--color-text-hint)', padding: 8, fontSize: 13 }}>
          暂无错题数据
        </p>
      ) : (
      <div className="lp-error-dist__grid">
        {errorDist.map((e) => (
          <div className="lp-error-dist__item" key={e.type}>
            <div className="lp-error-dist__num">{e.count}</div>
            <div className="lp-error-dist__label">{e.label}</div>
          </div>
        ))}
      </div>
      )}
    </div>
  );
}

export default function LearningPortraitPage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.get('/learning-portrait')
      .then((d) => { setData(d); setError(null); })
      .catch((e) => {
        console.error('[LearningPortrait] load failed:', e);
        setError('数据加载失败，请刷新重试');
      });
  }, []);

  if (error) {
    return (
      <div className="learning-portrait">
        <div className="learning-portrait__header">
          <h1 className="learning-portrait__title">AI 学习画像</h1>
        </div>
        <p style={{ textAlign: 'center', color: 'var(--color-error)', padding: 'var(--spacing-lg)' }}>{error}</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="learning-portrait">
        <div className="learning-portrait__header">
          <h1 className="learning-portrait__title">AI 学习画像</h1>
        </div>
        <p style={{ textAlign: 'center', color: 'var(--color-text-hint)' }}>加载中...</p>
      </div>
    );
  }

  return (
    <div className="learning-portrait">
      <div className="learning-portrait__header">
        <h1 className="learning-portrait__title">AI 学习画像</h1>
        <div className="learning-portrait__subtitle">基于你的答题数据生成</div>
      </div>

      {/* Strengths & Weaknesses side by side on desktop */}
      <div className="lp-body">
        <ModuleGroup
          label="🏆 优势模块"
          modules={data.strengths}
          pctClass="lp-module-card__pct--high"
        />
        <ModuleGroup
          label="⚠️ 待强化模块"
          modules={data.weaknesses}
          pctClass="lp-module-card__pct--low"
        />
      </div>

      {/* Full-width sections */}
      <TraitsCard traits={data.traits} />
      <AccuracyTrend dailyAccuracy={data.dailyAccuracy} />
      <ErrorDistribution errorDist={data.errorDist} />
    </div>
  );
}
