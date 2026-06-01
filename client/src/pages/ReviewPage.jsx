import { useEffect, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import AutoReviewViewer from '../components/review/AutoReviewViewer';
import Breadcrumb from '../components/common/Breadcrumb';
import { api } from '../utils/api';
import { useAIContext } from '../components/ai/AIContextProvider';

export default function ReviewPage() {
  const { unitId: rawUnitId } = useParams();
  const unitId = decodeURIComponent(rawUnitId || '');
  const navigate = useNavigate();
  const location = useLocation();
  const locState = location.state || {};

  const [review, setReview] = useState(null);
  const [loading, setLoading] = useState(true);
  const { autoPilotEnabled, registerActivityComplete } = useAIContext();

  useEffect(() => {
    if (!unitId) return;
    setLoading(true);
    api.get(`/units/${encodeURIComponent(unitId)}/review/generate`)
      .then((data) => setReview(data))
      .catch(() => setReview({ skip: true }))
      .finally(() => setLoading(false));
  }, [unitId]);

  async function handleComplete() {
    await api.post(`/units/${encodeURIComponent(unitId)}/review/complete`);
    if (autoPilotEnabled) registerActivityComplete({ type: 'review', unitId });
    navigate(`/test/${encodeURIComponent(unitId)}`, { state: locState });
  }

  if (loading) return <div className="page-loading">加载中...</div>;

  return (
    <div className="page">
      <Breadcrumb chapterId={locState.chapterId} partTitle="自动回顾" />
      <AutoReviewViewer reviewData={review} onComplete={handleComplete} />
    </div>
  );
}
