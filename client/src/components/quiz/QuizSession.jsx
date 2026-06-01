import { useState } from 'react';
import FillBlankQuiz from './FillBlankQuiz';
import AIHintButton from '../ai/AIHintButton';

export default function QuizSession({ questions, onSubmit }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState(() =>
    Array(questions.length).fill(null).map(() => [])
  );

  const q = questions[currentIndex];
  const isLast = currentIndex >= questions.length - 1;

  function handleAnswerChange(blankIdx, value) {
    setAnswers((prev) => {
      const next = [...prev];
      next[currentIndex][blankIdx] = value;
      return next;
    });
  }

  function goNext() {
    if (!isLast) setCurrentIndex((i) => i + 1);
  }

  function goPrev() {
    if (currentIndex > 0) setCurrentIndex((i) => i - 1);
  }

  function handleSubmit() {
    onSubmit(answers);
  }

  return (
    <div className="quiz-session">
      <div className="quiz-session__progress">
        {questions.map((_, i) => (
          <span key={i} className={`quiz-session__dot ${i === currentIndex ? 'quiz-session__dot--active' : ''} ${i < currentIndex ? 'quiz-session__dot--done' : ''}`} />
        ))}
        <span className="quiz-session__count">{currentIndex + 1}/{questions.length}</span>
      </div>

      <FillBlankQuiz question={q} onAnswerChange={handleAnswerChange} />

      <AIHintButton questionStem={q?.stem || ''} />

      <div className="quiz-session__nav">
        <button className="btn btn--outline btn--sm" onClick={goPrev} disabled={currentIndex === 0}>
          上一题
        </button>
        {isLast ? (
          <button className="btn btn--primary btn--sm" onClick={handleSubmit}>
            提交测验
          </button>
        ) : (
          <button className="btn btn--primary btn--sm" onClick={goNext}>
            下一题
          </button>
        )}
      </div>
    </div>
  );
}
