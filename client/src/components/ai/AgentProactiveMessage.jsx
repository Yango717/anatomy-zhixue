import { useNavigate } from 'react-router-dom';
import { useAIContext } from './AIContextProvider';

function AvatarIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c0-4 4-7 8-7s8 3 8 7" />
    </svg>
  );
}

export default function AgentProactiveMessage() {
  const navigate = useNavigate();
  const { agentMessages, dismissAgentMessage } = useAIContext();

  if (!agentMessages || agentMessages.length === 0) return null;

  // 只显示最新的一条
  const latest = agentMessages[agentMessages.length - 1];

  function handleAction() {
    if (latest.actionRoute) {
      dismissAgentMessage(latest.id);
      navigate(latest.actionRoute);
    }
  }

  function handleDismiss() {
    dismissAgentMessage(latest.id);
  }

  return (
    <div className="agent-toast">
      <div className="agent-toast__row">
        <div className="agent-toast__avatar">
          <AvatarIcon />
        </div>
        <div className="agent-toast__bubble">
          <div className="agent-toast__name">妍学姐</div>
          <div className="agent-toast__msg">{latest.message}</div>
          <div className="agent-toast__actions">
            {latest.actionLabel && (
              <button className="btn btn--primary btn--sm" onClick={handleAction}>
                {latest.actionLabel}
              </button>
            )}
            <button className="btn btn--ghost btn--sm" onClick={handleDismiss}>
              稍后再说
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
