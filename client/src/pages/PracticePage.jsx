import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { api } from '../utils/api';
import { useAIContext } from '../components/ai/AIContextProvider';
import PracticeQuestionList from '../components/practice/PracticeQuestionList';
import PracticeModuleSelect from '../components/practice/PracticeModuleSelect';
import PracticeQuestionView from '../components/practice/PracticeQuestionView';
import PracticeResult from '../components/practice/PracticeResult';

const TYPE_ORDER = {
  multiple_choice: 1, multi_select: 2, fill_blank: 3, term_explanation: 4, short_answer: 5, essay: 6,
};

const TYPE_LABELS = {
  multiple_choice: '单选', multi_select: '多选', fill_blank: '填空',
  term_explanation: '名解', short_answer: '简答', essay: '问答',
};

export default function PracticePage() {
  const [screen, setScreen] = useState('select'); // select | list | question | result
  const [chapters, setChapters] = useState([]);
  const [allQuestions, setAllQuestions] = useState([]);
  const [currentQ, setCurrentQ] = useState(null);
  const [statusMap, setStatusMap] = useState({});

  // Mode & filter
  const [practiceMode, setPracticeMode] = useState('brush'); // memorize | brush | test
  const [typeFilter, setTypeFilter] = useState('all');
  // Test mode answers
  const [testAnswers, setTestAnswers] = useState({});
  const [testResult, setTestResult] = useState(null);

  const { autoPilotEnabled, registerActivityComplete } = useAIContext();
  const hasReportedRef = useRef(false); // prevent duplicate completion reports

  useEffect(() => {
    api.get('/chapters').then((d) => setChapters(d.chapters || [])).catch(() => {});
  }, []);

  // Filter & sort questions
  const questions = useMemo(() => {
    let qs = allQuestions;
    if (typeFilter !== 'all') {
      qs = qs.filter((q) => q.type === typeFilter);
    }
    return qs.sort((a, b) => (TYPE_ORDER[a.type] || 9) - (TYPE_ORDER[b.type] || 9));
  }, [allQuestions, typeFilter]);

  async function handleGenerate(chapterIds) {
    const collected = [];
    for (const chId of chapterIds) {
      const data = await api.get('/practice/questions', { chapter: chId });
      collected.push(...data.questions);
    }
    setAllQuestions(collected);
    setStatusMap({});
    setTestAnswers({});
    setTestResult(null);
    setScreen('list');
  }

  function handleSelectChapter(chapterId) {
    handleGenerate([chapterId]);
  }

  function handleQuestionClick(q, index) {
    setCurrentQ({ ...q, index });
    setScreen('question');
  }

  const filteredIndex = useCallback((globalIdx) => {
    // Find this question's index in the filtered list
    if (!currentQ) return 0;
    return questions.findIndex((q) => q.id === currentQ.id);
  }, [questions, currentQ]);

  const handleNext = useCallback(() => {
    if (!currentQ) return;
    const idx = questions.findIndex((q) => q.id === currentQ.id);
    if (idx >= 0 && idx < questions.length - 1) {
      const next = questions[idx + 1];
      setCurrentQ({ ...next, index: idx + 1 });
    } else {
      // Last question
      setScreen('list');
      setCurrentQ(null);
    }
  }, [questions, currentQ]);

  function handleReset() {
    setStatusMap({});
    setTestAnswers({});
    setTestResult(null);
    setCurrentQ(null);
    setScreen('list');
  }

  // Save practice errors for next-day review
  function savePracticeHistory() {
    if (hasReportedRef.current) return;
    const wrongCount = Object.values(statusMap).filter((s) => s === 'wrong').length;
    const totalAnswered = Object.keys(statusMap).length;
    if (totalAnswered === 0) return; // nothing practiced

    try {
      localStorage.setItem('ai_practice_history', JSON.stringify({
        date: new Date().toDateString(),
        totalQuestions: totalAnswered,
        totalErrors: wrongCount,
        timestamp: Date.now(),
      }));
    } catch {}
  }

  function handleBack() {
    if (screen === 'question') {
      setScreen('list');
      setCurrentQ(null);
    } else if (screen === 'list') {
      // Exiting practice → report completion for autoPilot
      if (autoPilotEnabled && !hasReportedRef.current) {
        savePracticeHistory();
        hasReportedRef.current = true;
        registerActivityComplete({ type: 'practice', unitId: '', result: { statusMap } });
      }
      setScreen('select');
      setAllQuestions([]);
      setStatusMap({});
      setTestAnswers({});
    } else if (screen === 'result') {
      setScreen('list');
      setCurrentQ(null);
      setTestResult(null);
    }
  }

  // Safety net: report on unmount if not already reported
  useEffect(() => {
    return () => {
      if (autoPilotEnabled && !hasReportedRef.current && Object.keys(statusMap).length > 0) {
        savePracticeHistory();
        hasReportedRef.current = true;
        registerActivityComplete({ type: 'practice', unitId: '', result: { statusMap } });
      }
    };
  }, [autoPilotEnabled, statusMap, registerActivityComplete]);

  // Brush mode: submit for auto-graded types
  async function handleSubmitAnswer(unitId, questionId, answer) {
    try {
      const res = await api.post('/practice/submit', { unitId, questionId, answer });
      // null = self-check (名解/问答), don't color
      if (res.isCorrect !== null) {
        setStatusMap((prev) => ({ ...prev, [questionId]: res.isCorrect ? 'correct' : 'wrong' }));
      }
      return res;
    } catch { return { isCorrect: false }; }
  }

  // Test mode: record answer without feedback
  function handleTestAnswer(questionId, answer) {
    setTestAnswers((prev) => ({ ...prev, [questionId]: answer }));
  }

  // Test mode: submit all
  async function handleTestSubmit() {
    let total = 0;
    let correct = 0;
    const results = {};
    for (const q of questions) {
      const ans = testAnswers[q.id];
      if (ans === undefined || ans === '') continue;
      if (q.type === 'term_explanation' || q.type === 'short_answer' || q.type === 'essay') continue;
      const res = await api.post('/practice/submit', { unitId: q.unitId, questionId: q.id, answer: ans });
      if (res.isCorrect !== null) {
        results[q.id] = res.isCorrect;
        if (res.isCorrect) correct++;
        total++;
      }
    }
    setStatusMap((prev) => {
      const next = { ...prev };
      Object.entries(results).forEach(([id, ok]) => { next[id] = ok ? 'correct' : 'wrong'; });
      return next;
    });
    setTestResult({ total, correct, score: total > 0 ? Math.round((correct / total) * 100) : 0 });
    setScreen('result');
  }

  const total = questions.length;
  const typeCounts = useMemo(() => {
    const counts = {};
    allQuestions.forEach((q) => { counts[q.type] = (counts[q.type] || 0) + 1; });
    return counts;
  }, [allQuestions]);

  return (
    <div className="page">
      {screen === 'select' && (
        <>
          <h2 className="page__title">刷题</h2>
          <PracticeModuleSelect
            chapters={chapters}
            onGenerate={handleGenerate}
            onSelectChapter={handleSelectChapter}
          />
        </>
      )}

      {(screen === 'list' || screen === 'question') && (
        <>
          {/* Type filter bar */}
          <div className="practice-filter">
            <button className={`practice-filter__chip ${typeFilter === 'all' ? 'practice-filter__chip--active' : ''}`}
              onClick={() => setTypeFilter('all')}>全部 ({allQuestions.length})</button>
            {[{ key: 'multiple_choice', label: '单选' }, { key: 'multi_select', label: '多选' },
              { key: 'fill_blank', label: '填空' }, { key: 'term_explanation', label: '名解' },
              { key: 'short_answer', label: '简答' }, { key: 'essay', label: '问答' }]
              .filter((t) => typeCounts[t.key] > 0)
              .map((t) => (
                <button key={t.key}
                  className={`practice-filter__chip ${typeFilter === t.key ? 'practice-filter__chip--active' : ''}`}
                  onClick={() => setTypeFilter(typeFilter === t.key ? 'all' : t.key)}>
                  {t.label} ({typeCounts[t.key] || 0})
                </button>
              ))}
          </div>

          {/* Mode selector bar */}
          <div className="practice-modes">
            {[{ key: 'memorize', label: '背题模式', desc: '直接看题和答案' },
              { key: 'brush', label: '刷题模式', desc: '答对自动下一题' },
              { key: 'test', label: '测试模式', desc: '全部做完看分数' }]
              .map((m) => (
                <button key={m.key}
                  className={`practice-mode-btn ${practiceMode === m.key ? 'practice-mode-btn--active' : ''}`}
                  onClick={() => {
                    setPracticeMode(m.key);
                    if (screen === 'question') { setScreen('list'); setCurrentQ(null); }
                  }}>
                  <span className="practice-mode-btn__label">{m.label}</span>
                  <span className="practice-mode-btn__desc">{m.desc}</span>
                </button>
              ))}
          </div>
        </>
      )}

      {screen === 'list' && (
        <PracticeQuestionList
          questions={questions}
          statusMap={statusMap}
          onQuestionClick={handleQuestionClick}
          onBack={handleBack}
          onReset={handleReset}
        />
      )}

      {screen === 'question' && currentQ && (
        <PracticeQuestionView
          key={currentQ.id}
          question={currentQ}
          total={questions.length}
          status={statusMap[currentQ.id]}
          mode={practiceMode}
          testAnswer={testAnswers[currentQ.id] || ''}
          onSubmit={handleSubmitAnswer}
          onTestAnswer={handleTestAnswer}
          onTestSubmit={handleTestSubmit}
          onBack={handleBack}
          onNext={handleNext}
          hasNext={questions.findIndex((q) => q.id === currentQ.id) < questions.length - 1}
        />
      )}

      {screen === 'result' && testResult && (
        <PracticeResult result={testResult} questions={questions} statusMap={statusMap} onBack={handleBack} />
      )}
    </div>
  );
}
