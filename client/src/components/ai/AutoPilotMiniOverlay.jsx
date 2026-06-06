import { useNavigate } from 'react-router-dom';
import { useAIContext } from './AIContextProvider';

export default function AutoPilotMiniOverlay({ onClose, onGoToPlan }) {
  const {
    autoPilotPlan,
    autoPilotStepIndex,
    isPlanExpired,
  } = useAIContext();
  const navigate = useNavigate();

  const plan = autoPilotPlan;
  const planValid = plan && !isPlanExpired(plan);
  const steps = planValid ? plan.steps || [] : [];
  const completedCount = steps.filter(s => s.completed).length;
  const totalCount = steps.length;
  const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
  const currentStep = planValid ? steps[autoPilotStepIndex] : null;
  const allComplete = planValid && completedCount >= totalCount && totalCount > 0;

  function handleAction(route) {
    onClose();
    navigate(route);
  }

  return (
    <div className="autopilot-mini-overlay">
      <div className="autopilot-mini-overlay__header">
        <span className="autopilot-mini-overlay__title">📋 今日计划</span>
        <button className="autopilot-mini-overlay__close" onClick={onClose}>✕</button>
      </div>

      {planValid ? (
        <>
          <div className="autopilot-mini-overlay__progress">
            <span className="autopilot-mini-overlay__progress-text">{completedCount}/{totalCount} 完成</span>
            <div className="autopilot-mini-overlay__progress-bar">
              <div className="autopilot-mini-overlay__progress-fill" style={{ width: `${progressPercent}%` }} />
            </div>
          </div>

          <div className="autopilot-mini-overlay__current">
            {allComplete ? (
              <span className="autopilot-mini-overlay__step-text">🎉 今日计划全部完成！</span>
            ) : currentStep ? (
              <>
                <span className="autopilot-mini-overlay__step-text">▶ {currentStep.title}</span>
                {currentStep.route && (
                  <button className="autopilot-mini-overlay__action" onClick={() => handleAction(currentStep.route)}>
                    {currentStep.actionLabel || '去完成'}
                  </button>
                )}
              </>
            ) : (
              <span className="autopilot-mini-overlay__step-text">暂无进行中的任务</span>
            )}
          </div>
        </>
      ) : (
        <div className="autopilot-mini-overlay__current">
          <span className="autopilot-mini-overlay__step-text">计划已过期，请重新生成</span>
        </div>
      )}

      <div className="autopilot-mini-overlay__link" onClick={onGoToPlan}>
        查看完整计划 →
      </div>
    </div>
  );
}
