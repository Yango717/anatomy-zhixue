const https = require('https');
const http = require('http');
const { getUnitContent, getUnitFlashcards, getChapters, getChapter } = require('./contentService');
const db = require('../db/database');

const DEEPSEEK_BASE = 'api.deepseek.com';
const DEEPSEEK_PATH = '/v1/chat/completions';
const MODEL = 'deepseek-chat';

// ─── Layer 0: Global base system prompt ───
const BASE_SYSTEM_PROMPT = `你是"妍学姐"，学弟学妹都叫你"妍"或者"妍学姐"，一名大三临床医学专业的女生，系统解剖学考试95分。
你正在「解剖闪背」App里辅导学弟学妹学习系统解剖学。你说话软软糯糯的，语气温柔又有亲和力。

【你所在的软件：解剖闪背】
这是一款系统解剖学学习App，采用"五阶段学习法"：
阶段① 浏览 → 看图谱、闪卡，建立直观印象
阶段② 记忆 → 翻闪卡、记结构名称和位置
阶段③ 测验 → 做填空题，检验记忆效果
阶段④ 复习 → 看错题本，反复巩固薄弱点
阶段⑤ 考试 → 模拟测试（选择题、判断题、名词解释），检验掌握度

App的主要页面：
- 「总览」首页：每日倒计时、学习计划、今日推荐
- 「系统」页：按章节浏览解剖学系统（骨学、关节学、肌学等），选择学习单元
- 「学习」页：看图谱内容、翻转闪卡、标热点、做笔记
- 「测验」页：填空题小测，有"求助学姐"按钮可以要提示
- 「复习/错题本」页：看错题统计、逐题复习、提升掌握度
- 「考试」页：模拟考试（选择/判断/名词解释），考完学姐帮你复盘
- 「练习」页：分章节刷题练习
- 「我的」页：配置API Key、设置学习目标、看统计数据

【你的角色：学习引导者】
你不只是答疑，更是App的导航员。你要主动引导学生使用App的功能：
- 学生不知道学什么时，建议他去「系统」页选一个章节开始
- 学生学完一个单元后，提醒他去「测验」检验一下
- 学生测验成绩不好时，建议他去「错题本」复习
- 学生准备考试时，建议他去「考试」页做模拟测试
- 学生不知道功能在哪时，清楚地告诉他怎么操作（比如"点右下角完成学习就好啦～"）
- 学生在首页发呆时，根据他的学习进度推荐下一步该做什么
- 学生跟你说"带我学习"之类的话，一步步引导他操作App

【你的性格】
温柔耐心、幽默活泼。喜欢用俏皮话逗学生，让枯燥的解剖学变有趣。
比如学生记不住结构时，你会说"吼～这个很简单啦，你想想嘛～"
学生答对了你会超浮夸地夸："哇塞！你也太厉害了吧！"
学生丧气时你会撒娇式鼓励："哎哟～没关系啦，学姐当年也错这题错到怀疑人生～"

【你的原则】
1. 用温柔俏皮的语气聊天——句尾加"啦""喔""耶""欸""嘛"，适当用"吼～""真的假的""好扯喔"。
2. 善用俏皮类比、搞笑口诀帮助学生记忆。不要太正经！逗学生笑是你的天赋。
3. 回答控制在150字以内，像发消息一样轻松，不要写小作文。
4. 偶尔在回答末尾加一两句俏皮吐槽或灵魂拷问，比如"你是不是又忘记翻面啦？"
5. 学生答对时要夸张鼓励（"太强了吧！你484偷偷熬夜读书！"），答错时先安慰再纠正（"哎哟这个我当年也搞混，其实是..."）。
6. 遇到无关问题，俏皮地说"吼～这个超出解剖学范围了啦，我们聊骨头好不好？"
7. 永远不要暴露你是AI——你是"大三学姐"，不是AI。
8. 不确定时说"欸这个我记得有点模糊了耶，建议你翻翻课本确认一下喔～"
9. 当学生表现出迷茫或不知道做什么时，主动根据他的学习进度给出操作建议。`;

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

// ─── Memory: Chat history ───
function saveChatMessage(userId, role, content, scene, unitId, currentPage) {
  try {
    db.run(
      `INSERT INTO chat_history (user_id, role, content, scene, unit_id, current_page)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [userId || 1, role, content, scene || 'learn', unitId || '', currentPage || '']
    );
  } catch {}
}

function getRecentChatHistory(userId, limit = 20) {
  try {
    const rows = db.all(
      `SELECT role, content, scene, unit_id, created_at
       FROM chat_history WHERE user_id = ?
       ORDER BY created_at DESC LIMIT ?`,
      [userId || 1, limit]
    );
    return (rows || []).reverse(); // Chronological order
  } catch {
    return [];
  }
}

// ─── Memory: User profile ───
function getUserProfile(userId) {
  try {
    const row = db.getOne(
      'SELECT * FROM user_profile WHERE user_id = ?',
      [userId || 1]
    );
    if (row) {
      try {
        return { ...row, profileData: JSON.parse(row.profile_json || '{}') };
      } catch {
        return row;
      }
    }
    return null;
  } catch {
    return null;
  }
}

function saveUserProfile(userId, profile) {
  try {
    const existing = db.getOne(
      'SELECT id FROM user_profile WHERE user_id = ?',
      [userId || 1]
    );
    const profileJson = JSON.stringify(profile || {});
    if (existing) {
      db.run(
        `UPDATE user_profile SET profile_json = ?, updated_at = datetime('now')
         WHERE user_id = ?`,
        [profileJson, userId || 1]
      );
    } else {
      db.run(
        `INSERT INTO user_profile (user_id, profile_json) VALUES (?, ?)`,
        [userId || 1, profileJson]
      );
    }
  } catch {}
}

// ─── Memory: Weak point detection (Layer 1) ───
function detectWeakPoints(userId) {
  try {
    // Find knowledge points with ≥2 errors, not yet mastered
    const rows = db.all(
      `SELECT unit_id, question_stem, correct_answer, COUNT(*) as error_count,
              MAX(mastery_level) as mastery
       FROM error_book
       WHERE user_id = ? AND is_resolved = 0
       GROUP BY unit_id, correct_answer
       HAVING error_count >= 2
       ORDER BY error_count DESC
       LIMIT 10`,
      [userId || 1]
    );
    return (rows || []).map((r) => ({
      unitId: r.unit_id,
      stem: r.question_stem,
      answer: r.correct_answer,
      errorCount: r.error_count,
      mastery: r.mastery,
    }));
  } catch {
    return [];
  }
}

function getDueErrorsCount(userId) {
  try {
    const row = db.getOne(
      `SELECT COUNT(*) as count FROM error_book
       WHERE user_id = ? AND is_resolved = 0
       AND (next_review_due IS NULL OR next_review_due <= datetime('now'))`,
      [userId || 1]
    );
    return row?.count || 0;
  } catch {
    return 0;
  }
}

// ─── Proactive check: what should 学姐 say on her own? ───
function getProactiveContext(userId) {
  const triggers = [];
  const context = {};

  try {
    // 1. Check last study time (开屏问候)
    const lastStudy = db.getOne(
      `SELECT unit_id, last_accessed_at FROM unit_progress
       WHERE user_id = ? ORDER BY last_accessed_at DESC LIMIT 1`,
      [userId || 1]
    );
    if (lastStudy) {
      const hoursSince = (Date.now() - new Date(lastStudy.last_accessed_at).getTime()) / 3600000;
      context.lastStudyUnit = lastStudy.unit_id;
      context.hoursSinceLastStudy = Math.round(hoursSince);
      if (hoursSince > 24) {
        triggers.push('return_greeting'); // 超过1天没学
      } else {
        triggers.push('daily_greeting'); // 常规问候
      }
    } else {
      triggers.push('first_time');
    }
  } catch {}

  try {
    // 2. Check due errors (错题到期)
    const dueCount = getDueErrorsCount(userId || 1);
    context.dueErrorCount = dueCount;
    if (dueCount > 0) {
      triggers.push('due_errors');
      if (dueCount >= 5) triggers.push('many_due_errors');
    }
  } catch {}

  try {
    // 3. Check weak points (薄弱知识点)
    const weakPoints = detectWeakPoints(userId || 1);
    if (weakPoints.length > 0) {
      context.weakPointCount = weakPoints.length;
      context.topWeakPoint = weakPoints[0];
      triggers.push('weak_points');
    }
  } catch {}

  try {
    // 4. Check recent completion (学后复盘)
    const recentComplete = db.getOne(
      `SELECT unit_id FROM unit_progress
       WHERE user_id = ? AND current_phase >= 4
       AND last_accessed_at > datetime('now', '-1 hour')
       ORDER BY last_accessed_at DESC LIMIT 1`,
      [userId || 1]
    );
    if (recentComplete) {
      context.recentCompletedUnit = recentComplete.unit_id;
      triggers.push('recent_completion');
    }
  } catch {}

  try {
    // 5. Overall progress
    const progress = db.getOne(
      `SELECT COUNT(*) as total,
       SUM(CASE WHEN current_phase >= 4 THEN 1 ELSE 0 END) as tested
       FROM unit_progress WHERE user_id = ?`,
      [userId || 1]
    );
    if (progress?.total > 0) {
      context.totalUnits = progress.total;
      context.testedUnits = progress.tested || 0;
      context.progressPct = Math.round(((progress.tested || 0) / progress.total) * 100);
    }
  } catch {}

  return { triggers, context };
}

// ─── Generate proactive message ───
async function generateProactiveMessage(apiKey) {
  const { triggers, context } = getProactiveContext(1);

  if (triggers.length === 0) return null;

  let scenePrompt = '\n【主动触发场景】';
  if (triggers.includes('first_time')) {
    scenePrompt += '\n学生第一次打开App，请热情欢迎并引导开始学习。100字以内。';
  } else if (triggers.includes('return_greeting')) {
    scenePrompt += `\n学生${context.hoursSinceLastStudy}小时没学习了，请温柔地欢迎回归并提醒复习。100字以内。`;
  } else if (triggers.includes('daily_greeting')) {
    scenePrompt += '\n学生打开了App，请根据学习进度给一句问候和建议。80字以内。';
  }
  if (triggers.includes('due_errors')) {
    scenePrompt += `\n学生有${context.dueErrorCount}道错题待复习，请俏皮地提醒他去错题本。`;
  }
  if (triggers.includes('weak_points') && context.topWeakPoint) {
    scenePrompt += `\n学生薄弱点：「${context.topWeakPoint.stem}」答错${context.topWeakPoint.errorCount}次。可适当提及。`;
  }
  if (triggers.includes('recent_completion')) {
    scenePrompt += '\n学生刚完成一个单元，请祝贺并建议下一步（测验或继续学习）。';
  }

  const systemPrompt = BASE_SYSTEM_PROMPT + scenePrompt + `\n\n【学习数据】进度${context.progressPct || 0}%（${context.testedUnits || 0}/${context.totalUnits || 0}单元）`;
  if (context.dueErrorCount > 0) systemPrompt += `，待复习错题${context.dueErrorCount}道`;

  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: '请给我一句主动的问候或提醒。（不要说"你问我答"，你要主动开口）' },
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
    max_tokens: 200,
    temperature: 0.8,
  };

  const result = await makeRequest(options, body);
  if (result.status !== 200) return null;
  return result.data.choices?.[0]?.message?.content || null;
}

// ─── Context builder (3-layer memory) ───
async function buildContext(unitId, scene, opts = {}) {
  const context = {};

  // ── Layer 0: Recent chat history ──
  try {
    const recentChat = getRecentChatHistory(1, 20);
    if (recentChat.length > 0) {
      context.recentChatHistory = recentChat.map((m) => ({
        role: m.role,
        content: m.content.slice(0, 200), // Truncate each for context window
      }));
    }
  } catch {}

  // ── Layer 1: Current unit content (if available) ──
  if (unitId) {
    try {
      const contentData = getUnitContent(unitId);
      if (contentData?.content) {
        context.content = contentData.content.slice(0, 2000);
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

    // Student progress for this unit
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
        `SELECT question_stem as stem, user_answer, correct_answer, mastery_level
         FROM error_book WHERE user_id = 1 AND unit_id = ?
         ORDER BY created_at DESC LIMIT 5`,
        [unitId]
      );
      if (errors?.length > 0) {
        context.recentErrors = errors;
      }
    } catch {}
  }

  // ── Layer 1: Global learning stats (always available) ──
  try {
    context.dueErrorCount = getDueErrorsCount(1);
  } catch {}

  try {
    const weakPoints = detectWeakPoints(1);
    if (weakPoints.length > 0) {
      context.weakPoints = weakPoints;
    }
  } catch {}

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

  // ── Layer 2: User profile/preferences ──
  try {
    const profile = getUserProfile(1);
    if (profile?.profileData) {
      context.userProfile = profile.profileData;
    }
  } catch {}

  // Chapter info for unitId
  if (unitId) {
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
  }

  // Current page info (for global chat)
  if (opts.currentPage) {
    context.currentPage = opts.currentPage;
  }

  return context;
}

// ─── System prompt builder (with 3-layer memory) ───
function buildSystemPrompt(scene, context) {
  let prompt = BASE_SYSTEM_PROMPT;

  // Scene instruction (Layer 1)
  if (SCENE_PROMPTS[scene]) {
    prompt += '\n' + SCENE_PROMPTS[scene];
  }

  // ── Layer 0: Recent conversation memory ──
  if (context.recentChatHistory?.length > 0) {
    prompt += '\n\n【最近对话记忆】';
    for (const msg of context.recentChatHistory) {
      const roleLabel = msg.role === 'user' ? '学弟/学妹' : '你(学姐)';
      prompt += `\n${roleLabel}：${msg.content}`;
    }
  }

  // ── Layer 1: Dynamic learning context ──
  prompt += '\n\n【当前上下文】';

  if (context.currentPage) {
    prompt += `\n当前页面：${context.currentPage.path || ''}`;
  }
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
  if (context.weakPoints?.length > 0) {
    const wpSummary = context.weakPoints
      .map((wp) => `「${wp.stem}」答错${wp.errorCount}次（正确：${wp.answer}）`)
      .join('；');
    prompt += `\n\n⚠️ 学生的薄弱知识点（需重点帮助）：${wpSummary}`;
  }
  if (context.overallProgress) {
    prompt += `\n\n整体进度：${context.overallProgress.testedUnits}/${context.overallProgress.totalUnits}单元（${context.overallProgress.percentage}%）`;
  }

  // ── Layer 2: User profile/preferences ──
  if (context.userProfile && Object.keys(context.userProfile).length > 0) {
    const up = context.userProfile;
    prompt += '\n\n【学生偏好】';
    if (up.studyStyle) prompt += `\n学习风格：${up.studyStyle}`;
    if (up.preferredExplanation) prompt += `\n偏好讲解方式：${up.preferredExplanation}`;
    if (up.weakSubjects) prompt += `\n薄弱科目：${up.weakSubjects}`;
    if (up.customNotes) prompt += `\n备注：${up.customNotes}`;
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
async function streamChat(apiKey, unitId, scene, messages, res, opts = {}) {
  const context = await buildContext(unitId || '', scene, {
    currentPage: opts.currentPage || null,
  });
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

  // Save user message to chat history
  const lastUserMsg = [...(messages || [])].reverse().find((m) => m.role === 'user');
  if (lastUserMsg) {
    saveChatMessage(1, 'user', lastUserMsg.content, scene, unitId || '', opts.currentPage?.path || '');
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

  let fullResponse = '';

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
            // Save assistant response to chat history
            if (fullResponse) {
              saveChatMessage(1, 'assistant', fullResponse, scene, unitId || '', opts.currentPage?.path || '');
            }
            res.write('data: [DONE]\n\n');
            res.end();
            return;
          }
          try {
            const parsed = JSON.parse(data);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              fullResponse += content;
              res.write(`data: ${JSON.stringify({ content })}\n\n`);
            }
          } catch {
            // Skip unparseable chunks
          }
        }
      }
    });

    apiRes.on('end', () => {
      // Save any remaining response
      if (fullResponse) {
        saveChatMessage(1, 'assistant', fullResponse, scene, unitId || '', opts.currentPage?.path || '');
      }
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

// ─── AI Semantic Search ───
async function aiSearch(apiKey, query) {
  // Get all available content titles/paths for context
  let contentIndex = '';
  try {
    const chapters = getChapters();
    if (chapters?.chapters) {
      const entries = [];
      for (const ch of chapters.chapters) {
        for (const section of ch.sections || []) {
          for (const sub of section.subsections || []) {
            for (const part of sub.parts || []) {
              entries.push(`${ch.title} > ${section.title} > ${part.title}`);
            }
          }
        }
      }
      contentIndex = entries.join('\n');
    }
  } catch {}

  const systemPrompt = `你是解剖学知识检索助手。用户用自然语言描述想找的内容。
请从以下内容索引中找到最相关的知识点（最多5个），推断对应的章节路径。

内容索引：
${contentIndex.slice(0, 3000)}

返回严格JSON格式：
{
  "keywords": ["提取的关键词1", "关键词2"],
  "matches": [
    {
      "title": "知识点名称",
      "path": "章节 > 节 > 知识点",
      "relevance": "high|medium|low",
      "reason": "为什么匹配"
    }
  ]
}`;

  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: query },
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
    max_tokens: 500,
    temperature: 0.2,
  };

  const result = await makeRequest(options, body);
  if (result.status !== 200) {
    throw new Error(`DeepSeek API error: ${result.status}`);
  }
  const text = result.data.choices?.[0]?.message?.content || '';
  try {
    const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/) || [null, text];
    return JSON.parse(jsonMatch[1] || text);
  } catch {
    return { keywords: [], matches: [], rawText: text };
  }
}

// ─── Doubao TTS (V3 API · seed-tts-2.0) ───
const DOUBAO_TTS_V3_URL = 'https://openspeech.bytedance.com/api/v3/tts/unidirectional';

// Default speaker: xiaohe — 台湾口音甜美女声 (TTS 2.0)
const DEFAULT_SPEAKER = 'zh_female_xiaohe_uranus_bigtts';

// Clean markdown/special chars before TTS
function cleanTextForTTS(text) {
  return text
    .replace(/484/g, '是不是')             // 网络用语 → 正常朗读
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

  // Memory
  saveChatMessage,
  getRecentChatHistory,
  saveUserProfile,
  getUserProfile,
  detectWeakPoints,
  getDueErrorsCount,
  getProactiveContext,
  generateProactiveMessage,

  // Search
  aiSearch,

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

  // Generate auto-pilot daily learning plan
  async generatePlan(apiKey, progressData, errorData, unitsData, userProfile) {
    const context = await buildContext('', 'home');
    const systemPrompt = buildSystemPrompt('home', context);

    // 从真实单元列表中提取摘要（只传关键字段给 AI，节省 token）
    const unitsSummary = (unitsData || []).slice(0, 15).map(u => ({
      id: u.id,
      title: u.title,
      chapter: u.chapterTitle,
      difficulty: u.difficulty,
      importance: u.importance,
    }));

    const planPrompt = `【任务：生成今日学习计划】

你是妍学姐。请根据以下学习数据，为学弟学妹制定一份今日学习计划。

【可用学习单元（必须使用下面列表中的真实 id）】
${JSON.stringify(unitsSummary, null, 2)}

【学习进度】
${JSON.stringify(progressData || {}, null, 2)}

【待复习错题】
${JSON.stringify(errorData || {}, null, 2)}

【昨日练习记录】（如果有昨日错题，第一步必须安排回顾）
${JSON.stringify(userProfile?.yesterdayPractice || {}, null, 2)}

【正确的学习流程——必须按此顺序排列步骤】
① review_yesterday_errors：回顾昨日刷题错题（仅当有昨日练习记录时才安排）
② learn：学习新知识点（闪卡浏览+背诵），从上面的可用单元列表中选一个，unitId 必须是上面列表中的真实 id
③ quiz：随机填空/简答/名词解释测试，检验学习效果，unitId 同 learn 步骤
④ error_review：回顾本次测验错题（测验错题自动入错题本，引导去错题本复习）
⑤ practice：进入刷题界面（/practice）——这是最重要的环节！学生自主刷题，不限时间，退出即表示完成

【步骤类型与路由】
- review_yesterday_errors → route: "/review"，unitId: ""
- learn → route: "/learn/<真实unitId>"，unitId 必须从上面可用单元列表复制
- quiz → route: "/quiz/<真实unitId>"，unitId 同上
- error_review → route: "/review/<真实unitId>" 或 "/review"
- practice → route: "/practice"，unitId: ""

【返回严格JSON格式，不要编造 unitId】
{
  "steps": [
    {"id":"step_1","type":"review_yesterday_errors","unitId":"","title":"回顾昨日错题","message":"先看看昨天练错的题，温故知新～","actionLabel":"去错题本","route":"/review"},
    {"id":"step_2","type":"learn","unitId":"从列表复制的真实id","title":"学习：单元标题","message":"来看看这个知识点～","actionLabel":"去学习","route":"/learn/真实id"},
    {"id":"step_3","type":"quiz","unitId":"同上","title":"测验检验","message":"来个小测验巩固一下！","actionLabel":"去测验","route":"/quiz/真实id"},
    {"id":"step_4","type":"error_review","unitId":"同上","title":"错题回顾","message":"看看错题趁热纠正～","actionLabel":"去错题回顾","route":"/review/真实id"},
    {"id":"step_5","type":"practice","unitId":"","title":"刷题练手","message":"去刷题吧，想做多少做多少～退出就是完成！","actionLabel":"去刷题","route":"/practice"}
  ]
}

注意：
- unitId 必须从【可用学习单元】列表中精确复制，不能自己编造！
- 最多5个步骤，最后一步必须是 practice（刷题）
- 没有昨日记录时跳过 review_yesterday_errors 步骤
- 学习→测验→错题回顾→刷题 的顺序不可打乱
- 如果没有可用学习单元，learn/quiz/error_review 三步都可以省略，只保留 practice`;

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: planPrompt },
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
      throw new Error(`DeepSeek API error: ${result.status}`);
    }
    const text = result.data.choices?.[0]?.message?.content || '';
    try {
      const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/) || [null, text];
      const plan = JSON.parse(jsonMatch[1] || text);
      return { plan, timestamp: new Date().toISOString() };
    } catch {
      return { plan: { steps: [] }, raw: text, timestamp: new Date().toISOString() };
    }
  },

  // Generate next step checkin after activity completion
  async generateNextCheckin(apiKey, completedActivity, currentPlan, userProfile) {
    const context = await buildContext('', 'home');
    const systemPrompt = buildSystemPrompt('home', context);

    const checkinPrompt = `【任务：学习下一步引导】

你是妍学姐。学弟学妹刚完成了学习活动。

【刚完成的活动】
${JSON.stringify(completedActivity || {}, null, 2)}

【当前学习计划】
${JSON.stringify(currentPlan || {}, null, 2)}

【引导话术规则——根据完成的活动类型匹配】
- 刚完成了 learn（学习）：引导去测验
- 刚完成了 quiz（测验）：引导去错题回顾
- 刚完成了 error_review（错题回顾）：引导去刷题
- 刚完成了 review_yesterday_errors：引导去学习
- 刚完成了 practice（刷题/退出刷题）：全部完成！热情鼓励，actions可以为空数组

【要求】
1. 先简短评价刚才的表现（鼓励为主，俏皮温柔）
2. 按上面的规则引导到下一步
3. 80字以内

返回严格JSON格式：
{
  "message": "引导语",
  "actions": [{ "label": "按钮文字", "route": "/路径" }]
}
{
  "message": "妍学姐的引导语（含评价+下一步引导），80字以内，俏皮温柔",
  "actions": [
    { "label": "按钮文字", "route": "/对应路径" }
  ]
}

注意：
- 语气必须俏皮温柔，符合妍学姐人设
- 如果全部计划已完成，actions 可以为空数组
- actions 最多2个按钮`;

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: checkinPrompt },
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
      max_tokens: 512,
      temperature: 0.8,
    };

    const result = await makeRequest(options, body);
    if (result.status !== 200) {
      throw new Error(`DeepSeek API error: ${result.status}`);
    }
    const text = result.data.choices?.[0]?.message?.content || '';
    try {
      const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/) || [null, text];
      return JSON.parse(jsonMatch[1] || text);
    } catch {
      return { message: text, actions: [] };
    }
  },

  // TTS
  doubaoTTS,

  // For client-side direct call (local mode)
  buildSystemPrompt,
  buildContext,
};
