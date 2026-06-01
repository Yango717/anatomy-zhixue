import { useState, useRef, useCallback } from 'react';
import { api } from '../utils/api';

const API_BASE = '/api/v1';

// Detect if in local mode (no server)
let cachedMode = null;
async function getCachedMode() {
  if (cachedMode) return cachedMode;
  try {
    const res = await fetch('/api/v1/health');
    const json = await res.json();
    cachedMode = json?.success ? 'server' : 'local';
  } catch {
    cachedMode = 'local';
  }
  return cachedMode;
}

export default function useAITutor() {
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const abortRef = useRef(null);

  // Determine scene from current route
  function getScene() {
    const path = window.location.pathname;
    if (path === '/' || path === '') return 'home';
    if (path.startsWith('/learn/')) return 'learn';
    if (path.startsWith('/quiz/')) return 'quiz';
    if (path.startsWith('/test/')) return 'review';
    if (path.startsWith('/review') && path !== '/review') return 'review';
    if (path === '/review') return 'errorbook';
    return 'learn';
  }

  // Extract unitId from current URL
  function getUnitId() {
    const path = window.location.pathname;
    const match = path.match(/\/(learn|quiz|review|test|finalexam)\/(.+)/);
    if (match) return decodeURIComponent(match[2]);
    return '';
  }

  // Get stored API key
  function getApiKey() {
    return localStorage.getItem('deepseek_api_key') || '';
  }

  // Streaming chat
  async function sendMessage(text) {
    const apiKey = getApiKey();
    if (!apiKey) {
      setError('请先在"我的"页面配置DeepSeek API Key');
      return;
    }

    const userMsg = { role: 'user', content: text };
    const assistantMsg = { role: 'assistant', content: '' };
    setMessages((prev) => [...prev, userMsg, assistantMsg]);
    setIsLoading(true);
    setError(null);

    const scene = getScene();
    const unitId = getUnitId();

    try {
      const controller = new AbortController();
      abortRef.current = controller;

      const res = await fetch(`${API_BASE}/ai/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiKey,
          unitId,
          scene,
          messages: messages.concat([userMsg]).map((m) => ({ role: m.role, content: m.content })),
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        // If server unavailable, fall back to local mode
        if (res.status === 0 || res.status >= 500) {
          throw new Error('SERVER_UNAVAILABLE');
        }
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error?.message || `API error: ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6).trim();
            if (data === '[DONE]') break;
            try {
              const parsed = JSON.parse(data);
              if (parsed.content) {
                setMessages((prev) => {
                  const updated = [...prev];
                  const lastIdx = updated.length - 1;
                  if (lastIdx >= 0 && updated[lastIdx].role === 'assistant') {
                    updated[lastIdx] = {
                      ...updated[lastIdx],
                      content: updated[lastIdx].content + parsed.content,
                    };
                  }
                  return updated;
                });
              }
              if (parsed.error) {
                setError(parsed.error);
              }
            } catch {}
          }
        }
      }
    } catch (err) {
      if (err.name === 'AbortError') {
        // User cancelled
      } else if (err.message === 'SERVER_UNAVAILABLE') {
        // Fall back to local mode (non-streaming)
        try {
          const result = await api.post('/ai/chat', {
            apiKey,
            unitId,
            scene,
            messages: messages.concat([userMsg]).map((m) => ({ role: m.role, content: m.content })),
          });
          const replyText = result?.reply || result?.content || '';
          setMessages((prev) => {
            const updated = [...prev];
            const lastIdx = updated.length - 1;
            if (lastIdx >= 0 && updated[lastIdx].role === 'assistant') {
              updated[lastIdx] = { ...updated[lastIdx], content: replyText };
            }
            return updated;
          });
        } catch (localErr) {
          setError(localErr.message || 'AI请求失败');
          setMessages((prev) => {
            const updated = [...prev];
            const lastIdx = updated.length - 1;
            if (lastIdx >= 0 && updated[lastIdx].role === 'assistant' && !updated[lastIdx].content) {
              updated[lastIdx] = { ...updated[lastIdx], content: '抱歉，请求失败了，请稍后重试。' };
            }
            return updated;
          });
        }
      } else {
        setError(err.message || 'AI请求失败');
        setMessages((prev) => {
          const updated = [...prev];
          const lastIdx = updated.length - 1;
          if (lastIdx >= 0 && updated[lastIdx].role === 'assistant' && !updated[lastIdx].content) {
            updated[lastIdx] = { ...updated[lastIdx], content: '抱歉，请求失败了，请稍后重试。' };
          }
          return updated;
        });
      }
    } finally {
      setIsLoading(false);
      abortRef.current = null;
    }
  }

  // Generate quiz questions
  async function generateQuiz(count = 3) {
    const apiKey = getApiKey();
    if (!apiKey) {
      setError('请先配置DeepSeek API Key');
      return null;
    }
    const unitId = getUnitId();
    setIsLoading(true);
    setError(null);

    try {
      const result = await api.post('/ai/generate-quiz', { apiKey, unitId, count });
      // Try to parse JSON from AI response
      const text = typeof result === 'string' ? result : result.quiz || '';
      try {
        // Extract JSON from possible markdown code block
        const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/) || [null, text];
        return JSON.parse(jsonMatch[1] || text);
      } catch {
        return { rawText: text };
      }
    } catch (err) {
      setError(err.message || '生成题目失败');
      return null;
    } finally {
      setIsLoading(false);
    }
  }

  // Generate review report
  async function generateReviewReport() {
    const apiKey = getApiKey();
    if (!apiKey) {
      setError('请先配置DeepSeek API Key');
      return null;
    }
    const unitId = getUnitId();
    setIsLoading(true);
    setError(null);

    try {
      const result = await api.post('/ai/review-report', { apiKey, unitId });
      return typeof result === 'string' ? result : result.report || '';
    } catch (err) {
      setError(err.message || '生成复盘报告失败');
      return null;
    } finally {
      setIsLoading(false);
    }
  }

  // Generate today's recommendation
  async function generateTodayRecommend() {
    const apiKey = getApiKey();
    if (!apiKey) return null;

    try {
      const result = await api.post('/ai/today-recommend', { apiKey });
      return typeof result === 'string' ? result : result.recommendation || '';
    } catch {
      return null;
    }
  }

  // Non-streaming quick question (for hint/scene-specific)
  async function quickAsk(text, scene) {
    const apiKey = getApiKey();
    if (!apiKey) {
      setError('请先配置DeepSeek API Key');
      return null;
    }
    setError(null);

    try {
      const controller = new AbortController();
      abortRef.current = controller;

      const unitId = getUnitId();
      const res = await fetch(`${API_BASE}/ai/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiKey,
          unitId,
          scene: scene || getScene(),
          messages: [{ role: 'user', content: text }],
        }),
        signal: controller.signal,
      });

      if (!res.ok) throw new Error(`API error: ${res.status}`);

      // Collect streaming response into single string
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let fullText = '';
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6).trim();
            if (data === '[DONE]') break;
            try {
              const parsed = JSON.parse(data);
              if (parsed.content) fullText += parsed.content;
            } catch {}
          }
        }
      }
      return fullText;
    } catch (err) {
      if (err.name !== 'AbortError') {
        setError(err.message);
      }
      return null;
    } finally {
      abortRef.current = null;
    }
  }

  function clearMessages() {
    setMessages([]);
    setError(null);
  }

  function cancelRequest() {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    setIsLoading(false);
  }

  function hasApiKey() {
    return !!getApiKey();
  }

  return {
    messages,
    isLoading,
    error,
    sendMessage,
    quickAsk,
    generateQuiz,
    generateReviewReport,
    generateTodayRecommend,
    clearMessages,
    cancelRequest,
    hasApiKey,
    getScene,
    getUnitId,
    setMessages,
  };
}
