// Browser-side content service — replaces fs.readFileSync with fetch
let chaptersCache = null;
let chaptersPromise = null;
let pathIndex = null;

async function loadChapters() {
  if (chaptersCache) return chaptersCache;
  if (chaptersPromise) return chaptersPromise;

  chaptersPromise = (async () => {
    const resp = await fetch('/content/chapters.json');
    if (!resp.ok) throw new Error('Failed to load chapters.json');
    const data = await resp.json();
    chaptersCache = data;
    pathIndex = new Map();
    for (const ch of data.chapters) {
      const cd = `${ch.chapterId}-${ch.title}`;
      for (const sec of ch.sections) {
        const sd = `${sec.id}-${sec.title}`;
        for (const sub of sec.subsections) {
          const subd = `${sub.id}-${sub.title}`;
          pathIndex.set(sub.id, { cd, sd, subd, parts: sub.parts, chapterId: ch.chapterId, sectionId: sec.id });
        }
      }
    }
    return data;
  })();
  return chaptersPromise;
}

function unitPrefix(unitId) { return (unitId || '').replace(/-part-.*$/, ''); }

function getContentPath(subId, filename) {
  const e = pathIndex?.get(subId);
  if (!e) return null;
  // encodeURI 对中文路径编码，确保 Cloudflare 等静态托管能正确 fetch
  return encodeURI(`/content/${e.cd}/${e.sd}/${e.subd}/${filename}`);
}

function resolveChapterDir(chapterId) {
  if (!chaptersCache) return null;
  const ch = chaptersCache.chapters.find(c => c.chapterId === chapterId);
  return ch ? encodeURI(`${chapterId}-${ch.title}`) : null;
}

// --- Public API ---

export async function getChapters() {
  const data = await loadChapters();
  return { chapters: data.chapters };
}

export async function getChapter(chapterId) {
  const data = await loadChapters();
  return data.chapters.find(c => c.chapterId === chapterId) || null;
}

export async function getChapterMeta(chapterId) {
  const dir = resolveChapterDir(chapterId);
  if (!dir) return null;
  const resp = await fetch(`/content/${dir}/meta.json`);
  return resp.ok ? resp.json() : null;
}

export async function getUnitContent(unitId) {
  await loadChapters();
  const path = getContentPath(unitPrefix(unitId), 'content.md');
  if (!path) return null;
  const resp = await fetch(path);
  return resp.ok ? { content: await resp.text() } : null;
}

export async function fetchJSON(subId, filename) {
  await loadChapters();
  const path = getContentPath(subId, filename);
  if (!path) return null;
  const resp = await fetch(path);
  return resp.ok ? resp.json() : null;
}

export function buildUnitPath(unitId) {
  if (!chaptersCache || !pathIndex) return '';
  const subId = unitPrefix(unitId);
  const e = pathIndex.get(subId);
  if (!e) return '';
  const ch = chaptersCache.chapters.find(c => c.chapterId === e.chapterId);
  const sec = ch?.sections.find(s => s.id === e.sectionId);
  const sub = sec?.subsections.find(s => s.id === subId);
  return [ch?.title, sec?.title, sub?.title].filter(Boolean).join(' > ');
}

export async function search(query) {
  const data = await loadChapters();
  const q = query.toLowerCase();
  const results = [];
  for (const ch of data.chapters) {
    for (const sec of ch.sections) {
      for (const sub of sec.subsections) {
        const path = getContentPath(sub.id, 'content.md');
        if (!path) continue;
        try {
          const resp = await fetch(path);
          if (!resp.ok) continue;
          const lines = (await resp.text()).split('\n');
          const matches = lines.filter(l => l.toLowerCase().includes(q));
          if (matches.length) {
            const heading = lines.find(l => l.startsWith('#'))?.replace(/^#+ /, '') || sub.title;
            results.push({ unitId: sub.id, title: sub.title, heading, snippets: matches.slice(0, 3).map(l => l.trim()) });
          }
        } catch {}
      }
    }
    if (results.length >= 20) break;
  }
  return results.slice(0, 20);
}

export async function getPracticePool(chapterId) {
  const dir = resolveChapterDir(chapterId);
  if (!dir) return { questions: [] };
  const resp = await fetch(`/content/${dir}/practice-pool.json`);
  return resp.ok ? resp.json() : { questions: [] };
}

export async function getAllPracticePools() {
  const data = await loadChapters();
  const pools = [];
  for (const ch of data.chapters) {
    const pool = await getPracticePool(ch.chapterId);
    if (pool.questions?.length) pools.push(pool);
  }
  return pools;
}

export async function resolveUnitAsset(unitId, relativePath) {
  await loadChapters();
  const subId = unitPrefix(unitId);
  const dir = getContentPath(subId, 'dummy');
  if (!dir) return relativePath;
  const baseDir = dir.replace(/\/dummy$/, '');
  // dir already encodeURI'd by getContentPath, only encode the relativePath part
  return `${baseDir}/${encodeURIComponent(relativePath)}`;
}

export async function getUnitFlashcards(unitId) {
  await loadChapters();
  const subId = unitPrefix(unitId);
  const path = getContentPath(subId, 'flashcards.json');
  if (!path) return null;
  const resp = await fetch(path);
  if (!resp.ok) return null;
  return resp.json();
}

export { loadChapters, pathIndex, chaptersCache };
