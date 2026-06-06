import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import useAITutor from '../../hooks/useAITutor';
import useVoice from '../../hooks/useVoice';
import { useAIContext } from './AIContextProvider';
import VoiceInputButton from './VoiceInputButton';
import { api } from '../../utils/api';

export default function GlobalAIChat() {
  const [input, setInput] = useState('');
  const [voiceError, setVoiceError] = useState(null);
  const [notificationCount, setNotificationCount] = useState(0);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  const {
    hasApiKey,
    globalMessages,
    saveGlobalMessages,
    activeThreadId,
    createThread,
    switchThread,
    saveThreadMessages,
    getActiveThread,
    threads,
    globalChatOpen,
    setGlobalChatOpen,
  } = useAIContext();

  // Always use the active thread messages — autopilot messages are now in the normal conversation
  const activeThread = getActiveThread();
  const threadMsgs = activeThread?.messages || [];
  const initialMsgs = threadMsgs.length > 0
    ? threadMsgs
    : (Array.isArray(globalMessages) ? globalMessages : []);
  const tutor = useAITutor(initialMsgs);
  const navigate = useNavigate();
  const loadedThreadRef = useRef(activeThreadId);
  const pendingThreadIdRef = useRef(activeThreadId);

  const voice = useVoice({
    lang: 'zh-CN',
    onResult: (text) => {
      tutor.sendMessage(text);
    },
    onError: (err) => setVoiceError(err?.message || '语音识别出错'),
  });

  // Fetch notification count (due errors)
  useEffect(() => {
    api.get('/errorbook/due').then((d) => {
      const count = d?.items?.length || d?.count || 0;
      setNotificationCount(count);
    }).catch(() => {});
  }, [globalChatOpen]); // Refresh when panel opens/closes

  // Also refresh on mount and periodically
  useEffect(() => {
    const fetchNotifications = () => {
      api.get('/errorbook/due').then((d) => {
        const count = d?.items?.length || d?.count || 0;
        setNotificationCount(count);
      }).catch(() => {});
    };
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 60000); // Every 60s
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    pendingThreadIdRef.current = activeThreadId;
  }, [activeThreadId]);

  useEffect(() => {
    if (!globalChatOpen) return;
    loadedThreadRef.current = activeThreadId;
    const nextThread = getActiveThread();
    const nextMessages = nextThread?.messages?.length
      ? nextThread.messages
      : (Array.isArray(globalMessages) ? globalMessages : []);
    tutor.setMessages(nextMessages);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [globalChatOpen, activeThreadId]);

  // Sync messages back to the active thread and global fallback store
  useEffect(() => {
    if (tutor.messages && tutor.messages.length > 0) {
      saveGlobalMessages(tutor.messages);
      let threadId = activeThreadId || pendingThreadIdRef.current;
      if (!threadId) {
        threadId = createThread();
        pendingThreadIdRef.current = threadId;
        switchThread(threadId);
      }
      saveThreadMessages(threadId, tutor.messages);
    }
  }, [tutor.messages, activeThreadId]);

  // Auto-scroll
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [tutor.messages]);

  // Prefetch TTS for assistant messages
  useEffect(() => {
    const msgs = tutor.messages || [];
    const lastMsg = msgs[msgs.length - 1];
    if (lastMsg?.role === 'assistant' && lastMsg.content) {
      voice.prefetch(lastMsg.content);
    }
  }, [tutor.messages]);

  // Focus input on open
  useEffect(() => {
    if (globalChatOpen && inputRef.current) {
      setTimeout(() => { if (inputRef.current) inputRef.current.focus(); }, 200);
    }
  }, [globalChatOpen]);

  function handleSend() {
    const text = input.trim();
    if (!text || tutor.isLoading) return;
    setInput('');
    if (!activeThreadId) {
      const threadId = createThread();
      pendingThreadIdRef.current = threadId;
      switchThread(threadId);
    }
    tutor.sendMessage(text);
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  function handleVoiceResult(text) {
    if (!activeThreadId) {
      const threadId = createThread();
      pendingThreadIdRef.current = threadId;
      switchThread(threadId);
    }
    tutor.sendMessage(text);
  }

  function handleSpeakMessage(text) {
    if (voice.isSpeaking) {
      voice.stopSpeaking();
    } else {
      voice.speak(text);
    }
  }

  function handleClear() {
    tutor.clearMessages();
    saveGlobalMessages([]);
    if (activeThreadId) {
      saveThreadMessages(activeThreadId, []);
    }
  }

  return (
    <>
      {!globalChatOpen && (
        <button
          className="ai-float-btn ai-float-btn--global"
          onClick={() => setGlobalChatOpen(true)}
          title={notificationCount > 0 ? `学姐提醒：${notificationCount}道错题待复习` : '妍学姐'}
          aria-label="打开AI学姐对话"
        >
          <span className="ai-float-btn__char">学</span>
          <span className="ai-float-btn__char">姐</span>
          {notificationCount > 0 && (
            <span className="ai-float-btn__badge">{notificationCount > 99 ? '99+' : notificationCount}</span>
          )}
        </button>
      )}

      {globalChatOpen && (
        <div className="ai-chat-panel ai-chat-panel--global">
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
              <button className="ai-icon-btn" onClick={handleClear} title="清空对话">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                </svg>
              </button>
              <button className="ai-icon-btn" onClick={() => setGlobalChatOpen(false)} title="关闭">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
          </div>

          <div className="ai-chat-panel__messages">
            {!hasApiKey ? (
              <div className="ai-chat-panel__empty">
                <p>我是妍学姐，系统解剖学考了95分～</p>
                <p>先去「我的」页面配置 DeepSeek API Key，我就能帮你学习啦！</p>
              </div>
            ) : (tutor.messages || []).length === 0 ? (
              <div className="ai-chat-panel__empty">
                <p>嗨！我是妍学姐～有什么可以帮你的？</p>
              </div>
            ) : (
              (tutor.messages || []).map((msg, i) => (
                <div key={i} className={`ai-message ai-message--${msg.role}`}>
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
                    {msg.role === 'assistant' && msg.content && (
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
              <div className="ai-message ai-message--error"><span>{tutor.error}</span></div>
            )}
            {voiceError && (
              <div className="ai-message ai-message--error"><span>{voiceError}</span></div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {hasApiKey && (
            <div className="ai-chat-panel__input">
              {/* Quick actions — static navigation */}
              <div className="ai-chat-panel__quick-actions">
                <button
                  className="ai-quick-btn"
                  onClick={() => {
                    const unitId = tutor.getUnitId();
                    if (unitId) {
                      navigate(`/quiz/${encodeURIComponent(unitId)}`);
                    } else {
                      navigate('/modules');
                    }
                  }}
                  title="去测验"
                >
                  📝 测验
                </button>
                <button
                  className="ai-quick-btn"
                  onClick={() => navigate('/review')}
                  title="去错题本"
                >
                  📖 错题
                </button>
                <button
                  className="ai-quick-btn"
                  onClick={() => navigate('/practice')}
                  title="去刷题"
                >
                  🎯 刷题
                </button>
              </div>
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
