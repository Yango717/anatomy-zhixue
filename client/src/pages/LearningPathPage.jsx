import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../utils/api';

function SprintTimeline({ days }) {
  return (
    <div className="lp-timeline">
      {days.map((d) => (
        <div className="lp-day-card" key={d.day}>
          <div className="lp-day-card__header">
            <span className="lp-day-card__day">Day {d.day}</span>
            <span className="lp-day-card__date">{d.date}</span>
          </div>
          <div className="lp-day-card__tasks">
            {d.tasks.map((t, i) => (
              <span className="lp-day-card__tag" key={i}>{t}</span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function RescuePhases({ phases }) {
  return (
    <div>
      {phases.map((p) => (
        <div className={`lp-phase-card lp-phase-card--${p.phase}`} key={p.phase}>
          <div className="lp-phase-card__title">{p.title}</div>
          <div className="lp-phase-card__meta">⏱ {p.duration}</div>
          <div className="lp-phase-card__desc">{p.description}</div>
          <div className="lp-phase-card__tasks">
            {p.tasks.map((t, i) => (
              <span className="lp-day-card__tag" key={i}>{t}</span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function LearningPathPage() {
  const navigate = useNavigate();
  const { planType: urlPlanType } = useParams();
  const [mode, setMode] = useState(urlPlanType || 'sprint');
  const [data, setData] = useState(null);

  useEffect(() => {
    api.get(`/learning-path/${mode}`).then(setData).catch(() => {});
  }, [mode]);

  useEffect(() => {
    if (urlPlanType && urlPlanType !== mode) setMode(urlPlanType);
  }, [urlPlanType]);

  function handleModeSwitch(m) {
    setMode(m);
    navigate(`/path/${m}`, { replace: true });
  }

  return (
    <div className="learning-path">
      <div className="learning-path__header">
        <h1 className="learning-path__title">
          {data?.title || '学习路径推荐'}
        </h1>
        <div className="learning-path__subtitle">
          {data?.subtitle || '妍学姐为你量身规划'}
        </div>
      </div>

      <div className="lp-mode-switch">
        <button
          className={`lp-mode-switch__btn ${mode === 'sprint' ? 'lp-mode-switch__btn--active' : ''}`}
          onClick={() => handleModeSwitch('sprint')}
        >
          🏃 考前7天冲刺
        </button>
        <button
          className={`lp-mode-switch__btn ${mode === 'rescue' ? 'lp-mode-switch__btn--active' : ''}`}
          onClick={() => handleModeSwitch('rescue')}
        >
          🆘 挂科拯救计划
        </button>
      </div>

      {data && (
        data.type === 'sprint'
          ? <SprintTimeline days={data.days} />
          : <RescuePhases phases={data.phases} />
      )}

      <div className="lp-cta">
        <button
          className="btn btn--primary btn--lg"
          style={{ fontSize: 'var(--font-size-base)', padding: '12px 32px' }}
          onClick={() => navigate('/modules')}
        >
          🚀 开始执行计划
        </button>
      </div>
    </div>
  );
}
