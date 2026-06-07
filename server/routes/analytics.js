const express = require('express');
const router = express.Router();
const { getDB, all, get: getOne, run: runQuery } = require('../db/database');
const contentService = require('../services/contentService');

function safeAll(sql, params) {
  try { return all(sql, params); } catch { return []; }
}
function safeGetOne(sql, params) {
  try { return getOne(sql, params); } catch { return null; }
}

const CHAPTER_NAMES = {
  'chapter-01': '运动系统', 'chapter-02': '消化系统', 'chapter-03': '呼吸系统',
  'chapter-04': '泌尿系统', 'chapter-05': '生殖系统', 'chapter-06': '循环系统',
  'chapter-07': '感觉器', 'chapter-08': '神经系统', 'chapter-09': '内分泌系统',
  'chapter-00': '绪论',
};

// GET /api/v1/analytics/learning-center
router.get('/learning-center', async (_req, res) => {
  try {
    await getDB();
    const data = contentService.getChapters();

    // 1. 连续学习天数
    const accessDates = safeAll(
      `SELECT DISTINCT date(last_accessed_at) as d FROM unit_progress WHERE user_id=1 AND last_accessed_at IS NOT NULL ORDER BY d DESC`
    ).map(r => r.d).filter(Boolean);
    let streak = 0;
    if (accessDates.length > 0) {
      const today = new Date().toISOString().slice(0, 10);
      const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
      if (accessDates[0] === today || accessDates[0] === yesterday) {
        streak = 1;
        for (let i = 1; i < accessDates.length; i++) {
          const prev = new Date(accessDates[i - 1]);
          const curr = new Date(accessDates[i]);
          const diff = (prev - curr) / 86400000;
          if (diff <= 1.5) streak++;
          else break;
        }
      }
    }

    // 2. 本周学习时长
    const recentQuiz = safeGetOne(`SELECT COUNT(*) as c FROM quiz_attempts WHERE user_id=1 AND created_at >= datetime('now', '-7 days')`)?.c || 0;
    const recentTest = safeGetOne(`SELECT COUNT(*) as c FROM test_attempts WHERE user_id=1 AND created_at >= datetime('now', '-7 days')`)?.c || 0;
    const recentFinal = safeGetOne(`SELECT COUNT(*) as c FROM final_exam_attempts WHERE user_id=1 AND created_at >= datetime('now', '-7 days')`)?.c || 0;
    let weeklyMinutes = (recentQuiz + recentTest + recentFinal) * 2;
    const weeklyHours = (weeklyMinutes / 60).toFixed(1);

    // 3. 完成测试题数
    const totalQuiz = safeGetOne(`SELECT COUNT(*) as c FROM quiz_attempts WHERE user_id=1`)?.c || 0;
    const totalTest = safeGetOne(`SELECT COUNT(*) as c FROM test_attempts WHERE user_id=1`)?.c || 0;
    const totalFinal = safeGetOne(`SELECT COUNT(*) as c FROM final_exam_attempts WHERE user_id=1`)?.c || 0;
    let testsDone = totalQuiz + totalTest + totalFinal;

    // 4. 掌握度
    const allRows = safeAll(`SELECT unit_id, current_phase FROM unit_progress WHERE user_id=1`);
    let totalUnits = 0; let masteredUnits = 0;
    for (const ch of data.chapters) {
      for (const sec of ch.sections) for (const sub of sec.subsections) for (const _p of sub.parts) totalUnits++;
    }
    for (const r of allRows) { if (r.current_phase >= 4) masteredUnits++; }
    let mastery = totalUnits ? Math.round(masteredUnits / totalUnits * 100) : 0;

    // 5. 各 section 掌握率
    const sectionProgress = [];
    for (const ch of data.chapters) {
      const chErrors = new Set(
        safeAll(`SELECT DISTINCT unit_id FROM error_book WHERE user_id=1 AND is_resolved=0 AND unit_id LIKE ?`, [`${ch.chapterId}%`]).map(r => r.unit_id)
      );
      for (const sec of ch.sections) {
        let secTotal = 0; let secDone = 0;
        for (const sub of sec.subsections) for (const part of sub.parts) {
          secTotal++;
          const uid = `${sub.id}-part-${part.id}`;
          const p = allRows.find(r => r.unit_id === uid);
          if (p && p.current_phase >= 4 && !chErrors.has(uid)) secDone++;
        }
        if (secTotal > 0) {
          sectionProgress.push({
            chapterId: ch.chapterId, sectionId: sec.id, name: sec.title,
            pct: Math.round(secDone / secTotal * 100), totalUnits: secTotal, completedUnits: secDone,
          });
        }
      }
    }

    // 6. AI 建议
    const weakSections = [...sectionProgress].sort((a, b) => a.pct - b.pct).slice(0, 2);
    const suggestions = [];
    for (const ws of weakSections) {
      if (ws.pct < 70) {
        suggestions.push({
          sectionId: ws.sectionId, sectionName: ws.name,
          message: `你在${ws.name}的掌握率仅 ${ws.pct}%，建议优先复习。`,
          actions: [
            { label: `${ws.name}图谱复习`, type: 'atlas', chapterId: ws.chapterId, sectionId: ws.sectionId },
            { label: `${ws.name}专项训练`, type: 'practice', chapterId: ws.chapterId },
            { label: `完成10道测试题`, type: 'test', chapterId: ws.chapterId },
          ],
        });
      }
    }

    res.json({
      success: true,
      data: { streak, weeklyHours, testsDone, mastery, sectionProgress, suggestions, totalUnits, completedUnits: masteredUnits },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// GET /api/v1/analytics/learning-portrait
router.get('/learning-portrait', async (_req, res) => {
  try {
    await getDB();
    const data = contentService.getChapters();

    // 1. 优势 / 待强化
    const chapterProg = [];
    for (const ch of data.chapters) {
      let total = 0; let done = 0;
      for (const sec of ch.sections) for (const sub of sec.subsections) for (const _p of sub.parts) total++;
      const rows = safeAll(`SELECT unit_id, current_phase FROM unit_progress WHERE user_id=1 AND unit_id LIKE ?`, [`${ch.chapterId}%`]);
      const errs = new Set(safeAll(`SELECT DISTINCT unit_id FROM error_book WHERE user_id=1 AND is_resolved=0 AND unit_id LIKE ?`, [`${ch.chapterId}%`]).map(r => r.unit_id));
      for (const r of rows) { if (r.current_phase >= 4 && !errs.has(r.unit_id)) done++; }
      const pct = total ? Math.round(done / total * 100) : 0;
      chapterProg.push({ chapterId: ch.chapterId, name: CHAPTER_NAMES[ch.chapterId] || ch.title, pct, total, done });
    }

    let strengths = chapterProg.filter(c => c.pct >= 70).sort((a, b) => b.pct - a.pct);
    let weaknesses = chapterProg.filter(c => c.pct < 70).sort((a, b) => a.pct - b.pct);

    // 2. 学习特点
    const errByType = {};
    try {
      const errRows = safeAll(`SELECT question_type, COUNT(*) as c FROM error_book WHERE user_id=1 AND is_resolved=0 GROUP BY question_type`, []);
      for (const r of errRows) errByType[r.question_type] = r.c;
    } catch {}
    const totalErrors = Object.values(errByType).reduce((a, b) => a + b, 0) || 1;
    const fillBlankPct = Math.round((errByType.fill_blank || 0) / totalErrors * 100);
    const choicePct = Math.round((errByType.multiple_choice || 0) / totalErrors * 100);
    const termPct = Math.round((errByType.term_explanation || 0) / totalErrors * 100);

    const traits = [
      { label: '结构定位能力', score: Math.max(30, 92 - choicePct), color: '#4a9c7c' },
      { label: '记忆准确度', score: Math.max(30, 78 - fillBlankPct), color: '#7c5cbf' },
      { label: '图谱识别能力', score: Math.max(30, 68 - choicePct), color: '#7c5cbf' },
      { label: '答题速度', score: Math.max(30, 60), color: '#c08a4a' },
      { label: '临床关联能力', score: Math.max(30, 45 + (100 - termPct) * 0.2), color: '#c0554a' },
    ];

    // 3. 近30天正确率
    const dailyAccuracy = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400000);
      const dateStr = d.toISOString().slice(0, 10);
      const dayQuiz = safeGetOne(`SELECT COUNT(*) as c FROM quiz_attempts WHERE user_id=1 AND date(created_at)=?`, [dateStr])?.c || 0;
      const dayQuizCorrect = safeGetOne(`SELECT COUNT(*) as c FROM quiz_attempts WHERE user_id=1 AND date(created_at)=? AND is_correct=1`, [dateStr])?.c || 0;
      const dayTest = safeGetOne(`SELECT COUNT(*) as c FROM test_attempts WHERE user_id=1 AND date(created_at)=?`, [dateStr])?.c || 0;
      const dayTestCorrect = safeGetOne(`SELECT COUNT(*) as c FROM test_attempts WHERE user_id=1 AND date(created_at)=? AND is_correct=1`, [dateStr])?.c || 0;
      const total = dayQuiz + dayTest;
      const correct = dayQuizCorrect + dayTestCorrect;
      dailyAccuracy.push(total > 0 ? Math.round(correct / total * 100) : null);
    }

    // 4. 错误分布
    const errorDist = [
      { type: 'fill_blank', label: '填空题', count: errByType.fill_blank || 0 },
      { type: 'multiple_choice', label: '选择题', count: errByType.multiple_choice || 0 },
      { type: 'term_explanation', label: '名词解释', count: errByType.term_explanation || 0 },
      { type: 'true_false', label: '判断题', count: errByType.true_false || 0 },
    ];

    res.json({ success: true, data: { strengths, weaknesses, traits, dailyAccuracy, errorDist } });
  } catch (err) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// GET /api/v1/analytics/learning-path/:planType
router.get('/learning-path/:planType', async (req, res) => {
  const { planType } = req.params;
  if (planType === 'sprint') {
    res.json({ success: true, data: {
      type: 'sprint',
      title: '考前 7 天冲刺计划',
      subtitle: '适合有一定基础、需要短期提分的同学',
      days: [
        { day: 1, title: '运动系统·骨学', tasks: ['骨学核心结构图谱', '骨学基础选择题30道', '错题收录'], duration: '2h' },
        { day: 2, title: '运动系统·关节+肌学', tasks: ['关节学图谱', '肌学起止点闪卡', '专项训练20道'], duration: '2h' },
        { day: 3, title: '内脏学·消化+呼吸', tasks: ['消化系统图谱', '呼吸系统结构', '综合练习30道'], duration: '2h' },
        { day: 4, title: '内脏学·泌尿+生殖', tasks: ['泌尿系统图谱', '生殖系统要点', '专项训练20道'], duration: '1.5h' },
        { day: 5, title: '脉管系统', tasks: ['心血管核心图谱', '淋巴系统', '综合训练30道'], duration: '2h' },
        { day: 6, title: '神经系统+感觉器', tasks: ['中枢神经图谱', '脑神经要点', '感觉器速记'], duration: '2.5h' },
        { day: 7, title: '综合模拟', tasks: ['150题综合模拟', '全部错题终审', '考前回顾'], duration: '3h' },
      ],
    }});
  } else if (planType === 'rescue') {
    res.json({ success: true, data: {
      type: 'rescue',
      title: '挂科拯救计划',
      subtitle: '适合基础薄弱、需要从头重建的同学',
      phases: [
        { phase: 'recovery', title: '基础恢复阶段', duration: '预计 7 天 · 每天 1.5 小时', description: '骨学、关节学基础重建。每天完成 5 张图谱 + 20 道基础题，建立信心。', color: '#c08a4a', tasks: ['骨学核心结构图谱', '关节学基本类型', '每日20道基础选择题', '错题自动收录'] },
        { phase: 'reinforce', title: '强化阶段', duration: '预计 10 天 · 每天 2 小时', description: '错题集中攻克 + 专题训练。覆盖肌学、神经系统、脉管系统三大薄弱模块。', color: '#7c5cbf', tasks: ['肌学专项强化', '神经系统图谱训练', '脉管系统变式题', '每日1次AI诊断'] },
        { phase: 'sprint', title: '冲刺阶段', duration: '预计 5 天 · 每天 2.5 小时', description: '综合模拟考试 + 真题演练 + 考前回顾。保持节奏，调整心态，稳扎稳打。', color: '#4a9c7c', tasks: ['150题综合模拟', '近3年真题训练', '全部错题终审', '考前心态调整'] },
      ],
    }});
  } else {
    res.status(400).json({ success: false, error: { code: 'INVALID_PLAN_TYPE', message: 'planType must be sprint or rescue' } });
  }
});

module.exports = router;
