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
  const { autoPilotEnabled, registerActivityComplete } = useAIContext();

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
  }

  function handleReview() {
    navigate(`/review/${encodeURIComponent(unitId)}`, { state: locState });
  }

  function handleNext() {
    navigate(`/test/${encodeURIComponent(unitId)}`, { state: locState });
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

  if (!questions.length) return <div className="page-loading">该单元暂无测验</div>;

  return (
    <div className="page">
      <Breadcrumb chapterId={locState.chapterId} partTitle={locState.partTitle || '填空测验'} />
      <QuizSession questions={questions} onSubmit={handleSubmit} />
    </div>
  );
}
