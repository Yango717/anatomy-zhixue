import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AIErrorHelper from '../ai/AIErrorHelper';

const TYPE_LABELS = { multiple_choice: '选择题', true_false: '判断题', term_explanation: '名词解释', short_answer: '简答题', essay: '问答题', fill_blank: '填空题', multi_select: '多选题' };

export default function ErrorBookItem({ error, onMastery, onResolve, isDue }) {
  const navigate = useNavigate();
  const [showAnalysis, setShowAnalysis] = useState(false);

  // AI 分析文案（本地生成，基于错题信息推断）
  function getAIAnalysis(err) {
    const stem = (err.question_stem || '').toLowerCase();
    const type = err.question_type;
    const wrongCount = err.times_reviewed || 0;

    let reason = '';
    let confusedWith = '';
    let suggestion = '';

    // 基于题目内容推断错误原因
    if (stem.includes('神经') && (stem.includes('动脉') || stem.includes('静脉'))) {
      reason = '容易将神经与血管的解剖位置混淆';
      confusedWith = '股神经 ↔ 股动脉、胫神经 ↔ 胫后动脉';
      suggestion = '记住 NAVL 口诀：Nerve → Artery → Vein → Lymph，从外侧到内侧';
    } else if (stem.includes('位置') || stem.includes('位于') || stem.includes('走行')) {
      reason = '结构定位能力不足，对三维空间关系把握不准';
      suggestion = '建议通过图谱闪卡反复训练空间定位';
    } else if (stem.includes('起止') || stem.includes('附着') || stem.includes('起点')) {
      reason = '肌学起止点记忆混淆，缺乏系统性归纳';
      suggestion = '建议按肌群分组记忆，结合图谱强化';
    } else if (type === 'fill_blank') {
      reason = '专业术语记忆不牢固，填空时容易遗漏关键词';
      suggestion = '建议通过闪卡反复记忆核心术语';
    } else if (type === 'term_explanation') {
      reason = '临床关联能力较弱，无法将解剖知识与临床场景联系';
      suggestion = '建议结合临床案例理解解剖结构的意义';
    } else {
      reason = '该知识点掌握不牢固，需要加强复习';
      suggestion = '建议先复习相关内容，再做专项训练';
    }

    const repeatNote = wrongCount >= 2 ? `\n\n⚠️ 你已经连续 ${wrongCount + 1} 次在这道题上出错，这说明这个知识点没有真正掌握。` : '';

    return { reason, confusedWith, suggestion, repeatNote };
  }

  const analysis = getAIAnalysis(error);

  return (
    <div className={`error-item ${isDue ? 'error-item--due' : ''}`}>
      <div className="error-item__header">
        <span className="error-item__type">{TYPE_LABELS[error.question_type] || error.question_type}</span>
        <span className={`error-item__mastery error-item__mastery--l${Math.min(error.mastery_level||0, 3)}`}>
          {['未复习','复习1次','复习2次','已掌握'][Math.min(error.mastery_level||0,3)] || '未复习'}
        </span>
      </div>
      <p className="error-item__stem">{error.question_stem}</p>
      <div className="error-item__answers">
        <p className="error-item__wrong">✗ 你的答案：{error.user_answer || '(未填)'}</p>
        <p className="error-item__correct">✓ 正确答案：{error.correct_answer}</p>
      </div>

      {/* AI 分析区域 */}
      <button
        className="btn btn--ghost btn--sm"
        style={{ marginTop: 8, marginBottom: showAnalysis ? 8 : 0, fontSize: 12 }}
        onClick={() => setShowAnalysis(!showAnalysis)}
      >
        🧠 {showAnalysis ? '收起 AI 分析' : '展开 AI 分析'}
      </button>

      {showAnalysis && (
        <div className="error-ai-analysis">
          <div className="error-ai-analysis__header">
            <div className="error-ai-analysis__avatar">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                <circle cx="12" cy="8" r="4" /><path d="M4 20c0-4 4-7 8-7s8 3 8 7" />
              </svg>
            </div>
            <span className="error-ai-analysis__name">妍学姐分析</span>
          </div>
          <div className="error-ai-analysis__body">
            <p><strong>错误原因：</strong>{analysis.reason}</p>
            {analysis.confusedWith && (
              <p><strong>易混淆点：</strong>{analysis.confusedWith}</p>
            )}
            <p><strong>建议：</strong>{analysis.suggestion}</p>
            {analysis.repeatNote && (
              <p style={{ color: 'var(--color-warning)', marginTop: 4 }}>{analysis.repeatNote}</p>
            )}
          </div>
          <div className="error-ai-analysis__actions">
            <button
              className="btn btn--primary btn--sm"
              onClick={() => navigate('/motion-flow')}
            >
              📷 图谱复习
            </button>
            <button
              className="btn btn--outline btn--sm"
              onClick={() => navigate('/practice')}
            >
              🎯 专项训练
            </button>
          </div>
        </div>
      )}

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
