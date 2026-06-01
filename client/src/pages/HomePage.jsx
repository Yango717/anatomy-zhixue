import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import CountdownCard from '../components/home/CountdownCard';
import RecommendCard from '../components/home/RecommendCard';
import SystemProgressRing from '../components/systems/SystemProgressRing';
import SystemIcon from '../components/systems/SystemIcon';
import AITutorBar from '../components/ai/AITutorBar';
import { api } from '../utils/api';
import { CHAPTER_NAMES } from '../utils/constants';

export default function HomePage() {
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);

  useEffect(() => {
    api.get('/progress/overview').then((d) => setStats(d)).catch(() => {});
  }, []);

  const chapterProgress = stats?.chapterProgress || [];

  return (
    <div className="home-page">
      <div className="home-page__body">
        <CountdownCard />

        <AITutorBar />

        <button className="btn btn--primary btn--lg btn--block home-cta"
          onClick={() => navigate('/modules')}>
          探索人体系统
        </button>

        {/* Body systems overview */}
        <div className="home-section">
          <h3 className="home-section__title">人体系统</h3>
          <div className="home-systems">
            {chapterProgress.map((ch) => (
              <button key={ch.chapterId} className="home-sys"
                onClick={() => navigate('/modules')}>
                <SystemIcon chapterId={ch.chapterId} size={28} />
                <span className="home-sys__name">{CHAPTER_NAMES[ch.chapterId] || ch.chapterId}</span>
                <span className="home-sys__count">{ch.completedUnits || 0}/{ch.totalUnits || 0}</span>
              </button>
            ))}
          </div>
        </div>

        <RecommendCard />

        {stats && (
          <div className="home-section">
            <div className="home-overall">
              <div className="home-overall__header">
                <span>总进度</span>
                <span className="home-overall__pct">{stats.percentage || 0}%</span>
              </div>
              <div className="home-overall__bar">
                <div className="home-overall__fill" style={{ width: `${stats.percentage || 0}%` }} />
              </div>
              <span className="home-overall__detail">
                {stats.completedUnits || 0}/{stats.totalUnits || 0} 单元已完成
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
