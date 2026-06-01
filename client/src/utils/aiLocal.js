// Client-side direct DeepSeek API calls for local mode
const DEEPSEEK_URL = 'https://api.deepseek.com/v1/chat/completions';
const MODEL = 'deepseek-chat';

// Non-streaming call for local mode
async function callDeepSeek(apiKey, messages, maxTokens = 1024, temperature = 0.7) {
  const res = await fetch(DEEPSEEK_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages,
      stream: false,
      max_tokens: maxTokens,
      temperature,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `API error: ${res.status}`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content || '';
}

export async function aiChatLocal(apiKey, unitId, scene, messages) {
  // For local mode, we return the text directly (no streaming)
  // The context building is minimal since we don't have server-side content access
  // We rely on the client to pass relevant context
  return callDeepSeek(apiKey, messages, 1024, scene === 'quiz' ? 0.3 : 0.7);
}

export async function aiGenerateQuizLocal(apiKey, unitId, count = 3) {
  const text = await callDeepSeek(
    apiKey,
    [
      {
        role: 'system',
        content: '你是解剖学助教。请根据知识点生成填空题。返回严格JSON格式。',
      },
      {
        role: 'user',
        content: `请为这个知识点生成${count}道填空题。返回JSON: {"questions":[{"stem":"...","answer":"...","hint":"...","difficulty":"easy|medium|hard"}]}`,
      },
    ],
    1024,
    0.7
  );

  try {
    const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/) || [null, text];
    return JSON.parse(jsonMatch[1] || text);
  } catch {
    return { rawText: text };
  }
}

export async function aiReviewReportLocal(apiKey, unitId) {
  return callDeepSeek(
    apiKey,
    [
      {
        role: 'system',
        content: '你是解剖学助教。请分析学生的测试错题，指出薄弱知识点，给出复习建议。200字以内。',
      },
      {
        role: 'user',
        content: '请根据我最近的测试结果分析薄弱点。',
      },
    ],
    800,
    0.7
  );
}

export async function aiTodayRecommendLocal(apiKey) {
  return callDeepSeek(
    apiKey,
    [
      {
        role: 'system',
        content: '你是"解剖学姐"，大三临床医学生，温柔耐心又幽默活泼的台湾女生。给学生一句甜甜的问候和一条学习建议。用台湾女生语气（句尾加"啦""喔""耶"），100字以内。',
      },
      {
        role: 'user',
        content: '今天该学什么？根据我的整体进度给个建议。',
      },
    ],
    300,
    0.8
  );
}
