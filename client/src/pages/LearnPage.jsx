import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import ContentViewer from '../components/content/ContentViewer';
import NotesSection from '../components/content/NotesSection';
import Breadcrumb from '../components/common/Breadcrumb';
import ImageHotspotView from '../components/learn/ImageHotspotView';
import FlashcardCarousel from '../components/learn/FlashcardCarousel';
import { useLearningFlow } from '../hooks/useLearningFlow';
import { resolveUnitAsset } from '../services/contentService';
import { api } from '../utils/api';
import { useAIContext } from '../components/ai/AIContextProvider';

export default function LearnPage() {
  const { unitId: rawUnitId } = useParams();
  const unitId = decodeURIComponent(rawUnitId || '');
  const navigate = useNavigate();
  const location = useLocation();
  const locationState = location.state || {};

  const { phase, loading: flowLoading, completeLearning } = useLearningFlow(unitId);
  const { autoPilotEnabled, registerActivityComplete } = useAIContext();

  // Markdown fallback content
  const [content, setContent] = useState('');
  const [contentLoading, setContentLoading] = useState(true);

  // Flashcards B+D mode
  const [flashcardsData, setFlashcardsData] = useState(null);
  const [flashcardsLoading, setFlashcardsLoading] = useState(true);
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [flippedCards, setFlippedCards] = useState(new Set());

  const loading = contentLoading || flashcardsLoading || flowLoading;

  useEffect(() => {
    if (!unitId) return;
    // Fetch both in parallel
    setContentLoading(true);
    setFlashcardsLoading(true);
    setCurrentCardIndex(0);
    setFlippedCards(new Set());

    api.get(`/units/${encodeURIComponent(unitId)}/content`)
      .then((data) => setContent(data?.content || ''))
      .catch(() => setContent(''))
      .finally(() => setContentLoading(false));

    api.get(`/units/${encodeURIComponent(unitId)}/flashcards`)
      .then(async (data) => {
        if (data && data.flashcards?.length > 0) {
          if (data.image?.src && !data.image.src.startsWith('/') && !data.image.src.startsWith('http')) {
            data.image.src = await resolveUnitAsset(unitId, `images/${data.image.src}`);
          }
          setFlashcardsData(data);
        } else {
          setFlashcardsData(null);
        }
      })
      .catch(() => setFlashcardsData(null))
      .finally(() => setFlashcardsLoading(false));
  }, [unitId]);

  function handleFlip(cardId) {
    setFlippedCards((prev) => {
      const next = new Set(prev);
      next.add(cardId);
      return next;
    });
  }

  function handleNavigate(index) {
    setCurrentCardIndex(index);
  }

  function handleHotspotClick(cardId) {
    const idx = flashcardsData.flashcards.findIndex((fc) => fc.id === cardId);
    if (idx >= 0) {
      setCurrentCardIndex(idx);
    }
  }

  async function handleComplete() {
    await completeLearning();
    if (autoPilotEnabled) registerActivityComplete({ type: 'learn', unitId });
    const chapterId = locationState.chapterId;
    if (chapterId) {
      navigate(`/sections/${chapterId}`);
    } else {
      navigate('/modules');
    }
  }

  // ─── Render ───

  if (loading) return <div className="page-loading">加载中...</div>;

  const isFlashcardMode = flashcardsData && flashcardsData.flashcards?.length > 0;

  // No content at all
  if (!isFlashcardMode && !content) {
    return (
      <div className="page">
        <Breadcrumb chapterId={locationState.chapterId} partTitle={locationState.partTitle || '学习内容'} />
        <div className="empty-hint">该单元暂无学习内容</div>
      </div>
    );
  }

  return (
    <div className="page page--learn">
      <Breadcrumb chapterId={locationState.chapterId} partTitle={locationState.partTitle || '学习内容'} />

      {isFlashcardMode ? (
        <>
          {/* B+D Mode */}
          {flashcardsData.image && (
            <ImageHotspotView
              image={flashcardsData.image}
              hotspots={flashcardsData.flashcards.filter((fc) => fc.hotspot)}
              activeFlashcardId={flashcardsData.flashcards[currentCardIndex]?.id}
              onHotspotClick={handleHotspotClick}
            />
          )}

          {/* Progress bar */}
          <div className="learn-progress">
            <p className="learn-progress__text">
              已浏览 {flippedCards.size} / {flashcardsData.flashcards.length} 个结构
            </p>
            <div className="learn-progress__bar">
              <div
                className="learn-progress__fill"
                style={{ width: `${(flippedCards.size / flashcardsData.flashcards.length) * 100}%` }}
              />
            </div>
          </div>

          <FlashcardCarousel
            flashcards={flashcardsData.flashcards}
            activeIndex={currentCardIndex}
            onNavigate={handleNavigate}
            flippedCards={flippedCards}
            onFlip={handleFlip}
          />
        </>
      ) : (
        <>
          {/* Fallback to Markdown mode */}
          <ContentViewer content={content} />
          <NotesSection unitId={unitId} />
        </>
      )}

      {/* Action button */}
      <div className="learn-page__action">
        <button className="btn btn--primary btn--lg btn--block" onClick={handleComplete}>
          完成学习 →
        </button>
      </div>

    </div>
  );
}
