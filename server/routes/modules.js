const express = require('express');
const router = express.Router();
const contentService = require('../services/contentService');

// Return flat list of all units (for AI plan generation)
router.get('/list', (_req, res) => {
  try {
    const chapters = contentService.getChapters();
    const units = [];

    for (const ch of (chapters.chapters || chapters || [])) {
      for (const sec of (ch.sections || [])) {
        for (const sub of (sec.subsections || [])) {
          for (const part of (sub.parts || [])) {
            const uid = `${sub.id}-part-${part.id}`;
            units.push({
              id: uid,
              title: part.title,
              chapterId: ch.chapterId,
              chapterTitle: ch.title,
              sectionId: sec.id,
              sectionTitle: sec.title,
              subsectionId: sub.id,
              subsectionTitle: sub.title,
              knowledgeId: part.knowledgeId || '',
              importance: part.importance || 50,
              difficulty: part.difficulty || 1,
            });
          }
        }
      }
    }

    res.json({ success: true, data: { units, total: units.length }, timestamp: new Date().toISOString() });
  } catch (err) {
    res.status(500).json({ success: false, error: { code: 'READ_ERROR', message: err.message } });
  }
});

module.exports = router;
