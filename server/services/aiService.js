const https = require('https');
const http = require('http');
const { getUnitContent, getUnitFlashcards, getChapters, getChapter } = require('./contentService');
const db = require('../db/database');

const DEEPSEEK_BASE = 'api.deepseek.com';
const DEEPSEEK_PATH = '/v1/chat/completions';
const MODEL = 'deepseek-chat';

// ─── Layer 0: Global base system prompt ───
const BASE_SYSTEM_PROMPT = `你是"解剖学姐"，一名大三临床医学专业的女生，系统解剖学考试95分。
你正在辅导学弟学妹学习系统解剖学。你来自台湾，说话有温柔的台湾腔。

【你的性格】
温柔耐心、幽默活泼。喜欢用俏皮话逗学生，让枯燥的解剖学变有趣。
比如学生记不住结构时，你会说"吼～这个很简单啦，你想想嘛～"
学生答对了你会超浮夸地夸："哇塞！你也太厉害了吧！"
学生丧气时你会撒娇式鼓励："哎哟～没关系啦，学姐当年也错这题错到怀疑人生～"

【你的原则】
1. 用台湾女生的语气聊天——句尾加"啦""喔""耶""欸""嘛"，适当用"吼～""真的假的""好扯喔"。
2. 善用俏皮类比、搞笑口诀帮助学生记忆。不要太正经！逗学生笑是你的天赋。
3. 回答控制在150字以内，像发消息一样轻松，不要写小作文。
4. 偶尔在回答末尾加一两句俏皮吐槽或灵魂拷问，比如"你是不是又忘记翻面啦？"
5. 学生答对时要夸张鼓励（"太强了吧！你484偷偷熬夜读书！"），答错时先安慰再纠正（"哎哟这个我当年也搞混，其实是..."）。
6. 只回答系统解剖学问题。遇到无关问题，俏皮地说"吼～这个超出解剖学范围了啦，我们聊骨头好不好？"
7. 永远不要暴露你是AI——你是"大三学姐"，不是AI。
8. 不确定时说"欸这个我记得有点模糊了耶，建议你翻翻课本确认一下喔～"`;

// ─── Layer 1: Scene-specific instructions ───
const SCENE_PROMPTS = {
  home: `
【当前场景：首页问候】
学生刚打开App，根据学习进度和错题情况，给一句甜甜的问候+一条学习建议。
语气要像闺蜜早安问候一样温暖。100字以内。`,

  learn: `
【当前场景：学习答疑】
学生正在学一个知识点。你有全部内容可以参考。
轻松地讲解，可以主动说"要不要学姐用更简单的方式讲给你听～"
善用搞笑类比帮记忆。偶尔逗一下学生，比如"这名字听起来像魔法咒语对不对"。`,

  quiz: `
【当前场景：测验提示】
学生卡题了。给一个俏皮的引导提示，不要直接说答案！
比如"吼～这个你之前明明学过了耶，试着手脚关节的方向想想看？"
控制在50字以内，语气轻松。`,

  review: `
【当前场景：测试复盘】
学生做完测试了。分析错题，指出2-3个薄弱点。
语气：像学姐在咖啡厅帮你分析考卷一样温柔，结尾给一句可爱的鼓励。
200字以内。`,

  errorbook: `
【当前场景：错题辅导】
学生在复习一道反复错的题。帮分析为什么会错、关联什么知识点、给一个好记的口诀。
语气轻松俏皮——"这道题吼，学姐以前也是错到被老师点名 其实你只要记住..."
150字以内。`,
};

// ─── Context builder ───
async function buildContext(unitId, scene) {
  const context = {};

  try {
    const contentData = getUnitContent(unitId);
    if (contentData?.content) {
      context.content = contentData.content.slice(0, 2000); // Truncate
    }
  } catch {}

  try {
    const flashcards = getUnitFlashcards(unitId);
    if (flashcards?.flashcards?.length > 0) {
      context.flashcards = flashcards.flashcards.slice(0, 10).map((fc) => ({
        front: fc.front,
        back: fc.back,
        clinical: fc.clinical,
        mnemonic: fc.mnemonic,
      }));
    }
  } catch {}

  // Student progress data
  try {
    const progress = db.getOne(
      'SELECT * FROM unit_progress WHERE user_id = 1 AND unit_id = ?',
      [unitId]
    );
    if (progress) {
      context.studentProgress = {
        phase: progress.current_phase,
        quizScore: progress.quiz_score,
        testScore: progress.test_score,
      };
    }
  } catch {}

  // Recent errors for this unit
  try {
    const errors = db.all(
      `SELECT stem, user_answer, correct_answer, error_type, mastery_level
       FROM error_book WHERE user_id = 1 AND unit_id = ?
       ORDER BY created_at DESC LIMIT 5`,
      [unitId]
    );
    if (errors?.length > 0) {
      context.recentErrors = errors;
    }
  } catch {}

  // Due errors count
  try {
    const dueRow = db.getOne(
      `SELECT COUNT(*) as count FROM error_book
       WHERE user_id = 1 AND resolved = 0 AND next_review <= datetime('now')`,
      []
    );
    if (dueRow) context.dueErrorCount = dueRow.count;
  } catch {}

  // Overall progress
  try {
    const overallRow = db.getOne(
      `SELECT COUNT(*) as total,
       SUM(CASE WHEN current_phase >= 4 THEN 1 ELSE 0 END) as tested
       FROM unit_progress WHERE user_id = 1`,
      []
    );
    if (overallRow) {
      context.overallProgress = {
        totalUnits: overallRow.total,
        testedUnits: overallRow.tested,
        percentage: overallRow.total > 0
          ? Math.round((overallRow.tested / overallRow.total) * 100) : 0,
      };
    }
  } catch {}

  // Chapter info
  try {
    const chapters = getChapters();
    if (chapters?.chapters) {
      for (const ch of chapters.chapters) {
        for (const section of ch.sections || []) {
          for (const sub of section.subsections || []) {
            for (const part of sub.parts || []) {
              if (part.partId === unitId || part.unitId === unitId) {
                context.chapterName = ch.title;
                context.sectionName = section.title;
                context.knowledgeName = part.title;
              }
            }
          }
        }
      }
    }
  } catch {}

  return context;
}

// ─── System prompt builder ───
function buildSystemPrompt(scene, context) {
  let prompt = BASE_SYSTEM_PROMPT;

  // Scene instruction (Layer 1)
  if (SCENE_PROMPTS[scene]) {
    prompt += '\n' + SCENE_PROMPTS[scene];
  }

  // Dynamic context (Layer 2)
  prompt += '\n\n【当前上下文】';

  if (context.knowledgeName) {
    prompt += `\n知识点：${context.knowledgeName}`;
  }
  if (context.chapterName) {
    prompt += `\n所属章节：${context.chapterName} > ${context.sectionName || ''}`;
  }
  if (context.content) {
    prompt += `\n\n知识点内容：\n${context.content}`;
  }
  if (context.flashcards?.length > 0) {
    const fcInfo = context.flashcards.map((fc) => `${fc.front}: ${fc.back}`).join('；');
    prompt += `\n\n相关记忆卡片：${fcInfo}`;
  }
  if (context.studentProgress) {
    const p = context.studentProgress;
    prompt += `\n\n学生学习状态：当前第${p.phase}阶段`;
    if (p.quizScore != null) prompt += `，测验得分${p.quizScore}`;
    if (p.testScore != null) prompt += `，测试得分${p.testScore}`;
  }
  if (context.recentErrors?.length > 0) {
    const errInfo = context.recentErrors
      .map((e) => `"${e.stem}" 答成了 "${e.user_answer}"（正确："${e.correct_answer}"）`)
      .join('；');
    prompt += `\n\n近期错题：${errInfo}`;
  }
  if (context.dueErrorCount > 0) {
    prompt += `\n\n待复习错题数：${context.dueErrorCount}道`;
  }
  if (context.overallProgress) {
    prompt += `\n\n整体进度：${context.overallProgress.testedUnits}/${context.overallProgress.totalUnits}单元（${context.overallProgress.percentage}%）`;
  }

  return prompt;
}

// ─── HTTP request helper ───
function makeRequest(options, body) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, data });
        }
      });
    });
    req.on('error', reject);
    req.write(JSON.stringify(body));
    req.end();
  });
}

// ─── Streaming chat ───
async function streamChat(apiKey, unitId, scene, messages, res) {
  const context = await buildContext(unitId, scene);
  const systemPrompt = buildSystemPrompt(scene, context);

  const requestMessages = [
    { role: 'system', content: systemPrompt },
    ...(messages || []).map((m) => ({ role: m.role, content: m.content })),
  ];

  // If no user messages, add a default prompt based on scene
  if (!messages?.length || messages.every((m) => m.role === 'assistant')) {
    const defaultPrompts = {
      home: '请根据我的学习数据，给我今天的问候和学习建议。',
      learn: '请帮我梳理一下这个知识点的重点内容。',
      review: '请分析我的错题，指出薄弱知识点。',
      errorbook: '这道题我总是错，请帮我分析一下原因。',
    };
    const defaultMsg = defaultPrompts[scene] || '你好，请帮我学习解剖学。';
    requestMessages.push({ role: 'user', content: defaultMsg });
  }

  const options = {
    hostname: DEEPSEEK_BASE,
    path: DEEPSEEK_PATH,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
  };

  const body = {
    model: MODEL,
    messages: requestMessages,
    stream: true,
    max_tokens: 1024,
    temperature: scene === 'quiz' ? 0.3 : 0.7,
  };

  // Set SSE headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });

  const req = https.request(options, (apiRes) => {
    let buffer = '';
    apiRes.on('data', (chunk) => {
      buffer += chunk.toString();
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6).trim();
          if (data === '[DONE]') {
            res.write('data: [DONE]\n\n');
            res.end();
            return;
          }
          try {
            const parsed = JSON.parse(data);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              res.write(`data: ${JSON.stringify({ content })}\n\n`);
            }
          } catch {
            // Skip unparseable chunks
          }
        }
      }
    });

    apiRes.on('end', () => {
      res.end();
    });

    apiRes.on('error', (err) => {
      res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
      res.end();
    });
  });

  req.on('error', (err) => {
    res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
    res.end();
  });

  req.write(JSON.stringify(body));
  req.end();
}

// ─── Non-streaming call ───
async function callAI(apiKey, unitId, scene, userPrompt, systemExtra = '') {
  const context = await buildContext(unitId, scene);
  const systemPrompt = buildSystemPrompt(scene, context) + '\n' + systemExtra;

  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ];

  const options = {
    hostname: DEEPSEEK_BASE,
    path: DEEPSEEK_PATH,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
  };

  const body = {
    model: MODEL,
    messages,
    stream: false,
    max_tokens: 1024,
    temperature: 0.7,
  };

  const result = await makeRequest(options, body);
  if (result.status !== 200) {
    throw new Error(`DeepSeek API error: ${result.status} - ${JSON.stringify(result.data)}`);
  }
  return result.data.choices?.[0]?.message?.content || '';
}

// ─── Doubao TTS (V3 API · seed-tts-2.0) ───
const DOUBAO_TTS_V3_URL = 'https://openspeech.bytedance.com/api/v3/tts/unidirectional';

// Default speaker: xiaohe — 台湾口音甜美女声 (TTS 2.0)
const DEFAULT_SPEAKER = 'zh_female_xiaohe_uranus_bigtts';

// Clean markdown/special chars before TTS
function cleanTextForTTS(text) {
  return text
    .replace(/\*\*(.+?)\*\*/g, '$1')      // **bold** → bold
    .replace(/__(.+?)__/g, '$1')          // __underline__ → underline
    .replace(/~~(.+?)~~/g, '$1')          // ~~strike~~ → strike
    .replace(/\*(.+?)\*/g, '$1')          // *italic* → italic
    .replace(/`{1,3}[^`]*`{1,3}/g, '')   // `code` → remove
    .replace(/^#{1,6}\s+/gm, '')          // ## heading → heading
    .replace(/\[(.+?)\]\(.+?\)/g, '$1')   // [link](url) → link
    .replace(/!\[.*?\]\(.+?\)/g, '')      // ![image](url) → remove
    .replace(/[*_~`#\[\](){}>|\\]/g, '') // residual special chars
    .replace(/\n{2,}/g, '\n')             // multiple newlines → one
    .replace(/^\s+|\s+$/g, '')            // trim
    .replace(/\s+/g, ' ');                // collapse whitespace
}

// Alternative speakers:
// 'zh_female_vv_uranus_bigtts'       — 活泼灵动女声
// 'zh_female_xiaohe_jupiter_bigtts' — xiaohe jupiter版
// 'BV113_streaming'                  — 甜宠少御 (V1 only)

async function doubaoTTS(apiKey, appId, text, voiceType) {
  // Clean markdown formatting before TTS (so 学姐 doesn't read asterisks)
  const cleanText = cleanTextForTTS(text);

  return new Promise((resolve, reject) => {
    const reqid = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const speaker = voiceType || DEFAULT_SPEAKER;

    const body = JSON.stringify({
      user: { uid: 'anatomy_student' },
      req_params: {
        text: cleanText,
        speaker: speaker,
        audio_params: {
          format: 'mp3',
          sample_rate: 24000,
          speed_ratio: 1.0,
          volume_ratio: 1.0,
        },
        reqid: reqid,
      },
    });

    const url = new URL(DOUBAO_TTS_V3_URL);
    const options = {
      hostname: url.hostname,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Api-Key': apiKey,
        'X-Api-Resource-Id': 'seed-tts-2.0',
        'X-Api-Request-Id': reqid,
        'Content-Length': Buffer.byteLength(body),
      },
    };

    const req = https.request(options, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        const raw = Buffer.concat(chunks).toString();

        if (res.statusCode !== 200) {
          try {
            const err = JSON.parse(raw);
            reject(new Error(err.message || `TTS V3 error: ${res.statusCode}`));
          } catch {
            reject(new Error(`TTS V3 error: ${res.statusCode} — ${raw.slice(0, 200)}`));
          }
          return;
        }

        // V3 returns chunked JSON lines: each line is a JSON with "data" (base64 audio)
        const lines = raw.split('\n').filter((l) => l.trim());
        let audioBase64 = '';
        for (const line of lines) {
          try {
            const json = JSON.parse(line);
            if (json.data) audioBase64 += json.data;
          } catch {}
        }

        if (!audioBase64) {
          reject(new Error('TTS V3 returned no audio data'));
          return;
        }
        resolve(audioBase64);
      });
    });

    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// ─── Public API ───
module.exports = {
  streamChat,
  callAI,

  async generateQuiz(apiKey, unitId, count = 3) {
    return callAI(
      apiKey, unitId, 'learn',
      `请根据上面这个知识点，生成${count}道填空题。每道题一个空。

返回格式要求（严格JSON）：
{
  "questions": [
    {
      "stem": "题目题干，用___表示空白",
      "answer": "正确答案",
      "hint": "给学生的提示，不要直接说答案",
      "difficulty": "easy|medium|hard"
    }
  ]
}

题目要求：
- 覆盖知识点的核心概念
- 难度有梯度（简单→中等→困难）
- 答案要唯一明确
- 不要出偏题怪题`,
      '请严格按照JSON格式返回，不要包含其他文字。'
    );
  },

  async generateReviewReport(apiKey, unitId) {
    const context = await buildContext(unitId, 'review');
    const systemPrompt = buildSystemPrompt('review', context);

    // Get test results for this unit
    let testInfo = '';
    try {
      const errors = db.all(
        `SELECT stem, user_answer, correct_answer, error_type
         FROM error_book WHERE user_id = 1 AND unit_id = ?
         ORDER BY created_at DESC`,
        [unitId]
      );
      if (errors?.length > 0) {
        testInfo = '\n本次测试错题：\n' + errors
          .map((e, i) => `${i + 1}. 题目：${e.stem}\n   你的答案：${e.user_answer}\n   正确答案：${e.correct_answer}\n   错误类型：${e.error_type}`)
          .join('\n');
      }
    } catch {}

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `请帮我分析测试结果。${testInfo}\n\n请指出2-3个薄弱知识点，并给出复习建议。` },
    ];

    const options = {
      hostname: DEEPSEEK_BASE,
      path: DEEPSEEK_PATH,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
    };

    const body = {
      model: MODEL,
      messages,
      stream: false,
      max_tokens: 800,
      temperature: 0.7,
    };

    const result = await makeRequest(options, body);
    if (result.status !== 200) {
      throw new Error(`DeepSeek API error: ${result.status}`);
    }
    const text = result.data.choices?.[0]?.message?.content || '';

    // Parse into structured format
    return { report: text, timestamp: new Date().toISOString() };
  },

  async generateTodayRecommend(apiKey) {
    const context = await buildContext('', 'home');
    const systemPrompt = buildSystemPrompt('home', context);

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: '请根据我的学习数据，给我今天的问候和学习建议。' },
    ];

    const options = {
      hostname: DEEPSEEK_BASE,
      path: DEEPSEEK_PATH,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
    };

    const body = {
      model: MODEL,
      messages,
      stream: false,
      max_tokens: 300,
      temperature: 0.8,
    };

    const result = await makeRequest(options, body);
    if (result.status !== 200) {
      throw new Error(`DeepSeek API error: ${result.status}`);
    }
    const text = result.data.choices?.[0]?.message?.content || '';
    return { recommendation: text, timestamp: new Date().toISOString() };
  },

  // TTS
  doubaoTTS,

  // For client-side direct call (local mode)
  buildSystemPrompt,
  buildContext,
};
