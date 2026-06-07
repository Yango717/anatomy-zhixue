// Browser-side API handlers — replaces Express routes when server is unavailable
// All imports are local-only modules (no sql.js import at top level)

import { getDB, all, getOne, runQuery, debouncedSave, immediateSave } from '../db/database';
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
  immediateSave();
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
  immediateSave();
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
  immediateSave();
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
  immediateSave();
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
export async function completePhase(uid, p) { await init(); const ph = parseInt(p); const ex = getOne(`SELECT id FROM unit_progress WHERE user_id=1 AND unit_id=?`, [uid]); if (ex) runQuery(`UPDATE unit_progress SET current_phase=?, phase_${ph}_completed_at=datetime('now') WHERE user_id=1 AND unit_id=?`, [ph, uid]); else runQuery(`INSERT INTO unit_progress (user_id, unit_id, current_phase, phase_${ph}_completed_at) VALUES (1, ?, ?, datetime('now'))`, [uid, ph]); immediateSave(); return { unitId: uid, currentPhase: ph }; }
export async function markUnitComplete(uid) { await init(); const ex = getOne(`SELECT id FROM unit_progress WHERE user_id=1 AND unit_id=?`, [uid]); if (ex) runQuery(`UPDATE unit_progress SET current_phase=1, last_accessed_at=datetime('now') WHERE user_id=1 AND unit_id=?`, [uid]); else runQuery(`INSERT INTO unit_progress (user_id, unit_id, current_phase, last_accessed_at) VALUES (1, ?, 1, datetime('now'))`, [uid]); immediateSave(); return { unitId: uid, completed: true }; }
export async function getNotes(uid) { await init(); return all(`SELECT * FROM user_notes WHERE user_id=1 AND unit_id=? ORDER BY updated_at DESC`, [uid]); }
export async function createNote(uid, text) { await init(); runQuery(`INSERT INTO user_notes (user_id, unit_id, note_text) VALUES (1, ?, ?)`, [uid, text]); immediateSave(); return { success: true }; }
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

  immediateSave();
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
export async function updateErrorMastery(id, level) { await init(); runQuery(`UPDATE error_book SET mastery_level=?, times_reviewed=times_reviewed+1, next_review_due=?, updated_at=datetime('now') WHERE id=? AND user_id=1`, [level, nextReview(level), id]); immediateSave(); return { success: true }; }
export async function resolveError(id) { await init(); runQuery(`UPDATE error_book SET is_resolved=1, resolved_at=datetime('now'), updated_at=datetime('now') WHERE id=? AND user_id=1`, [id]); immediateSave(); return { success: true }; }

export async function addErrors(errors) {
  await init();
  let added = 0;
  for (const err of errors) {
    const existing = getOne(`SELECT id FROM error_book WHERE user_id=1 AND question_id=? AND is_resolved=0`, [err.question_id]);
    if (existing) {
      runQuery(`UPDATE error_book SET user_answer=?, mastery_level=MAX(0,mastery_level-1), next_review_due=datetime('now'), updated_at=datetime('now') WHERE id=?`, [err.user_answer, existing.id]);
    } else {
      runQuery(`INSERT INTO error_book (user_id, unit_id, question_id, question_type, question_stem, user_answer, correct_answer, explanation, options, mastery_level, next_review_due) VALUES (1,?,?,?,?,?,?,?,?,0,?)`, [err.unit_id, err.question_id, err.question_type, err.question_stem, err.user_answer, err.correct_answer, err.explanation||'', err.options||'', nextReview(0)]);
      added++;
    }
  }
  immediateSave();
  return { added };
}

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

// --- motion (五步学习流) ---
const CHAPTER_DIR_CACHE = {};

async function getMotionDir(chapterId) {
  if (CHAPTER_DIR_CACHE[chapterId]) return CHAPTER_DIR_CACHE[chapterId];
  try {
    const resp = await fetch('/content/chapters.json');
    if (resp.ok) {
      const data = await resp.json();
      const ch = (data.chapters || data).find(c => c.chapterId === chapterId);
      if (ch) { CHAPTER_DIR_CACHE[chapterId] = '/content/' + chapterId + '-' + ch.title; return CHAPTER_DIR_CACHE[chapterId]; }
    }
  } catch {}
  CHAPTER_DIR_CACHE[chapterId] = '/content/' + chapterId;
  return CHAPTER_DIR_CACHE[chapterId];
}

async function loadMotionJSON(chapterId, filename) {
  try {
    const dir = await getMotionDir(chapterId);
    const resp = await fetch(`${dir}/${filename}`);
    return resp.ok ? resp.json() : null;
  } catch { return null; }
}

export async function getMotionKnowledgeCards(chapterId, section, subsection) {
  let cards = await loadMotionJSON(chapterId, 'knowledge_cards.json');
  if (!cards) return [];
  if (section) cards = cards.filter(c => c.section === section);
  if (subsection) cards = cards.filter(c => c.subsection === subsection);
  return cards;
}

export async function getMotionAtlasCards(chapterId, section) {
  let cards = await loadMotionJSON(chapterId, 'atlas_cards.json');
  if (!cards) return [];
  if (section) cards = cards.filter(c => c.section === section);
  const dir = await getMotionDir(chapterId);
  return cards.map(card => ({
    ...card,
    imageUrls: (card.images || []).map(f => `${dir}/atlas/${f}`)
  }));
}

export async function getMotionQuestionCardMap(chapterId) {
  return await loadMotionJSON(chapterId, 'question_card_map.json') || [];
}

export async function getMotionPracticePool(chapterId) {
  return await loadMotionJSON(chapterId, 'practice-pool.json') || { questions: [] };
}

export async function getMotionErrorCardRefs(chapterId, errors) {
  if (!Array.isArray(errors)) return { knowledgeCards: [], atlasCards: [] };
  const cardMap = await loadMotionJSON(chapterId, 'question_card_map.json') || [];
  const allKnowledge = await loadMotionJSON(chapterId, 'knowledge_cards.json') || [];
  const allAtlas = await loadMotionJSON(chapterId, 'atlas_cards.json') || [];

  const index = {};
  for (const m of cardMap) {
    index[m.q_type + "::" + m.q_num] = m.refs;
  }

  const knowledgeCards = [];
  const atlasCards = [];
  const seenK = new Set();
  const seenA = new Set();

  for (const err of errors) {
    const key = err.q_type + "::" + err.q_num;
    const refs = index[key];
    if (!refs) continue;
    for (const refId of refs) {
      const kc = allKnowledge.find(c => c.id === refId);
      if (kc && !seenK.has(kc.id)) {
        seenK.add(kc.id);
        knowledgeCards.push(kc);
      }
      if (kc && kc.tags) {
        for (const tag of kc.tags) {
          const matched = allAtlas.filter(a => a.tags && a.tags.some(t => t === tag || t.includes(tag) || tag.includes(t)));
          for (const ac of matched) {
            if (!seenA.has(ac.id)) {
              seenA.add(ac.id);
              atlasCards.push(ac);
            }
          }
        }
      }
    }
  }

  // Add image URLs to atlas cards
  const dir = await getMotionDir(chapterId);
  const atlasCardsWithUrls = atlasCards.map(card => ({
    ...card,
    imageUrls: (card.images || []).map(f => `${dir}/atlas/${f}`)
  }));

  return { knowledgeCards, atlasCards: atlasCardsWithUrls };
}

// --- learning center (妍学姐学习驾驶舱) ---
const SECTION_NAMES = {
  'section-01-01': '骨学', 'section-01-02': '关节学', 'section-01-03': '肌学',
  'section-02-01': '消化系统', 'section-03-01': '呼吸系统',
  'section-04-01': '泌尿系统', 'section-05-01': '生殖系统',
  'section-06-01': '心血管系统', 'section-06-02': '淋巴系统',
  'section-07-01': '感觉器', 'section-08-01': '中枢神经系统',
  'section-08-02': '周围神经系统', 'section-09-01': '内分泌系统',
};

export async function getLearningCenterData() {
  await init();

  // 安全读取函数
  function safeAll(sql, params) {
    try { return all(sql, params); } catch { return []; }
  }
  function safeGetOne(sql, params) {
    try { return getOne(sql, params); } catch { return null; }
  }

  let data;
  try { data = await content.loadChapters(); }
  catch (e) { console.error('[getLearningCenterData] chapters error:', e); data = { chapters: [] }; }

  // 1. 计算连续学习天数
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
  // @demo: 如果没有真实数据，给模拟值
  if (streak === 0) streak = 7;

  // 2. 本周学习时长（基于答题数量估算，每题约2分钟）
  const recentQuiz = safeGetOne(`SELECT COUNT(*) as c FROM quiz_attempts WHERE user_id=1 AND created_at >= datetime('now', '-7 days')`)?.c || 0;
  const recentTest = safeGetOne(`SELECT COUNT(*) as c FROM test_attempts WHERE user_id=1 AND created_at >= datetime('now', '-7 days')`)?.c || 0;
  const recentFinal = safeGetOne(`SELECT COUNT(*) as c FROM final_exam_attempts WHERE user_id=1 AND created_at >= datetime('now', '-7 days')`)?.c || 0;
  let weeklyMinutes = (recentQuiz + recentTest + recentFinal) * 2;
  // @demo: 不足时补模拟值
  if (weeklyMinutes < 60) weeklyMinutes = 318; // ~5.3h
  const weeklyHours = (weeklyMinutes / 60).toFixed(1);

  // 3. 完成测试题数
  const totalQuiz = safeGetOne(`SELECT COUNT(*) as c FROM quiz_attempts WHERE user_id=1`)?.c || 0;
  const totalTest = safeGetOne(`SELECT COUNT(*) as c FROM test_attempts WHERE user_id=1`)?.c || 0;
  const totalFinal = safeGetOne(`SELECT COUNT(*) as c FROM final_exam_attempts WHERE user_id=1`)?.c || 0;
  let testsDone = totalQuiz + totalTest + totalFinal;
  // @demo
  if (testsDone < 20) testsDone = 128;

  // 4. 掌握度：phase >= 4 的比例
  const allRows = safeAll(`SELECT unit_id, current_phase FROM unit_progress WHERE user_id=1`);
  let totalUnits = 0; let masteredUnits = 0;
  for (const ch of data.chapters) {
    for (const sec of ch.sections) for (const sub of sec.subsections) for (const _p of sub.parts) totalUnits++;
  }
  for (const r of allRows) { if (r.current_phase >= 4) masteredUnits++; }
  let mastery = totalUnits ? Math.round(masteredUnits / totalUnits * 100) : 0;
  // @demo
  if (mastery < 20) mastery = 76;

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
          chapterId: ch.chapterId,
          sectionId: sec.id,
          name: sec.title,
          pct: Math.round(secDone / secTotal * 100),
          totalUnits: secTotal,
          completedUnits: secDone,
        });
      }
    }
  }

  // @demo: 如果 section 数据太少，补充模拟热力图
  if (sectionProgress.length < 3 || sectionProgress.every(s => s.pct === 0)) {
    sectionProgress.length = 0;
    sectionProgress.push(
      { chapterId: 'chapter-01', sectionId: 'section-01-01', name: '骨学', pct: 92, totalUnits: 35, completedUnits: 32 },
      { chapterId: 'chapter-01', sectionId: 'section-01-02', name: '关节学', pct: 88, totalUnits: 20, completedUnits: 18 },
      { chapterId: 'chapter-01', sectionId: 'section-01-03', name: '肌学', pct: 75, totalUnits: 25, completedUnits: 19 },
      { chapterId: 'chapter-08', sectionId: 'section-08-01', name: '神经系统', pct: 61, totalUnits: 30, completedUnits: 18 },
      { chapterId: 'chapter-06', sectionId: 'section-06-01', name: '脉管系统', pct: 54, totalUnits: 22, completedUnits: 12 },
    );
  }

  // 6. AI 建议（基于最薄弱 section 的错题）
  const weakSections = [...sectionProgress].sort((a, b) => a.pct - b.pct).slice(0, 2);
  const suggestions = [];
  for (const ws of weakSections) {
    if (ws.pct < 70) {
      suggestions.push({
        sectionId: ws.sectionId,
        sectionName: ws.name,
        message: `你在${ws.name}的掌握率仅 ${ws.pct}%，建议优先复习。`,
        actions: [
          { label: `${ws.name}图谱复习`, type: 'atlas', chapterId: ws.chapterId, sectionId: ws.sectionId },
          { label: `${ws.name}专项训练`, type: 'practice', chapterId: ws.chapterId },
          { label: `完成10道测试题`, type: 'test', chapterId: ws.chapterId },
        ],
      });
    }
  }
  // @demo fallback
  if (suggestions.length === 0) {
    suggestions.push({
      sectionId: 'section-06-01',
      sectionName: '脉管系统',
      message: '你在脉管系统连续出现错误。股动脉、股神经的解剖位置关系是你目前的薄弱点。',
      actions: [
        { label: '股动脉图谱复习', type: 'atlas', chapterId: 'chapter-06', sectionId: 'section-06-01' },
        { label: '股三角专项训练', type: 'practice', chapterId: 'chapter-06' },
        { label: '完成10道测试题', type: 'test', chapterId: 'chapter-06' },
      ],
    });
  }

  return {
    streak,
    weeklyHours,
    testsDone,
    mastery,
    sectionProgress,
    suggestions,
    totalUnits,
    completedUnits: masteredUnits || Math.round(76 * totalUnits / 100),
  };
}

// --- learning portrait (AI 学习画像) ---
export async function getLearningPortrait() {
  await init();

  // 安全读取函数 — 任何 SQL 错误返回空数组
  function safeAll(sql, params) {
    try { return all(sql, params); } catch { return []; }
  }
  function safeGetOne(sql, params) {
    try { return getOne(sql, params); } catch { return null; }
  }

  let chapterProg = [];
  try {
    const data = await content.loadChapters();

    // 1. 优势 / 待强化模块
    for (const ch of data.chapters) {
      let total = 0; let done = 0;
      for (const sec of ch.sections) for (const sub of sec.subsections) for (const _p of sub.parts) total++;
      const rows = safeAll(`SELECT unit_id, current_phase FROM unit_progress WHERE user_id=1 AND unit_id LIKE ?`, [`${ch.chapterId}%`]);
      const errs = new Set(safeAll(`SELECT DISTINCT unit_id FROM error_book WHERE user_id=1 AND is_resolved=0 AND unit_id LIKE ?`, [`${ch.chapterId}%`]).map(r => r.unit_id));
      for (const r of rows) { if (r.current_phase >= 4 && !errs.has(r.unit_id)) done++; }
      const pct = total ? Math.round(done / total * 100) : 0;
      chapterProg.push({ chapterId: ch.chapterId, name: CHAPTER_NAMES[ch.chapterId] || ch.title, pct, total, done });
    }
  } catch (e) {
    console.error('[getLearningPortrait] chapters error:', e);
  }

  let strengths = chapterProg.filter(c => c.pct >= 70).sort((a, b) => b.pct - a.pct);
  let weaknesses = chapterProg.filter(c => c.pct < 70).sort((a, b) => a.pct - b.pct);

  // @demo: 如果数据不足，给模拟值
  if (chapterProg.length === 0 || chapterProg.every(c => c.pct === 0)) {
    strengths = [
      { chapterId: 'chapter-01', name: '运动系统', pct: 90, sub: '骨学 · 关节学' },
      { chapterId: 'chapter-01', name: '肌学', pct: 88, sub: '各肌群起止点' },
    ];
    weaknesses = [
      { chapterId: 'chapter-06', name: '脉管系统', pct: 58, sub: '动静脉走行' },
      { chapterId: 'chapter-08', name: '神经系统', pct: 61, sub: '脑神经核团' },
    ];
  }

  // 2. 学习特点（基于错题类型分布推断）
  const errByType = {};
  try {
    const errRows = safeAll(`SELECT question_type, COUNT(*) as c FROM error_book WHERE user_id=1 AND is_resolved=0 GROUP BY question_type`, []);
    for (const r of errRows) errByType[r.question_type] = r.c;
  } catch {}

  const totalErrors = Object.values(errByType).reduce((a, b) => a + b, 0) || 1;
  const fillBlankPct = Math.round((errByType.fill_blank || 0) / totalErrors * 100);
  const choicePct = Math.round((errByType.multiple_choice || 0) / totalErrors * 100);
  const termPct = Math.round((errByType.term_explanation || 0) / totalErrors * 100);

  // 推断学习特点
  let traits = [
    { label: '结构定位能力', score: Math.max(30, 92 - choicePct), color: '#4a9c7c' },
    { label: '记忆准确度', score: Math.max(30, 78 - fillBlankPct), color: '#7c5cbf' },
    { label: '图谱识别能力', score: Math.max(30, 68 - choicePct), color: '#7c5cbf' },
    { label: '答题速度', score: Math.max(30, 60), color: '#c08a4a' },
    { label: '临床关联能力', score: Math.max(30, 45 + (100 - termPct) * 0.2), color: '#c0554a' },
  ];

  // @demo
  if (totalErrors <= 1) {
    traits = [
      { label: '结构定位能力', score: 92, color: '#4a9c7c' },
      { label: '记忆准确度', score: 78, color: '#7c5cbf' },
      { label: '图谱识别能力', score: 68, color: '#7c5cbf' },
      { label: '答题速度', score: 60, color: '#c08a4a' },
      { label: '临床关联能力', score: 45, color: '#c0554a' },
    ];
  }

  // 3. 近30天正确率
  const dailyAccuracy = [];
  try {
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
  } catch {}

  // @demo: 如果数据太少，填充模拟趋势
  if (dailyAccuracy.length === 0 || dailyAccuracy.every(v => v === null)) {
    const demo = [68,72,65,70,75,78,73,80,82,77,85,88,82,90,86,92,88,85,90,87,93,89,91,88,86,90,85,88,92,87];
    for (let i = 0; i < 30; i++) dailyAccuracy[i] = demo[i];
  }

  // 4. 错误分布
  const errorDist = [
    { type: 'fill_blank', label: '填空题', count: errByType.fill_blank || 0 },
    { type: 'multiple_choice', label: '选择题', count: errByType.multiple_choice || 0 },
    { type: 'term_explanation', label: '名词解释', count: errByType.term_explanation || 0 },
    { type: 'true_false', label: '判断题', count: errByType.true_false || 0 },
  ];
  // @demo
  if (totalErrors <= 1) {
    errorDist[0].count = 28;
    errorDist[1].count = 12;
    errorDist[2].count = 8;
    errorDist[3].count = 5;
  }

  return { strengths, weaknesses, traits, dailyAccuracy, errorDist };
}

const CHAPTER_NAMES = {
  'chapter-01': '运动系统', 'chapter-02': '消化系统', 'chapter-03': '呼吸系统',
  'chapter-04': '泌尿系统', 'chapter-05': '生殖系统', 'chapter-06': '循环系统',
  'chapter-07': '感觉器', 'chapter-08': '神经系统', 'chapter-09': '内分泌系统',
  'chapter-00': '绪论',
};

// --- learning path (学习路径推荐) ---
export async function getLearningPath(planType) {
  await init();

  if (planType === 'sprint') {
    return {
      type: 'sprint',
      title: '考前7天冲刺计划',
      subtitle: '妍学姐为你规划',
      days: [
        { day: 1, date: 'Day 1', tasks: ['骨学综合复习', '图谱训练（颅骨）', '50道选择题'] },
        { day: 2, date: 'Day 2', tasks: ['关节学强化', '专项测试（肩/肘/髋）', '错题回顾'] },
        { day: 3, date: 'Day 3', tasks: ['肌学复习', '图谱训练（四肢肌）', '30道填空题'] },
        { day: 4, date: 'Day 4', tasks: ['神经系统图谱', '脑神经核团记忆', '专项测试'] },
        { day: 5, date: 'Day 5', tasks: ['脉管系统强化', '动静脉走行图谱', '错题集中攻克'] },
        { day: 6, date: 'Day 6', tasks: ['综合模拟考', '150题全真模拟', 'AI批改+分析'] },
        { day: 7, date: 'Day 7', tasks: ['错题终极大回顾', '重点图谱速览', '休息调整心态'] },
      ],
    };
  }

  // rescue: 挂科拯救计划
  return {
    type: 'rescue',
    title: '解剖挂科拯救计划',
    subtitle: '妍学姐带你逆风翻盘',
    phases: [
      {
        phase: 'recovery',
        title: '基础恢复阶段',
        duration: '预计 7 天 · 每天 1.5 小时',
        description: '骨学、关节学基础重建。每天完成 5 张图谱 + 20 道基础题，建立信心。',
        color: '#c08a4a',
        tasks: ['骨学核心结构图谱', '关节学基本类型', '每日20道基础选择题', '错题自动收录'],
      },
      {
        phase: 'reinforce',
        title: '强化阶段',
        duration: '预计 10 天 · 每天 2 小时',
        description: '错题集中攻克 + 专题训练。覆盖肌学、神经系统、脉管系统三大薄弱模块。',
        color: '#7c5cbf',
        tasks: ['肌学专项强化', '神经系统图谱训练', '脉管系统变式题', '每日1次AI诊断'],
      },
      {
        phase: 'sprint',
        title: '冲刺阶段',
        duration: '预计 5 天 · 每天 2.5 小时',
        description: '综合模拟考试 + 真题演练 + 考前回顾。保持节奏，调整心态，稳扎稳打。',
        color: '#4a9c7c',
        tasks: ['150题综合模拟', '近3年真题训练', '全部错题终审', '考前心态调整'],
      },
    ],
  };
}
import { aiChatLocal, aiGenerateQuizLocal, aiReviewReportLocal, aiTodayRecommendLocal, aiGeneratePlanLocal, aiGenerateNextCheckinLocal } from '../utils/aiLocal';
export async function aiChat(apiKey, unitId, scene, messages, currentPage, userProfile) { const text = await aiChatLocal(apiKey, unitId, scene, messages, { currentPage, userProfile }); return { reply: text }; }
export async function aiGenerateQuiz(apiKey, unitId, count) { return aiGenerateQuizLocal(apiKey, unitId, count); }
export async function aiReviewReport(apiKey, unitId) { const report = await aiReviewReportLocal(apiKey, unitId); return { report }; }
export async function aiTodayRecommend(apiKey) { const recommendation = await aiTodayRecommendLocal(apiKey); return { recommendation };}
export async function aiGeneratePlan(apiKey, progress, errors, units, userProfile) { return aiGeneratePlanLocal(apiKey, progress, errors, units, userProfile); }
export async function aiGenerateNextCheckin(apiKey, completedActivity, currentPlan, userProfile) { return aiGenerateNextCheckinLocal(apiKey, completedActivity, currentPlan, userProfile); }
export { aiChatLocal, aiGenerateQuizLocal, aiReviewReportLocal, aiTodayRecommendLocal, aiGeneratePlanLocal, aiGenerateNextCheckinLocal };
