const fs = require('fs');
const path = require('path');
const express = require('express');
const router = express.Router();
const config = require('../config');
const contentService = require('../services/contentService');

router.get('/chapters', (_req, res) => {
  try {
    const data = contentService.getChapters();
    res.json({ success: true, data, timestamp: new Date().toISOString() });
  } catch (err) {
    res.status(500).json({ success: false, error: { code: 'READ_ERROR', message: err.message }, timestamp: new Date().toISOString() });
  }
});

router.get('/chapters/:chapterId', (req, res) => {
  try {
    const chapter = contentService.getChapter(req.params.chapterId);
    if (!chapter) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: '模块不存在' }, timestamp: new Date().toISOString() });
    }
    res.json({ success: true, data: chapter, timestamp: new Date().toISOString() });
  } catch (err) {
    res.status(500).json({ success: false, error: { code: 'READ_ERROR', message: err.message }, timestamp: new Date().toISOString() });
  }
});

router.get('/chapters/:chapterId/sections', (req, res) => {
  try {
    const meta = contentService.getChapterMeta(req.params.chapterId);
    if (!meta) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: '模块元数据不存在' }, timestamp: new Date().toISOString() });
    }
    res.json({ success: true, data: meta, timestamp: new Date().toISOString() });
  } catch (err) {
    res.status(500).json({ success: false, error: { code: 'READ_ERROR', message: err.message }, timestamp: new Date().toISOString() });
  }
});

// Get learning content (markdown) for a specific unit
router.get('/units/:unitId/content', (req, res) => {
  try {
    const result = contentService.getUnitContent(req.params.unitId);
    if (!result) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: '该单元暂无学习内容' }, timestamp: new Date().toISOString() });
    }
    res.json({ success: true, data: { content: result.content }, timestamp: new Date().toISOString() });
  } catch (err) {
    res.status(500).json({ success: false, error: { code: 'READ_ERROR', message: err.message }, timestamp: new Date().toISOString() });
  }
});

// Get flashcards data for a specific unit
router.get('/units/:unitId/flashcards', (req, res) => {
  try {
    const data = contentService.getUnitFlashcards(req.params.unitId);
    res.json({ success: true, data, timestamp: new Date().toISOString() });
  } catch (err) {
    res.status(500).json({ success: false, error: { code: 'READ_ERROR', message: err.message }, timestamp: new Date().toISOString() });
  }
});

// Search across all content.md files
router.get('/search', (req, res) => {
  try {
    const q = (req.query.q || '').toLowerCase();
    if (!q || q.length < 2) {
      return res.json({ success: true, data: { results: [], query: q }, timestamp: new Date().toISOString() });
    }

    const results = [];
    const { getChapters } = require('../services/contentService');
    const chaptersData = getChapters();

    function walk(dir, context) {
      if (!fs.existsSync(dir)) return;
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fp = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          walk(fp, context);
        } else if (entry.name === 'content.md') {
          const raw = fs.readFileSync(fp, 'utf-8');
          // Extract headings and matched snippets
          const headings = [];
          const lines = raw.split('\n');
          let matchedLines = [];
          for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            if (line.startsWith('## ')) headings.push(line.replace('## ', '').trim());
            if (line.toLowerCase().includes(q)) {
              matchedLines.push({ lineNum: i + 1, text: line.trim().substring(0, 120) });
            }
          }
          if (matchedLines.length > 0) {
            results.push({
              filePath: fp.replace(config.contentDir, ''),
              headings: headings.slice(0, 3),
              matches: matchedLines.slice(0, 5),
              matchCount: matchedLines.length,
            });
          }
        }
      }
    }

    if (fs.existsSync(config.contentDir)) {
      walk(config.contentDir, {});
    }

    res.json({ success: true, data: { results: results.slice(0, 20), query: q }, timestamp: new Date().toISOString() });
  } catch (err) {
    res.status(500).json({ success: false, error: { code: 'SEARCH_ERROR', message: err.message }, timestamp: new Date().toISOString() });
  }
});

module.exports = router;
