import { useEffect, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import QuizSession from '../components/quiz/QuizSession';
import QuizResult from '../components/quiz/QuizResult';
import Breadcrumb from '../components/common/Breadcrumb';
import { api } from '../utils/api';
import { useAIContext } from '../components/ai/AIContextProvider';

export default function QuizPage() {
  const { unitId: rawUnitId } = useParams();
  const unitId = decodeURIComponent(rawUnitId || '');
  const navigate = useNavigate();
  const location = useLocation();
  const locState = location.state || {};

  const [questions, setQuestions] = useState([]);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const { autoPilotEnabled, registerActivityComplete, pushAgentMessage } = useAIContext();

  useEffect(() => {
    if (!unitId) return;
    setLoading(true);
    api.get(`/units/${encodeURIComponent(unitId)}/quiz`)
      .then((data) => setQuestions(data.questions || []))
      .catch(() => setQuestions([]))
      .finally(() => setLoading(false));
  }, [unitId]);

  async function handleSubmit(answers) {
    const res = await api.post(`/units/${encodeURIComponent(unitId)}/quiz/submit`, { answers });
    setResult(res);
    if (autoPilotEnabled) registerActivityComplete({ type: 'quiz', unitId, result: res });

    // Agent: 测验完成后主动推送
    const pct = res?.score || 0;
    if (pct >= 80) {
      pushAgentMessage({
        message: `测验完成！正确率 ${pct}%，很棒 🎉\n\n建议进入自动回顾，巩固薄弱点。`,
        actionLabel: '去回顾',
        actionRoute: `/review/${encodeURIComponent(unitId)}`,
      });
    } else {
      pushAgentMessage({
        message: `测验完成，正确率 ${pct}%。\n\n有些知识点还需加强，建议先回顾错题再继续。`,
        actionLabel: '查看错题',
        actionRoute: '/review',
      });
    }
  }

  function handleReview() {
    navigate(`/review/${encodeURIComponent(unitId)}`, { state: locState });
  }

  function handleNext() {
    navigate(`/test/${encodeURIComponent(unitId)}`, { state: locState });
  }

  // 跳过测验 → 标记完成并推进自动模式
  function handleSkipToPractice() {
    if (autoPilotEnabled) {
      registerActivityComplete({ type: 'quiz', unitId, result: { skipped: true } });
    }
    navigate('/practice');
  }

  if (loading) return <div className="page-loading">加载中...</div>;

  if (result) {
    return (
      <div className="page">
        <Breadcrumb chapterId={locState.chapterId} partTitle="测验结果" />
        <QuizResult result={result} onReview={handleReview} onNext={handleNext} />
      </div>
    );
  }

  if (!questions.length) {
    return (
      <div className="page page--quiz-empty">
        <Breadcrumb chapterId={locState.chapterId} partTitle={locState.partTitle || '填空测验'} />

        <div className="quiz-empty__card">
          <div className="quiz-empty__icon">🧪</div>
          <h2 className="quiz-empty__title">测验题目筹备中</h2>
          <p className="quiz-empty__desc">
            学姐正在整理这个单元的填空测验题～<br />
            很快就会上线啦！到时候会考你一些关键解剖学概念，帮你检验学习效果 💪
          </p>
          <p className="quiz-empty__hint">
            想提前自测？可以用「问学姐」功能，让我出几道题考考你 👇
          </p>

          <div className="quiz-empty__actions">
            <button className="btn btn--primary" onClick={handleSkipToPractice}>
              去刷题练手 🎯
            </button>
            <button className="btn btn--outline" onClick={() => navigate(-1)}>
              返回
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <Breadcrumb chapterId={locState.chapterId} partTitle={locState.partTitle || '填空测验'} />
      <QuizSession questions={questions} onSubmit={handleSubmit} />
    </div>
  );
}
