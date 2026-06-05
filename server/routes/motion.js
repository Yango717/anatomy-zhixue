const fs = require("fs");
const path = require("path");
const express = require("express");
const router = express.Router();
const config = require("../config");

function getChapterDir(chapterId) {
  // Look up chapter directory name from chapters.json
  try {
    const chaptersPath = path.join(config.contentDir, "chapters.json");
    const chapters = JSON.parse(fs.readFileSync(chaptersPath, "utf-8"));
    const ch = (chapters.chapters || chapters).find(c => c.chapterId === chapterId);
    if (ch) return path.join(config.contentDir, chapterId + "-" + ch.title);
  } catch {}
  // Fallback: try chapter-01/02 pattern
  return path.join(config.contentDir, chapterId);
}

function loadJson(chapterDir, filename) {
  const fp = path.join(chapterDir, filename);
  if (!fs.existsSync(fp)) return null;
  try { return JSON.parse(fs.readFileSync(fp, "utf-8")); } catch { return null; }
}

// GET /api/v1/motion/knowledge-cards?chapter=chapter-01&section=骨学&subsection=颅骨
router.get("/knowledge-cards", (req, res) => {
  try {
    const chapterId = req.query.chapter || "chapter-01";
    const chapterDir = getChapterDir(chapterId);
    let cards = loadJson(chapterDir, "knowledge_cards.json");
    if (!cards) return res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "知识闪卡数据未找到" } });
    const { section, subsection } = req.query;
    if (section) cards = cards.filter(c => c.section === section);
    if (subsection) cards = cards.filter(c => c.subsection === subsection);
    res.json({ success: true, data: cards });
  } catch (err) {
    res.status(500).json({ success: false, error: { code: "READ_ERROR", message: err.message } });
  }
});

// GET /api/v1/motion/atlas-cards?chapter=chapter-01&section=骨学
router.get("/atlas-cards", (req, res) => {
  try {
    const chapterId = req.query.chapter || "chapter-01";
    const chapterDir = getChapterDir(chapterId);
    let cards = loadJson(chapterDir, "atlas_cards.json");
    if (!cards) return res.status(404).json({ success: false, error: { code: "NOT_FOUND" } });
    const section = req.query.section;
    if (section) cards = cards.filter(c => c.section === section);
    res.json({ success: true, data: cards });
  } catch (err) {
    res.status(500).json({ success: false, error: { code: "READ_ERROR", message: err.message } });
  }
});

// GET /api/v1/motion/question-card-map?chapter=chapter-01
router.get("/question-card-map", (req, res) => {
  try {
    const chapterId = req.query.chapter || "chapter-01";
    const chapterDir = getChapterDir(chapterId);
    const data = loadJson(chapterDir, "question_card_map.json");
    if (!data) return res.status(404).json({ success: false, error: { code: "NOT_FOUND" } });
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: { code: "READ_ERROR", message: err.message } });
  }
});

// POST /api/v1/motion/error-card-refs  { chapter, errors: [{ q_type, q_num }, ...] }
router.post("/error-card-refs", (req, res) => {
  try {
    const { errors, chapter } = req.body;
    if (!Array.isArray(errors)) return res.status(400).json({ success: false, error: { code: "INVALID" } });
    const chapterId = chapter || "chapter-01";
    const chapterDir = getChapterDir(chapterId);

    const cardMap = loadJson(chapterDir, "question_card_map.json") || [];
    const allKnowledge = loadJson(chapterDir, "knowledge_cards.json") || [];
    const allAtlas = loadJson(chapterDir, "atlas_cards.json") || [];

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

    res.json({ success: true, data: { knowledgeCards, atlasCards } });
  } catch (err) {
    res.status(500).json({ success: false, error: { code: "READ_ERROR", message: err.message } });
  }
});

// GET /api/v1/motion/practice-pool?chapter=chapter-01
router.get("/practice-pool", (req, res) => {
  try {
    const chapterId = req.query.chapter || "chapter-01";
    const chapterDir = getChapterDir(chapterId);
    const data = loadJson(chapterDir, "practice-pool.json");
    if (!data) return res.status(404).json({ success: false, error: { code: "NOT_FOUND" } });
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: { code: "READ_ERROR", message: err.message } });
  }
});

module.exports = router;