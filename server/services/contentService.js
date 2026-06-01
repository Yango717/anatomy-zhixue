const fs = require('fs');
const path = require('path');
const config = require('../config');
const { findInChapters } = require('./fileUtils');

function getChapters() {
  const filePath = path.join(config.contentDir, 'chapters.json');
  if (!fs.existsSync(filePath)) return { chapters: [] };
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

function getChapter(chapterId) {
  return getChapters().chapters.find((c) => c.chapterId === chapterId) || null;
}

function getChapterMeta(chapterId) {
  const dirs = fs.readdirSync(config.contentDir).filter((d) =>
    d.startsWith(chapterId) && fs.statSync(path.join(config.contentDir, d)).isDirectory()
  );
  if (dirs.length === 0) return null;
  const metaPath = path.join(config.contentDir, dirs[0], 'meta.json');
  if (!fs.existsSync(metaPath)) return null;
  return JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
}

function countUnits(chapterData) {
  let total = 0;
  for (const section of chapterData.sections || []) {
    for (const sub of section.subsections || []) {
      total += (sub.parts || []).length;
    }
  }
  return total;
}

// Find content.md for a given unitId (format: "sub-XX-XX-XX-part-XXXX")
function getUnitContent(unitId) {
  const subPrefix = unitId.replace(/-part-.*/, '');
  const raw = findInChapters(config.contentDir, 'content.md', subPrefix);
  return raw ? { content: raw, path: '' } : null;
}

// Find flashcards.json for a given unitId, return null if not found
function getUnitFlashcards(unitId) {
  const subPrefix = unitId.replace(/-part-.*/, '');
  try {
    const raw = findInChapters(config.contentDir, 'flashcards.json', subPrefix);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

module.exports = { getChapters, getChapter, getChapterMeta, countUnits, getUnitContent, getUnitFlashcards };
