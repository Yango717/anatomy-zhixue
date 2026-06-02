import { useNavigate, useLocation } from 'react-router-dom';
import { useAIContext } from './AIContextProvider';

export default function AutoPilotMiniAvatar() {
  const {
    autoPilotEnabled,
    autoPilotPendingCheckin,
    autoPilotPlan,
    autoPilotStepIndex,
    isPlanExpired,
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
      // On home page, scroll to latest messages (ChatHomePage is already full-screen)
      window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
    } else {
      // On other pages, navigate to home chat
      navigate('/');
    }
  }

  return (
    <div className="autopilot-mini-avatar" onClick={handleClick} title="学姐自动驾驶中">
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
