import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAIContext } from './AIContextProvider';
import AutoPilotMiniOverlay from './AutoPilotMiniOverlay';

export default function AutoPilotMiniAvatar() {
  const {
    autoPilotEnabled,
    autoPilotPendingCheckin,
    autoPilotPlan,
    autoPilotStepIndex,
    isPlanExpired,
    switchHomeTab,
  } = useAIContext();
  const navigate = useNavigate();
  const location = useLocation();
  const isHome = location.pathname === '/' || location.pathname === '';
  const [showOverlay, setShowOverlay] = useState(false);

  if (!autoPilotEnabled) return null;

  const hasCheckin = autoPilotPendingCheckin && !autoPilotPendingCheckin.delivered;

  // Show badge when there are incomplete steps in a non-expired plan
  const hasIncompleteSteps = autoPilotPlan && !isPlanExpired(autoPilotPlan) &&
    autoPilotPlan.steps?.some((s, i) => i >= autoPilotStepIndex && !s.completed);

  const showBadge = hasCheckin || hasIncompleteSteps;

  function handleClick() {
    if (isHome) {
      // 首页：切换到自主学姐 Tab
      switchHomeTab('auto');
    } else {
      // 其他页面：弹出迷你计划浮窗
      setShowOverlay(!showOverlay);
    }
  }

  function handleCloseOverlay() {
    setShowOverlay(false);
  }

  function handleGoToPlan() {
    setShowOverlay(false);
    switchHomeTab('auto');
    navigate('/');
  }

  return (
    <>
      <div className="autopilot-mini-avatar" onClick={handleClick} title={isHome ? '自主学姐' : '查看学习计划'}>
        {/* Avatar circle */}
        <div className={`autopilot-mini-avatar__circle ${showBadge ? 'autopilot-mini-avatar__circle--alert' : ''}`}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="8" r="4" />
            <path d="M4 20c0-4 4-7 8-7s8 3 8 7" />
          </svg>
        </div>

        {/* Notification badge */}
        {showBadge && (
          <span className="autopilot-mini-avatar__badge" />
        )}

        {/* Auto label */}
        <span className="autopilot-mini-avatar__label">自动</span>
      </div>

      {/* Mini overlay for non-home pages */}
      {showOverlay && !isHome && (
        <AutoPilotMiniOverlay
          onClose={handleCloseOverlay}
          onGoToPlan={handleGoToPlan}
        />
      )}
    </>
  );
}
