import { useState, useEffect } from 'react';
import AIHintButton from '../ai/AIHintButton';

const TYPE_LABEL = {
  multiple_choice: '单选题', multi_select: '多选题', fill_blank: '填空题',
  term_explanation: '名词解释', true_false: '判断题',
  short_answer: '简答题', essay: '问答题',
};

const AUTO_GRADED = new Set(['multiple_choice', 'multi_select', 'fill_blank', 'true_false']);
const SELF_CHECK = new Set(['term_explanation', 'short_answer', 'essay']);

export default function PracticeQuestionView({
  question, total, status, mode, testAnswer,
  onSubmit, onTestAnswer, onTestSubmit, onBack, onNext, hasNext,
}) {
  const [answer, setAnswer] = useState('');
  const [blankAnswers, setBlankAnswers] = useState([]);
  const [submitted, setSubmitted] = useState(false);
  const [result, setResult] = useState(null);
  const [showAnswer, setShowAnswer] = useState(false);

  // Reset state when question changes
  useEffect(() => {
    setAnswer(testAnswer || '');
    setBlankAnswers([]);
    setSubmitted(false);
    setResult(null);
    setShowAnswer(false);
  }, [question.id, mode]);

  // ----- Memorize mode: show answer immediately -----
  if (mode === 'memorize') {
    const correctAns = question.type === 'fill_blank'
      ? (question.blanks || []).map((b) => b.answer).join('、')
      : question.type === 'multiple_choice' || question.type === 'multi_select'
      ? question.answer
      : question.type === 'term_explanation'
      ? (question.explanation || question.answer || '')
      : question.answer || '';

    return (
      <div>
        <div className="page-header">
          <button className="page-header__back" onClick={onBack}>← 返回列表</button>
          <h2 className="page-header__title">第 {question.index + 1}/{total} 题</h2>
          <span className="practice-mode-tag">背题</span>
        </div>
        <div className="practice-question">
          <span className="practice-question__type">{TYPE_LABEL[question.type] || question.type}</span>
          <p className="practice-question__stem">{question.stem}</p>

          {/* Options for MC */}
          {question.options && (
            <div className="test-options">
              {question.options.map((opt) => (
                <div key={opt.key}
                  className={`test-option ${opt.key === question.answer || question.answer?.includes(opt.key) ? 'test-option--selected' : ''}`}>
                  <span className="test-option__key">{opt.key}</span>
                  <span className="test-option__text">{opt.text}</span>
                </div>
              ))}
            </div>
          )}

          {/* Answer */}
          <div className="memorize-answer">
            <strong>答案：</strong>{correctAns}
          </div>
          {question.explanation && (
            <div className="memorize-explain">{question.explanation}</div>
          )}

          <div className="quiz-session__nav">
            <button className="btn btn--outline btn--lg" onClick={onBack}>返回列表</button>
            {hasNext && (
              <button className="btn btn--primary btn--lg" onClick={() => onNext()}>下一题 →</button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ----- Brush / Test mode -----
  function handleSubmit() {
    if (AUTO_GRADED.has(question.type)) {
      // Auto-graded: submit to API
      const ans = question.type === 'fill_blank' ? blankAnswers : answer;
      onSubmit(question.unitId, question.id, ans).then((res) => {
        setResult(res);
        setSubmitted(true);
        if (res.isCorrect && hasNext && mode === 'brush') {
          setTimeout(() => onNext(), 800);
        }
      });
    } else if (SELF_CHECK.has(question.type)) {
      // Self-check: just mark as submitted, user compares manually
      setSubmitted(true);
      setShowAnswer(false);
    }
  }

  function handleReveal() {
    setShowAnswer(true);
  }

  function handleTestNext() {
    // In test mode, save answer and move to next
    const ans = question.type === 'fill_blank' ? blankAnswers : answer;
    onTestAnswer(question.id, ans);
    if (hasNext) {
      onNext();
    }
  }

  return (
    <div>
      <div className="page-header">
        <button className="page-header__back" onClick={onBack}>← 返回列表</button>
        <h2 className="page-header__title">第 {question.index + 1}/{total} 题</h2>
        <span className={`practice-status ${status === 'correct' ? 'practice-status--ok' : status === 'wrong' ? 'practice-status--err' : ''}`}>
          {status === 'correct' ? '✓' : status === 'wrong' ? '✗' : ''}
          <span className="practice-mode-tag">{mode === 'brush' ? '刷题' : '测试'}</span>
        </span>
      </div>

      <div className="practice-question">
        <span className="practice-question__type">{TYPE_LABEL[question.type] || question.type}</span>
        {question.type !== 'fill_blank' && (
          <p className="practice-question__stem">{question.stem}</p>
        )}

        {/* Multiple Choice */}
        {(question.type === 'multiple_choice' || question.type === 'multi_select') && question.options && (
          <div className="test-options">
            {question.options.map((opt) => (
              <label key={opt.key}
                className={`test-option ${(answer === opt.key || (Array.isArray(answer) && answer.includes(opt.key))) ? 'test-option--selected' : ''} ${submitted && result ? (!result.isCorrect && (answer === opt.key || (Array.isArray(answer) && answer.includes(opt.key))) ? 'test-option--wrong' : (question.answer || '').includes(opt.key) ? 'test-option--correct' : '') : ''}`}>
                <input type={question.type === 'multi_select' ? 'checkbox' : 'radio'} name="q"
                  value={opt.key} checked={answer === opt.key || (Array.isArray(answer) && answer.includes(opt.key))}
                  onChange={() => !submitted && setAnswer(question.type === 'multi_select'
                    ? (Array.isArray(answer) ? (answer.includes(opt.key) ? answer.filter(a => a !== opt.key) : [...answer, opt.key]) : [opt.key])
                    : opt.key)}
                  disabled={submitted} />
                <span className="test-option__key">{opt.key}</span>
                <span className="test-option__text">{opt.text}</span>
              </label>
            ))}
          </div>
        )}

        {/* Fill Blank */}
        {question.type === 'fill_blank' && (
          <div style={{ fontSize: 'var(--font-size-lg)', lineHeight: 2.2 }}>
            {question.stem.split(/_{2,}/).map((part, i, arr) => (
              <span key={i}>
                {part}
                {i < arr.length - 1 && (
                  <input className="quiz-blank__input" style={{ width: 100, margin: '0 4px' }}
                    value={blankAnswers[i] || ''}
                    onChange={(e) => { const v = [...blankAnswers]; v[i] = e.target.value; setBlankAnswers(v); }}
                    disabled={submitted} />
                )}
              </span>
            ))}
          </div>
        )}

        {/* Term Explanation */}
        {SELF_CHECK.has(question.type) && (
          <>
            <p className="practice-question__hint">请输入你的答案，然后点击"显示答案"自行核对</p>
            <textarea className="test-textarea" rows={question.type === 'essay' ? 8 : 5}
              value={answer} onChange={(e) => !submitted && setAnswer(e.target.value)}
              placeholder="输入你的答案..."
              disabled={submitted && mode === 'brush'} />
          </>
        )}

        {/* AI Hint for brush/test mode */}
        {!submitted && (mode === 'brush' || mode === 'test') && (
          <AIHintButton questionStem={question.stem || ''} />
        )}

        {/* Action buttons */}
        {!submitted && mode === 'brush' && (
          <button className="btn btn--primary btn--lg btn--block" style={{ marginTop: 'var(--spacing-xl)' }}
            onClick={handleSubmit}>
            {SELF_CHECK.has(question.type) ? '提交（自行核对）' : '提交答案'}
          </button>
        )}

        {submitted && mode === 'brush' && (
          <div style={{ marginTop: 'var(--spacing-xl)' }}>
            {AUTO_GRADED.has(question.type) && result && (
              <>
                <p className={result.isCorrect ? 'practice-feedback--ok' : 'practice-feedback--err'}>
                  {result.isCorrect ? '✓ 回答正确' : '✗ 回答错误'}
                </p>
                {!result.isCorrect && question.explanation && (
                  <p className="practice-feedback__explain">{question.explanation}</p>
                )}
                {!result.isCorrect && (
                  <p className="practice-feedback__correct-answer">
                    正确答案：{question.answer || (question.blanks || []).map(b => b.answer).join('、')}
                  </p>
                )}
                {result.isCorrect && hasNext ? (
                  <p style={{ textAlign: 'center', color: 'var(--color-text-hint)', marginTop: 'var(--spacing-md)' }}>即将自动跳转...</p>
                ) : !result.isCorrect && hasNext ? (
                  <div style={{ display: 'flex', gap: 'var(--spacing-sm)', marginTop: 'var(--spacing-md)' }}>
                    <button className="btn btn--outline btn--lg" style={{ flex: 1 }} onClick={onBack}>返回列表</button>
                    <button className="btn btn--primary btn--lg" style={{ flex: 1 }} onClick={() => onNext()}>下一题 →</button>
                  </div>
                ) : (
                  <button className="btn btn--primary btn--lg btn--block" style={{ marginTop: 'var(--spacing-md)' }} onClick={onBack}>返回列表</button>
                )}
              </>
            )}

            {SELF_CHECK.has(question.type) && (
              <>
                {!showAnswer ? (
                  <button className="btn btn--secondary btn--lg btn--block" onClick={handleReveal}>
                    👁 显示答案
                  </button>
                ) : (
                  <div className="memorize-answer">
                    <strong>参考答案：</strong>
                    <div style={{ whiteSpace: 'pre-wrap', marginTop: 'var(--spacing-sm)' }}>
                      {question.explanation || question.answer || '暂无参考答案'}
                    </div>
                  </div>
                )}
                <div style={{ display: 'flex', gap: 'var(--spacing-sm)', marginTop: 'var(--spacing-md)' }}>
                  <button className="btn btn--outline btn--lg" style={{ flex: 1 }} onClick={onBack}>返回列表</button>
                  {hasNext && (
                    <button className="btn btn--primary btn--lg" style={{ flex: 1 }} onClick={() => onNext()}>下一题 →</button>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {/* Test mode: no submit until all answered */}
        {mode === 'test' && (
          <div style={{ marginTop: 'var(--spacing-xl)' }}>
            <div style={{ display: 'flex', gap: 'var(--spacing-sm)' }}>
              <button className="btn btn--outline btn--lg" style={{ flex: 1 }} onClick={onBack}>返回列表</button>
              <button className="btn btn--primary btn--lg" style={{ flex: 1 }} onClick={handleTestNext}>
                {hasNext ? '保存并下一题 →' : '保存'}
              </button>
            </div>
            {!hasNext && (
              <button className="btn btn--primary btn--lg btn--block" style={{ marginTop: 'var(--spacing-md)' }}
                onClick={onTestSubmit}>
                提交全部答案，查看结果
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
