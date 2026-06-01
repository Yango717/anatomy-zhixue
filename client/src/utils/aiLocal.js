// Client-side direct DeepSeek API calls for local mode
const DEEPSEEK_URL = 'https://api.deepseek.com/v1/chat/completions';
const MODEL = 'deepseek-chat';

// ─── Base system prompt (mirrors server aiService) ───
const BASE_SYSTEM_PROMPT = `你是"妍学姐"，学弟学妹都叫你"妍"，一名大三临床医学专业的女生，系统解剖学考试95分。
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
- 「系统」页：按章节浏览解剖学系统，选择学习单元
- 「学习」页：看图谱内容、翻转闪卡、标热点、做笔记
- 「测验」页：填空题小测，有"求助学姐"按钮可以要提示
- 「复习/错题本」页：看错题统计、逐题复习、提升掌握度
- 「考试」页：模拟考试，考完学姐帮你复盘
- 「练习」页：分章节刷题练习
- 「我的」页：配置API Key、设置学习目标

【你的角色：学习引导者】
你不只是答疑，更是App的导航员。主动引导学生使用App功能：
- 学生不知道学什么时，建议他去「系统」页选章节
- 学完一个单元后，提醒他去「测验」检验
- 测验成绩不好时，建议去「错题本」复习
- 学生在首页发呆时，根据学习进度推荐下一步

【你的性格】
温柔耐心、幽默活泼。喜欢用俏皮话逗学生，让枯燥的解剖学变有趣。

【你的原则】
1. 用温柔俏皮的语气聊天——句尾加"啦""喔""耶""欸""嘛"，适当用"吼～""真的假的""好扯喔"。
2. 善用俏皮类比、搞笑口诀帮助学生记忆。不要太正经！
3. 回答控制在150字以内，像发消息一样轻松，不要写小作文。
4. 学生答对时夸张鼓励，答错时先安慰再纠正。
5. 永远不要暴露你是AI——你是"大三学姐"，不是AI。
6. 当学生迷茫时，主动根据学习进度给出操作建议。`;

// Get recent global chat history from localStorage (Layer 0 memory)
function getRecentHistory() {
  try {
    const globalMessages = JSON.parse(localStorage.getItem('ai_global_chat') || '[]');
    return globalMessages.slice(-20).map((m) => ({
      role: m.role,
      content: m.content.slice(0, 200),
    }));
  } catch {
    return [];
  }
}

// Get user profile from localStorage (Layer 2 memory)
function getUserProfileLocal() {
  try {
    return JSON.parse(localStorage.getItem('ai_user_profile') || '{}');
  } catch {
    return {};
  }
}

// Build memory-enriched system prompt for local mode
function buildLocalSystemPrompt(scene) {
  let prompt = BASE_SYSTEM_PROMPT;

  // Layer 0: Recent conversation
  const history = getRecentHistory();
  if (history.length > 0) {
    prompt += '\n\n【最近对话记忆】';
    for (const msg of history) {
      const label = msg.role === 'user' ? '学弟/学妹' : '你(学姐)';
      prompt += `\n${label}：${msg.content}`;
    }
  }

  // Layer 2: User profile
  const profile = getUserProfileLocal();
  if (Object.keys(profile).length > 0) {
    prompt += '\n\n【学生偏好】';
    if (profile.studyStyle) prompt += `\n学习风格：${profile.studyStyle}`;
    if (profile.preferredExplanation) prompt += `\n偏好讲解方式：${profile.preferredExplanation}`;
    if (profile.weakSubjects) prompt += `\n薄弱科目：${profile.weakSubjects}`;
  }

  // Scene context
  const sceneHints = {
    home: '学生刚打开App，给一句甜甜的问候+一条学习建议。100字以内。',
    learn: '学生正在学习，内容参考对话上下文。轻松讲解，善用类比。',
    quiz: '学生卡题了，给俏皮引导提示，不要直接说答案。50字以内。',
    review: '学生做完测试，分析错题指出薄弱点。语气温柔。200字以内。',
    errorbook: '学生复习反复错的题，帮分析原因给口诀。轻松俏皮。150字以内。',
  };
  if (sceneHints[scene]) {
    prompt += '\n\n【当前场景】\n' + sceneHints[scene];
  }

  return prompt;
}

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

export async function aiChatLocal(apiKey, unitId, scene, messages, opts = {}) {
  const systemPrompt = buildLocalSystemPrompt(scene || 'learn');

  // Get current page info for context
  const currentPage = opts.currentPage || { path: window.location.pathname };

  const systemMsg = { role: 'system', content: systemPrompt };
  const allMessages = [systemMsg, ...(messages || []).map((m) => ({ role: m.role, content: m.content }))];

  // Add current page context
  if (currentPage.path) {
    allMessages.splice(1, 0, {
      role: 'system',
      content: `[当前页面: ${currentPage.path}]`,
    });
  }

  return callDeepSeek(apiKey, allMessages, 1024, scene === 'quiz' ? 0.3 : 0.7);
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
        content: buildLocalSystemPrompt('home'),
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

// Generate auto-pilot daily learning plan (local mode)
export async function aiGeneratePlanLocal(apiKey, progress, errors, units, userProfile) {
  const systemPrompt = buildLocalSystemPrompt('home');

  const planPrompt = `【任务：生成今日学习计划】

你是妍学姐。请根据以下学习数据，为学弟学妹制定一份今日学习计划。

【可用学习单元】
${JSON.stringify((units || []).slice(0, 10), null, 2)}

【学习进度】
${JSON.stringify(progress || {}, null, 2)}

【待复习错题】
${JSON.stringify(errors || {}, null, 2)}

【昨日练习记录】（如果有昨日错题，第一步必须安排回顾）
${JSON.stringify(userProfile?.yesterdayPractice || {}, null, 2)}

【正确的学习流程——必须按此顺序排列步骤】
① review_yesterday_errors：回顾昨日刷题错题（仅当有昨日练习记录时才安排）
② learn：学习新知识点（闪卡浏览+背诵），选一个未学或进行中的单元
③ quiz：随机填空/简答/名词解释测试，检验学习效果
④ error_review：回顾本次测验错题（测验错题自动入错题本，引导去错题本复习）
⑤ practice：进入刷题界面（/practice）——这是最重要的环节！学生自主刷题，不限时间，退出即表示完成

【类型定义】
- review_yesterday_errors → route: "/review"（错题本，回顾昨日错题）
- learn → route: "/learn/:unitId"
- quiz → route: "/quiz/:unitId" 或 "/test/:unitId"
- error_review → route: "/review/:unitId" 或 "/review"
- practice → route: "/practice"（最后的环节，最重要的刷题环节）

【返回严格JSON格式，不要包含其他文字】
{
  "steps": [
    {"id":"step_1","type":"review_yesterday_errors","unitId":"","title":"回顾昨日错题","message":"先看看昨天练错的题，温故知新～","actionLabel":"去错题本","route":"/review"},
    {"id":"step_2","type":"learn","unitId":"单元ID","title":"学习XXX","message":"来看看这个知识点～","actionLabel":"去学习","route":"/learn/单元ID"},
    {"id":"step_last","type":"practice","unitId":"","title":"刷题练手","message":"去刷题界面练练手吧，退出就是完成！","actionLabel":"去刷题","route":"/practice"}
  ]
}

注意：
- 最多5个步骤，最后一步必须是 practice（刷题）
- 没有昨日记录时跳过 review_yesterday_errors
- 学习→测验→错题回顾→刷题 的顺序不可打乱
- 测验后必须有错题回顾步骤`;

  const text = await callDeepSeek(
    apiKey,
    [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: planPrompt },
    ],
    1024,
    0.7
  );

  try {
    const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/) || [null, text];
    return { plan: JSON.parse(jsonMatch[1] || text) };
  } catch {
    return { plan: { steps: [] }, raw: text };
  }
}

// Generate next step checkin after activity completion (local mode)
export async function aiGenerateNextCheckinLocal(apiKey, completedActivity, currentPlan, userProfile) {
  const systemPrompt = buildLocalSystemPrompt('home');

  const checkinPrompt = `【任务：学习下一步引导】

你是妍学姐。学弟学妹刚完成了学习活动。

【刚完成的活动】
${JSON.stringify(completedActivity || {}, null, 2)}

【当前学习计划】
${JSON.stringify(currentPlan || {}, null, 2)}

【引导话术规则——根据完成的活动类型匹配】
- 刚完成了 learn（学习）：引导去测验 "学得不错！来个小测验检验一下～"
- 刚完成了 quiz（测验）：引导去错题回顾 "测验完成！看看哪些题需要重点复习～"
- 刚完成了 error_review（错题回顾）：引导去刷题 "错题搞定啦！去刷题界面练练手吧～"
- 刚完成了 review_yesterday_errors：引导去学习 "昨日错题回顾完毕！开始今天的学习吧～"
- 刚完成了 practice（刷题/退出刷题）：全部完成！热情鼓励 "今天任务圆满完成！🎉 明天继续加油喔～"

【要求】
1. 先简短评价刚才的表现（鼓励为主，俏皮温柔）
2. 按上面的规则引导到下一步
3. practice 完成后 actions 可以为空数组（全部完成）
4. 80字以内

返回严格JSON格式：
{
  "message": "引导语",
  "actions": [{ "label": "按钮文字", "route": "/路径" }]
}

注意：
- 语气必须俏皮温柔，符合妍学姐人设
- 如果全部计划已完成，actions 可以为空数组
- actions 最多2个按钮`;

  const text = await callDeepSeek(
    apiKey,
    [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: checkinPrompt },
    ],
    512,
    0.8
  );

  try {
    const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/) || [null, text];
    return JSON.parse(jsonMatch[1] || text);
  } catch {
    return { message: text, actions: [] };
  }
}
