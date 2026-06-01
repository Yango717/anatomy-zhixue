import { createContext, useContext, useState, useCallback, useEffect } from 'react';

const AIContext = createContext(null);

const CHAT_HISTORY_KEY = 'ai_chat_history';
const MAX_HISTORY = 50; // Keep last 50 messages per unit

export function AIContextProvider({ children }) {
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('deepseek_api_key') || '');
  const [chatHistories, setChatHistories] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(CHAT_HISTORY_KEY) || '{}');
    } catch {
      return {};
    }
  });

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

  // Persist chat history
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

  // Get chat history for a unit
  const getChatHistory = useCallback((unitId) => {
    return chatHistories[unitId] || [];
  }, [chatHistories]);

  // Clear chat history for a unit
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

  // Model info (for future multimodal support)
  const [modelInfo, setModelInfo] = useState({
    name: 'DeepSeek V4',
    supportsVision: false,
    supportsVoice: false,
  });

  const updateModelInfo = useCallback((info) => {
    setModelInfo((prev) => ({ ...prev, ...info }));
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
    chatHistories,
    saveChatHistory,
    getChatHistory,
    clearChatHistory,
    modelInfo,
    updateModelInfo,
  };

  return <AIContext.Provider value={value}>{children}</AIContext.Provider>;
}

export function useAIContext() {
  const ctx = useContext(AIContext);
  if (!ctx) throw new Error('useAIContext must be used inside AIContextProvider');
  return ctx;
}

export default AIContext;
