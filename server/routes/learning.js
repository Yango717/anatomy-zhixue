const express = require('express');
const router = express.Router();
const { getDB, get: getOne, run: runQuery, all } = require('../db/database');

// Get current phase for a unit
router.get('/progress/unit/:unitId', async (req, res) => {
  try {
    await getDB();
    const row = getOne(
      'SELECT * FROM unit_progress WHERE user_id = 1 AND unit_id = ?',
      [req.params.unitId]
    );
    res.json({
      success: true,
      data: row ? { currentPhase: row.current_phase || 0 } : { currentPhase: 0 },
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    res.status(500).json({ success: false, error: { code: 'DB_ERROR', message: err.message }, timestamp: new Date().toISOString() });
  }
});

// Mark a phase as complete
router.post('/progress/unit/:unitId/phase/:phaseNum/complete', async (req, res) => {
  try {
    await getDB();
    const { unitId, phaseNum } = req.params;
    const phase = parseInt(phaseNum, 10);

    // Check if record exists
    const existing = getOne(
      'SELECT id FROM unit_progress WHERE user_id = 1 AND unit_id = ?',
      [unitId]
    );

    if (existing) {
      runQuery(
        `UPDATE unit_progress SET current_phase = ?, phase_${phase}_completed_at = datetime('now'),
         last_accessed_at = datetime('now') WHERE user_id = 1 AND unit_id = ?`,
        [phase, unitId]
      );
    } else {
      runQuery(
        `INSERT INTO unit_progress (user_id, unit_id, current_phase, phase_${phase}_completed_at)
         VALUES (1, ?, ?, datetime('now'))`,
        [unitId, phase]
      );
    }

    res.json({
      success: true,
      data: { unitId, completedPhase: phase },
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    res.status(500).json({ success: false, error: { code: 'DB_ERROR', message: err.message }, timestamp: new Date().toISOString() });
  }
});

// Mark unit learning as complete (binary: 0=not started, 1=completed)
router.post('/progress/unit/:unitId/complete', async (req, res) => {
  try {
    await getDB();
    const { unitId } = req.params;
    const existing = getOne(
      'SELECT id FROM unit_progress WHERE user_id = 1 AND unit_id = ?',
      [unitId]
    );
    if (existing) {
      runQuery(
        `UPDATE unit_progress SET current_phase = 1, last_accessed_at = datetime('now') WHERE user_id = 1 AND unit_id = ?`,
        [unitId]
      );
    } else {
      runQuery(
        `INSERT INTO unit_progress (user_id, unit_id, current_phase, last_accessed_at) VALUES (1, ?, 1, datetime('now'))`,
        [unitId]
      );
    }
    res.json({ success: true, data: { unitId, completed: true }, timestamp: new Date().toISOString() });
  } catch (err) {
    res.status(500).json({ success: false, error: { code: 'DB_ERROR', message: err.message }, timestamp: new Date().toISOString() });
  }
});

// Notes CRUD
router.get('/notes/:unitId', async (req, res) => {
  try {
    await getDB();
    const notes = all("SELECT * FROM user_notes WHERE user_id = 1 AND unit_id = ? ORDER BY updated_at DESC", [req.params.unitId]);
    res.json({ success: true, data: notes, timestamp: new Date().toISOString() });
  } catch (err) {
    res.status(500).json({ success: false, error: { code: 'DB_ERROR', message: err.message }, timestamp: new Date().toISOString() });
  }
});

router.post('/notes/:unitId', async (req, res) => {
  try {
    await getDB();
    runQuery("INSERT INTO user_notes (user_id, unit_id, note_text) VALUES (1, ?, ?)", [req.params.unitId, req.body.text || '']);
    res.json({ success: true, data: { created: true }, timestamp: new Date().toISOString() });
  } catch (err) {
    res.status(500).json({ success: false, error: { code: 'DB_ERROR', message: err.message }, timestamp: new Date().toISOString() });
  }
});

router.delete('/notes/:noteId', async (req, res) => {
  try {
    await getDB();
    runQuery("DELETE FROM user_notes WHERE id = ? AND user_id = 1", [req.params.noteId]);
    res.json({ success: true, data: { deleted: true }, timestamp: new Date().toISOString() });
  } catch (err) {
    res.status(500).json({ success: false, error: { code: 'DB_ERROR', message: err.message }, timestamp: new Date().toISOString() });
  }
});

module.exports = router;
