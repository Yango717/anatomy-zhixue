import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAIContext } from './AIContextProvider';
import useAITutor from '../../hooks/useAITutor';
import { api } from '../../utils/api';

const AUTO_PROMPTS = [
  { text: '今天该做什么？', icon: '📋' },
  { text: '帮我调整计划', icon: '🔄' },
  { text: '我学完了，下一步？', icon: '✅' },
  { text: '今天进度如何？', icon: '📊' },
];

export default function AutoPilotChatBox() {
  const {
    hasApiKey,
    autoPilotEnabled,
    autoPilotPlan,
    autoPilotStepIndex,
    autoPilotMessages,
    saveAutoPilotMessages,
    addAutoPilotMessage,
    isPlanExpired,
    saveAutoPilotPlan,
  } = useAIContext();

  const navigate = useNavigate();
  const [input, setInput] = useState('');
  const [planCollapsed, setPlanCollapsed] = useState(false);
  const [generating, setGenerating] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const planGeneratedRef = useRef(false);

  // Use AI tutor for the auto-mode chat
  const tutor = useAITutor(autoPilotMessages);

  // Sync autoPilotMessages → tutor when external messages arrive (e.g. from AutoPilotCheckin)
  const lastMsgCountRef = useRef(autoPilotMessages.length);
  useEffect(() => {
    // Only sync when autoPilotMessages has MORE messages than tutor (external injection)
    if (autoPilotMessages.length > (tutor.messages?.length || 0)) {
      tutor.setMessages(autoPilotMessages);
    }
    lastMsgCountRef.current = autoPilotMessages.length;
  }, [autoPilotMessages]);

  // Auto-scroll on new messages
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [tutor.messages]);

  // Sync tutor messages back to autoPilotMessages — only when tutor has NEWER content
  const lastSyncedCountRef = useRef(0);
  useEffect(() => {
    if (tutor.messages && tutor.messages.length > lastSyncedCountRef.current) {
      lastSyncedCountRef.current = tutor.messages.length;
      saveAutoPilotMessages(tutor.messages);
    }
  }, [tutor.messages]);

  // Generate plan on mount if needed
  useEffect(() => {
    if (!autoPilotEnabled || !hasApiKey) return;
    if (planGeneratedRef.current) return;

    // Check if plan exists and is valid
    const existingPlan = autoPilotPlan;
    const planValid = existingPlan && !isPlanExpired(existingPlan);

    if (planValid && autoPilotMessages.length > 0) {
      // Plan exists and messages already populated — skip generation
      planGeneratedRef.current = true;
      return;
    }

    planGeneratedRef.current = true;
    generatePlan();
  }, [autoPilotEnabled, hasApiKey]);

  // ─── Plan generation ───
  async function generatePlan() {
    setGenerating(true);

    // Carry-over from yesterday
    let carryOverSteps = [];
    try {
      const yesterdaySummary = JSON.parse(localStorage.getItem('ai_autopilot_daily_summary') || 'null');
      if (yesterdaySummary?.pendingSteps?.length > 0) {
        const sourcePlan = JSON.parse(localStorage.getItem('ai_autopilot_plan') || 'null');
        if (sourcePlan?.steps) {
          carryOverSteps = yesterdaySummary.pendingSteps
            .map(id => sourcePlan.steps.find(s => s.id === id))
            .filter(Boolean)
            .map(s => ({ ...s, completed: false, id: s.id + '_carry' }));
        }
      }
    } catch {}

    try {
      let plan = null;

      if (hasApiKey) {
        try {
          plan = await tutor.generateAutoPilotPlan();
        } catch {}
      }

      if (!plan || !plan.steps || plan.steps.length === 0) {
        plan = await generateLocalFallbackPlan(carryOverSteps);
      } else {
        const allSteps = [...carryOverSteps, ...plan.steps];
        plan = { ...plan, steps: allSteps, createdAt: Date.now() };
      }

      saveAutoPilotPlan(plan);
      deliverPlanGreeting(plan, carryOverSteps);
    } catch (e) {
      console.error('[AutoPilotChat] Plan generation failed:', e);
      const fallbackMsg = {
        role: 'assistant',
        content: '自动驾驶模式已开启～告诉我你想学什么，或者去「系统」页面选一个章节开始吧！',
        _actions: [{ label: '去选章节', route: '/modules' }],
      };
      addAutoPilotMessage(fallbackMsg);
    } finally {
      setGenerating(false);
    }
  }

  async function generateLocalFallbackPlan(carryOver = []) {
    const [modulesRes, errors] = await Promise.all([
      api.get('/modules/list').catch(() => ({ units: [] })),
      api.get('/errorbook/due').catch(() => ({})),
    ]);

    const allUnits = modulesRes?.units || [];
    const errorItems = errors?.items || [];
    const steps = [...carryOver];

    // ① 回顾昨日错题
    let hasYesterdayErrors = false;
    try {
      const yesterdayData = JSON.parse(localStorage.getItem('ai_practice_history') || '{}');
      const yesterday = new Date(Date.now() - 86400000).toDateString();
      if (yesterdayData.date === yesterday && (yesterdayData.totalErrors > 0 || yesterdayData.totalQuestions > 0)) {
        hasYesterdayErrors = true;
        steps.push({
          id: 'step_review_yesterday',
          type: 'review_yesterday_errors',
          unitId: '',
          title: `回顾昨日错题（${yesterdayData.totalErrors || 0}道）`,
          message: '先看看昨天练错的题，温故知新～',
          actionLabel: '去错题本',
          route: '/review',
        });
      }
    } catch {}

    // ② 学习 + 测验 + 错题回顾
    let pickedUnitId = '';
    let pickedUnitTitle = '';
    if (allUnits.length > 0) {
      const easyUnits = allUnits.filter(u => u.difficulty <= 2);
      const candidate = easyUnits[0] || allUnits[0];
      pickedUnitId = candidate.id;
      pickedUnitTitle = candidate.title;
    }

    if (pickedUnitId) {
      steps.push(
        { id: `step_learn_${pickedUnitId}`, type: 'learn', unitId: pickedUnitId, title: `学习：${pickedUnitTitle}`, actionLabel: '去学习', route: `/learn/${encodeURIComponent(pickedUnitId)}` },
        { id: `step_quiz_${pickedUnitId}`, type: 'quiz', unitId: pickedUnitId, title: '测验检验', actionLabel: '去测验', route: `/quiz/${encodeURIComponent(pickedUnitId)}` },
        { id: 'step_error_review', type: 'error_review', unitId: pickedUnitId, title: '错题回顾', actionLabel: '去错题回顾', route: `/review/${encodeURIComponent(pickedUnitId)}` },
      );
    } else if (errorItems.length > 0 && !hasYesterdayErrors) {
      steps.push({ id: 'step_errorbook', type: 'error_review', unitId: '', title: `复习 ${errorItems.length} 道到期错题`, actionLabel: '去错题本', route: '/review' });
    }

    // ③ 刷题
    steps.push({ id: 'step_practice', type: 'practice', unitId: '', title: '刷题练手', actionLabel: '去刷题', route: '/practice' });

    return { steps, createdAt: Date.now() };
  }

  function deliverPlanGreeting(plan, carryOverSteps = []) {
    const hour = new Date().getHours();
    let timeGreet;
    if (hour < 9) timeGreet = '早安';
    else if (hour < 12) timeGreet = '上午好';
    else if (hour < 14) timeGreet = '中午好';
    else if (hour < 18) timeGreet = '下午好';
    else timeGreet = '晚上好';

    const tones = ['啦～', '喔～', '耶～', '欸～'];
    const tone = tones[Math.floor(Math.random() * tones.length)];

    const hasCarryOver = carryOverSteps.length > 0;
    const stepLines = plan.steps.map((s, i) => `${i + 1}️⃣ ${s.title}`).join('\n');

    let greeting;
    if (hasCarryOver) {
      greeting = `${timeGreet}${tone} 学姐等你呢～ 😊\n\n昨天有 ${carryOverSteps.length} 个小任务还没收尾，先把它补上！\n\n今天的学习路线：\n${stepLines}\n\n一步步来，学姐全程陪着你～`;
    } else {
      greeting = `${timeGreet}${tone} 又见面啦～ 😊\n\n今天学姐给你安排好啦：\n\n${stepLines}\n\n不用急，慢慢来～学到就是赚到！`;
    }

    const firstStep = plan.steps[0];
    const msg = {
      role: 'assistant',
      content: greeting,
      _actions: firstStep ? [{ label: firstStep.actionLabel || '开始', route: firstStep.route }] : [],
    };
    addAutoPilotMessage(msg);
  }

  // ─── Send message in auto-mode chat ───
  function handleSend(text) {
    const msg = text || input.trim();
    if (!msg || tutor.isLoading) return;
    setInput('');
    // tutor.sendMessage handles both adding user msg and generating AI response
    // The sync effect above will persist to autoPilotMessages
    tutor.sendMessage(msg);
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  function handleQuickPrompt(text) {
    handleSend(text);
  }

  // ─── Plan progress calculation ───
  const plan = autoPilotPlan;
  const planValid = plan && !isPlanExpired(plan);
  const steps = planValid ? plan.steps || [] : [];
  const completedCount = steps.filter(s => s.completed).length;
  const totalCount = steps.length;
  const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
  const currentStep = planValid ? steps[autoPilotStepIndex] : null;
  const allComplete = planValid && completedCount >= totalCount && totalCount > 0;

  if (!autoPilotEnabled) return null;

  return (
    <div className="autopilot-chat-box">
      {/* ─── Plan Card (collapsible) ─── */}
      {planValid && (
        <div className={`autopilot-plan-card ${planCollapsed ? 'autopilot-plan-card--collapsed' : ''}`}>
          <div className="autopilot-plan-card__header" onClick={() => setPlanCollapsed(!planCollapsed)}>
            <span className="autopilot-plan-card__title">📋 今日计划</span>
            <div className="autopilot-plan-card__header-right">
              <span className="autopilot-plan-card__progress-text">{completedCount}/{totalCount} 完成</span>
              <span className={`autopilot-plan-card__toggle ${planCollapsed ? '' : 'autopilot-plan-card__toggle--open'}`}>
                ▼
              </span>
            </div>
          </div>

          {/* Progress bar */}
          <div className="autopilot-plan-card__progress-bar">
            <div className="autopilot-plan-card__progress-fill" style={{ width: `${progressPercent}%` }} />
          </div>

          {!planCollapsed && (
            <div className="autopilot-plan-card__steps">
              {steps.map((step, i) => {
                const isCompleted = step.completed;
                const isCurrent = i === autoPilotStepIndex && !isCompleted;
                return (
                  <div key={step.id} className={`autopilot-plan-step ${isCompleted ? 'autopilot-plan-step--completed' : ''} ${isCurrent ? 'autopilot-plan-step--current' : ''}`}>
                    <span className="autopilot-plan-step__indicator">
                      {isCompleted ? '✓' : isCurrent ? '▶' : '○'}
                    </span>
                    <span className="autopilot-plan-step__title">{step.title}</span>
                    {isCurrent && step.route && (
                      <button className="autopilot-plan-step__action" onClick={() => navigate(step.route)}>
                        {step.actionLabel || '去完成 →'}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Completion celebration */}
          {allComplete && (
            <div className="autopilot-plan-card__celebration">
              🎉 今日计划圆满完成！你好棒！明天继续加油喔～
            </div>
          )}
        </div>
      )}

      {/* ─── Expired plan notice ─── */}
      {plan && !planValid && (
        <div className="autopilot-plan-card autopilot-plan-card--expired">
          <p>计划已过期（超过24小时）</p>
          <button className="btn btn--primary btn--sm" onClick={generatePlan} disabled={generating}>
            {generating ? '生成中...' : '重新生成计划'}
          </button>
        </div>
      )}

      {/* ─── No plan yet, generating ─── */}
      {!plan && generating && (
        <div className="autopilot-plan-card autopilot-plan-card--loading">
          <div className="autopilot-plan-card__skeleton">
            <div className="skeleton-line skeleton-line--long" />
            <div className="skeleton-line skeleton-line--medium" />
            <div className="skeleton-line skeleton-line--short" />
          </div>
          <p className="autopilot-plan-card__loading-text">学姐正在制定今日学习计划...</p>
        </div>
      )}

      {/* ─── Chat Messages ─── */}
      <div className="autopilot-chat-box__messages">
        {tutor.messages.length === 0 && !generating ? (
          <div className="autopilot-chat-box__welcome">
            <div className="autopilot-chat-box__welcome-icon">🧭</div>
            <h3>自主模式</h3>
            <p>学姐会帮你安排每日学习计划，引导你完成学习流程</p>
            {!hasApiKey && (
              <button className="btn btn--primary btn--sm" onClick={() => navigate('/me')}>
                配置 API Key →
              </button>
            )}
            <div className="autopilot-chat-box__quick-prompts">
              {AUTO_PROMPTS.map((p, i) => (
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
        <div ref={messagesEndRef} />
      </div>

      {/* ─── Input Bar ─── */}
      {hasApiKey && (
        <div className="chat-home__input-bar">
          <div className="chat-home__input-row">
            <textarea
              ref={inputRef}
              className="chat-home__textarea"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="和自主学姐对话..."
              rows={1}
              disabled={tutor.isLoading || generating}
            />
            <button
              className="chat-home__send-btn"
              onClick={() => handleSend()}
              disabled={!input.trim() || tutor.isLoading || generating}
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
