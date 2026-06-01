import useVoice from '../../hooks/useVoice';

export default function VoiceInputButton({ onResult, onError, disabled = false }) {
  const voice = useVoice({
    lang: 'zh-CN',
    onResult: (text) => onResult?.(text),
    onError: (err) => onError?.(err),
  });

  if (!voice.isRecognitionSupported) return null;

  function handlePointerDown(e) {
    if (disabled) return;
    e.preventDefault();
    voice.handleTouchStart(e);
    voice.startListening();
  }

  function handlePointerUp(e) {
    e.preventDefault();
    voice.stopListening();
  }

  function handlePointerLeave() {
    if (voice.isListening) {
      voice.cancelListening();
    }
  }

  const deltaY = 0; // Simplified: touch tracking handled by parent if needed

  return (
    <div className={`voice-input ${voice.isListening ? 'voice-input--active' : ''}`}>
      {voice.isListening ? (
        <div className="voice-input__recording">
          <div className="voice-input__waves">
            {[0, 1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="voice-input__wave-bar"
                style={{
                  animationDelay: `${i * 0.1}s`,
                  height: `${12 + voice.volumeLevel * 28}px`,
                }}
              />
            ))}
          </div>
          <span className="voice-input__text">
            {voice.interimText || '正在聆听...'}
          </span>
          <span className="voice-input__hint">松开发送 · 上滑取消</span>
        </div>
      ) : (
        <button
          className="voice-input__btn"
          onPointerDown={handlePointerDown}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerLeave}
          disabled={disabled}
          title="按住说话"
          aria-label="语音输入"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
            <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
            <line x1="12" y1="19" x2="12" y2="23" />
            <line x1="8" y1="23" x2="16" y2="23" />
          </svg>
        </button>
      )}
    </div>
  );
}
