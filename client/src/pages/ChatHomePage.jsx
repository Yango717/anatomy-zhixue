import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import useAITutor from '../hooks/useAITutor';
import useVoice from '../hooks/useVoice';
import { useAIContext } from '../components/ai/AIContextProvider';
import VoiceInputButton from '../components/ai/VoiceInputButton';
import { api } from '../utils/api';

const QUICK_PROMPTS = [
  { text: '今天该学什么？', icon: '📅' },
  { text: '帮我复习薄弱点', icon: '🎯' },
  { text: '颅骨有多少块？', icon: '🦴' },
  { text: '给我出几道题', icon: '📝' },
];

export default function ChatHomePage() {
  const [input, setInput] = useState('');
  const [voiceError, setVoiceError] = useState(null);
  const [greeting, setGreeting] = useState('');
  const [showThreads, setShowThreads] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const navigate = useNavigate();

  const {
    hasApiKey,
    threads,
    activeThreadId,
    createThread,
    switchThread,
    saveThreadMessages,
    renameThread,
    deleteThread,
    getActiveThread,
    // AutoPilot
    autoPilotEnabled,
    autoPilotPlan,
    autoPilotStepIndex,
    autoPilotThreadId,
    saveAutoPilotPlan,
    saveAutoPilotThreadId,
  } = useAIContext();

  // Get active thread messages
  const activeThread = getActiveThread();
  const threadMessages = activeThread?.messages || [];

  // Initialize useAITutor with active thread messages
  const tutor = useAITutor(threadMessages);

  const voice = useVoice({
    lang: 'zh-CN',
    onResult: (text) => {
      handleSend(text);
    },
    onError: (err) => setVoiceError(err?.message || '语音识别出错'),
  });

  // Generate greeting for new/empty threads
  useEffect(() => {
    if (hasApiKey && tutor.messages.length === 0) {
      tutor.generateTodayRecommend().then((text) => {
        if (text) setGreeting(text);
      }).catch(() => {});
    }
  }, [hasApiKey, activeThreadId]);

  // 自我介绍：每次新对话（空线程），学姐主动自我介绍
  useEffect(() => {
    if (!hasApiKey) return;
    if (threadMessages.length > 0) return; // Only for empty threads
    const apiKey = localStorage.getItem('deepseek_api_key');
    if (!apiKey) return;

    // Try AI-generated intro with learning context
    api.get('/ai/proactive', { apiKey }).then((d) => {
      const introMsg = d?.message;
      if (introMsg) {
        tutor.setMessages([{ role: 'assistant', content: introMsg }]);
        saveThreadMessages(activeThreadId, [{ role: 'assistant', content: introMsg }]);
      } else {
        // Fallback: fixed introduction
        const fallback = `嗨！我是妍学姐～你可以叫我「妍」😊

我是大三临床医学专业的学姐，系统解剖学考了95分。我说话软软糯糯的啦～我的性格嘛，就是温柔耐心又带点幽默活泼，喜欢用俏皮话让枯燥的解剖学变有趣！

我可以帮你：
📖 解答任何解剖学问题
📝 出题考你、帮你批改
🔍 分析你的薄弱知识点
📅 根据你的进度推荐学习计划

虽然我是AI驱动的，但你就当我是你身边一个热心的学姐就好～有什么想知道的，直接问我吧！`;
        tutor.setMessages([{ role: 'assistant', content: fallback }]);
        saveThreadMessages(activeThreadId, [{ role: 'assistant', content: fallback }]);
      }
    }).catch(() => {
      const fallback = `嗨！我是妍学姐～叫我「妍」就好啦～😊\n\n大三临床医学生，解剖学95分，温柔又活泼。有什么解剖学问题尽管问，学姐帮你搞定！`;
      tutor.setMessages([{ role: 'assistant', content: fallback }]);
      saveThreadMessages(activeThreadId, [{ role: 'assistant', content: fallback }]);
    });
  }, [hasApiKey, activeThreadId]);

  // 自动驾驶模式：生成每日学习计划
  useEffect(() => {
    if (!autoPilotEnabled) return;
    if (!hasApiKey) return;

    // Check if we already have a valid plan for today
    if (autoPilotPlan && autoPilotPlan.createdAt) {
      const planDate = new Date(autoPilotPlan.createdAt).toDateString();
      const today = new Date().toDateString();
      if (planDate === today) return; // Already have today's plan
    }

    console.log('[AutoPilot] 开始生成今日学习计划...');
    setGreeting('学姐正在为你制定今日学习计划...');

    // Generate new plan
    tutor.generateAutoPilotPlan().then((plan) => {
      console.log('[AutoPilot] 计划生成结果:', plan);
      if (plan && plan.steps && plan.steps.length > 0) {
        const planWithMeta = { ...plan, createdAt: Date.now() };
        saveAutoPilotPlan(planWithMeta);

        // Build plan presentation message
        const stepLines = plan.steps.map((s, i) =>
          `${i + 1}️⃣ ${s.title}`
        ).join('\n');

        const planMsg = `早安！今天的学习路线来啦～ 🌟\n\n${stepLines}\n\n准备好了吗？我们开始吧！`;

        // Build actions for the first step
        const firstStep = plan.steps[0];
        const actions = [{ label: firstStep.actionLabel || '开始', route: firstStep.route }];

        // Present in chat
        const msg = {
          role: 'assistant',
          content: planMsg,
          _actions: actions,
        };
        tutor.setMessages([msg]);
        saveThreadMessages(activeThreadId, [msg]);
        setGreeting('');

        // Ensure autoPilot thread is tracked
        if (!autoPilotThreadId) {
          saveAutoPilotThreadId(activeThreadId);
        }
      } else {
        // AI returned empty plan — fall through to local fallback
        console.warn('[AutoPilot] AI 返回空计划，使用本地推荐');
        generateLocalFallbackPlan();
      }
    }).catch((err) => {
      console.error('[AutoPilot] 计划生成失败:', err);
      generateLocalFallbackPlan();
    });

    // Local fallback: use the existing recommendation engine
    async function generateLocalFallbackPlan() {
      try {
        const [recommend, errors] = await Promise.all([
          api.get('/recommend').catch(() => []),
          api.get('/errorbook/due').catch(() => ({})),
        ]);

        const recItems = Array.isArray(recommend) ? recommend : (recommend?.items || []);
        const errorItems = errors?.items || [];

        const steps = [];

        // Add due errorbook items first
        if (errorItems.length > 0) {
          steps.push({
            id: 'step_errorbook',
            type: 'errorbook',
            title: `复习 ${errorItems.length} 道错题`,
            message: `你有 ${errorItems.length} 道错题到期该复习啦～趁热打铁！`,
            actionLabel: '去错题本',
            route: '/review',
          });
        }

        // Add recommended items
        for (const item of recItems.slice(0, 4)) {
          if (item.type === 'learn' || item.type === 'unit') {
            steps.push({
              id: `step_${item.unitId || item.id}`,
              type: 'learn',
              unitId: item.unitId || item.id,
              title: item.title || item.name || '学习新内容',
              message: '来看看这个知识点吧，图谱很棒的喔～',
              actionLabel: '去学习',
              route: `/learn/${encodeURIComponent(item.unitId || item.id)}`,
            });
          }
        }

        // If still empty, add a general suggestion
        if (steps.length === 0) {
          steps.push({
            id: 'step_explore',
            type: 'learn',
            title: '浏览解剖系统',
            message: '今天从选一个感兴趣的系统开始吧！',
            actionLabel: '去选章节',
            route: '/modules',
          });
        }

        const plan = { steps, createdAt: Date.now() };
        saveAutoPilotPlan(plan);

        const stepLines = steps.map((s, i) => `${i + 1}️⃣ ${s.title}`).join('\n');
        const planMsg = `我帮你安排了今天的学习路线～ 🌟\n\n${stepLines}\n\n开始吧！`;
        const firstStep = steps[0];
        const msg = {
          role: 'assistant',
          content: planMsg,
          _actions: [{ label: firstStep.actionLabel, route: firstStep.route }],
        };
        tutor.setMessages([msg]);
        saveThreadMessages(activeThreadId, [msg]);
        setGreeting('');

        if (!autoPilotThreadId) {
          saveAutoPilotThreadId(activeThreadId);
        }
      } catch (e) {
        console.error('[AutoPilot] 本地计划也失败了:', e);
        setGreeting('');
        // Last resort: show a simple message
        const fallbackMsg = {
          role: 'assistant',
          content: '自动驾驶模式已开启～告诉我你想学什么，或者去「系统」页面选一个章节开始吧！',
          _actions: [{ label: '去选章节', route: '/modules' }],
        };
        tutor.setMessages([fallbackMsg]);
        saveThreadMessages(activeThreadId, [fallbackMsg]);
      }
    }
  }, [autoPilotEnabled, hasApiKey]);

  // Sync messages to thread
  useEffect(() => {
    if (tutor.messages && tutor.messages.length > 0 && activeThreadId) {
      saveThreadMessages(activeThreadId, tutor.messages);
      // Auto-rename: if thread is still "新对话" and we have a user message
      const activeT = threads.find((t) => t.id === activeThreadId);
      if (activeT?.name === '新对话') {
        const firstUserMsg = tutor.messages.find((m) => m.role === 'user');
        if (firstUserMsg) {
          const name = firstUserMsg.content.slice(0, 20) + (firstUserMsg.content.length > 20 ? '...' : '');
          renameThread(activeThreadId, name);
        }
      }
    }
  }, [tutor.messages, activeThreadId]);

  // Also sync global messages (for GlobalAIChat bubble on other pages)
  useEffect(() => {
    if (tutor.messages && tutor.messages.length > 0) {
      try {
        localStorage.setItem('ai_global_chat', JSON.stringify(tutor.messages.slice(-50)));
      } catch {}
    }
  }, [tutor.messages]);

  // Auto-scroll
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [tutor.messages]);

  // Prefetch TTS
  useEffect(() => {
    const msgs = tutor.messages || [];
    const lastMsg = msgs[msgs.length - 1];
    if (lastMsg?.role === 'assistant' && lastMsg.content) {
      voice.prefetch(lastMsg.content);
    }
  }, [tutor.messages]);

  // Focus on mount
  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 300);
  }, [activeThreadId]);

  function handleSend(text) {
    const msg = text || input.trim();
    if (!msg || tutor.isLoading) return;
    setInput('');
    // Ensure active thread exists
    if (!activeThreadId) {
      const newId = createThread();
      switchThread(newId);
    }
    tutor.sendMessage(msg);
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  function handleSpeakMessage(text) {
    if (voice.isSpeaking) voice.stopSpeaking();
    else voice.speak(text);
  }

  function handleDeleteThread(threadId, e) {
    e.stopPropagation();
    if (threads.length <= 1) {
      // Last thread — just clear messages
      tutor.clearMessages();
      renameThread(threadId, '新对话');
      return;
    }
    deleteThread(threadId);
    tutor.clearMessages();
  }

  function handleNewThread() {
    const newId = createThread();
    switchThread(newId);
    tutor.clearMessages();
    setShowThreads(false);
    setGreeting('');
  }

  function handleSwitchThread(threadId) {
    switchThread(threadId);
    setShowThreads(false);
    // Explicitly sync tutor messages to the selected thread
    const target = threads.find((t) => t.id === threadId);
    if (target) {
      tutor.setMessages(target.messages || []);
    }
  }

  const isEmpty = tutor.messages.length === 0;

  return (
    <div className="chat-home">
      {/* Thread sidebar overlay */}
      {showThreads && (
        <div className="chat-threads-overlay" onClick={() => setShowThreads(false)}>
          <div className="chat-threads-panel" onClick={(e) => e.stopPropagation()}>
            <div className="chat-threads-panel__header">
              <span className="chat-threads-panel__title">对话记录</span>
              <button className="ai-icon-btn" onClick={() => setShowThreads(false)}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <button className="chat-threads-panel__new-btn" onClick={handleNewThread}>
              ＋ 新对话
            </button>
            <div className="chat-threads-panel__list">
              {threads.map((t) => (
                <div
                  key={t.id}
                  className={`chat-thread-item ${t.id === activeThreadId ? 'chat-thread-item--active' : ''}`}
                  onClick={() => handleSwitchThread(t.id)}
                >
                  <div className="chat-thread-item__info">
                    <span className="chat-thread-item__name">{t.name}</span>
                    <span className="chat-thread-item__meta">
                      {t.messages.length} 条消息 · {new Date(t.updatedAt).toLocaleDateString('zh-CN')}
                    </span>
                  </div>
                  <button
                    className="chat-thread-item__del"
                    onClick={(e) => handleDeleteThread(t.id, e)}
                    title="删除对话"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="3 6 5 6 21 6" />
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="chat-home__header">
        <button className="chat-home__threads-btn" onClick={() => setShowThreads(true)} title="对话记录">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>
        <div className="chat-home__avatar">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="8" r="4" />
            <path d="M4 20c0-4 4-7 8-7s8 3 8 7" />
          </svg>
        </div>
        <div>
          <div className="chat-home__name">妍学姐</div>
          <div className="chat-home__subtitle">
            {threads.length > 1 ? `${threads.length} 个对话 · ` : ''}大三 · 解剖学95分
          </div>
        </div>
        <div className="chat-home__header-actions">
          <button className="chat-home__new-chat-btn" onClick={handleNewThread} title="新对话">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="chat-home__messages">
        {!hasApiKey ? (
          <div className="chat-home__onboard">
            <div className="chat-home__onboard-avatar">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <circle cx="12" cy="8" r="4" /><path d="M4 20c0-4 4-7 8-7s8 3 8 7" />
              </svg>
            </div>
            <h2 className="chat-home__onboard-title">嗨！我是妍学姐 👋</h2>
            <p className="chat-home__onboard-desc">
              先去「我的」页面配置 DeepSeek API Key，我就能陪你学习啦～
            </p>
            <button className="btn btn--primary" onClick={() => navigate('/me')}>去配置 →</button>
          </div>
        ) : isEmpty ? (
          <div className="chat-home__welcome">
            <div className="chat-home__welcome-avatar">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <circle cx="12" cy="8" r="4" /><path d="M4 20c0-4 4-7 8-7s8 3 8 7" />
              </svg>
            </div>
            <h2 className="chat-home__welcome-title">有什么可以帮你的？</h2>
            {greeting && <p className="chat-home__welcome-greet">{greeting}</p>}
            <div className="chat-home__quick-prompts">
              {QUICK_PROMPTS.map((p, i) => (
                <button key={i} className="chat-home__quick-btn" onClick={() => handleQuickPrompt(p.text)}>
                  <span>{p.icon}</span> {p.text}
                </button>
              ))}
            </div>
          </div>
        ) : (
          (tutor.messages || []).map((msg, i) => (
            <div key={i} className={`chat-home__msg chat-home__msg--${msg.role}`}>
              {msg.role === 'assistant' && (
                <div className="chat-home__msg-avatar">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="8" r="4" /><path d="M4 20c0-4 4-7 8-7s8 3 8 7" />
                  </svg>
                </div>
              )}
              <div className="chat-home__msg-bubble">
                <div className="chat-home__msg-text">
                  {msg.content || (msg.role === 'assistant' && tutor.isLoading ? (
                    <span className="ai-thinking-dots"><span /><span /><span /></span>
                  ) : '')}
                </div>
                {msg.role === 'assistant' && msg.content && (
                  <button
                    className={`ai-speak-btn ${voice.isSpeaking ? 'ai-speak-btn--active' : ''}`}
                    onClick={() => handleSpeakMessage(msg.content)}
                    title={voice.isSpeaking ? '停止播报' : '语音播报'}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                      {voice.isSpeaking ? (
                        <><rect x="6" y="6" width="4" height="12" rx="1" /><rect x="14" y="6" width="4" height="12" rx="1" /></>
                      ) : (
                        <path d="M11 5L6 9H2v6h4l5 4V5zM19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" />
                      )}
                    </svg>
                  </button>
                )}
                {/* AutoPilot inline action buttons */}
                {msg._actions && msg._actions.length > 0 && (
                  <div className="autopilot-inline-actions">
                    {msg._actions.map((action, ai) => (
                      <button
                        key={ai}
                        className="autopilot-inline-actions__btn"
                        onClick={() => navigate(action.route)}
                      >
                        {action.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))
        )}
        {tutor.error && <div className="chat-home__error">{tutor.error}</div>}
        {voiceError && <div className="chat-home__error">{voiceError}</div>}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      {hasApiKey && (
        <div className="chat-home__input-bar">
          <div className="chat-home__input-row">
            {voice.isRecognitionSupported && (
              <VoiceInputButton
                onResult={(text) => handleSend(text)}
                onError={(err) => setVoiceError(err?.message)}
                disabled={tutor.isLoading}
              />
            )}
            <textarea
              ref={inputRef}
              className="chat-home__textarea"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="问学姐任何解剖学问题..."
              rows={1}
              disabled={tutor.isLoading}
            />
            <button
              className="chat-home__send-btn"
              onClick={() => handleSend()}
              disabled={!input.trim() || tutor.isLoading}
              title="发送"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
