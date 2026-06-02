import { useNavigate, useLocation } from 'react-router-dom';
import { useAIContext } from './AIContextProvider';

export default function AutoPilotMiniAvatar() {
  const {
    autoPilotEnabled,
    autoPilotPendingCheckin,
    autoPilotPlan,
    autoPilotStepIndex,
    isPlanExpired,
    setGlobalChatOpen,
  } = useAIContext();
  const navigate = useNavigate();
  const location = useLocation();
  const isHome = location.pathname === '/' || location.pathname === '';

  if (!autoPilotEnabled) return null;

  const hasCheckin = autoPilotPendingCheckin && !autoPilotPendingCheckin.delivered;

  // Show badge when there are incomplete steps in a non-expired plan
  const hasIncompleteSteps = autoPilotPlan && !isPlanExpired(autoPilotPlan) &&
    autoPilotPlan.steps?.some((s, i) => i >= autoPilotStepIndex && !s.completed);

  const showBadge = hasCheckin || hasIncompleteSteps;

  function handleClick() {
    if (isHome) {
      // 首页：滚动到最新消息
      window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
    } else {
      // 其他页面：打开聊天气泡（小窗），不跳转整页
      setGlobalChatOpen(true);
    }
  }

  return (
    <div className="autopilot-mini-avatar" onClick={handleClick} title={isHome ? '滚动到最新消息' : '打开学姐对话'}>
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
  );
}
