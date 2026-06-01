import { useEffect, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import TestSession from '../components/test/TestSession';
import TestResult from '../components/test/TestResult';
import Breadcrumb from '../components/common/Breadcrumb';
import AIReviewPanel from '../components/ai/AIReviewPanel';
import { api } from '../utils/api';
import { useAIContext } from '../components/ai/AIContextProvider';

export default function TestPage() {
  const { unitId: raw } = useParams();
  const unitId = decodeURIComponent(raw || '');
  const navigate = useNavigate();
  const location = useLocation();
  const loc = location.state || {};
  const [questions, setQuestions] = useState([]);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const { autoPilotEnabled, registerActivityComplete } = useAIContext();

  useEffect(() => {
    if (!unitId) return;
    setLoading(true);
    api.get(`/units/${encodeURIComponent(unitId)}/test`)
      .then((d) => setQuestions(d.questions || []))
      .catch(() => setQuestions([]))
      .finally(() => setLoading(false));
  }, [unitId]);

  async function handleSubmit(answers) {
    const res = await api.post(`/units/${encodeURIComponent(unitId)}/test/submit`, { answers });
    setResult(res);
    if (autoPilotEnabled) registerActivityComplete({ type: 'test', unitId, result: res });
  }

  if (loading) return <div className="page-loading">加载中...</div>;

  if (result) {
    const chapterId = loc.chapterId || loc.sectionId || '';
    return (
      <div className="page">
        <Breadcrumb chapterId={loc.chapterId || loc.sectionId} partTitle="测试结果" />
        <TestResult
          result={result}
          onViewErrors={() => navigate('/review')}
          onBack={() => chapterId ? navigate(`/sections/${chapterId}`) : navigate('/modules')}
          onExam={() => navigate('/finalexam/' + encodeURIComponent(unitId), { state: loc })}
        />
        <AIReviewPanel />
      </div>
    );
  }

  if (!questions.length) return <div className="page-loading">该单元暂无测试</div>;

  return (
    <div className="page">
      <Breadcrumb chapterId={loc.chapterId || loc.sectionId} partTitle={loc.partTitle || '正式测试'} />
      <TestSession questions={questions} onSubmit={handleSubmit} />
    </div>
  );
}
