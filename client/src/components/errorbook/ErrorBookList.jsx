import { useState, useEffect } from 'react';
import ErrorBookItem from './ErrorBookItem';
import { api } from '../../utils/api';

const TYPE_LABELS = { multiple_choice:'选择题', true_false:'判断题', term_explanation:'名词解释', short_answer:'简答题', essay:'问答题', fill_blank:'填空题', multi_select:'多选题' };

function parseOptions(item) {
  try {
    const arr = JSON.parse(item.options || '[]');
    if (Array.isArray(arr) && arr.length > 0) return arr;
  } catch(e) {}
  return ['A','B','C','D','E'];
}

function optionLabel(opt, idx) {
  const letter = (typeof opt === 'object' && opt !== null) ? (opt.key || String.fromCharCode(65+idx)) : String.fromCharCode(65+idx);
  const text = (typeof opt === 'object' && opt !== null) ? (opt.text || opt.label || '') : String(opt);
  return { letter, label: text ? letter + '. ' + text : letter };
}

export default function ErrorBookList() {
  const [errors, setErrors] = useState([]);
  const [dueErrors, setDueErrors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [quizMode, setQuizMode] = useState(false);
  const [quizItems, setQuizItems] = useState([]);
  const [quizIdx, setQuizIdx] = useState(0);
  const [quizAnswers, setQuizAnswers] = useState({});
  const [quizSubmitted, setQuizSubmitted] = useState(false);

  function load() {
    setLoading(true);
    Promise.all([api.get('/errorbook'), api.get('/errorbook/due')])
      .then(([all, due]) => { setErrors(all); setDueErrors(due); })
      .catch(() => {}).finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  async function handleMastery(id, level) {
    await api.put(`/errorbook/${id}/mastery`, { masteryLevel: level });
    load();
  }

  async function handleResolve(id) {
    await api.put(`/errorbook/${id}/resolve`);
    load();
  }

  function startQuiz() {
    setQuizItems(dueErrors.length > 0 ? [...dueErrors] : [...errors]);
    setQuizIdx(0); setQuizAnswers({}); setQuizSubmitted(false); setQuizMode(true);
  }

  function handleQuizAnswer(qId, value) {
    setQuizAnswers(prev => ({ ...prev, [qId]: value }));
  }

  function submitQuiz() {
    setQuizSubmitted(true);
    quizItems.forEach(item => {
      const userAns = (quizAnswers[item.id] || '').trim().toLowerCase();
      const correctAns = (item.correct_answer || '').trim().toLowerCase();
      const ok = userAns && correctAns && (userAns === correctAns || userAns.replace(/\s/g,'') === correctAns.replace(/\s/g,''));
      handleMastery(item.id, ok ? Math.min((item.mastery_level||0)+1, 3) : Math.max((item.mastery_level||0)-1, 0));
    });
  }

  function exitQuiz() { setQuizMode(false); load(); }

  // ===== 复测模式 =====
  const item = quizItems[quizIdx];
  if (quizMode && item) {
    const correctAns = (item.correct_answer || '').trim();
    const userAns = (quizAnswers[item.id] || '').trim();
    const isCorrect = quizSubmitted && userAns && correctAns &&
      (userAns.toLowerCase() === correctAns.toLowerCase() || userAns.replace(/\s/g,'').toLowerCase() === correctAns.replace(/\s/g,'').toLowerCase());
    const isManual = ['term_explanation','short_answer','essay'].includes(item.question_type);
    const opts = parseOptions(item).map((o,i) => optionLabel(o,i));

    return (
      <div className="error-quiz">
        <div className="error-quiz__header">
          <button className="btn btn--outline btn--sm" onClick={exitQuiz}>← 返回错题本</button>
          <span className="error-quiz__progress">{quizIdx + 1} / {quizItems.length}</span>
        </div>

        <div className={'error-quiz__card' + (quizSubmitted ? (isCorrect ? ' error-quiz__card--correct' : ' error-quiz__card--wrong') : '')}>
          <div className="error-quiz__type">{TYPE_LABELS[item.question_type] || item.question_type}</div>
          <p className="error-quiz__stem">{item.question_stem}</p>

          {/* 填空/判断 */}
          {['fill_blank','true_false'].includes(item.question_type) && (
            <div className="error-quiz__input-area">
              <input className="error-quiz__input" type="text" value={userAns}
                onChange={e => handleQuizAnswer(item.id, e.target.value)} disabled={quizSubmitted}
                placeholder={item.question_type==='true_false'?'输入 A(正确) 或 B(错误)':'输入你的答案...'} autoFocus />
              {quizSubmitted && <QuizResult isCorrect={isCorrect} item={item} />}
            </div>
          )}

          {/* 单选题 */}
          {item.question_type === 'multiple_choice' && (
            <div className="error-quiz__input-area">
              <div className="error-quiz__options">
                {opts.map(o => (
                  <label key={o.letter} className={'error-quiz__opt' + (userAns.toUpperCase()===o.letter?' error-quiz__opt--selected':'')}>
                    <input type="radio" name={item.id} value={o.letter}
                      checked={userAns.toUpperCase()===o.letter} disabled={quizSubmitted}
                      onChange={e => handleQuizAnswer(item.id, e.target.value)} />{o.label}
                  </label>
                ))}
              </div>
              {quizSubmitted && <QuizResult isCorrect={isCorrect} item={item} />}
            </div>
          )}

          {/* 多选题 */}
          {item.question_type === 'multi_select' && (
            <div className="error-quiz__input-area">
              <div className="error-quiz__options">
                {opts.map(o => {
                  const checked = userAns.toUpperCase().includes(o.letter);
                  return (
                    <label key={o.letter} className={'error-quiz__opt' + (checked?' error-quiz__opt--selected':'')}>
                      <input type="checkbox" value={o.letter} checked={checked} disabled={quizSubmitted}
                        onChange={e => {
                          let cur = (userAns||'').toUpperCase().split('').filter(Boolean);
                          if (e.target.checked) cur.push(o.letter);
                          else cur = cur.filter(l => l !== o.letter);
                          handleQuizAnswer(item.id, [...new Set(cur)].sort().join(''));
                        }} />{o.label}
                    </label>
                  );
                })}
              </div>
              {quizSubmitted && <QuizResult isCorrect={isCorrect} item={item} />}
            </div>
          )}

          {/* 主观题 */}
          {isManual && (
            <div className="error-quiz__input-area">
              <textarea className="error-quiz__textarea" rows={4} value={userAns}
                onChange={e => handleQuizAnswer(item.id, e.target.value)} disabled={quizSubmitted}
                placeholder="输入你的回答..." />
              {quizSubmitted && (
                <div className="error-quiz__result">
                  <p className="error-quiz__ref-answer">你的原答：{item.user_answer || '(未填)'}</p>
                  <p className="error-quiz__ref-answer" style={{color:'var(--color-success)'}}>参考答案：{item.correct_answer}</p>
                </div>
              )}
            </div>
          )}

          {!quizSubmitted && (
            <div className="error-quiz__nav">
              <button className="btn btn--outline btn--sm" disabled={quizIdx===0} onClick={()=>setQuizIdx(i=>i-1)}>← 上一题</button>
              <button className="btn btn--outline btn--sm" disabled={quizIdx>=quizItems.length-1} onClick={()=>setQuizIdx(i=>i+1)}>下一题 →</button>
            </div>
          )}
        </div>

        <div className="error-quiz__footer">
          {!quizSubmitted ? (
            <button className="btn btn--primary btn--lg btn--block" onClick={submitQuiz} disabled={quizItems.length===0}>提交复测 ({quizItems.length} 题)</button>
          ) : (
            <button className="btn btn--primary btn--lg btn--block" onClick={exitQuiz}>完成，返回错题本</button>
          )}
        </div>
      </div>
    );
  }

  // ===== 列表模式 =====
  if (loading) return <div className="page-loading">加载中...</div>;
  if (!errors.length) return (
    <div className="empty-hint">
      <p>🎉 暂无错题</p>
      <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-hint)' }}>继续完成更多测试吧</p>
    </div>
  );

  const dueIds = new Set(dueErrors.map(e => e.id));

  return (
    <div className="error-list">
      {dueErrors.length > 0 && (
        <div className="due-section">
          <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:12 }}>
            <h3 className="due-section__title" style={{margin:0}}>📅 今日待复习 · {dueErrors.length} 题</h3>
            <button className="btn btn--primary btn--sm" onClick={startQuiz}>🧪 开始复测</button>
          </div>
          {dueErrors.map(e => <ErrorBookItem key={e.id} error={e} onMastery={handleMastery} onResolve={handleResolve} />)}
        </div>
      )}

      <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:12 }}>
        <h3 className="due-section__title" style={{color:'var(--color-text-secondary)',margin:0}}>全部错题 · {errors.length} 题</h3>
        {dueErrors.length===0 && errors.length>0 && (
          <button className="btn btn--primary btn--sm" onClick={startQuiz}>🧪 开始复测</button>
        )}
      </div>
      {errors.map(e => <ErrorBookItem key={e.id} error={e} onMastery={handleMastery} onResolve={handleResolve} isDue={dueIds.has(e.id)} />)}
    </div>
  );
}

function QuizResult({ isCorrect, item }) {
  return (
    <div className="error-quiz__result">
      {isCorrect ? <span className="error-quiz__correct-mark">✓ 回答正确！</span> : <span className="error-quiz__wrong-mark">✗ 不正确</span>}
      <p className="error-quiz__ref-answer">原错答：{item.user_answer || '(未填/未选)'}</p>
      <p className="error-quiz__ref-answer" style={{color:'var(--color-success)'}}>正确答案：{item.correct_answer}</p>
    </div>
  );
}
