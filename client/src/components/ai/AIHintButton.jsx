import { useState, useEffect, useRef } from 'react';
import useAITutor from '../../hooks/useAITutor';
import useVoice from '../../hooks/useVoice';
import { useAIContext } from './AIContextProvider';

export default function AIHintButton({ questionStem, hintCount = 0, maxHints = 2 }) {
  const [hint, setHint] = useState('');
  const [loading, setLoading] = useState(false);
  const [usedCount, setUsedCount] = useState(hintCount);
  const { hasApiKey } = useAIContext();
  const tutor = useAITutor();
  const voice = useVoice({ lang: 'zh-CN' });
  const autoPlayedRef = useRef(false);

  // Auto-speak hint when it loads
  useEffect(() => {
    if (hint && !autoPlayedRef.current) {
      autoPlayedRef.current = true;
      // Small delay to let the UI render first
      setTimeout(() => voice.speak(hint), 300);
    }
  }, [hint]);

  if (usedCount >= maxHints) return null;

  async function handleGetHint() {
    if (loading || usedCount >= maxHints) return;
    if (!hasApiKey) {
      alert('请先在「我的」页面配置 DeepSeek API Key');
      return;
    }
    autoPlayedRef.current = false;
    setLoading(true);
    const text = await tutor.quickAsk(
      `我卡在这道题上了：${questionStem}\n\n请给我一个引导性的提示，不要直接说答案。`,
      'quiz'
    );
    if (text) {
      setHint(text);
      setUsedCount((c) => c + 1);
      // Prefetch TTS audio so speak button is instant
      voice.prefetch(text);
    }
    setLoading(false);
  }

  return (
    <div className="ai-hint">
      {!hint ? (
        <button
          className="ai-hint__btn"
          onClick={handleGetHint}
          disabled={loading}
        >
          {loading ? (
            <span className="ai-hint__loading">学姐思考中...</span>
          ) : (
            <>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="8" r="4" />
                <path d="M4 20c0-4 4-7 8-7s8 3 8 7" />
              </svg>
              <span>求助学姐 ({maxHints - usedCount}次)</span>
            </>
          )}
        </button>
      ) : (
        <div className="ai-hint__content">
          <div className="ai-hint__header">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="8" r="4" />
              <path d="M4 20c0-4 4-7 8-7s8 3 8 7" />
            </svg>
            <span>学姐提示：</span>
          </div>
          <p className="ai-hint__text">{hint}</p>
          <div className="ai-hint__footer" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px' }}>
            {voice.isSynthSupported && (
              <button
                className={`ai-speak-btn ${voice.isSpeaking ? 'ai-speak-btn--active' : ''}`}
                onClick={() => voice.isSpeaking ? voice.stopSpeaking() : voice.speak(hint)}
                title={voice.isSpeaking ? '停止' : '🔊 学姐读给我听'}
                style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '11px', color: 'var(--ai-accent)', border: '1px solid var(--color-border)', borderRadius: '12px', padding: '3px 10px', background: 'transparent', cursor: 'pointer' }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                  {voice.isSpeaking
                    ? <><rect x="6" y="4" width="4" height="16" rx="1" /><rect x="14" y="4" width="4" height="16" rx="1" /></>
                    : <path d="M11 5L6 9H2v6h4l5 4V5zM19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" />
                  }
                </svg>
                {voice.isSpeaking ? '停止' : '学姐读给我听'}
              </button>
            )}
          </div>
          {usedCount < maxHints && (
            <button
              className="ai-hint__more"
              onClick={handleGetHint}
              disabled={loading}
            >
              {loading ? '...' : `再给点提示 (${maxHints - usedCount}次)`}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
