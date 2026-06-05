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

// 学姐风格的计划问候语 — 有温度、有感情、按时间段切换
function buildPlanGreeting(steps, carryOverSteps = []) {
  const hour = new Date().getHours();
  let timeGreet;
  if (hour < 9) timeGreet = '早安';
  else if (hour < 12) timeGreet = '上午好';
  else if (hour < 14) timeGreet = '中午好';
  else if (hour < 18) timeGreet = '下午好';
  else timeGreet = '晚上好';

  const emojiMap = {
    review_yesterday_errors: '🔁',
    learn: '📖',
    quiz: '📝',
    error_review: '🔍',
    practice: '🎯',
  };
  const stepLines = steps.map((s, i) =>
    `${emojiMap[s.type] || '📌'} ${i + 1}. ${s.title}`
  ).join('\n');

  const hasCarryOver = carryOverSteps.length > 0;
  const totalNew = steps.length - carryOverSteps.length;

  // 选一个俏皮的语气词
  const tones = ['啦～', '喔～', '耶～', '欸～'];
  const tone = tones[Math.floor(Math.random() * tones.length)];

  let greeting;
  if (hasCarryOver) {
    greeting = `${timeGreet}${tone} 学姐等你呢～ 😊\n\n昨天有 ${carryOverSteps.length} 个小任务还没收尾，我们先把它补上，然后再开始今天的新内容！\n\n今天的学习路线：\n${stepLines}\n\n别担心，一步步来，学姐全程陪着你～有什么想问的随时喊我！`;
  } else {
    greeting = `${timeGreet}${tone} 又见面啦～ 😊\n\n今天学姐给你安排好啦，按这个节奏走就很棒：\n\n${stepLines}\n\n不用急，慢慢来～学到就是赚到！有不会的随时问学姐喔，我一直在这儿 🤍`;
  }

  return greeting;
}

export default function ChatHomePage() {
  const [input, setInput] = useState('');
  const [voiceError, setVoiceError] = useState(null);
  const [greeting, setGreeting] = useState('');
  const [showThreads, setShowThreads] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const introThreadRef = useRef(null);
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
    autoPilotDailySummary,
    isPlanExpired,
    saveAutoPilotPlan,
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

  useEffect(() => {
    tutor.setMessages(threadMessages);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeThreadId]);

  // 自我介绍：每次新对话（空线程），学姐主动自我介绍
  useEffect(() => {
    if (!hasApiKey) return;
    const threadId = getOrCreateThreadId();
    if (!threadId) return;
    if (introThreadRef.current === threadId) return;
    if (readThreadMessages(threadId).length > 0) return; // Only for empty threads
    const apiKey = localStorage.getItem('deepseek_api_key');
    if (!apiKey) return;
    introThreadRef.current = threadId;

    // Try AI-generated intro with learning context
    api.get('/ai/proactive', { apiKey }).then((d) => {
      const introMsg = d?.message;
      if (introMsg) {
        tutor.setMessages([{ role: 'assistant', content: introMsg }]);
        saveThreadMessages(threadId, [{ role: 'assistant', content: introMsg }]);
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
        saveThreadMessages(threadId, [{ role: 'assistant', content: fallback }]);
      }
    }).catch(() => {
      const fallback = `嗨！我是妍学姐～叫我「妍」就好啦～😊\n\n大三临床医学生，解剖学95分，温柔又活泼。有什么解剖学问题尽管问，学姐帮你搞定！`;
      tutor.setMessages([{ role: 'assistant', content: fallback }]);
      saveThreadMessages(threadId, [{ role: 'assistant', content: fallback }]);
    });
  }, [hasApiKey, activeThreadId]);

  // 模式切换消息：监听 autoPilotEnabled 变化
  const prevAutoPilotRef = useRef(autoPilotEnabled);
  useEffect(() => {
    if (prevAutoPilotRef.current === autoPilotEnabled) return;
    const wasAuto = prevAutoPilotRef.current;
    prevAutoPilotRef.current = autoPilotEnabled;

    const tid = getOrCreateThreadId();

    if (!autoPilotEnabled && wasAuto) {
      // 关闭自动模式 → 追加手动模式消息
      const offMsg = {
        role: 'assistant',
        content: '好的～手动模式已开启！有需要随时叫我喔～😊',
      };
      // 直接从 localStorage 读现有消息
      let existing = [];
      try {
        const data = JSON.parse(localStorage.getItem('ai_threads') || '{}');
        const thread = (data.threads || []).find(t => t.id === tid);
        existing = thread?.messages || [];
      } catch {}
      const updated = [...existing, offMsg];
      tutor.setMessages(updated);
      saveThreadMessages(tid, updated);
      return;
    }

    // 开启自动模式 → 如果已有未过期计划，发状态消息告知当前进度
    if (autoPilotEnabled && !wasAuto) {
      let plan = null;
      let stepIdx = 0;
      try {
        plan = JSON.parse(localStorage.getItem('ai_autopilot_plan') || 'null');
        const state = JSON.parse(localStorage.getItem('ai_autopilot_state') || '{}');
        stepIdx = state.stepIndex || 0;
      } catch {}

      // 读线程消息
      let existing = [];
      try {
        const data = JSON.parse(localStorage.getItem('ai_threads') || '{}');
        const thread = (data.threads || []).find(t => t.id === tid);
        existing = thread?.messages || [];
      } catch {}

      if (plan && plan.steps && !isPlanExpired(plan)) {
        const remaining = plan.steps.filter((s, i) => i >= stepIdx && !s.completed);
        const currentStep = plan.steps[stepIdx];
        if (remaining.length > 0 && currentStep) {
          const resumeMsg = {
            role: 'assistant',
            content: `自动驾驶模式已开启～你还有 ${remaining.length} 个任务没完成喔！接下来：${currentStep.title}`,
            _actions: [{ label: currentStep.actionLabel || '继续', route: currentStep.route }],
          };
          const updated = [...existing, resumeMsg];
          tutor.setMessages(updated);
          saveThreadMessages(tid, updated);
        } else {
          // 全部完成 → 问候
          const doneMsg = {
            role: 'assistant',
            content: '自动驾驶模式已开启～不过今天的任务都完成啦！🎉 明天继续加油喔～或者你想再刷几道题练练手？',
            _actions: [{ label: '去刷题', route: '/practice' }],
          };
          const updated = [...existing, doneMsg];
          tutor.setMessages(updated);
          saveThreadMessages(tid, updated);
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoPilotEnabled]);

  // 防止重复生成计划（React StrictMode 双重调用 + 异步竞争）
  const planGeneratingRef = useRef(false);

  // 直接从 localStorage 获取或创建线程 ID — 避免 React state 竞态导致的重复创建
  function getOrCreateThreadId() {
    // 优先返回已有线程
    if (activeThreadId) return activeThreadId;
    // 从 localStorage 读（绕过 state 延迟）
    try {
      const data = JSON.parse(localStorage.getItem('ai_threads') || '{}');
      if (data.activeThreadId) return data.activeThreadId;
      if (data.threads?.length > 0) return data.threads[0].id;
    } catch {}
    // 都没有就创建一个
    return createThread();
  }

  // 从 localStorage 直接读线程消息 — 绕过 state 延迟
  function readThreadMessages(threadId) {
    try {
      const data = JSON.parse(localStorage.getItem('ai_threads') || '{}');
      const thread = (data.threads || []).find(t => t.id === threadId);
      return thread?.messages || [];
    } catch { return []; }
  }

  // 自动驾驶模式：24h 过期 + 昨日顺延 + 当日续接 + 计划生成
  useEffect(() => {
    if (!autoPilotEnabled) return;

    // ─── 阻止 StrictMode 双重调用 + 异步竞争 ───
    if (planGeneratingRef.current) return;

    // ─── 直接从 localStorage 读取最新计划（避免 stale closure）───
    let latestPlan = null;
    try { latestPlan = JSON.parse(localStorage.getItem('ai_autopilot_plan') || 'null'); } catch {}
    const planValid = latestPlan && !isPlanExpired(latestPlan);

    // ─── 当日续接：计划未过期、已有进度但未完成 → 发续接消息 ───
    if (planValid && latestPlan.steps) {
      try {
        const state = JSON.parse(localStorage.getItem('ai_autopilot_state') || '{}');
        const stepIdx = state.stepIndex || 0;
        if (stepIdx > 0) {
          const remaining = latestPlan.steps.filter((s, i) =>
            i >= stepIdx && !s.completed
          );
          const currentStep = latestPlan.steps[stepIdx];
          if (remaining.length > 0 && currentStep) {
            const lastMsg = threadMessages[threadMessages.length - 1];
            const alreadyResumed = lastMsg?.content?.includes('欢迎回来');
            if (!alreadyResumed && threadMessages.length > 0) {
              const resumeMsg = {
                role: 'assistant',
                content: `欢迎回来～你还有 ${remaining.length} 个任务没完成喔！接下来：${currentStep.title}`,
                _actions: [{ label: currentStep.actionLabel || '继续', route: currentStep.route }],
              };
              const updated = [...threadMessages, resumeMsg];
              tutor.setMessages(updated);
              if (activeThreadId) saveThreadMessages(activeThreadId, updated);
            }
            return; // 续接后不重新生成
          }
        }
      } catch {}
    }

    // ─── 24h 过期检查：计划有效且有消息 → 跳过生成 ───
    if (planValid && threadMessages.length > 0) {
      console.log('[AutoPilot] 今日计划未过期，跳过生成');
      return;
    }

    // ─── 计划过期 → 清除后重新生成 ───
    if (latestPlan && !planValid) {
      console.log('[AutoPilot] 计划已过期（超过24h），重新生成');
      try { localStorage.removeItem('ai_autopilot_plan'); } catch {}
      latestPlan = null;
    }

    planGeneratingRef.current = true;
    console.log('[AutoPilot] 开始生成今日学习计划... hasApiKey:', hasApiKey, 'activeThreadId:', activeThreadId);
    setGreeting('学姐正在为你制定今日学习计划...');

    // Ensure we have an active thread — getOrCreateThreadId handles creation + localStorage
    const threadId = getOrCreateThreadId();
    // 注意：不调用 switchThread！它在首次渲染时闭包里的 threads 是 []，
    // 会覆写 localStorage 清空已创建的线程，导致消息全部丢失。
    console.log('[AutoPilot] 使用线程:', threadId);

    // ─── 昨日未完成步骤顺延 ───
    let carryOverSteps = [];
    try {
      const yesterdaySummary = JSON.parse(localStorage.getItem('ai_autopilot_daily_summary') || 'null');
      if (yesterdaySummary?.pendingSteps?.length > 0) {
        const yesterdayPlan = latestPlan; // 当前 plan 可能是昨天的
        const yesterdayPlanFromStorage = JSON.parse(localStorage.getItem('ai_autopilot_plan') || 'null');
        const sourcePlan = (yesterdayPlanFromStorage?.createdAt !== latestPlan?.createdAt) ? yesterdayPlanFromStorage : null;
        if (sourcePlan?.steps) {
          carryOverSteps = yesterdaySummary.pendingSteps
            .map(id => sourcePlan.steps.find(s => s.id === id))
            .filter(Boolean)
            .map(s => ({ ...s, completed: false, id: s.id + '_carry' }));
        }
        if (carryOverSteps.length > 0) {
          console.log('[AutoPilot] 昨日未完成步骤顺延:', carryOverSteps.map(s => s.title).join(', '));
        }
      }
    } catch {}

    // If no API key, skip AI and go straight to local fallback
    if (!hasApiKey) {
      console.log('[AutoPilot] 无 API Key，使用本地降级方案');
      generateLocalFallbackPlan(threadId, carryOverSteps);
      return;
    }

    // Try AI first, fall back to local
    console.log('[AutoPilot] 尝试 AI 生成计划...');
    tutor.generateAutoPilotPlan().then((plan) => {
      console.log('[AutoPilot] AI 计划结果:', plan);
      if (plan && plan.steps && plan.steps.length > 0) {
        // Prepend carry-over steps
        const allSteps = [...carryOverSteps, ...plan.steps];
        const planWithMeta = { ...plan, steps: allSteps, createdAt: Date.now() };
        saveAutoPilotPlan(planWithMeta);

        const stepLines = allSteps.map((s, i) =>
          `${i + 1}️⃣ ${s.title}`
        ).join('\n');

        const planMsg = buildPlanGreeting(allSteps, carryOverSteps);

        const firstStep = allSteps[0];
        const actions = [{ label: firstStep.actionLabel || '开始', route: firstStep.route }];

        const msg = {
          role: 'assistant',
          content: planMsg,
          _actions: actions,
        };
        // 追加到现有对话，不覆盖
        const existingMsgs = readThreadMessages(threadId);
        const updatedMsgs = [...existingMsgs, msg];
        console.log('[AutoPilot] 设置计划消息到对话:', threadId);
        tutor.setMessages(updatedMsgs);
        saveThreadMessages(threadId, updatedMsgs);
        setGreeting('');
        planGeneratingRef.current = false;
      } else {
        console.warn('[AutoPilot] AI 返回空计划，降级到本地方案');
        generateLocalFallbackPlan(threadId, carryOverSteps);
      }
    }).catch((err) => {
      console.error('[AutoPilot] AI 计划失败:', err.message || err);
      generateLocalFallbackPlan(threadId, carryOverSteps);
    });

    // Local fallback: generate plan following correct learning flow
    async function generateLocalFallbackPlan(threadId, carryOver = []) {
      try {
        const [modulesRes, errors] = await Promise.all([
          api.get('/modules/list').catch(() => ({ units: [] })),
          api.get('/errorbook/due').catch(() => ({})),
        ]);

        const allUnits = modulesRes?.units || [];
        const errorItems = errors?.items || [];
        const steps = [...carryOver]; // 昨日顺延步骤放最前面

        // ─── ① 回顾昨日刷题错题 ───
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
              message: '先看看昨天练错的题，温故知新～趁热打铁印象更深！',
              actionLabel: '去错题本',
              route: '/review',
            });
          }
        } catch {}

        // ─── ② 学习 + 测验 + 错题回顾（从真实单元列表中选）───
        let pickedUnitId = '';
        let pickedUnitTitle = '';
        if (allUnits.length > 0) {
          // 优先选低难度单元（difficulty <= 2），否则选第一个
          const easyUnits = allUnits.filter(u => u.difficulty <= 2);
          const candidate = easyUnits[0] || allUnits[0];
          pickedUnitId = candidate.id;
          pickedUnitTitle = candidate.title;
        }

        if (pickedUnitId) {
          // Full flow: learn → quiz → error_review
          steps.push({
            id: `step_learn_${pickedUnitId}`,
            type: 'learn',
            unitId: pickedUnitId,
            title: `学习：${pickedUnitTitle}`,
            message: '来看看这个知识点吧，图谱和闪卡都很棒的喔～',
            actionLabel: '去学习',
            route: `/learn/${encodeURIComponent(pickedUnitId)}`,
          });
          steps.push({
            id: `step_quiz_${pickedUnitId}`,
            type: 'quiz',
            unitId: pickedUnitId,
            title: '测验检验',
            message: '学完了？来做几道题检验一下记住了多少！',
            actionLabel: '去测验',
            route: `/quiz/${encodeURIComponent(pickedUnitId)}`,
          });
          steps.push({
            id: 'step_error_review',
            type: 'error_review',
            unitId: pickedUnitId,
            title: '错题回顾',
            message: '测验完了看看错题，趁热打铁纠正印象！',
            actionLabel: '去错题回顾',
            route: `/review/${encodeURIComponent(pickedUnitId)}`,
          });
        } else if (errorItems.length > 0 && !hasYesterdayErrors) {
          // No new unit to learn, but have due errors → review them
          steps.push({
            id: 'step_errorbook',
            type: 'error_review',
            unitId: '',
            title: `复习 ${errorItems.length} 道到期错题`,
            message: `你有 ${errorItems.length} 道错题到期了，趁热打铁清理一下！`,
            actionLabel: '去错题本',
            route: '/review',
          });
        }
        // If neither unit nor errors, skip straight to practice below

        // ─── ⑤ 刷题（最重要的环节）───
        steps.push({
          id: 'step_practice',
          type: 'practice',
          unitId: '',
          title: '刷题练手',
          message: '去刷题界面大展身手吧！想做多少做多少，退出就代表今天任务完成啦～',
          actionLabel: '去刷题',
          route: '/practice',
        });

        const plan = { steps, createdAt: Date.now() };
        saveAutoPilotPlan(plan);

        // Build presentation
        const emojiMap = {
          review_yesterday_errors: '🔁',
          learn: '📖',
          quiz: '📝',
          error_review: '🔍',
          practice: '🎯',
          errorbook: '📚',
        };
        const stepLines = steps.map((s, i) =>
          `${emojiMap[s.type] || '📌'} ${i + 1}. ${s.title}`
        ).join('\n');

        const planMsg = buildPlanGreeting(steps, carryOver);
        const firstStep = steps[0];
        const msg = {
          role: 'assistant',
          content: planMsg,
          _actions: [{ label: firstStep.actionLabel, route: firstStep.route }],
        };
        const existingMsgs2 = readThreadMessages(threadId);
        const updatedMsgs2 = [...existingMsgs2, msg];
        tutor.setMessages(updatedMsgs2);
        saveThreadMessages(threadId, updatedMsgs2);
        setGreeting('');

        console.log('[AutoPilot] 本地计划已生成:', steps.map(s => s.type).join(' → '), '→ thread:', threadId);
        planGeneratingRef.current = false;
      } catch (e) {
        console.error('[AutoPilot] 本地计划失败:', e);
        setGreeting('');
        const fallbackMsg = {
          role: 'assistant',
          content: '自动驾驶模式已开启～告诉我你想学什么，或者去「系统」页面选一个章节开始吧！',
          _actions: [{ label: '去选章节', route: '/modules' }],
        };
        const existingMsgs3 = readThreadMessages(threadId);
        tutor.setMessages([...existingMsgs3, fallbackMsg]);
        saveThreadMessages(threadId, [...existingMsgs3, fallbackMsg]);
        planGeneratingRef.current = false;
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
