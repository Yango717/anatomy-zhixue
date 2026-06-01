import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import useAITutor from '../../hooks/useAITutor';
import useVoice from '../../hooks/useVoice';
import { useAIContext } from './AIContextProvider';

export default function AITutorBar() {
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const { hasApiKey } = useAIContext();
  const tutor = useAITutor();
  const navigate = useNavigate();
  const voice = useVoice({ lang: 'zh-CN' });

  useEffect(() => {
    if (!hasApiKey) return;
    setLoading(true);
    tutor.generateTodayRecommend()
      .then((text) => {
        if (text) setMessage(text);
      })
      .finally(() => setLoading(false));
  }, [hasApiKey]);

  if (!hasApiKey) return null;

  return (
    <div className="ai-tutor-bar">
      <div className="ai-tutor-bar__header">
        <div className="ai-tutor-bar__avatar">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="8" r="4" />
            <path d="M4 20c0-4 4-7 8-7s8 3 8 7" />
          </svg>
        </div>
        <span className="ai-tutor-bar__name">解剖学姐</span>
        {voice.isSynthSupported && message && (
          <button
            className={`ai-speak-btn ai-speak-btn--sm ${voice.isSpeaking ? 'ai-speak-btn--active' : ''}`}
            onClick={() => voice.isSpeaking ? voice.stopSpeaking() : voice.speak(message)}
            title={voice.isSpeaking ? '停止播报' : '语音播报'}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
              {voice.isSpeaking ? (
                <><rect x="6" y="6" width="4" height="12" rx="1" /><rect x="14" y="6" width="4" height="12" rx="1" /></>
              ) : (
                <path d="M11 5L6 9H2v6h4l5 4V5zM19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" />
              )}
            </svg>
          </button>
        )}
      </div>
      <div className="ai-tutor-bar__body">
        {loading ? (
          <p className="ai-tutor-bar__text ai-tutor-bar__text--loading">正在分析你的学习数据...</p>
        ) : (
          <p className="ai-tutor-bar__text">{message || '有什么解剖学问题尽管问我！'}</p>
        )}
      </div>
      <div className="ai-tutor-bar__actions">
        <button
          className="btn btn--sm"
          onClick={() => navigate('/review')}
        >
          去错题本
        </button>
        <button
          className="btn btn--primary btn--sm"
          onClick={() => navigate('/modules')}
        >
          开始学习
        </button>
      </div>
    </div>
  );
}
