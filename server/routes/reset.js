const express = require('express');
const router = express.Router();
const { getDB, run: runQuery } = require('../db/database');

router.post('/learning-data', async (_req, res) => {
  try {
    await getDB();
    const tables = [
      'unit_progress', 'quiz_attempts', 'test_attempts',
      'final_exam_attempts', 'error_book', 'weak_points',
      'review_sessions',
    ];
    for (const table of tables) {
      try { runQuery(`DELETE FROM ${table}`); } catch {}
    }
    res.json({ success: true, data: { message: '所有学习数据已重置' } });
  } catch (err) {
    res.status(500).json({ success: false, error: { code: 'DB_ERROR', message: err.message } });
  }
});

module.exports = router;
