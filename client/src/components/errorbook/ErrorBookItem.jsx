import AIErrorHelper from '../ai/AIErrorHelper';

const TYPE_LABELS = { multiple_choice: '选择题', true_false: '判断题', term_explanation: '名词解释', short_answer: '简答题', essay: '问答题', fill_blank: '填空题', multi_select: '多选题' };

export default function ErrorBookItem({ error, onMastery, onResolve, isDue }) {
  return (
    <div className={`error-item ${isDue ? 'error-item--due' : ''}`}>
      <div className="error-item__header">
        <span className="error-item__type">{TYPE_LABELS[error.question_type] || error.question_type}</span>
        <span className={`error-item__mastery error-item__mastery--l${error.mastery_level}`}>
          {['未复习','1次','2次','已掌握'][error.mastery_level] || '未复习'}
        </span>
      </div>
      <p className="error-item__stem">{error.question_stem}</p>
      <div className="error-item__answers">
        <p className="error-item__wrong">✗ 你的答案：{error.user_answer || '(未填)'}</p>
        <p className="error-item__correct">✓ 正确答案：{error.correct_answer}</p>
      </div>
      {error.explanation && (
        <details className="error-item__explanation">
          <summary>查看解析</summary>
          <p>{error.explanation}</p>
        </details>
      )}
      <p className="error-item__path">{error.unit_path}</p>
      <div className="error-item__actions">
        {error.mastery_level < 3 && (
          <button className="btn btn--outline btn--sm" onClick={() => onMastery(error.id, (error.mastery_level || 0) + 1)}>
            + 掌握度
          </button>
        )}
        <button className="btn btn--ghost btn--sm" onClick={() => onResolve(error.id)}>
          标记已解决
        </button>
      </div>
      <AIErrorHelper errorItem={{
        stem: error.question_stem,
        userAnswer: error.user_answer,
        correctAnswer: error.correct_answer,
      }} />
    </div>
  );
}
