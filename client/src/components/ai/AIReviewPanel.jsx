import { useState, useEffect } from 'react';
import useAITutor from '../../hooks/useAITutor';
import useVoice from '../../hooks/useVoice';
import { useAIContext } from './AIContextProvider';

export default function AIReviewPanel() {
  const [report, setReport] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { hasApiKey } = useAIContext();
  const tutor = useAITutor();
  const voice = useVoice({ lang: 'zh-CN' });

  useEffect(() => {
    if (!hasApiKey) {
      setLoading(false);
      return;
    }
    tutor.generateReviewReport()
      .then((text) => {
        if (text) setReport(text);
        else setError('生成复盘报告失败');
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [hasApiKey]);

  if (!hasApiKey) return null;

  return (
    <div className="ai-review-panel">
      <div className="ai-review-panel__header">
        <div className="ai-review-panel__title-row">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="8" r="4" />
            <path d="M4 20c0-4 4-7 8-7s8 3 8 7" />
          </svg>
          <h3 className="ai-review-panel__title">学姐帮你分析了一下</h3>
        </div>
        {voice.isSynthSupported && report && (
          <button
            className={`ai-review-panel__play-btn ${voice.isSpeaking ? 'ai-review-panel__play-btn--active' : ''}`}
            onClick={() => {
              if (voice.isSpeaking) {
                if (voice.isPaused) voice.resumeSpeaking();
                else voice.pauseSpeaking();
              } else {
                voice.speak(report, 0.9);
              }
            }}
          >
            {voice.isSpeaking ? (
              voice.isPaused ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <polygon points="5 3 19 12 5 21 5 3" />
                </svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <rect x="6" y="4" width="4" height="16" rx="1" />
                  <rect x="14" y="4" width="4" height="16" rx="1" />
                </svg>
              )
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <polygon points="5 3 19 12 5 21 5 3" />
              </svg>
            )}
            <span>
              {voice.isSpeaking
                ? (voice.isPaused ? '继续' : '暂停')
                : '学姐帮你总结'}
            </span>
          </button>
        )}
      </div>

      <div className="ai-review-panel__body">
        {loading ? (
          <div className="ai-review-panel__loading">
            <div className="ai-review-panel__spinner" />
            <span>学姐正在分析你的答题情况...</span>
          </div>
        ) : error ? (
          <p className="ai-review-panel__error">{error}</p>
        ) : (
          <div className="ai-review-panel__report">
            {report.split('\n').map((line, i) => {
              // Render bold markers
              const rendered = line
                .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
                .replace(/【(.+?)】/g, '<span class="ai-review-panel__tag">$1</span>');
              return (
                <p
                  key={i}
                  className="ai-review-panel__line"
                  dangerouslySetInnerHTML={{ __html: rendered || '&nbsp;' }}
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
