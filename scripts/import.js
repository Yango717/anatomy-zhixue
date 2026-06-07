const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

const CONTENT_DIR = path.join(__dirname, '..', 'content');

// ── Mapping from Excel system names to our chapter IDs ──
const SYSTEM_TO_CHAPTER = {
  '绪论': { id: 'chapter-00', title: '绪论', icon: '📚', order: 0 },
  '骨学': { id: 'chapter-01', title: '运动系统', icon: '🪲', order: 1 },
  '肌学': { id: 'chapter-01', title: '运动系统', icon: '🪲', order: 1 },
  '运动系统': { id: 'chapter-01', title: '运动系统', icon: '🪲', order: 1 },
  '消化系统': { id: 'chapter-02', title: '消化系统', icon: '🍽', order: 2 },
  '呼吸系统': { id: 'chapter-03', title: '呼吸系统', icon: '🫁', order: 3 },
  '泌尿系统': { id: 'chapter-04', title: '泌尿系统', icon: '🫘', order: 4 },
  '生殖系统': { id: 'chapter-05', title: '生殖系统', icon: '💙', order: 5 },
  '心血管系统': { id: 'chapter-06', title: '循环系统', icon: '❤️', order: 6 },
  '脉管系统': { id: 'chapter-06', title: '循环系统', icon: '❤️', order: 6 },
  '感觉器': { id: 'chapter-07', title: '感觉器', icon: '👁', order: 7 },
  '神经系统': { id: 'chapter-08', title: '神经系统', icon: '🧠', order: 8 },
  '内脏神经系统': { id: 'chapter-08', title: '神经系统', icon: '🧠', order: 8 },
  '脑脊膜与血管': { id: 'chapter-08', title: '神经系统', icon: '🧠', order: 8 },
  '内分泌系统': { id: 'chapter-09', title: '内分泌系统', icon: '🥺', order: 9 },
};

// ── Read Excel files ──
const kb = XLSX.readFile('C:/Users/21109/Desktop/解剖学结构化_系统解剖学_知识点数据库_V2.xlsx');
const kbData = XLSX.utils.sheet_to_json(kb.Sheets['知识点数据库']);
const relData = XLSX.utils.sheet_to_json(kb.Sheets['知识点关系表']);

const eb = XLSX.readFile('C:/Users/21109/Desktop/解剖学结构化_系统解剖学_真题数据库.xlsx');
const ebData = XLSX.utils.sheet_to_json(eb.Sheets['真题数据库']);

// ── Build knowledge point index ──
const knowledgeIndex = {};
kbData.forEach((k) => { knowledgeIndex[k['知识点ID']] = k; });

// ── Determine chapter from 章节 field ──
function getChapterInfo(kp) {
  const chapterStr = (kp['章节'] || '').replace(/^第[一二三四五六七八九十\d]+章\s*/, '').trim();
  // Try to match chapter by the chapter name first
  for (const [sysKey, info] of Object.entries(SYSTEM_TO_CHAPTER)) {
    if (chapterStr === sysKey || chapterStr.includes(sysKey) || sysKey.includes(chapterStr)) {
      return info;
    }
  }
  // Fallback: match by 系统
  const sys = kp['系统'];
  return SYSTEM_TO_CHAPTER[sys] || SYSTEM_TO_CHAPTER['绪论'];
}

// Group: chapter -> 系统(section) -> subsection(L2知识点名) -> [points]
const structure = {};

kbData.forEach((kp) => {
  const chInfo = getChapterInfo(kp);
  if (!chInfo) { console.warn('Unknown:', kp['章节'], kp['系统']); return; }

  const chKey = chInfo.id;
  // Section = 系统 name
  const sectionKey = kp['系统'];
  // Subsection = L2 knowledge point name (L3 points are grouped)
  const level = kp['层级'] || 'L2';
  const subKey = level === 'L2' ? kp['知识点名称'] : '要点详解';

  if (!structure[chKey]) structure[chKey] = {};
  if (!structure[chKey][sectionKey]) structure[chKey][sectionKey] = {};
  if (!structure[chKey][sectionKey][subKey]) structure[chKey][sectionKey][subKey] = [];
  structure[chKey][sectionKey][subKey].push(kp);
});

// ── Clean old content ──
console.log('Cleaning old content...');
const chapterDirs = fs.readdirSync(CONTENT_DIR).filter(d => d.startsWith('chapter-') && fs.statSync(path.join(CONTENT_DIR, d)).isDirectory());
chapterDirs.forEach(d => {
  fs.rmSync(path.join(CONTENT_DIR, d), { recursive: true, force: true });
});
console.log('Building content structure...');

// Build new chapters.json
const chaptersData = { app: { name: '解剖智学', subtitle: '背解剖，不该只是死记硬背' }, chapters: [] };
const chapterOrder = Object.entries(structure).sort((a, b) => {
  const infoA = Object.values(SYSTEM_TO_CHAPTER).find(c => c.id === a[0]);
  const infoB = Object.values(SYSTEM_TO_CHAPTER).find(c => c.id === b[0]);
  return (infoA?.order || 99) - (infoB?.order || 99);
});

let sectionCounter = 0;

chapterOrder.forEach(([chKey, sections]) => {
  const chInfo = Object.values(SYSTEM_TO_CHAPTER).find(c => c.id === chKey) || {};
  const chMeta = { chapterId: chKey, title: chInfo.title || chKey, icon: chInfo.icon || '📖', sections: [] };
  const chDir = `${chKey}-${chInfo.title || chKey}`;

  // Create chapter directory
  fs.mkdirSync(path.join(CONTENT_DIR, chDir), { recursive: true });

  Object.entries(sections).forEach(([sectionName, subsections]) => {
    sectionCounter++;
    const secId = `section-${String(sectionCounter).padStart(2, '0')}`;
    const secMeta = { id: secId, title: sectionName, order: sectionCounter, subsections: [] };

    Object.entries(subsections).forEach(([subName, points], subIdx) => {
      const subId = `sub-${secId.replace('section-', '')}-${String(subIdx + 1).padStart(2, '0')}`;
      const subDirName = `${subId}-${sanitize(subName)}`;
      const secDirName = `${secId}-${sanitize(sectionName)}`;
      const subDir = path.join(CONTENT_DIR, chDir, secDirName, subDirName);
      fs.mkdirSync(subDir, { recursive: true });

      // Parts: group L3 points as parts
      const l2Points = points.filter(p => p['层级'] === 'L2');
      const l3Points = points.filter(p => p['层级'] === 'L3');

      const parts = [];
      // Each L2 point becomes a part
      l2Points.forEach((p, pi) => {
        parts.push({
          id: sanitize(p['知识点名称']),
          title: p['知识点名称'],
          knowledgeId: p['知识点ID'],
          importance: p['考试重要性'] || 0,
          difficulty: p['难度'] || 1,
          canTest: p['可出题性'] || '中',
          freqLevel: p['频率等级'] || 'B',
        });
      });
      // Group L3 points under their parent or as separate parts
      if (l3Points.length > 0) {
        parts.push({
          id: sanitize('要点'),
          title: '要点',
          knowledgeId: l3Points[0]['知识点ID'],
          importance: Math.max(...l3Points.map(p => p['考试重要性'] || 0)),
          difficulty: Math.round(l3Points.reduce((s, p) => s + (p['难度'] || 1), 0) / l3Points.length),
        });
      }

      secMeta.subsections.push({ id: subId, title: subName, order: subIdx + 1, parts });

      // ── Generate content.md ──
      let md = `# ${subName}\n\n`;
      points.forEach((p) => {
        md += `## ${p['知识点名称']}\n\n`;
        if (p['定义']) md += `${p['定义']}\n\n`;
        if (p['临床意义']) md += `### 临床意义\n${p['临床意义']}\n\n`;
        if (p['高频考点']) md += `### 高频考点\n${p['高频考点'].split('\n').map(l => `- ${l.trim()}`).join('\n')}\n\n`;
        md += `> **ID**: ${p['知识点ID']} | **考试重要性**: ${p['考试重要性']} | **难度**: ${p['难度']} | **频率**: ${p['频率等级']}\n\n`;
      });
      fs.writeFileSync(path.join(subDir, 'content.md'), md);

      // ── Generate meta.json ──
      fs.writeFileSync(path.join(subDir, 'meta.json'), JSON.stringify({
        subId, title: subName, knowledgeCount: points.length, parts,
      }));

      // ── Find exam questions for these knowledge points (PRECISE ID MATCH ONLY) ──
      const knowledgeIds = new Set(points.map(p => p['知识点ID']));
      const relatedQuestions = ebData.filter(q => {
        const qKb = (q['关联知识点'] || '').split(/[,，、\s]+/).map(s => s.trim()).filter(Boolean);
        return qKb.some(id => knowledgeIds.has(id));
      });

      // ── Generate quiz.json (Phase 2: 填空题) ──
      const fillBlanks = relatedQuestions.filter(q => q['题型'] === '填空题');
      if (fillBlanks.length > 0) {
        const quizQuestions = fillBlanks.map((q) => ({
          id: q['题目ID'],
          type: 'fill_blank',
          stem: parseFillBlank(q['题目'], q['答案']),
          blanks: parseBlanks(q['答案']),
          relatedContent: q['考试重点'] || '',
          difficulty: q['难度'] || 1,
          freqLevel: q['频率等级'],
          errorTags: (q['错因标签'] || '').split('\n'),
          examId: q['题目ID'],
        }));
        fs.writeFileSync(path.join(subDir, 'quiz.json'), JSON.stringify({
          unitId: `${subId}-part-${parts[0]?.id}`,
          phase: 2,
          questions: quizQuestions,
        }, null, 2));
      }

      // ── Generate test.json (Phase 4: 单选/多选/名词解释) ──
      const testTypes = relatedQuestions.filter(q => ['单选题', '多选题', '名词解释'].includes(q['题型']));
      if (testTypes.length > 0) {
        const testQuestions = testTypes.map((q) => ({
          id: q['题目ID'],
          type: q['题型'] === '单选题' ? 'multiple_choice' :
                 q['题型'] === '多选题' ? 'multi_select' : 'term_explanation',
          stem: q['题目'],
          options: parseOptions(q['选项'], q['答案']),
          answer: q['答案'],
          explanation: q['解析'] || '',
          difficulty: q['难度'] || 1,
          freqLevel: q['频率等级'],
          keyPoints: q['考试重点'] || '',
          errorTags: (q['错因标签'] || '').split('\n'),
          examId: q['题目ID'],
        }));
        fs.writeFileSync(path.join(subDir, 'test.json'), JSON.stringify({
          unitId: `${subId}-part-${parts[0]?.id}`,
          phase: 4,
          questions: testQuestions,
        }, null, 2));
      }

      // ── Generate finalexam.json (Phase 5: from 高难度/重点题) ──
      const examQuestions = relatedQuestions.filter(q =>
        (q['频率等级'] === 'A' || q['考试重点']?.length > 10) && q['难度'] >= 2
      );
      if (examQuestions.length > 0) {
        const feQuestions = examQuestions.slice(0, 10).map((q) => ({
          id: q['题目ID'],
          type: q['题型'] === '单选题' ? 'multiple_choice' :
                 q['题型'] === '多选题' ? 'multi_select' : 'true_false',
          stem: q['题目'],
          options: parseOptions(q['选项'], q['答案']),
          answer: q['答案'],
          explanation: q['解析'] || '',
          examId: q['题目ID'],
        }));
        fs.writeFileSync(path.join(subDir, 'finalexam.json'), JSON.stringify({
          unitId: `${subId}-part-${parts[0]?.id}`,
          phase: 5,
          source: '真题汇编',
          questions: feQuestions,
        }, null, 2));
      }
    });
    chMeta.sections.push(secMeta);
  });
  chaptersData.chapters.push(chMeta);

  // Write chapter meta.json
  fs.writeFileSync(path.join(CONTENT_DIR, chDir, 'meta.json'), JSON.stringify(chMeta, null, 2));

  // Write chapter-level practice pool (system-level matching for practice API)
  const poolQuestions = ebData.filter(q => {
    const examSys = q['系统'];
    const examCh = SYSTEM_TO_CHAPTER[examSys];
    return examCh && examCh.id === chKey;
  });
  if (poolQuestions.length > 0) {
    const pool = poolQuestions.map(q => ({
      id: q['题目ID'],
      type: q['题型'] === '单选题' ? 'multiple_choice' :
             q['题型'] === '多选题' ? 'multi_select' :
             q['题型'] === '填空题' ? 'fill_blank' :
             q['题型'] === '名词解释' ? 'term_explanation' : 'fill_blank',
      stem: q['题目'],
      options: parseOptions(q['选项'], q['答案']),
      answer: q['答案'],
      blanks: q['题型'] === '填空题' ? parseBlanks(q['答案']) : undefined,
      explanation: q['解析'] || '',
      difficulty: q['难度'] || 1,
      freqLevel: q['频率等级'],
      keyPoints: q['考试重点'] || '',
      errorTags: (q['错因标签'] || '').split('\n'),
      examId: q['题目ID'],
    }));
    fs.writeFileSync(path.join(CONTENT_DIR, chDir, 'practice-pool.json'), JSON.stringify({ chapterId: chKey, questions: pool }, null, 2));
  }
});

// ── Write updated chapters.json ──
fs.writeFileSync(path.join(CONTENT_DIR, 'chapters.json'), JSON.stringify(chaptersData));

// ── Helper functions ──
function sanitize(name) {
  return (name || '未命名').replace(/[\/\\?%*:|"<>\s]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').substring(0, 50);
}

function parseFillBlank(stem, answer) {
  // Replace answer parts with ___
  const answers = (answer || '').split(/[,，、]/).map(s => s.trim());
  let result = stem;
  // Already has ___ in the stem? Keep them
  if (!result.includes('___') && !result.includes('____')) {
    // Replace long spaces or brackets with blanks
    result = result.replace(/_{2,}/g, '___').replace(/（\s*）/g, '___').replace(/\(\s*\)/g, '___');
    if (!result.includes('___')) {
      // If no blanks found, append blanks at end
      result += ' ' + answers.map(() => '___').join('、');
    }
  }
  return result;
}

function parseBlanks(answer) {
  return (answer || '').split(/[,，、]/).map((a, i) => ({
    index: i,
    answer: a.trim(),
    hint: '',
  }));
}

function parseOptions(optionsStr, answer) {
  if (!optionsStr) return null;
  // Split by newlines to get individual options like "A.xxx", "B.xxx"
  const lines = optionsStr.split(/[\r\n]+/).map(s => s.trim()).filter(Boolean);
  if (lines.length >= 2) {
    return lines.map((line, i) => {
      // Match A. A． A) A、 A B. B． ... etc (half-width and full-width dots)
      const match = line.match(/^([A-E])\s*[.．、)）\s]\s*(.*)/);
      if (match) return { key: match[1], text: match[2] };
      // Also handle "B,顶骨" → the comma comes from mangled multi-line
      const loose = line.match(/^([A-E])\s*[,，、．.)）]?\s*(.*)/);
      if (loose) return { key: loose[1], text: loose[2] };
      return { key: String.fromCharCode(65 + i), text: line };
    });
  }
  // Fallback: comma-separated
  const parts = optionsStr.split(/[,，]\s*/);
  return parts.map((p, i) => ({ key: String.fromCharCode(65 + i), text: p.trim() }));
}

console.log('\n✅ Import complete!');
console.log(`   Chapters: ${chaptersData.chapters.length}`);
console.log(`   Knowledge points: ${kbData.length}`);
console.log(`   Exam questions: ${ebData.length}`);
console.log(`   Relations: ${relData.length}`);
