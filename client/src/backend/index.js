// Browser-side API handlers — replaces Express routes when server is unavailable
// All imports are local-only modules (no sql.js import at top level)

import { getDB, all, getOne, runQuery, debouncedSave } from '../db/database';
import * as content from '../services/contentService';
import { nextReview } from '../services/spacedRepetition';

let initialized = false;

export async function init() {
  if (initialized) return;
  await content.loadChapters();
  try { await getDB(); } catch {}
  initialized = true;
}

function unitPrefix(unitId) { return (unitId || '').replace(/-part-.*$/, ''); }

// --- content ---
export async function getChapters() { await init(); return content.getChapters(); }
export async function getChapter(cid) { await init(); return content.getChapter(cid); }
export async function getChapterSections(cid) { await init(); return content.getChapterMeta(cid); }
export async function getUnitContent(uid) { await init(); return content.getUnitContent(uid); }
export async function getUnitFlashcards(uid) { await init(); return content.getUnitFlashcards(uid); }
export async function search(q) { await init(); return content.search(q); }

// --- quiz ---
export async function getQuiz(unitId) {
  await init();
  const subId = unitPrefix(unitId);
  const quiz = await content.fetchJSON(subId, 'quiz.json');
  if (!quiz?.questions) return { questions: [], unitId };
  return { questions: quiz.questions.map(q => ({ id: q.id, type: q.type, stem: q.stem, blankCount: q.blankCount, hints: q.hints, relatedContent: q.relatedContent, difficulty: q.difficulty })), unitId };
}

export async function submitQuiz(unitId, answers) {
  await init();
  const subId = unitPrefix(unitId);
  const quiz = await content.fetchJSON(subId, 'quiz.json');
  if (!quiz?.questions) throw { code: 'NOT_FOUND', message: 'Quiz not found' };

  let totalScore = 0;
  const wrongAnswers = [];
  for (let i = 0; i < quiz.questions.length; i++) {
    const q = quiz.questions[i];
    const ua = (answers[i] || []).map(a => (a || '').trim().toLowerCase());
    const ca = (q.answers || []).map(a => (a || '').trim().toLowerCase());
    let correct = 0;
    const bw = [];
    for (let j = 0; j < ca.length; j++) {
      if (ua[j] === ca[j]) correct++; else bw.push(j);
    }
    const score = ca.length ? correct / ca.length : 0;
    totalScore += score;
    const isC = bw.length === 0;
    runQuery(`INSERT INTO quiz_attempts (user_id, unit_id, question_id, question_type, user_answer, correct_answer, is_correct, blanks_wrong, score) VALUES (1, ?, ?, 'fill_blank', ?, ?, ?, ?, ?)`, [unitId, q.id, JSON.stringify(ua), JSON.stringify(ca), isC ? 1 : 0, JSON.stringify(bw), score]);
    if (!isC) {
      const ex = getOne(`SELECT id FROM weak_points WHERE user_id=1 AND unit_id=? AND question_id=?`, [unitId, q.id]);
      if (ex) runQuery(`UPDATE weak_points SET wrong_count=wrong_count+1, last_wrong_at=datetime('now') WHERE id=?`, [ex.id]);
      else runQuery(`INSERT INTO weak_points (user_id, unit_id, question_id, related_content, wrong_count) VALUES (1, ?, ?, ?, 1)`, [unitId, q.id, q.relatedContent || '']);
      wrongAnswers.push({ questionId: q.id, stem: q.stem, userAnswer: ua, correctAnswer: ca, blanksWrong: bw });
    }
  }
  const pct = quiz.questions.length ? Math.round(totalScore / quiz.questions.length * 100) : 0;
  const prog = getOne(`SELECT id FROM unit_progress WHERE user_id=1 AND unit_id=?`, [unitId]);
  if (prog) runQuery(`UPDATE unit_progress SET current_phase=2, phase_2_completed_at=datetime('now') WHERE user_id=1 AND unit_id=?`, [unitId]);
  else runQuery(`INSERT INTO unit_progress (user_id, unit_id, current_phase, phase_2_completed_at) VALUES (1, ?, 2, datetime('now'))`, [unitId]);
  debouncedSave();
  return { score: pct, correctCount: quiz.questions.length - wrongAnswers.length, totalCount: quiz.questions.length, wrongAnswers };
}

export async function generateReview(unitId) {
  await init();
  const weak = all(`SELECT * FROM weak_points WHERE user_id=1 AND unit_id=? AND reviewed=0 ORDER BY last_wrong_at DESC`, [unitId]);
  if (!weak.length) return { skip: true, message: '暂无薄弱点需要复习' };
  const quiz = await content.fetchJSON(unitPrefix(unitId), 'quiz.json');
  const items = weak.map(w => { const q = quiz?.questions?.find(q => q.id === w.question_id); return q ? { questionId: q.id, type: q.type, stem: q.stem, answers: q.answers, relatedContent: w.related_content, wrongCount: w.wrong_count } : null; }).filter(Boolean);
  return { skip: !items.length, items, totalCount: items.length };
}

export async function completeReview(unitId) {
  await init();
  runQuery(`UPDATE weak_points SET reviewed=1, reviewed_at=datetime('now') WHERE user_id=1 AND unit_id=? AND reviewed=0`, [unitId]);
  const ids = all(`SELECT id FROM weak_points WHERE user_id=1 AND unit_id=?`, [unitId]).map(r => r.id);
  runQuery(`INSERT INTO review_sessions (user_id, unit_id, weak_point_ids, total_items, completed, completed_at) VALUES (1, ?, ?, ?, 1, datetime('now'))`, [unitId, JSON.stringify(ids), ids.length]);
  const prog = getOne(`SELECT id FROM unit_progress WHERE user_id=1 AND unit_id=?`, [unitId]);
  if (prog) runQuery(`UPDATE unit_progress SET current_phase=3, phase_3_completed_at=datetime('now') WHERE user_id=1 AND unit_id=?`, [unitId]);
  else runQuery(`INSERT INTO unit_progress (user_id, unit_id, current_phase, phase_3_completed_at) VALUES (1, ?, 3, datetime('now'))`, [unitId]);
  debouncedSave();
  return { success: true };
}

// --- test ---
function judge(q, ua) {
  ua = (ua || '').trim();
  const ca = (q.answer || q.correctAnswer || '').trim();
  const cal = ca.toLowerCase();
  if (q.type === 'multiple_choice') { const ok = ua.toLowerCase() === cal; return { correct: ok, score: ok ? 1 : 0 }; }
  if (q.type === 'true_false') { const pos = ['true', '✓', '对']; const up = pos.some(p => ua.includes(p)), cp = pos.some(p => ca.includes(p)); const ok = up === cp; return { correct: ok, score: ok ? 1 : 0 }; }
  if (q.type === 'term_explanation') { const cr = q.scoringCriteria; if (!cr) return { correct: null, score: null }; const ms = cr.mustInclude?.length ? cr.mustInclude.filter(k => ua.includes(k)).length / cr.mustInclude.length : 0.5; const bs = (cr.bonusWords || []).filter(k => ua.includes(k)).length * 0.1; const sc = Math.min(1, ms * 0.8 + bs); return { correct: sc >= 0.6, score: sc }; }
  if (q.type === 'short_answer' || q.type === 'essay') return { correct: null, score: null };
  return { correct: ua === ca, score: ua === ca ? 1 : 0 };
}

export async function getTest(unitId) { await init(); const t = await content.fetchJSON(unitPrefix(unitId), 'test.json'); return t?.questions ? { questions: t.questions.map(({ answer, answers, correctAnswer, scoringCriteria, explanation, ...r }) => r), unitId } : { questions: [], unitId }; }
export async function getFinalExam(unitId) { await init(); const t = await content.fetchJSON(unitPrefix(unitId), 'finalexam.json'); return t?.questions ? { questions: t.questions.map(({ answer, answers, correctAnswer, explanation, ...r }) => r), unitId } : { questions: [], unitId }; }

export async function submitTest(unitId, answers) {
  await init();
  const t = await content.fetchJSON(unitPrefix(unitId), 'test.json');
  if (!t?.questions) throw { code: 'NOT_FOUND' };
  let ts = 0; const uPath = content.buildUnitPath(unitId);
  for (let i = 0; i < t.questions.length; i++) {
    const q = t.questions[i]; const { correct, score } = judge(q, answers[i] || '');
    ts += score ?? 0;
    runQuery(`INSERT INTO test_attempts (user_id, unit_id, question_id, question_type, user_answer, correct_answer, is_correct, score, max_score) VALUES (1, ?, ?, ?, ?, ?, ?, ?, 1)`, [unitId, q.id, q.type, answers[i] || '', q.answer || q.correctAnswer || '', correct === true ? 1 : 0, score ?? 0]);
    if (correct === false) runQuery(`INSERT INTO error_book (user_id, unit_id, unit_path, question_id, question_type, question_stem, user_answer, correct_answer, explanation, mastery_level, next_review_due) VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)`, [unitId, uPath, q.id, q.type, q.stem || '', answers[i] || '', q.answer || q.correctAnswer || '', q.explanation || '', nextReview(0)]);
  }
  const pct = t.questions.length ? Math.round(ts / t.questions.length * 100) : 0;
  const prog = getOne(`SELECT id FROM unit_progress WHERE user_id=1 AND unit_id=?`, [unitId]);
  if (prog) runQuery(`UPDATE unit_progress SET current_phase=4, phase_4_completed_at=datetime('now') WHERE user_id=1 AND unit_id=?`, [unitId]);
  else runQuery(`INSERT INTO unit_progress (user_id, unit_id, current_phase, phase_4_completed_at) VALUES (1, ?, 4, datetime('now'))`, [unitId]);
  debouncedSave();
  return { score: pct, results: t.questions.map((q, i) => ({ questionId: q.id, correct: judge(q, answers[i] || '').correct, score: judge(q, answers[i] || '').score ?? 0 })), totalCount: t.questions.length };
}

export async function submitFinalExam(unitId, answers) {
  await init();
  const t = await content.fetchJSON(unitPrefix(unitId), 'finalexam.json');
  if (!t?.questions) throw { code: 'NOT_FOUND' };
  let ts = 0; const uPath = content.buildUnitPath(unitId);
  for (let i = 0; i < t.questions.length; i++) {
    const q = t.questions[i]; const { correct, score } = judge(q, answers[i] || '');
    ts += score ?? 0;
    runQuery(`INSERT INTO final_exam_attempts (user_id, unit_id, question_id, question_type, user_answer, correct_answer, is_correct, score) VALUES (1, ?, ?, ?, ?, ?, ?, ?)`, [unitId, q.id, q.type, answers[i] || '', q.answer || q.correctAnswer || '', correct === true ? 1 : 0, score ?? 0]);
    if (correct === false) runQuery(`INSERT INTO error_book (user_id, unit_id, unit_path, question_id, question_type, question_stem, user_answer, correct_answer, explanation, mastery_level, next_review_due) VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)`, [unitId, uPath, q.id, q.type, q.stem || '', answers[i] || '', q.answer || q.correctAnswer || '', q.explanation || '', nextReview(0)]);
  }
  const pct = t.questions.length ? Math.round(ts / t.questions.length * 100) : 0;
  const prog = getOne(`SELECT id FROM unit_progress WHERE user_id=1 AND unit_id=?`, [unitId]);
  if (prog) runQuery(`UPDATE unit_progress SET current_phase=5, phase_5_completed_at=datetime('now') WHERE user_id=1 AND unit_id=?`, [unitId]);
  else runQuery(`INSERT INTO unit_progress (user_id, unit_id, current_phase, phase_5_completed_at) VALUES (1, ?, 5, datetime('now'))`, [unitId]);
  debouncedSave();
  return { score: pct, results: t.questions.map((q, i) => ({ questionId: q.id, correct: judge(q, answers[i] || '').correct, score: judge(q, answers[i] || '').score ?? 0 })), totalCount: t.questions.length };
}

// --- progress ---
export async function getProgressOverview() {
  await init();
  const data = await content.loadChapters();
  let total = 0; const cprog = [];
  for (const ch of data.chapters) {
    let cu = 0;
    for (const sec of ch.sections) for (const sub of sec.subsections) for (const _p of sub.parts) { cu++; total++; }
    const rows = all(`SELECT unit_id, current_phase FROM unit_progress WHERE user_id=1 AND unit_id LIKE ?`, [`${ch.chapterId}%`]);
    const errs = new Set(all(`SELECT DISTINCT unit_id FROM error_book WHERE user_id=1 AND is_resolved=0 AND unit_id LIKE ?`, [`${ch.chapterId}%`]).map(r => r.unit_id));
    let done = 0;
    for (const r of rows) { if (r.current_phase >= 5 && !errs.has(r.unit_id)) done++; }
    cprog.push({ chapterId: ch.chapterId, title: ch.title, totalUnits: cu, completedUnits: done, pct: cu ? Math.round(done / cu * 100) : 0 });
  }
  const allRows = all(`SELECT unit_id, current_phase FROM unit_progress WHERE user_id=1`);
  const errs = new Set(all(`SELECT DISTINCT unit_id FROM error_book WHERE user_id=1 AND is_resolved=0`).map(r => r.unit_id));
  const phases = [0, 0, 0, 0, 0, 0];
  allRows.forEach(r => { if (r.current_phase >= 0 && r.current_phase <= 5) phases[r.current_phase]++; });
  let done = 0;
  for (const r of allRows) { if (r.current_phase >= 5 && !errs.has(r.unit_id)) done++; }
  const eTot = getOne(`SELECT COUNT(*) as c FROM error_book WHERE user_id=1 AND is_resolved=0`)?.c || 0;
  const eDue = getOne(`SELECT COUNT(*) as c FROM error_book WHERE user_id=1 AND is_resolved=0 AND next_review_due <= datetime('now')`)?.c || 0;
  const recent = getOne(`SELECT COUNT(*) as c FROM quiz_attempts WHERE user_id=1 AND created_at >= datetime('now', '-7 days')`)?.c || 0;
  return { totalUnits: total, completedCount: done, phases, errorTotal: eTot, dueErrors: eDue, recentAttempts: recent, chapterProgress: cprog };
}

export async function getChapterProgress(cid) {
  await init();
  const data = await content.loadChapters();
  const ch = data.chapters.find(c => c.chapterId === cid);
  if (!ch) throw { code: 'NOT_FOUND' };
  const units = [];
  for (const sec of ch.sections) for (const sub of sec.subsections) for (const part of sub.parts) {
    const uid = `${sub.id}-part-${part.id}`;
    const p = getOne(`SELECT current_phase FROM unit_progress WHERE user_id=1 AND unit_id=?`, [uid]);
    const e = all(`SELECT COUNT(*) as c FROM error_book WHERE user_id=1 AND unit_id=? AND is_resolved=0`, [uid])[0]?.c || 0;
    units.push({ unitId: uid, title: part.title || sub.title, subId: sub.id, sectionId: sec.id, phase: p?.current_phase || 0, hasErrors: e > 0 });
  }
  return { chapterId: cid, units };
}

// --- learning ---
export async function getUnitProgress(uid) { await init(); return getOne(`SELECT * FROM unit_progress WHERE user_id=1 AND unit_id=?`, [uid]) || { unitId: uid, currentPhase: 0 }; }
export async function completePhase(uid, p) { await init(); const ph = parseInt(p); const ex = getOne(`SELECT id FROM unit_progress WHERE user_id=1 AND unit_id=?`, [uid]); if (ex) runQuery(`UPDATE unit_progress SET current_phase=?, phase_${ph}_completed_at=datetime('now') WHERE user_id=1 AND unit_id=?`, [ph, uid]); else runQuery(`INSERT INTO unit_progress (user_id, unit_id, current_phase, phase_${ph}_completed_at) VALUES (1, ?, ?, datetime('now'))`, [uid, ph]); debouncedSave(); return { unitId: uid, currentPhase: ph }; }
export async function markUnitComplete(uid) { await init(); const ex = getOne(`SELECT id FROM unit_progress WHERE user_id=1 AND unit_id=?`, [uid]); if (ex) runQuery(`UPDATE unit_progress SET current_phase=1, last_accessed_at=datetime('now') WHERE user_id=1 AND unit_id=?`, [uid]); else runQuery(`INSERT INTO unit_progress (user_id, unit_id, current_phase, last_accessed_at) VALUES (1, ?, 1, datetime('now'))`, [uid]); debouncedSave(); return { unitId: uid, completed: true }; }
export async function getNotes(uid) { await init(); return all(`SELECT * FROM user_notes WHERE user_id=1 AND unit_id=? ORDER BY updated_at DESC`, [uid]); }
export async function createNote(uid, text) { await init(); runQuery(`INSERT INTO user_notes (user_id, unit_id, note_text) VALUES (1, ?, ?)`, [uid, text]); debouncedSave(); return { success: true }; }
export async function deleteNote(id) { await init(); runQuery(`DELETE FROM user_notes WHERE id=? AND user_id=1`, [id]); debouncedSave(); return { success: true }; }

// --- practice ---
// Cache practice questions by ID for fast submit lookup
const questionCache = new Map();

export async function getPracticeQuestions(chapter, sub) {
  await init();
  const results = [];
  const seen = new Set();

  // 1) Try practice-pool.json first (single file, fast)
  if (chapter) {
    const pool = await content.getPracticePool(chapter);
    (pool.questions || []).forEach(q => {
      if (!seen.has(q.id)) {
        seen.add(q.id);
        results.push({
          id: q.id, unitId: '', partTitle: '', type: q.type,
          stem: q.stem, options: q.options,
          source: 'pool', answer: q.answer,
          blanks: q.blanks, explanation: q.explanation,
        });
      }
    });
  }

  // 2) Supplement with subsection-level quiz/test files if pool is too small
  if (results.length < 10) {
    const data = await content.loadChapters();
    for (const ch of data.chapters) {
      if (chapter && ch.chapterId !== chapter) continue;
      for (const sec of ch.sections) {
        for (const subsec of sec.subsections) {
          if (sub && subsec.id !== sub) continue;
          if (results.length >= 10) break;
          const firstPart = (subsec.parts || [])[0];
          if (!firstPart) continue;
          const uid = subsec.id + '-part-' + firstPart.id;
          try {
            const quiz = await content.fetchJSON(subsec.id, 'quiz.json');
            const test = await content.fetchJSON(subsec.id, 'test.json');
            const subQuestions = [...(quiz?.questions || []), ...(test?.questions || [])];
            subQuestions.forEach(q => {
              if (!seen.has(q.id)) {
                seen.add(q.id);
                results.push({
                  id: q.id, unitId: uid,
                  partTitle: firstPart.title || subsec.title,
                  type: q.type, stem: q.stem, options: q.options,
                  source: quiz?.questions?.some(x => x.id === q.id) ? 'quiz' : 'test',
                  answer: q.answer, blanks: q.blanks, explanation: q.explanation,
                });
              }
            });
          } catch {}
        }
      }
    }
  }

  // Strip answer for self-check types and cache
  const safe = results.map(q => {
    questionCache.set(q.id, q);
    if (q.type === 'term_explanation' || q.type === 'short_answer' || q.type === 'essay') {
      return { ...q, answer: '' };
    }
    return q;
  });

  return { questions: safe, total: safe.length };
}

export async function submitPractice(unitId, questionId, type, answer) {
  await init();

  // Look up from cache first
  let question = questionCache.get(questionId);

  // Fallback: search practice pools directly
  if (!question) {
    const pools = await content.getAllPracticePools();
    for (const p of pools) {
      question = (p.questions || []).find(q => q.id === questionId);
      if (question) { questionCache.set(questionId, question); break; }
    }
  }

  if (!question) {
    throw { code: 'NOT_FOUND', message: '题目不存在' };
  }

  const selfCheck = question.type === 'term_explanation' || question.type === 'short_answer' || question.type === 'essay';
  let isCorrect = false;

  if (question.type === 'fill_blank') {
    const userBlanks = Array.isArray(answer) ? answer : [answer];
    const correctBlanks = (question.blanks || []).map(b => (b.answer || '').trim().toLowerCase());
    isCorrect = userBlanks.length === correctBlanks.length &&
      userBlanks.every((a, i) => (a || '').trim().toLowerCase() === correctBlanks[i]);
  } else if (question.type === 'multiple_choice') {
    isCorrect = (answer || '').toString().trim().toUpperCase() === (question.answer || '').toUpperCase();
  } else if (question.type === 'true_false') {
    const ua = (answer || '').toString();
    const pos = ['true', '✓', '对'];
    isCorrect = pos.some(p => ua.includes(p)) === pos.some(p => (question.answer || '').includes(p));
  }

  const correctAns = question.type === 'fill_blank'
    ? JSON.stringify((question.blanks || []).map(b => b.answer))
    : JSON.stringify(question.answer || '');
  const userAns = Array.isArray(answer) ? JSON.stringify(answer) : JSON.stringify(answer || '');

  runQuery(
    'INSERT INTO quiz_attempts (user_id, unit_id, question_id, question_type, user_answer, correct_answer, is_correct, score) VALUES (1, ?, ?, ?, ?, ?, ?, ?)',
    [unitId, questionId, question.type, userAns, correctAns, isCorrect && !selfCheck ? 1 : 0, isCorrect && !selfCheck ? 1 : 0]
  );

  // Write wrong answers to error_book
  if (!isCorrect && !selfCheck) {
    const existing = getOne(
      `SELECT id FROM error_book WHERE user_id = 1 AND question_id = ? AND is_resolved = 0`,
      [questionId]
    );
    if (existing) {
      runQuery(
        `UPDATE error_book SET user_answer = ?, mastery_level = MAX(0, mastery_level - 1), next_review_due = datetime('now'), updated_at = datetime('now') WHERE id = ?`,
        [userAns, existing.id]
      );
    } else {
      runQuery(
        `INSERT INTO error_book (user_id, unit_id, question_id, question_type, question_stem, user_answer, correct_answer, explanation, mastery_level, next_review_due, created_at) VALUES (1, ?, ?, ?, ?, ?, ?, ?, 0, datetime('now'), datetime('now'))`,
        [unitId || 'practice', questionId, question.type, question.stem || '', userAns, correctAns, question.explanation || '']
      );
    }
  }

  debouncedSave();
  const correctAnsStr = question.type === 'fill_blank'
    ? (question.blanks || []).map(b => b.answer).join('、')
    : question.answer || '';

  return {
    isCorrect: selfCheck ? null : isCorrect,
    correctAnswer: correctAnsStr,
    selfCheck,
    explanation: question.explanation || '',
  };
}

// --- errorbook ---
export async function getErrorBook() { await init(); return all(`SELECT * FROM error_book WHERE user_id=1 ORDER BY created_at DESC`); }
export async function getErrorBookDue() { await init(); return all(`SELECT * FROM error_book WHERE user_id=1 AND is_resolved=0 AND next_review_due <= datetime('now') ORDER BY next_review_due ASC`); }
export async function getErrorBookStats() { await init(); const t = getOne(`SELECT COUNT(*) as c FROM error_book WHERE user_id=1 AND is_resolved=0`)?.c || 0; const bt = all(`SELECT question_type, COUNT(*) as c FROM error_book WHERE user_id=1 AND is_resolved=0 GROUP BY question_type`); return { total: t, byType: bt }; }
export async function updateErrorMastery(id, level) { await init(); runQuery(`UPDATE error_book SET mastery_level=?, times_reviewed=times_reviewed+1, next_review_due=?, updated_at=datetime('now') WHERE id=? AND user_id=1`, [level, nextReview(level), id]); debouncedSave(); return { success: true }; }
export async function resolveError(id) { await init(); runQuery(`UPDATE error_book SET is_resolved=1, resolved_at=datetime('now'), updated_at=datetime('now') WHERE id=? AND user_id=1`, [id]); debouncedSave(); return { success: true }; }

// --- recommend ---
export async function getRecommend() {
  await init();
  const data = await content.loadChapters();
  const recs = [];
  const due = all(`SELECT DISTINCT unit_id FROM error_book WHERE user_id=1 AND is_resolved=0 AND next_review_due <= datetime('now') LIMIT 3`);
  for (const d of due) { const pth = content.buildUnitPath(d.unit_id); recs.push({ type: 'error', title: '复习错题', message: pth || d.unit_id, unitId: d.unit_id, path: pth }); }
  const intervals = [1, 2, 4, 7, 15, 30];
  const learned = all(`SELECT unit_id, current_phase, phase_1_completed_at FROM unit_progress WHERE user_id=1 AND current_phase>=1 AND current_phase<5`);
  for (const lu of learned) {
    if (!lu.phase_1_completed_at) continue;
    const dp = Math.floor((Date.now() - new Date(lu.phase_1_completed_at).getTime()) / 86400000);
    if (intervals.some(iv => dp >= iv && dp < iv + 1)) { const pth = content.buildUnitPath(lu.unit_id); recs.push({ type: 'review', title: '艾宾浩斯复习', message: pth || lu.unit_id, unitId: lu.unit_id, path: pth, daysPassed: dp }); }
  }
  if (recs.length < 3) {
    const progMap = new Map(all(`SELECT unit_id, current_phase FROM unit_progress WHERE user_id=1`).map(p => [p.unit_id, p.current_phase]));
    for (const ch of data.chapters) { for (const sec of ch.sections) { for (const sub of sec.subsections) { for (const part of sub.parts) {
      const uid = `${sub.id}-part-${part.id}`; const phase = progMap.get(uid) || 0;
      if ((phase === 0 || phase < 5) && recs.length < 5) { const pth = content.buildUnitPath(uid); recs.push({ type: 'learn', title: phase === 0 ? '开始学习' : '继续学习', message: pth || uid, unitId: uid, path: pth }); }
    }}}}
  }
  return recs.slice(0, 5);
}

// --- countdown ---
export async function getCountdown() { await init(); const n = getOne(`SELECT value FROM settings WHERE key='countdown_name'`); const t = getOne(`SELECT value FROM settings WHERE key='countdown_target'`); return { name: n?.value || '距离解剖学期末考试', target: t?.value || '' }; }
export async function updateCountdown(name, target) { await init(); if (name) runQuery(`INSERT INTO settings (key, value, updated_at) VALUES ('countdown_name', ?, datetime('now')) ON CONFLICT(key) DO UPDATE SET value=excluded.value`, [name]); if (target) runQuery(`INSERT INTO settings (key, value, updated_at) VALUES ('countdown_target', ?, datetime('now')) ON CONFLICT(key) DO UPDATE SET value=excluded.value`, [target]); debouncedSave(); return { success: true }; }

// --- AI (local mode: direct DeepSeek API calls) ---
import { aiChatLocal, aiGenerateQuizLocal, aiReviewReportLocal, aiTodayRecommendLocal } from '../utils/aiLocal';
export async function aiChat(apiKey, unitId, scene, messages, currentPage, userProfile) { const text = await aiChatLocal(apiKey, unitId, scene, messages, { currentPage, userProfile }); return { reply: text }; }
export async function aiGenerateQuiz(apiKey, unitId, count) { return aiGenerateQuizLocal(apiKey, unitId, count); }
export async function aiReviewReport(apiKey, unitId) { const report = await aiReviewReportLocal(apiKey, unitId); return { report }; }
export async function aiTodayRecommend(apiKey) { const recommendation = await aiTodayRecommendLocal(apiKey); return { recommendation };}
export { aiChatLocal, aiGenerateQuizLocal, aiReviewReportLocal, aiTodayRecommendLocal };
