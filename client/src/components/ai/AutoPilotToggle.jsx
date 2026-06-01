import { useAIContext } from './AIContextProvider';

export default function AutoPilotToggle() {
  const { autoPilotEnabled, toggleAutoPilot } = useAIContext();

  return (
    <button
      className={`autopilot-toggle ${autoPilotEnabled ? 'autopilot-toggle--on' : ''}`}
      onClick={toggleAutoPilot}
      title={autoPilotEnabled ? '自动驾驶中 — 点击切换手动' : '手动驾驶中 — 点击开启自动驾驶'}
    >
      <span className="autopilot-toggle__track">
        <span className="autopilot-toggle__thumb" />
      </span>
      <span className="autopilot-toggle__label">
        {autoPilotEnabled ? '自动' : '手动'}
      </span>
    </button>
  );
}
