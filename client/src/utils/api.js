const API_BASE = '/api/v1';

// ---- fetch-mode (when Express backend is available) ----
async function fetchRequest(path, options = {}) {
  const url = `${API_BASE}${path}`;
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });
  const json = await res.json();
  if (!res.ok || !json.success) {
    throw json.error || { code: 'UNKNOWN_ERROR', message: '请求失败' };
  }
  return json.data;
}

// ---- local-mode (when running static, no server) ----
let _backend = null;
let _backendLoadError = null;

async function getBackend() {
  if (_backend) return _backend;
  if (_backendLoadError) throw _backendLoadError;
  try {
    _backend = await import('../backend/index');
    return _backend;
  } catch (e) {
    _backendLoadError = e;
    throw e;
  }
}

function parseLocalPath(path) {
  const p = path.startsWith(API_BASE) ? path.slice(API_BASE.length) : path;
  const qIdx = p.indexOf('?');
  return (qIdx >= 0 ? p.slice(0, qIdx) : p).split('/').filter(Boolean);
}

async function localDispatch(method, s, body, rawPath) {
  const b = await getBackend();

  if (s[0] === 'health') return { status: 'ok' };
  if (s[0] === 'chapters' && s.length === 1) return b.getChapters();
  if (s[0] === 'chapters' && s.length === 2) return b.getChapter(s[1]);
  if (s[0] === 'chapters' && s[2] === 'sections') return b.getChapterSections(s[1]);
  if (s[0] === 'units' && s[2] === 'content') return b.getUnitContent(s[1]);
  if (s[0] === 'units' && s[2] === 'flashcards') return b.getUnitFlashcards(s[1]);
  if (s[0] === 'units' && s[2] === 'quiz' && s.length === 3) return b.getQuiz(s[1]);
  if (s[0] === 'units' && s[3] === 'submit' && s[2] === 'quiz') return b.submitQuiz(s[1], body.answers);
  if (s[0] === 'units' && s[3] === 'generate') return b.generateReview(s[1]);
  if (s[0] === 'units' && s[3] === 'complete') return b.completeReview(s[1]);
  if (s[0] === 'units' && s[2] === 'test' && s.length === 3) return b.getTest(s[1]);
  if (s[0] === 'units' && s[3] === 'submit' && s[2] === 'test') return b.submitTest(s[1], body.answers);
  if (s[0] === 'units' && s[2] === 'finalexam' && s.length === 3) return b.getFinalExam(s[1]);
  if (s[0] === 'units' && s[3] === 'submit' && s[2] === 'finalexam') return b.submitFinalExam(s[1], body.answers);
  if (s[0] === 'progress' && s[1] === 'overview') return b.getProgressOverview();
  if (s[0] === 'progress' && s[1] === 'chapter') return b.getChapterProgress(s[2]);
  if (s[0] === 'learning' && s[1] === 'progress' && s[2] === 'unit' && s.length === 4) return b.getUnitProgress(s[3]);
  if (s[0] === 'learning' && s[1] === 'progress' && s[4] === 'phase') return b.completePhase(s[3], s[5]);
  if (s[0] === 'learning' && s[1] === 'progress' && s[4] === 'complete') return b.markUnitComplete(s[3]);
  if (s[0] === 'learning' && s[1] === 'notes' && s.length === 3 && method === 'GET') return b.getNotes(s[2]);
  if (s[0] === 'learning' && s[1] === 'notes' && s.length === 3 && method === 'POST') return b.createNote(s[2], body.text);
  if (s[0] === 'learning' && s[1] === 'notes' && s.length === 3 && method === 'DELETE') return b.deleteNote(s[2]);
  if (s[0] === 'practice' && s[1] === 'questions') { const u = new URL(rawPath, 'http://x'); return b.getPracticeQuestions(u.searchParams.get('chapter'), u.searchParams.get('sub')); }
  if (s[0] === 'practice' && s[1] === 'submit') return b.submitPractice(body.unitId, body.questionId, body.questionType, body.answer);
  if (s[0] === 'errorbook' && s.length === 1) return b.getErrorBook();
  if (s[0] === 'errorbook' && s[1] === 'due') return b.getErrorBookDue();
  if (s[0] === 'errorbook' && s[1] === 'stats') return b.getErrorBookStats();
  if (s[0] === 'errorbook' && s[2] === 'mastery') return b.updateErrorMastery(parseInt(s[1]), body.masteryLevel);
  if (s[0] === 'errorbook' && s[2] === 'resolve') return b.resolveError(parseInt(s[1]));
  if (s[0] === 'recommend') return b.getRecommend();
  if (s[0] === 'countdown' && s.length === 1 && method === 'GET') return b.getCountdown();
  if (s[0] === 'countdown' && s.length === 1 && method === 'PUT') return b.updateCountdown(body.name, body.target);
  if (s[0] === 'search') { const u = new URL(rawPath, 'http://x'); return b.search(u.searchParams.get('q') || ''); }

  // AI routes — call DeepSeek API directly from browser
  if (s[0] === 'ai' && s[1] === 'chat') return b.aiChat(body.apiKey, body.unitId, body.scene, body.messages, body.currentPage, body.userProfile);
  if (s[0] === 'ai' && s[1] === 'generate-quiz') return b.aiGenerateQuiz(body.apiKey, body.unitId, body.count);
  if (s[0] === 'ai' && s[1] === 'review-report') return b.aiReviewReport(body.apiKey, body.unitId);
  if (s[0] === 'ai' && s[1] === 'today-recommend') return b.aiTodayRecommend(body.apiKey);
  if (s[0] === 'ai' && s[1] === 'generate-plan') return b.aiGeneratePlan(body.apiKey, body.progress, body.errors, body.units, body.userProfile);
  if (s[0] === 'ai' && s[1] === 'next-checkin') return b.aiGenerateNextCheckin(body.apiKey, body.completedActivity, body.currentPlan, body.userProfile);
  if (s[0] === 'ai' && s[1] === 'search') throw { code: 'SERVER_REQUIRED', message: 'AI搜索需要服务端支持' };

  throw { code: 'NOT_FOUND', message: `Unknown: ${method} /${s.join('/')}` };
}

async function localRequest(path, options = {}) {
  const method = (options.method || 'GET').toUpperCase();
  const segs = parseLocalPath(path);
  const body = options.body ? JSON.parse(options.body) : {};
  try {
    return await localDispatch(method, segs, body, path);
  } catch (err) {
    if (err.code) throw err;
    throw { code: 'UNKNOWN_ERROR', message: err.message || '请求失败' };
  }
}

// ---- mode detection ----
let _mode = null;

async function detectMode() {
  if (_mode) return _mode;
  try {
    const res = await fetch('/api/v1/health');
    const json = await res.json();
    if (json?.success) { _mode = 'fetch'; return 'fetch'; }
  } catch {}
  try {
    await getBackend();
    _mode = 'local';
    return 'local';
  } catch {
    _mode = 'fetch';
    return 'fetch';
  }
}

// ---- unified request ----
async function request(path, options = {}) {
  const mode = await detectMode();
  if (mode === 'local') return localRequest(path, options);
  return fetchRequest(path, options);
}

export const api = {
  get: (path, params) => {
    const query = params ? '?' + new URLSearchParams(params).toString() : '';
    return request(path + query);
  },
  post: (path, body) =>
    request(path, { method: 'POST', body: JSON.stringify(body) }),
  put: (path, body) =>
    request(path, { method: 'PUT', body: JSON.stringify(body) }),
  del: (path) =>
    request(path, { method: 'DELETE' }),
};
