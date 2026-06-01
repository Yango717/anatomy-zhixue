import { useState, useRef, useEffect } from 'react';
import useAITutor from '../../hooks/useAITutor';
import useVoice from '../../hooks/useVoice';
import { useAIContext } from './AIContextProvider';
import VoiceInputButton from './VoiceInputButton';

export default function AIChatPanel({ scene, unitId }) {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [voiceError, setVoiceError] = useState(null);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  const tutor = useAITutor();
  const { hasApiKey } = useAIContext();
  const voice = useVoice({
    lang: 'zh-CN',
    onResult: (text) => {
      tutor.sendMessage(text);
    },
    onError: (err) => setVoiceError(err?.message || '语音识别出错'),
  });

  // Load saved messages
  useEffect(() => {
    if (isOpen && unitId) {
      const history = tutor.getChatHistory?.(unitId);
      // History loading handled by context provider
    }
  }, [isOpen, unitId]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [tutor.messages]);

  // Prefetch TTS for assistant messages (instant playback when user clicks 🔊)
  useEffect(() => {
    const lastMsg = tutor.messages[tutor.messages.length - 1];
    if (lastMsg?.role === 'assistant' && lastMsg.content) {
      voice.prefetch(lastMsg.content);
    }
  }, [tutor.messages]);

  // Focus input on open
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 200);
    }
  }, [isOpen]);

  function handleSend() {
    const text = input.trim();
    if (!text || tutor.isLoading) return;
    setInput('');
    tutor.sendMessage(text);
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  function handleVoiceResult(text) {
    tutor.sendMessage(text);
  }

  function handleSpeakMessage(text) {
    if (voice.isSpeaking) {
      voice.stopSpeaking();
    } else {
      voice.speak(text);
    }
  }

  return (
    <>
      {/* Floating button */}
      {!isOpen && (
        <button
          className="ai-float-btn"
          onClick={() => setIsOpen(true)}
          title="问妍学姐"
          aria-label="打开AI对话"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="8" r="4" />
            <path d="M4 20c0-4 4-7 8-7s8 3 8 7" />
          </svg>
          <span className="ai-float-btn__label">学姐</span>
        </button>
      )}

      {/* Chat panel */}
      {isOpen && (
        <div className="ai-chat-panel">
          {/* Header */}
          <div className="ai-chat-panel__header">
            <div className="ai-chat-panel__avatar">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="8" r="4" />
                <path d="M4 20c0-4 4-7 8-7s8 3 8 7" />
              </svg>
            </div>
            <div className="ai-chat-panel__title">
              <span>妍学姐</span>
              <span className="ai-chat-panel__subtitle">大三 · 解剖学95分</span>
            </div>
            <div className="ai-chat-panel__actions">
              <button
                className="ai-icon-btn"
                onClick={() => tutor.clearMessages()}
                title="清空对话"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                </svg>
              </button>
              <button
                className="ai-icon-btn"
                onClick={() => setIsOpen(false)}
                title="关闭"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="ai-chat-panel__messages">
            {!hasApiKey ? (
              <div className="ai-chat-panel__empty">
                <p>👋 我是妍学姐，系统解剖学考了95分。</p>
                <p>先去「我的」页面配置DeepSeek API Key，我就能帮你学习了！</p>
              </div>
            ) : tutor.messages.length === 0 ? (
              <div className="ai-chat-panel__empty">
                <p>👋 嗨！我是妍学姐~</p>
                <p>有什么解剖学问题尽管问，咱们一起搞定！</p>
              </div>
            ) : (
              tutor.messages.map((msg, i) => (
                <div
                  key={i}
                  className={`ai-message ai-message--${msg.role}`}
                >
                  {msg.role === 'assistant' && (
                    <div className="ai-message__avatar">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="8" r="4" />
                        <path d="M4 20c0-4 4-7 8-7s8 3 8 7" />
                      </svg>
                    </div>
                  )}
                  <div className="ai-message__bubble">
                    <div className="ai-message__text">
                      {msg.content || (msg.role === 'assistant' && tutor.isLoading ? '思考中...' : '')}
                    </div>
                    {msg.role === 'assistant' && msg.content && voice.isSynthSupported && (
                      <button
                        className={`ai-speak-btn ${voice.isSpeaking ? 'ai-speak-btn--active' : ''}`}
                        onClick={() => handleSpeakMessage(msg.content)}
                        title={voice.isSpeaking ? '停止播报' : '语音播报'}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                          {voice.isSpeaking ? (
                            <>
                              <rect x="6" y="6" width="4" height="12" rx="1" />
                              <rect x="14" y="6" width="4" height="12" rx="1" />
                            </>
                          ) : (
                            <path d="M11 5L6 9H2v6h4l5 4V5zM19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" />
                          )}
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
            {tutor.error && (
              <div className="ai-message ai-message--error">
                <span>⚠️ {tutor.error}</span>
              </div>
            )}
            {voiceError && (
              <div className="ai-message ai-message--error">
                <span>🎤 {voiceError}</span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input area */}
          {hasApiKey && (
            <div className="ai-chat-panel__input">
              <div className="ai-chat-panel__input-row">
                {voice.isRecognitionSupported && (
                  <VoiceInputButton
                    onResult={handleVoiceResult}
                    onError={(err) => setVoiceError(err?.message)}
                    disabled={tutor.isLoading}
                  />
                )}
                <textarea
                  ref={inputRef}
                  className="ai-chat-panel__textarea"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="问学姐... (Enter发送)"
                  rows={1}
                  disabled={tutor.isLoading}
                />
                <button
                  className="ai-send-btn"
                  onClick={handleSend}
                  disabled={!input.trim() || tutor.isLoading}
                  title="发送"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="22" y1="2" x2="11" y2="13" />
                    <polygon points="22 2 15 22 11 13 2 9 22 2" />
                  </svg>
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}
