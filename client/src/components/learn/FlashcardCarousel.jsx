import { useState, useCallback, useRef } from 'react';
import Flashcard from './Flashcard';

export default function FlashcardCarousel({ flashcards, activeIndex, onNavigate, flippedCards, onFlip }) {
  const [touchStart, setTouchStart] = useState(null);
  const carouselRef = useRef(null);

  const currentCard = flashcards[activeIndex];
  if (!currentCard) return null;

  const isFlipped = flippedCards.has(currentCard.id);

  function handleFlip() {
    onFlip(currentCard.id);
  }

  function goPrev() {
    if (activeIndex > 0) onNavigate(activeIndex - 1);
  }

  function goNext() {
    if (activeIndex < flashcards.length - 1) onNavigate(activeIndex + 1);
  }

  const handleTouchStart = useCallback((e) => {
    setTouchStart({ x: e.touches[0].clientX, y: e.touches[0].clientY });
  }, []);

  const handleTouchEnd = useCallback((e) => {
    if (!touchStart) return;
    const dx = e.changedTouches[0].clientX - touchStart.x;
    const dy = e.changedTouches[0].clientY - touchStart.y;
    // Only trigger swipe if horizontal movement > vertical and > threshold
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 50) {
      if (dx < 0) goNext();
      else goPrev();
    }
    setTouchStart(null);
  }, [touchStart, activeIndex, flashcards.length]);

  return (
    <div className="flashcard-carousel" ref={carouselRef}>
      <div
        className="flashcard-swipe-area"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <Flashcard card={currentCard} isFlipped={isFlipped} onFlip={handleFlip} />
      </div>

      <div className="flashcard-controls">
        <button
          className="flashcard-nav-btn"
          onClick={goPrev}
          disabled={activeIndex === 0}
          aria-label="上一个"
        >
          ←
        </button>

        <div className="flashcard-indicator">
          <span className="flashcard-pos">{activeIndex + 1} / {flashcards.length}</span>
          <div className="flashcard-dots">
            {flashcards.map((_fc, i) => (
              <span
                key={i}
                className={`flashcard-dot ${i === activeIndex ? 'flashcard-dot--active' : ''}`}
              />
            ))}
          </div>
        </div>

        <button
          className="flashcard-nav-btn"
          onClick={goNext}
          disabled={activeIndex >= flashcards.length - 1}
          aria-label="下一个"
        >
          →
        </button>
      </div>
    </div>
  );
}
