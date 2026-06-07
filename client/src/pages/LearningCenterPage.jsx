import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import StatCard from '../components/learningcenter/StatCard';
import KnowledgeHeatmap from '../components/learningcenter/KnowledgeHeatmap';
import AISuggestion from '../components/learningcenter/AISuggestion';
import { api } from '../utils/api';

function getGreeting() {
  const h = new Date().getHours();
  if (h < 6) return '夜深了，注意休息 🌙';
  if (h < 12) return '早上好，今天也要加油 💪';
  if (h < 14) return '中午好，学完午休一下 ☀️';
  if (h < 18) return '下午好，继续冲 🚀';
  return '晚上好，今天辛苦了 🌟';
}

export default function LearningCenterPage() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);

  useEffect(() => {
    api.get('/learning-center').then(setData).catch(() => {});
  }, []);

  const greeting = getGreeting();

  return (
    <div className="learning-center">
      {/* Header */}
      <div className="learning-center__header">
        <div className="learning-center__greeting">{greeting}</div>
        <h1 className="learning-center__title">妍学姐学习中心</h1>
        {data && (
          <div className="learning-center__subtitle">
            你已经连续学习 {data.streak} 天了！
          </div>
        )}
      </div>

      {/* Stat Cards */}
      <div className="lc-stats">
        <StatCard
          value={data?.streak || '—'}
          unit="天"
          label="🔥 连续学习"
        />
        <StatCard
          value={data?.weeklyHours || '—'}
          unit="h"
          label="⏱ 本周学习时长"
          accent
        />
        <StatCard
          value={data?.testsDone || '—'}
          unit="题"
          label="📝 完成测试"
        />
        <StatCard
          value={data?.mastery || '—'}
          unit="%"
          label="🎯 当前掌握度"
          accent
        />
      </div>

      {/* Body: Heatmap + AI Suggestion */}
      <div className="lc-body">
        <KnowledgeHeatmap sections={data?.sectionProgress} />
        <AISuggestion suggestions={data?.suggestions} />
      </div>

      {/* Chat CTA */}
      <div className="lc-cta">
        <button
          className="btn btn--primary btn--lg"
          onClick={() => navigate('/chat')}
          style={{ fontSize: 'var(--font-size-base)', padding: '12px 32px' }}
        >
          💬 找学姐聊聊
        </button>
      </div>
    </div>
  );
}
