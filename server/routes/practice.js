const express = require('express');
const router = express.Router();
const { getDB, run: runQuery } = require('../db/database');
const contentService = require('../services/contentService');
const quizService = require('../services/quizService');
const testService = require('../services/testService');

// Get all questions for a section (subsection or entire chapter)
// ?chapter=chapter-01  → all questions in that chapter
// ?sub=sub-01-01-01   → all questions in that subsection
router.get('/practice/questions', (req, res) => {
  try {
    const fs = require('fs');
    const path = require('path');
    const config = require('../config');
    const { chapter, sub } = req.query;
    const seen = new Set();
    const results = [];

    // 1) Try practice-pool.json first (single file, fast)
    if (chapter) {
      const chapterDirs = fs.readdirSync(config.contentDir).filter(d =>
        d.startsWith(chapter) && fs.statSync(path.join(config.contentDir, d)).isDirectory()
      );
      if (chapterDirs.length > 0) {
        const poolPath = path.join(config.contentDir, chapterDirs[0], 'practice-pool.json');
        if (fs.existsSync(poolPath)) {
          const pool = JSON.parse(fs.readFileSync(poolPath, 'utf-8'));
          (pool.questions || []).forEach((q) => {
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
      }
    }

    // 2) Supplement with subsection-level quiz/test files (for subs with no pool)
    if (results.length < 10) {
      const chaptersData = contentService.getChapters();
      for (const ch of (chaptersData.chapters || [])) {
        if (chapter && ch.chapterId !== chapter) continue;
        for (const s of (ch.sections || [])) {
          for (const secSub of (s.subsections || [])) {
            if (sub && secSub.id !== sub) continue;
            const firstPart = (secSub.parts || [])[0];
            if (!firstPart) continue;
            const unitId = secSub.id + '-part-' + firstPart.id;
            const quiz = quizService.getQuiz(unitId);
            const test = testService.getTest(unitId);
            const subQuestions = [
              ...(quiz?.questions || []),
              ...(test?.questions || []),
            ];
            subQuestions.forEach((q) => {
              if (!seen.has(q.id)) {
                seen.add(q.id);
                results.push({
                  id: q.id,
                  unitId,
                  partTitle: firstPart.title || secSub.title,
                  type: q.type,
                  stem: q.stem,
                  options: q.options,
                  source: quiz?.questions?.some(x => x.id === q.id) ? 'quiz' : 'test',
                  answer: q.answer,
                  blanks: q.blanks,
                  explanation: q.explanation,
                });
              }
            });
          }
        }
      }
    }

    // Strip answer for self-check types (term_explanation, short_answer, essay)
    const safeQuestions = results.map((q) => {
      if (q.type === 'term_explanation' || q.type === 'short_answer' || q.type === 'essay') {
        const { answer, ...rest } = q;
        return { ...rest, answer: '' };
      }
      return q;
    });

    res.json({
      success: true,
      data: { questions: safeQuestions, total: safeQuestions.length },
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    res.status(500).json({ success: false, error: { code: 'PRACTICE_ERROR', message: err.message }, timestamp: new Date().toISOString() });
  }
});

// Submit practice answer — write wrong answers to error_book
router.post('/practice/submit', async (req, res) => {
  try {
    const fs = require('fs');
    const path = require('path');
    const config = require('../config');
    const { unitId, questionId, answer } = req.body;
    await getDB();

    // Find question: first try quiz/test files, then practice-pool.json
    let question = null;
    const quiz = quizService.getQuiz(unitId);
    const test = testService.getTest(unitId);
    if (quiz) question = quiz.questions.find((q) => q.id === questionId);
    if (!question && test) question = test.questions.find((q) => q.id === questionId);

    // Fallback: search practice-pool.json files for the question
    if (!question) {
      const chapterDirs = fs.readdirSync(config.contentDir).filter(d =>
        fs.statSync(path.join(config.contentDir, d)).isDirectory()
      );
      for (const dir of chapterDirs) {
        const poolPath = path.join(config.contentDir, dir, 'practice-pool.json');
        if (fs.existsSync(poolPath)) {
          const pool = JSON.parse(fs.readFileSync(poolPath, 'utf-8'));
          const found = (pool.questions || []).find((q) => q.id === questionId);
          if (found) { question = found; break; }
        }
      }
    }

    if (!question) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: '题目不存在' }, timestamp: new Date().toISOString() });
    }

    let isCorrect = false;

    if (question.type === 'fill_blank') {
      const userBlanks = Array.isArray(answer) ? answer : [answer];
      const correctBlanks = (question.blanks || []).map((b) => b.answer.trim().toLowerCase());
      isCorrect = userBlanks.length === correctBlanks.length &&
        userBlanks.every((a, i) => (a || '').trim().toLowerCase() === correctBlanks[i]);
    } else if (question.type === 'multiple_choice') {
      isCorrect = (answer || '').toString().trim().toUpperCase() === (question.answer || '').toUpperCase();
    } else if (question.type === 'multi_select') {
      const userSel = Array.isArray(answer) ? answer.sort().join(',') : (answer || '').toString();
      const rawAns = (question.answer || '').replace(/\s/g, '');
      const correctLetters = rawAns.includes(',') || rawAns.includes('，')
        ? rawAns.split(/[,，]/).map(s => s.trim()).sort().join(',')
        : rawAns.split('').sort().join(',');
      isCorrect = userSel === correctLetters;
    } else if (question.type === 'true_false') {
      const userBool = answer === 'true' || answer === '✓' || answer === '对';
      isCorrect = userBool === question.answer;
    } else if (question.type === 'term_explanation' || question.type === 'short_answer' || question.type === 'essay') {
      // Self-check types — no auto-judging
    }

    // Record attempt
    const correctAns = question.type === 'fill_blank'
      ? JSON.stringify((question.blanks || []).map((b) => b.answer))
      : JSON.stringify(question.answer || '');
    const userAns = Array.isArray(answer) ? JSON.stringify(answer) : JSON.stringify(answer || '');
    runQuery(
      'INSERT INTO quiz_attempts (user_id, unit_id, question_id, question_type, user_answer, correct_answer, is_correct, score) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [1, unitId, questionId, question.type, userAns, correctAns, isCorrect ? 1 : 0, isCorrect ? 1 : 0]
    );

    // Write wrong answers to error_book
    if (!isCorrect && question.type !== 'term_explanation' && question.type !== 'short_answer' && question.type !== 'essay') {
      const db = await getDB();
      const existing = db.exec(
        `SELECT id FROM error_book WHERE user_id = 1 AND question_id = '${questionId.replace(/'/g, "''")}' AND is_resolved = 0`
      );
      const now = new Date().toISOString();
      if (existing.length === 0 || existing[0].values.length === 0) {
        db.run(
          `INSERT INTO error_book (user_id, unit_id, question_id, question_type, question_stem, user_answer, correct_answer, explanation, mastery_level, next_review_due, created_at)
           VALUES (1, ?, ?, ?, ?, ?, ?, ?, 0, datetime('now'), ?)`,
          [unitId || 'practice', questionId, question.type, question.stem || '',
           userAns, correctAns, question.explanation || '', now]
        );
      } else {
        const rowId = existing[0].values[0][0];
        db.run(
          `UPDATE error_book SET user_answer = ?, mastery_level = MAX(0, mastery_level - 1), next_review_due = datetime('now'), updated_at = datetime('now') WHERE id = ?`,
          [userAns, rowId]
        );
      }
    }

    const selfCheck = question.type === 'term_explanation' || question.type === 'short_answer' || question.type === 'essay';
    const correctAnsStr = question.type === 'fill_blank'
      ? (question.blanks || []).map((b) => b.answer).join('、')
      : question.answer || '';

    res.json({
      success: true,
      data: {
        isCorrect: selfCheck ? null : isCorrect,
        correctAnswer: correctAnsStr,
        selfCheck,
        explanation: question.explanation || '',
      },
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    res.status(500).json({ success: false, error: { code: 'SUBMIT_ERROR', message: err.message }, timestamp: new Date().toISOString() });
  }
});

module.exports = router;
