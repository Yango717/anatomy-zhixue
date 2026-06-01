import { useState } from 'react';
import useAITutor from '../../hooks/useAITutor';
import useVoice from '../../hooks/useVoice';
import { useAIContext } from './AIContextProvider';

export default function AIErrorHelper({ errorItem }) {
  const [explanation, setExplanation] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPanel, setShowPanel] = useState(false);
  const { hasApiKey } = useAIContext();
  const tutor = useAITutor();
  const voice = useVoice({ lang: 'zh-CN' });

  if (!errorItem) return null;

  async function handleAskWhy() {
    if (!hasApiKey) {
      alert('请先在「我的」页面配置 DeepSeek API Key');
      return;
    }
    setShowPanel(true);
    if (explanation || loading) return;
    setLoading(true);

    const prompt = `这道题我总是错，帮我分析一下原因：
题目：${errorItem.stem || errorItem.question || ''}
我的错误答案：${errorItem.userAnswer || errorItem.user_answer || ''}
正确答案：${errorItem.correctAnswer || errorItem.correct_answer || ''}

请分析我为什么会错，并推荐一个记忆方法。`;

    const text = await tutor.quickAsk(prompt, 'errorbook');
    if (text) setExplanation(text);
    setLoading(false);
  }

  return (
    <div className="ai-error-helper">
      {!showPanel ? (
        <button
          className="ai-error-helper__btn"
          onClick={handleAskWhy}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="8" r="4" />
            <path d="M4 20c0-4 4-7 8-7s8 3 8 7" />
          </svg>
          <span>问学姐为什么会错？</span>
        </button>
      ) : (
        <div className="ai-error-helper__panel">
          <div className="ai-error-helper__header">
            <span>🧑‍⚕️ 学姐分析</span>
            <div className="ai-error-helper__header-actions">
              {explanation && voice.isSynthSupported && (
                <button
                  className={`ai-speak-btn ai-speak-btn--sm ${voice.isSpeaking ? 'ai-speak-btn--active' : ''}`}
                  onClick={() => voice.isSpeaking ? voice.stopSpeaking() : voice.speak(explanation)}
                  title={voice.isSpeaking ? '停止' : '播报'}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M11 5L6 9H2v6h4l5 4V5zM19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" />
                  </svg>
                </button>
              )}
              <button
                className="ai-icon-btn"
                onClick={() => setShowPanel(false)}
                title="收起"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                </svg>
              </button>
            </div>
          </div>
          {loading ? (
            <div className="ai-error-helper__loading">学姐思考中...</div>
          ) : (
            <div className="ai-error-helper__body">{explanation}</div>
          )}
        </div>
      )}
    </div>
  );
}
