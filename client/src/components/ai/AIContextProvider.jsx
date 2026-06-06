import { createContext, useContext, useState, useCallback, useEffect } from 'react';

const AIContext = createContext(null);

const CHAT_HISTORY_KEY = 'ai_chat_history';
const GLOBAL_CHAT_KEY = 'ai_global_chat';
const USER_PROFILE_KEY = 'ai_user_profile';
const THREADS_KEY = 'ai_threads';
const AUTOPILOT_MSGS_KEY = 'ai_autopilot_msgs';
const ACTIVE_HOME_TAB_KEY = 'ai_active_home_tab';
const MAX_HISTORY = 50;
const MAX_GLOBAL_MESSAGES = 100;
const MAX_THREADS = 20;
const MAX_AUTOPILOT_MSGS = 200;

export function AIContextProvider({ children }) {
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('deepseek_api_key') || '');

  // ─── Legacy: per-unit chat histories (kept for backward compat) ───
  const [chatHistories, setChatHistories] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(CHAT_HISTORY_KEY) || '{}');
    } catch {
      return {};
    }
  });

  // ─── Global unified chat messages (Layer 0 memory) ───
  const [globalMessages, setGlobalMessages] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(GLOBAL_CHAT_KEY) || '[]');
    } catch {
      return [];
    }
  });

  // ─── User profile / preferences (Layer 2 memory) ───
  const [userProfile, setUserProfile] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(USER_PROFILE_KEY) || '{}');
    } catch {
      return {};
    }
  });

  // ─── AutoPilot mode ───
  const [autoPilotEnabled, setAutoPilotEnabled] = useState(() => {
    try {
      const stored = localStorage.getItem('ai_autopilot_enabled');
      return stored === null ? true : stored === 'true'; // 默认开启
    }
    catch { return true; }
  });
  const [autoPilotPlan, setAutoPilotPlan] = useState(() => {
    try { return JSON.parse(localStorage.getItem('ai_autopilot_plan') || 'null'); }
    catch { return null; }
  });
  const [autoPilotStepIndex, setAutoPilotStepIndex] = useState(() => {
    try { return JSON.parse(localStorage.getItem('ai_autopilot_state') || '{}').stepIndex || 0; }
    catch { return 0; }
  });
  const [autoPilotPendingCheckin, setAutoPilotPendingCheckin] = useState(null);
  // 每日任务完成摘要 — 追踪哪些步骤完成了，哪些没完成
  const [autoPilotDailySummary, setAutoPilotDailySummary] = useState(() => {
    try { return JSON.parse(localStorage.getItem('ai_autopilot_daily_summary') || 'null'); }
    catch { return null; }
  });
  // ─── 自主模式独立消息流 ───
  const [autoPilotMessages, setAutoPilotMessages] = useState(() => {
    try { return JSON.parse(localStorage.getItem(AUTOPILOT_MSGS_KEY) || '[]'); }
    catch { return []; }
  });
  // 首页 Tab：'chat' | 'auto'
  const [activeHomeTab, setActiveHomeTab] = useState(() => {
    return localStorage.getItem(ACTIVE_HOME_TAB_KEY) || 'auto';
  });

  // 全局聊天气泡开关（迷你头像点击时打开）
  const [globalChatOpen, setGlobalChatOpen] = useState(false);

  // Persist API key
  const saveApiKey = useCallback((key) => {
    setApiKey(key);
    if (key) {
      localStorage.setItem('deepseek_api_key', key);
    } else {
      localStorage.removeItem('deepseek_api_key');
    }
  }, []);

  // TTS credentials
  const [ttsKey, setTtsKey] = useState(() => localStorage.getItem('doubao_tts_key') || '');
  const [ttsAppId, setTtsAppId] = useState(() => localStorage.getItem('doubao_tts_appid') || '');

  const saveTtsKey = useCallback((key) => {
    setTtsKey(key);
    if (key) {
      localStorage.setItem('doubao_tts_key', key);
    } else {
      localStorage.removeItem('doubao_tts_key');
    }
  }, []);

  const saveTtsAppId = useCallback((appId) => {
    setTtsAppId(appId);
    if (appId) {
      localStorage.setItem('doubao_tts_appid', appId);
    } else {
      localStorage.removeItem('doubao_tts_appid');
    }
  }, []);

  // ─── 自主模式消息方法 ───
  const saveAutoPilotMessages = useCallback((msgs) => {
    const trimmed = Array.isArray(msgs) ? msgs.slice(-MAX_AUTOPILOT_MSGS) : [];
    setAutoPilotMessages(trimmed);
    try { localStorage.setItem(AUTOPILOT_MSGS_KEY, JSON.stringify(trimmed)); } catch {}
  }, []);

  const addAutoPilotMessage = useCallback((msg) => {
    setAutoPilotMessages((prev) => {
      const updated = [...prev, msg].slice(-MAX_AUTOPILOT_MSGS);
      try { localStorage.setItem(AUTOPILOT_MSGS_KEY, JSON.stringify(updated)); } catch {}
      return updated;
    });
  }, []);

  const clearAutoPilotMessages = useCallback(() => {
    setAutoPilotMessages([]);
    try { localStorage.removeItem(AUTOPILOT_MSGS_KEY); } catch {}
  }, []);

  const switchHomeTab = useCallback((tab) => {
    setActiveHomeTab(tab);
    try { localStorage.setItem(ACTIVE_HOME_TAB_KEY, tab); } catch {}
  }, []);

  // ─── Legacy: per-unit chat history ───
  const saveChatHistory = useCallback((unitId, messages) => {
    setChatHistories((prev) => {
      const updated = {
        ...prev,
        [unitId]: messages.slice(-MAX_HISTORY),
      };
      try {
        localStorage.setItem(CHAT_HISTORY_KEY, JSON.stringify(updated));
      } catch {}
      return updated;
    });
  }, []);

  const getChatHistory = useCallback((unitId) => {
    return chatHistories[unitId] || [];
  }, [chatHistories]);

  const clearChatHistory = useCallback((unitId) => {
    setChatHistories((prev) => {
      const updated = { ...prev };
      delete updated[unitId];
      try {
        localStorage.setItem(CHAT_HISTORY_KEY, JSON.stringify(updated));
      } catch {}
      return updated;
    });
  }, []);

  // ─── Global chat messages (Layer 0) ───
  const saveGlobalMessages = useCallback((messages) => {
    const trimmed = messages.slice(-MAX_GLOBAL_MESSAGES);
    setGlobalMessages(trimmed);
    try {
      localStorage.setItem(GLOBAL_CHAT_KEY, JSON.stringify(trimmed));
    } catch {}
  }, []);

  const clearGlobalMessages = useCallback(() => {
    setGlobalMessages([]);
    try {
      localStorage.removeItem(GLOBAL_CHAT_KEY);
    } catch {}
  }, []);

  // ─── User profile (Layer 2: preferences + habits) ───
  const saveUserProfile = useCallback((profile) => {
    const merged = { ...userProfile, ...profile, updatedAt: Date.now() };
    setUserProfile(merged);
    try {
      localStorage.setItem(USER_PROFILE_KEY, JSON.stringify(merged));
    } catch {}
  }, [userProfile]);

  const updateUserPreference = useCallback((key, value) => {
    setUserProfile((prev) => {
      const updated = { ...prev, [key]: value, updatedAt: Date.now() };
      try {
        localStorage.setItem(USER_PROFILE_KEY, JSON.stringify(updated));
      } catch {}
      return updated;
    });
  }, []);

  // ─── Thread management ───
  const [threads, setThreads] = useState(() => {
    try {
      const data = JSON.parse(localStorage.getItem(THREADS_KEY) || '{}');
      return data.threads || [];
    } catch { return []; }
  });
  const [activeThreadId, setActiveThreadId] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(THREADS_KEY) || '{}').activeThreadId || null;
    } catch { return null; }
  });

  const persistThreads = useCallback((newThreads, newActiveId) => {
    setThreads(newThreads);
    setActiveThreadId(newActiveId);
    try {
      localStorage.setItem(THREADS_KEY, JSON.stringify({ threads: newThreads, activeThreadId: newActiveId }));
    } catch {}
  }, []);

  const createThread = useCallback(() => {
    const id = `thread_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const newThread = {
      id,
      name: '新对话',
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    setThreads((prev) => {
      let baseThreads = prev;
      try {
        const data = JSON.parse(localStorage.getItem(THREADS_KEY) || '{}');
        if (Array.isArray(data.threads) && data.threads.length > prev.length) {
          baseThreads = data.threads;
        }
      } catch {}
      const newThreads = [newThread, ...baseThreads].slice(0, MAX_THREADS);
      try {
        localStorage.setItem(THREADS_KEY, JSON.stringify({ threads: newThreads, activeThreadId: id }));
      } catch {}
      return newThreads;
    });
    setActiveThreadId(id);
    return id;
  }, []);

  const switchThread = useCallback((threadId) => {
    if (!threadId) return;
    setActiveThreadId(threadId);
    try {
      const data = JSON.parse(localStorage.getItem(THREADS_KEY) || '{}');
      localStorage.setItem(THREADS_KEY, JSON.stringify({
        threads: Array.isArray(data.threads) ? data.threads : threads,
        activeThreadId: threadId,
      }));
    } catch {}
  }, [threads]);

  const saveThreadMessages = useCallback((threadId, messages) => {
    if (!threadId) return;
    const safeMessages = Array.isArray(messages) ? messages.slice(-MAX_GLOBAL_MESSAGES) : [];
    setThreads((prev) => {
      let baseThreads = prev;
      try {
        const data = JSON.parse(localStorage.getItem(THREADS_KEY) || '{}');
        if (Array.isArray(data.threads) && data.threads.length >= prev.length) {
          baseThreads = data.threads;
        }
      } catch {}
      const exists = baseThreads.some((t) => t.id === threadId);
      const updated = exists
        ? baseThreads.map((t) => (
            t.id === threadId
              ? { ...t, messages: safeMessages, updatedAt: Date.now() }
              : t
          ))
        : [{
            id: threadId,
            name: '新对话',
            messages: safeMessages,
            createdAt: Date.now(),
            updatedAt: Date.now(),
          }, ...baseThreads].slice(0, MAX_THREADS);
      try {
        const data = JSON.parse(localStorage.getItem(THREADS_KEY) || '{}');
        const currentActiveId = data.activeThreadId || activeThreadId || threadId;
        localStorage.setItem(THREADS_KEY, JSON.stringify({ threads: updated, activeThreadId: currentActiveId }));
      } catch {}
      return updated;
    });
  }, [activeThreadId]);

  const renameThread = useCallback((threadId, name) => {
    setThreads((prev) => {
      const updated = prev.map((t) => t.id === threadId ? { ...t, name } : t);
      try {
        let currentActiveId = activeThreadId;
        if (!currentActiveId) {
          const data = JSON.parse(localStorage.getItem(THREADS_KEY) || '{}');
          currentActiveId = data.activeThreadId || threadId;
        }
        localStorage.setItem(THREADS_KEY, JSON.stringify({ threads: updated, activeThreadId: currentActiveId }));
      } catch {}
      return updated;
    });
  }, [activeThreadId]);

  const deleteThread = useCallback((threadId) => {
    setThreads((prev) => {
      const updated = prev.filter((t) => t.id !== threadId);
      const newActiveId = activeThreadId === threadId
        ? (updated[0]?.id || null)
        : activeThreadId;
      setActiveThreadId(newActiveId);
      try {
        localStorage.setItem(THREADS_KEY, JSON.stringify({ threads: updated, activeThreadId: newActiveId }));
      } catch {}
      return updated;
    });
  }, [activeThreadId]);

  const getActiveThread = useCallback(() => {
    return threads.find((t) => t.id === activeThreadId) || null;
  }, [threads, activeThreadId]);

  // Auto-create first thread if none exist
  useEffect(() => {
    if (threads.length === 0) {
      createThread();
    } else if (!activeThreadId && threads.length > 0) {
      setActiveThreadId(threads[0].id);
    }
  }, []);

  // v3.2 迁移：只修正自动模式默认值，保留用户的聊天线程与全局记忆
  useEffect(() => {
    try {
      if (!localStorage.getItem('ai_autopilot_v3_migrated')) {
        if (localStorage.getItem('ai_autopilot_enabled') === null) {
          localStorage.setItem('ai_autopilot_enabled', 'true');
          setAutoPilotEnabled(true);
        }
        localStorage.setItem('ai_autopilot_v3_migrated', '1');
      }
    } catch {}
  }, []);

  // v4 迁移：将旧线程中的 AutoPilot 消息迁移到独立消息流
  useEffect(() => {
    try {
      if (localStorage.getItem('ai_autopilot_v4_migrated')) return;

      // 从现有线程中提取含 _actions 的 AutoPilot 消息
      let migratedMsgs = [];
      try {
        const data = JSON.parse(localStorage.getItem('ai_threads') || '{}');
        const allThreads = data.threads || [];
        for (const thread of allThreads) {
          if (!thread.messages) continue;
          for (const msg of thread.messages) {
            if (msg._actions && msg._actions.length > 0) {
              migratedMsgs.push(msg);
            }
          }
        }
      } catch {}

      // 如果已有自主消息，追加迁移消息；否则直接写入
      if (migratedMsgs.length > 0) {
        const existing = JSON.parse(localStorage.getItem(AUTOPILOT_MSGS_KEY) || '[]');
        const combined = [...existing, ...migratedMsgs].slice(-MAX_AUTOPILOT_MSGS);
        localStorage.setItem(AUTOPILOT_MSGS_KEY, JSON.stringify(combined));
      }

      localStorage.setItem('ai_autopilot_v4_migrated', '1');
    } catch {}
  }, []);

  // Apply autoPilot theme on mount
  useEffect(() => {
    if (autoPilotEnabled) {
      document.body.dataset.autoPilot = 'on';
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Model info (for future multimodal support)
  const [modelInfo, setModelInfo] = useState({
    name: 'DeepSeek V4',
    supportsVision: false,
    supportsVoice: false,
  });

  const updateModelInfo = useCallback((info) => {
    setModelInfo((prev) => ({ ...prev, ...info }));
  }, []);

  // ─── AutoPilot methods ───

  const isPlanExpired = useCallback((plan) => {
    if (!plan?.createdAt) return true;
    return Date.now() - plan.createdAt > 24 * 60 * 60 * 1000;
  }, []);

  const toggleAutoPilot = useCallback(() => {
    setAutoPilotEnabled((prev) => {
      const next = !prev;
      localStorage.setItem('ai_autopilot_enabled', String(next));
      if (next) {
        document.body.dataset.autoPilot = 'on';
      } else {
        delete document.body.dataset.autoPilot;
      }
      return next;
    });
  }, []);

  const saveAutoPilotPlan = useCallback((plan) => {
    setAutoPilotPlan(plan);
    setAutoPilotStepIndex(0);
    try { localStorage.setItem('ai_autopilot_plan', JSON.stringify(plan)); } catch {}
    try {
      const state = JSON.parse(localStorage.getItem('ai_autopilot_state') || '{}');
      state.stepIndex = 0;
      localStorage.setItem('ai_autopilot_state', JSON.stringify(state));
    } catch {}
    // Reset daily summary when plan is saved
    if (plan?.steps) {
      const summary = {
        date: new Date().toDateString(),
        createdAt: plan.createdAt,
        completedSteps: [],
        pendingSteps: plan.steps.map(s => s.id),
      };
      setAutoPilotDailySummary(summary);
      try { localStorage.setItem('ai_autopilot_daily_summary', JSON.stringify(summary)); } catch {}
    } else {
      setAutoPilotDailySummary(null);
      try { localStorage.removeItem('ai_autopilot_daily_summary'); } catch {}
    }
  }, []);

  const advanceAutoPilotStep = useCallback(() => {
    setAutoPilotStepIndex((prev) => {
      const next = prev + 1;
      try {
        const state = JSON.parse(localStorage.getItem('ai_autopilot_state') || '{}');
        state.stepIndex = next;
        localStorage.setItem('ai_autopilot_state', JSON.stringify(state));
      } catch {}
      return next;
    });
  }, []);

  const registerActivityComplete = useCallback((activity) => {
    const idx = autoPilotStepIndex;
    // Mark current step as completed
    setAutoPilotPlan((prevPlan) => {
      if (!prevPlan?.steps) return prevPlan;
      const steps = prevPlan.steps.map((s, i) =>
        i === idx ? { ...s, completed: true } : s
      );
      const newPlan = { ...prevPlan, steps };
      try { localStorage.setItem('ai_autopilot_plan', JSON.stringify(newPlan)); } catch {}

      // Update daily summary
      const completed = steps.filter(s => s.completed).map(s => s.id);
      const pending = steps.filter(s => !s.completed).map(s => s.id);
      const summary = {
        date: new Date().toDateString(),
        createdAt: newPlan.createdAt,
        completedSteps: completed,
        pendingSteps: pending,
      };
      setAutoPilotDailySummary(summary);
      try { localStorage.setItem('ai_autopilot_daily_summary', JSON.stringify(summary)); } catch {}

      return newPlan;
    });
    // Queue a checkin for AutoPilotCheckin to deliver
    setAutoPilotPendingCheckin({
      activity,
      completedStepIndex: idx,
      timestamp: Date.now(),
    });
  }, [autoPilotStepIndex]);

  const markCheckinDelivered = useCallback(() => {
    setAutoPilotPendingCheckin(null);
  }, []);

  const value = {
    apiKey,
    saveApiKey,
    hasApiKey: !!apiKey,
    ttsKey,
    saveTtsKey,
    ttsAppId,
    saveTtsAppId,
    hasTtsKey: !!ttsKey,
    // Legacy per-unit
    chatHistories,
    saveChatHistory,
    getChatHistory,
    clearChatHistory,
    // Global chat (new)
    globalMessages,
    saveGlobalMessages,
    clearGlobalMessages,
    // User profile (new)
    userProfile,
    saveUserProfile,
    updateUserPreference,
    // Thread management
    threads,
    activeThreadId,
    createThread,
    switchThread,
    saveThreadMessages,
    renameThread,
    deleteThread,
    getActiveThread,
    // Model info
    modelInfo,
    updateModelInfo,
    // AutoPilot
    autoPilotEnabled,
    autoPilotPlan,
    autoPilotStepIndex,
    autoPilotPendingCheckin,
    autoPilotDailySummary,
    isPlanExpired,
    globalChatOpen,
    setGlobalChatOpen,
    toggleAutoPilot,
    saveAutoPilotPlan,
    advanceAutoPilotStep,
    registerActivityComplete,
    markCheckinDelivered,
    // 自主模式独立消息
    autoPilotMessages,
    saveAutoPilotMessages,
    addAutoPilotMessage,
    clearAutoPilotMessages,
    // 首页 Tab
    activeHomeTab,
    switchHomeTab,
  };

  return <AIContext.Provider value={value}>{children}</AIContext.Provider>;
}

export function useAIContext() {
  const ctx = useContext(AIContext);
  if (!ctx) throw new Error('useAIContext must be used inside AIContextProvider');
  return ctx;
}

export default AIContext;
