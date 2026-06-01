import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { api } from '../../utils/api';

function calcRemaining(targetISO) {
  if (!targetISO) return null;
  const diff = new Date(targetISO).getTime() - Date.now();
  if (diff <= 0) return { days: 0, expired: true };
  return {
    days: Math.floor(diff / (1000 * 60 * 60 * 24)),
    expired: false,
  };
}

const NAV_ITEMS = [
  { key: 'systems', label: '系统', path: '/modules', icon: '🧬' },
  { key: 'review', label: '复习', path: '/review', icon: '📖' },
  { key: 'exam', label: '考试', path: '/exam', icon: '📝' },
  { key: 'me', label: '我的', path: '/me', icon: '👤' },
];

export default function Sidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const [countdownName, setCountdownName] = useState('');
  const [countdownTarget, setCountdownTarget] = useState('');
  const [daysLeft, setDaysLeft] = useState(null);

  // Load countdown
  useEffect(() => {
    api.get('/countdown').then((data) => {
      setCountdownName(data.name || '');
      setCountdownTarget(data.target || '');
    }).catch(() => {});
  }, []);

  // Tick countdown
  useEffect(() => {
    if (!countdownTarget) return;
    const tick = () => setDaysLeft(calcRemaining(countdownTarget));
    tick();
    const timer = setInterval(tick, 60000); // per minute is enough for sidebar
    return () => clearInterval(timer);
  }, [countdownTarget]);

  function getActiveKey() {
    const p = location.pathname;
    if (p === '/' || p === '') return 'home';
    if (p.startsWith('/modules') || p.startsWith('/sections') || p.startsWith('/learn') || p.startsWith('/quiz')) return 'systems';
    if (p.startsWith('/review') || p === '/review') return 'review';
    if (p.startsWith('/exam') || p.startsWith('/test') || p.startsWith('/finalexam') || p.startsWith('/practice')) return 'exam';
    if (p === '/me' || p.startsWith('/me')) return 'me';
    return '';
  }

  const activeKey = getActiveKey();
  const isHome = location.pathname === '/' || location.pathname === '';

  return (
    <>
      {/* Desktop: left sidebar */}
      <aside className="sidebar">
        {/* Logo */}
        <div className="sidebar__logo" onClick={() => navigate('/')}>
          <span className="sidebar__logo-icon">解</span>
          <span className="sidebar__logo-text">解剖闪背</span>
        </div>

        {/* Countdown */}
        <div className="sidebar__countdown">
          {daysLeft ? (
            daysLeft.expired ? (
              <span className="sidebar__cd-expired">考试已到</span>
            ) : (
              <>
                <span className="sidebar__cd-days">{daysLeft.days}</span>
                <span className="sidebar__cd-label">天</span>
              </>
            )
          ) : (
            <span className="sidebar__cd-label">设置考期</span>
          )}
          {countdownName && (
            <span className="sidebar__cd-name">{countdownName}</span>
          )}
        </div>

        {/* Nav */}
        <nav className="sidebar__nav">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.key}
              className={`sidebar__item ${activeKey === item.key ? 'sidebar__item--active' : ''}`}
              onClick={() => navigate(item.path)}
            >
              <span className="sidebar__item-icon">{item.icon}</span>
              <span className="sidebar__item-label">{item.label}</span>
            </button>
          ))}
        </nav>
      </aside>

      {/* Mobile: bottom tab bar */}
      <nav className="bottom-tabs">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.key}
            className={`bottom-tabs__item ${activeKey === item.key ? 'bottom-tabs__item--active' : ''}`}
            onClick={() => navigate(item.path)}
          >
            <span className="bottom-tabs__icon">{item.icon}</span>
            <span className="bottom-tabs__label">{item.label}</span>
          </button>
        ))}
      </nav>
    </>
  );
}
