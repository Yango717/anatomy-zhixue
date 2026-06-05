import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "../utils/api";
import { useAIContext } from "../components/ai/AIContextProvider";
import AIHintButton from "../components/ai/AIHintButton";
import AIReviewPanel from "../components/ai/AIReviewPanel";

const SECTIONS = [
  { key: "骨学", label: "骨学", icon: "🧑" },
  { key: "关节学", label: "关节学", icon: "🔆" },
  { key: "肌学", label: "肌学", icon: "🦭" },
];

const STEP_LABELS = ["知识闪卡记背", "图谱闪卡识记", "小测验", "错题回顾", "错题复测"];

function getOptions(q) {
  if (Array.isArray(q.options) && q.options.length > 0) return q.options;
  if (q.type === "true_false") return ["A. 正确", "B. 错误"];
  return ["A", "B", "C", "D", "E"];
}

// 题目类型中文标签
const TYPE_LABEL = {
  fill_blank: "填空题",
  multiple_choice: "单选题",
  multi_select: "多选题",
  true_false: "判断题",
  term_explanation: "名词解释",
  short_answer: "简答题",
  essay: "论述题",
  atlas_structure_fill: "图谱填空",
};


export default function MotionFlowPage() {
  const [searchParams] = useSearchParams();
  const chapter = searchParams.get("chapter") || "chapter-01";
  const section = searchParams.get("section") || (chapter === "chapter-01" ? "骨学" : "消化系统");
  const subsection = searchParams.get("subsection") || "";

  const { autoPilotEnabled, registerActivityComplete } = useAIContext();
  const unitId = chapter + ":" + section + (subsection ? ":" + subsection : "");

  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(true);

  const [knowledgeCards, setKnowledgeCards] = useState([]);
  const [cardIndex, setCardIndex] = useState(0);
  const [flipped, setFlipped] = useState(new Set());

  const [atlasCards, setAtlasCards] = useState([]);
  const [atlasIndex, setAtlasIndex] = useState(0);

  const [poolQuestions, setPoolQuestions] = useState([]);
  const [quizQuestions, setQuizQuestions] = useState([]);
  const [quizAnswers, setQuizAnswers] = useState({});
  const [quizSubmitted, setQuizSubmitted] = useState(false);
  const [quizResults, setQuizResults] = useState([]);
  const [cardMapIndex, setCardMapIndex] = useState({});

  const [errorReviewCards, setErrorReviewCards] = useState(null);
  const [errorCardIdx, setErrorCardIdx] = useState(0);

  const [reTestQuestions, setReTestQuestions] = useState([]);
  const [reTestAnswers, setReTestAnswers] = useState({});
  const [reTestSubmitted, setReTestSubmitted] = useState(false);
  const [reTestResults, setReTestResults] = useState([]);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.get("/motion/knowledge-cards", { chapter, section, subsection }).catch(() => []),
      api.get("/motion/atlas-cards", { chapter, section }).catch(() => []),
      api.get("/motion/question-card-map", { chapter }).catch(() => []),
      api.get("/motion/practice-pool", { chapter }).catch(() => ({ questions: [] })),
    ]).then(([kc, ac, cm, pool]) => {
      const knowledgeArr = Array.isArray(kc) ? kc : [];
      let atlasArr = Array.isArray(ac) ? ac : [];
      const mapData = Array.isArray(cm) ? cm : [];

      // 若有 subsection，在图谱卡中通过 tag 匹配筛选
      if (subsection && knowledgeArr.length > 0) {
        const kcTags = new Set();
        knowledgeArr.forEach(c => (c.tags || []).forEach(t => kcTags.add(t)));
        atlasArr = atlasArr.filter(a =>
          (a.tags || []).some(t => kcTags.has(t) || [...kcTags].some(kt => t.includes(kt) || kt.includes(t)))
        );
      }

      // 若有 subsection，通过 card_map 筛选练习题
      let filteredPool = [];
      const poolData = pool?.questions ? pool : (pool?.data || pool);
      const allQuestions = poolData?.questions || [];

      if (subsection && knowledgeArr.length > 0) {
        const kcIds = new Set(knowledgeArr.map(c => c.id));
        // 找出该 subsection 关联的 (q_type, q_num)
        const allowedKeys = new Set();
        for (const m of mapData) {
          if ((m.refs || []).some(ref => kcIds.has(ref))) {
            allowedKeys.add(m.q_type + "::" + m.q_num);
          }
        }
        // 按 pool 中各题型的自然顺序分配 q_num，筛选在 allowedKeys 中的题目
        const counters = { "fill-blank": 0, "choice-A": 0, "choice-X": 0 };
        const poolTypeToMap = { fill_blank: "fill-blank", multiple_choice: "choice-A", multi_select: "choice-X", true_false: "choice-A", atlas_structure_fill: "fill-blank" };
        for (const q of allQuestions) {
          const mt = poolTypeToMap[q.type];
          if (!mt) continue; // 主观题不参与筛选
          counters[mt]++;
          if (allowedKeys.has(mt + "::" + counters[mt])) {
            filteredPool.push(q);
          }
        }
      } else {
        filteredPool = allQuestions;
      }

      setKnowledgeCards(knowledgeArr);
      setAtlasCards(atlasArr);
      const idx = {};
      for (const m of mapData) idx[m.q_type + "::" + m.q_num] = m.refs;
      setCardMapIndex(idx);
      setPoolQuestions(filteredPool);
      setLoading(false);
    });
  }, [section, subsection]);

  const buildQuiz = useCallback(() => {
    const typeCounters = { "fill-blank": 0, "choice-A": 0, "choice-X": 0 };
    const picked = [];
    // 题型配置：poolType → { mapType, take }。mapType 为 null 表示不参与错题关联
    const types = [
      { poolType: "fill_blank", mapType: "fill-blank", take: 5 },
      { poolType: "multiple_choice", mapType: "choice-A", take: 5 },
      { poolType: "multi_select", mapType: "choice-X", take: 5 },
      { poolType: "true_false", mapType: "choice-A", take: 3 },
      { poolType: "term_explanation", mapType: null, take: 2 },
      { poolType: "short_answer", mapType: null, take: 2 },
      { poolType: "essay", mapType: null, take: 1 },
      { poolType: "atlas_structure_fill", mapType: "fill-blank", take: 3 },
    ];
    for (const t of types) {
      const subset = poolQuestions.filter(q => q.type === t.poolType).slice(0, t.take);
      for (const q of subset) {
        const mapType = t.mapType || t.poolType;
        if (t.mapType) typeCounters[t.mapType]++;
        picked.push({ ...q, _qType: mapType, _qNum: t.mapType ? typeCounters[t.mapType] : 0 });
      }
    }
    setQuizQuestions(picked);
    setQuizAnswers({});
    setQuizSubmitted(false);
    setQuizResults([]);
  }, [poolQuestions]);

  useEffect(() => {
    if (poolQuestions.length > 0 && step === 2) buildQuiz();
  }, [poolQuestions, step, buildQuiz]);

  function flipCard(id) {
    setFlipped(prev => new Set([...prev, id]));
  }

  function handleQuizAnswer(qId, value) {
    setQuizAnswers(prev => ({ ...prev, [qId]: value }));
  }

  function checkAnswer(q, userAns) {
    if (q.type === "fill_blank" || q.type === "atlas_structure_fill") {
      // 多空填空题：userAns 是 { "id_0": "值1", "id_1": "值2", ... } 的对象
      if (typeof userAns === "object" && userAns !== null) {
        const blanks = q.blanks || [];
        if (blanks.length === 0) return false;
        return blanks.every((b, i) =>
          (userAns[q.id + "_" + i] || "").trim().toLowerCase() === (b.answer || "").trim().toLowerCase()
        );
      }
      return (userAns || "").trim().toLowerCase() === (q.answer || "").trim().toLowerCase();
    }
    if (q.type === "multiple_choice" || q.type === "true_false") {
      return (userAns || "").trim().toUpperCase() === (q.answer || "").trim().toUpperCase();
    }
    if (q.type === "term_explanation" || q.type === "short_answer" || q.type === "essay") {
      // 主观题无法自动判断，提交后由用户自行对照参考答案
      return null;
    }
    // multi_select：集合比较
    const uSet = new Set((userAns || "").split(",").map(s => s.trim().toUpperCase()).filter(Boolean));
    const cSet = new Set((q.answer || "").split(",").map(s => s.trim().toUpperCase()).filter(Boolean));
    return uSet.size === cSet.size && [...uSet].every(v => cSet.has(v));
  }

  function handleQuizSubmit() {
    const results = quizQuestions.map(q => {
      const userAns = quizAnswers[q.id] || "";
      return { q, userAnswer: userAns, correct: checkAnswer(q, userAns) };
    });
    setQuizResults(results);
    setQuizSubmitted(true);

    // 将答错的客观题写入错题本
    const wrongOnes = results.filter(r => r.correct === false);
    if (wrongOnes.length > 0) {
      const errors = wrongOnes.map(r => ({
        question_id: r.q.id,
        question_type: r.q.type,
        question_stem: (r.q.stem || "").substring(0, 500),
        user_answer: typeof r.userAnswer === "object" ? JSON.stringify(r.userAnswer) : String(r.userAnswer),
        correct_answer: r.q.answer || "",
        explanation: r.q.explanation || "",
        options: r.q.options ? JSON.stringify(r.q.options) : "",
        unit_id: chapter + ":" + section + (subsection ? ":" + subsection : ""),
      }));
      api.post("/errorbook", { errors }).catch(() => {});
    }
    if (autoPilotEnabled) registerActivityComplete({ type: 'quiz', unitId, result: { total: results.length, correct: results.filter(r => r.correct === true).length } });
  }

  async function goToErrorReview() {
    setStep(3);
    // 只取明确错误的题（排除名词解释等 correct===null 的题型）
    const wrongOnes = quizResults.filter(r => r.correct === false);
    if (wrongOnes.length === 0) {
      setErrorReviewCards({ knowledgeCards: [], atlasCards: [] });
      return;
    }
    // 过滤掉没有 card map 映射的题型（_qNum 为 0 表示无映射）
    const mappable = wrongOnes.filter(r => r.q._qNum > 0);
    const errors = mappable.map(r => ({ q_type: r.q._qType, q_num: r.q._qNum }));
    try {
      const res = await api.post("/motion/error-card-refs", { chapter, errors });
      setErrorReviewCards(res?.data || res || { knowledgeCards: [], atlasCards: [] });
      setErrorCardIdx(0);
    } catch {
      setErrorReviewCards({ knowledgeCards: [], atlasCards: [] });
    }
  }

  function goToReTest() {
    setStep(4);
    if (autoPilotEnabled) registerActivityComplete({ type: 'error_review', unitId });
    // 只复测明确错误的题（排除名词解释等 correct===null 的题型）
    const wrongOnes = quizResults.filter(r => r.correct === false).map(r => r.q);
    setReTestQuestions(wrongOnes);
    setReTestAnswers({});
    setReTestSubmitted(false);
    setReTestResults([]);
  }

  function handleReTestAnswer(qId, value) {
    setReTestAnswers(prev => ({ ...prev, [qId]: value }));
  }

  function handleReTestSubmit() {
    const results = reTestQuestions.map(q => ({
      q,
      userAnswer: reTestAnswers[q.id] || "",
      correct: checkAnswer(q, reTestAnswers[q.id] || ""),
    }));
    setReTestResults(results);
    setReTestSubmitted(true);
    if (autoPilotEnabled) registerActivityComplete({ type: 'test', unitId, result: { total: results.length, correct: results.filter(r => r.correct === true).length } });
  }

  if (loading) return <div className="page-loading">加载中...</div>;

  const allReviewCards = errorReviewCards
    ? [...(errorReviewCards.knowledgeCards || []), ...(errorReviewCards.atlasCards || [])]
    : [];

  function renderQuizItems(questions, answers, submitted, results, onAnswer, isReTest) {
    return questions.map((q, qi) => {
      const result = results[qi];
      const isCorrect = result?.correct;
      const needsManual = isCorrect === null; // 名词解释等需人工判断
      const cls = submitted
        ? (needsManual ? "motion-quiz-item--manual" : isCorrect ? "motion-quiz-item--correct" : "motion-quiz-item--wrong")
        : "";
      const typeLabel = TYPE_LABEL[q.type] || q.type;
      const isBlankType = q.type === "fill_blank" || q.type === "atlas_structure_fill";
      const isOptionType = q.type === "multiple_choice" || q.type === "multi_select" || q.type === "true_false";
      const isRadio = q.type === "multiple_choice" || q.type === "true_false";

      // 填空题：把 blanks 对象转成可读字符串
      function formatFillAnswer(userAns, blanks) {
        if (typeof userAns === "object" && userAns !== null) {
          return (blanks || []).map((b, i) => userAns[q.id + "_" + i] || "（未填）").join("、");
        }
        return userAns || "（未填）";
      }

      return (
        <div key={q.id} className={"motion-quiz-item " + cls}>
          <div className="motion-quiz-item__header">
            <span className="motion-quiz-item__num">{qi + 1}.</span>
            <span className="motion-quiz-item__type">{typeLabel}</span>
          </div>
          <div className="motion-quiz-item__stem">
            {(() => {
              if (!isBlankType) return <span>{q.stem}</span>;
              // Try splitting on ___ or \___ patterns
              const parts = q.stem.split(/\\?_+/);
              const blanks = q.blanks || [];
              if (parts.length > 1) {
                // Stem has inline blank markers
                return parts.map((part, pi, arr) => (
                  <span key={pi}>
                    {part}
                    {pi < arr.length - 1 && (
                      <input className="motion-quiz-item__blank"
                        value={answers[q.id + "_" + pi] || ""}
                        onChange={e => onAnswer(q.id, { ...answers, [q.id + "_" + pi]: e.target.value })}
                        disabled={submitted} placeholder="____" />
                    )}
                  </span>
                ));
              } else {
                // No inline markers — append blank inputs after stem
                return (
                  <span>
                    {q.stem}{" "}
                    {blanks.map((b, bi) => (
                      <span key={bi}>
                        <input className="motion-quiz-item__blank"
                          value={answers[q.id + "_" + bi] || ""}
                          onChange={e => onAnswer(q.id, { ...answers, [q.id + "_" + bi]: e.target.value })}
                          disabled={submitted} placeholder={"(" + (bi+1) + ")"} />
                        {bi < blanks.length - 1 ? "、" : ""}
                      </span>
                    ))}
                  </span>
                );
              }
            })()}
          </div>

          {/* 填空/图谱填空：提交后显示答案 */}
          {isBlankType && submitted && (
            <div className="motion-quiz-item__answer">
              正确答案：{q.answer}
              {!isCorrect && <span className="motion-quiz-item__your-answer">&nbsp;你的回答：{formatFillAnswer(answers[q.id], q.blanks)}</span>}
            </div>
          )}

          {/* 选择/判断：选项列表 */}
          {isOptionType && (
            <div className="motion-quiz-item__options">
              {getOptions(q).map((opt, oi) => {
                const isOptObj = typeof opt === "object" && opt !== null;
                const letter = isOptObj ? opt.key : String.fromCharCode(65 + oi);
                const rawLabel = isOptObj ? opt.text : (typeof opt === "string" ? opt.replace(/^[A-E]\.\s*/, "") : String(opt));
                const checked = isRadio
                  ? answers[q.id] === letter
                  : (answers[q.id] || "").includes(letter);
                const optCls = checked ? "motion-quiz-item__opt--selected" : "";
                return (
                  <label key={oi} className={"motion-quiz-item__opt " + optCls}>
                    <input type={isRadio ? "radio" : "checkbox"}
                      name={q.id} value={letter} checked={checked}
                      onChange={e => {
                        if (isRadio) { onAnswer(q.id, e.target.value); return; }
                        const cur = (answers[q.id] || "").split(",").filter(Boolean);
                        if (e.target.checked) cur.push(letter);
                        else { const ci = cur.indexOf(letter); if (ci >= 0) cur.splice(ci, 1); }
                        onAnswer(q.id, cur.join(","));
                      }} disabled={submitted} />
                    {rawLabel.startsWith(letter + ". ") || rawLabel.startsWith(letter + "、") || rawLabel.startsWith(letter + " ")
                      ? rawLabel
                      : letter + ". " + rawLabel}
                  </label>
                );
              })}
            </div>
          )}
          {isOptionType && submitted && (
            <div className="motion-quiz-item__answer">
              正确答案：{q.answer}
              {!isCorrect && !needsManual && <span className="motion-quiz-item__your-answer">&nbsp;你的回答：{answers[q.id] || "（未选）"}</span>}
            </div>
          )}

          {/* 主观题：textarea（名词解释/简答/论述） */}
          {(q.type === "term_explanation" || q.type === "short_answer" || q.type === "essay") && (
            <div className="motion-quiz-item__explain">
              <textarea
                className="motion-quiz-item__textarea"
                rows={4}
                placeholder="请输入你的解释..."
                value={answers[q.id] || ""}
                onChange={e => onAnswer(q.id, e.target.value)}
                disabled={submitted}
              />
              {submitted && (
                <div className="motion-quiz-item__answer">
                  <strong>参考答案：</strong>{q.answer}
                </div>
              )}
            </div>
          )}

          {/* 妍学姐 AI 提示 */}
          {!submitted && <div style={{ marginTop: 8 }}><AIHintButton questionStem={q.stem || ''} /></div>}
        </div>
      );
    });
  }

  return (
    <div className="page motion-flow">
      <div className="motion-flow__header">
        <h1 className="motion-flow__title">
          {SECTIONS.find(s => s.key === section)?.icon || ""} {section}{subsection ? " · " + subsection : ""} · 五步学习流</h1>
      </div>
      <div className="motion-flow__steps">
        {STEP_LABELS.map((label, i) => {
          // 无图谱时隐藏图谱步骤
          if (i === 1 && atlasCards.length === 0) return null;
          const skippedBefore = (!atlasCards.length && i > 1) ? 1 : 0;
          const displayNum = i + 1 - skippedBefore;
          return (
            <div key={i}
              className={"motion-flow__step" + (i === step ? " motion-flow__step--active" : "") + (i < step ? " motion-flow__step--done" : "")}
              onClick={() => i < step && setStep(i)}>
              <span className="motion-flow__step-num">{displayNum}</span>
              <span className="motion-flow__step-label">{label}</span>
            </div>
          );
        })}
      </div>
      <div className="motion-flow__body">
        {step === 0 && (
          <div className="motion-step">
            <h2 className="motion-step__title">知识闪卡记背</h2>
            <p className="motion-step__hint">{knowledgeCards.length} 张闪卡 · 已翻 {flipped.size} 张 · 点击卡片翻转查看答案</p>
            {knowledgeCards.length === 0 ? (
              <div className="empty-hint">该章节暂无知识闪卡</div>
            ) : (
              <>
                <div className="motion-step__progress">
                  <div className="motion-step__progress-bar">
                    <div className="motion-step__progress-fill"
                      style={{ width: knowledgeCards.length ? `${(flipped.size / knowledgeCards.length) * 100}%` : "0%" }} />
                  </div>
                </div>
                <div className={"motion-flashcard" + (flipped.has(knowledgeCards[cardIndex]?.id) ? " motion-flashcard--flipped" : "")}
                  onClick={() => knowledgeCards[cardIndex] && flipCard(knowledgeCards[cardIndex].id)}>
                  <div className="motion-flashcard__inner">
                    <div className="motion-flashcard__front">
                      <span className="motion-flashcard__tag">知识点</span>
                      <p>{knowledgeCards[cardIndex]?.front}</p>
                      {knowledgeCards[cardIndex]?.subsection && (
                        <span className="motion-flashcard__meta">{knowledgeCards[cardIndex].section} · {knowledgeCards[cardIndex].subsection}</span>
                      )}
                    </div>
                    <div className="motion-flashcard__back">
                      <span className="motion-flashcard__tag">答案</span>
                      <p>{knowledgeCards[cardIndex]?.back}</p>
                      {knowledgeCards[cardIndex]?.tags && (
                        <div className="motion-flashcard__tags">
                          {knowledgeCards[cardIndex].tags.map(t => <span key={t} className="motion-flashcard__chip">{t}</span>)}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                <div className="motion-flashcard__hint">点击卡片翻转查看答案</div>
                <div className="motion-step__nav">
                  <button className="btn btn--outline btn--sm" disabled={cardIndex === 0} onClick={() => setCardIndex(i => i - 1)}>← 上一张</button>
                  <span className="motion-step__pos">{cardIndex + 1} / {knowledgeCards.length}</span>
                  <button className="btn btn--outline btn--sm" disabled={cardIndex >= knowledgeCards.length - 1} onClick={() => setCardIndex(i => i + 1)}>下一张 →</button>
                </div>
                <button className="btn btn--primary btn--lg btn--block" style={{ marginTop: 16 }}
                  onClick={() => {
                    if (autoPilotEnabled) registerActivityComplete({ type: 'learn', unitId });
                    if (atlasCards.length > 0) { setStep(1); setAtlasIndex(0); }
                    else { setStep(2); buildQuiz(); }
                  }}>
                  {atlasCards.length > 0 ? "完成记背，进入图谱识记 →" : "完成记背，开始测验 →"}
                </button>
              </>
            )}
          </div>
        )}
{step === 1 && (
          <div className="motion-step">
            <h2 className="motion-step__title">图谱闪卡识记</h2>
            <p className="motion-step__hint">{atlasCards.length} 张图谱 · 识记关键解剖结构</p>
            {atlasCards.length === 0 ? (
              <div className="empty-hint">暂无图谱数据</div>
            ) : (
              <>
                <div className="motion-atlas-card">
                  <div className="motion-atlas-card__header">
                    <span className="motion-atlas-card__page">ð 第{atlasCards[atlasIndex]?.page}页</span>
                    <span className="motion-atlas-card__title">{atlasCards[atlasIndex]?.title}</span>
                  </div>
                  <div className="motion-atlas-card__image-ref">
                    <p className="motion-atlas-card__image-name">ð¼ï¸ {atlasCards[atlasIndex]?.image}</p>
                    <p className="motion-atlas-card__image-hint">图谱图片待匹配到实际文件</p>
                  </div>
                  <div className="motion-atlas-card__structures">
                    <h4>需识记结构：</h4>
                    <ul>
                      {(atlasCards[atlasIndex]?.structures || []).map((s, si) => (
                        <li key={si}><strong>{s.label}</strong>{s.desc ? " —— " + s.desc : ""}</li>
                      ))}
                    </ul>
                  </div>
                </div>
                <div className="motion-step__nav">
                  <button className="btn btn--outline btn--sm" disabled={atlasIndex === 0} onClick={() => setAtlasIndex(i => i - 1)}>← 上一张</button>
                  <span className="motion-step__pos">{atlasIndex + 1} / {atlasCards.length}</span>
                  <button className="btn btn--outline btn--sm" disabled={atlasIndex >= atlasCards.length - 1} onClick={() => setAtlasIndex(i => i + 1)}>下一张 →</button>
                </div>
                <div style={{ display: "flex", gap: 12, marginTop: 16 }}>
                  <button className="btn btn--outline btn--lg" style={{ flex: 1 }} onClick={() => setStep(0)}>← 返回闪卡</button>
                  <button className="btn btn--primary btn--lg" style={{ flex: 1 }} onClick={() => { if (autoPilotEnabled) registerActivityComplete({ type: 'learn', unitId }); setStep(2); buildQuiz(); }}>完成识记，开始测验 →</button>
                </div>
              </>
            )}
          </div>
        )}
{step === 2 && (
          <div className="motion-step">
            <h2 className="motion-step__title">小测验</h2>
            <p className="motion-step__hint">{quizQuestions.length} 道题（填空 · 单选 · 多选）</p>
            {renderQuizItems(quizQuestions, quizAnswers, quizSubmitted, quizResults, handleQuizAnswer, false)}
            {!quizSubmitted ? (
              <button className="btn btn--primary btn--lg btn--block" style={{ marginTop: 16 }}
                onClick={handleQuizSubmit} disabled={quizQuestions.length === 0}>提交测验</button>
            ) : (
              <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 12 }}>
                <div className="motion-step__score">
                  {quizResults.filter(r => r.correct === true).length} / {quizResults.filter(r => r.correct !== null).length} 正确
                  {quizResults.some(r => r.correct === null) && <span className="motion-step__score-note">（主观题需自行对照参考答案）</span>}
                  {quizResults.every(r => r.correct === true) ? " 🎉" : ""}
                </div>
                <div style={{ display: "flex", gap: 12 }}>
                  {quizResults.some(r => r.correct === false) && (
                    <button className="btn btn--primary btn--lg" style={{ flex: 1 }} onClick={goToErrorReview}>错题回顾 →</button>
                  )}
                  <button className={"btn btn--lg" + (quizResults.some(r => r.correct === false) ? " btn--outline" : " btn--primary")}
                    style={{ flex: 1 }} onClick={() => setStep(0)}>
                    {quizResults.some(r => r.correct === false) ? "跳过回顾" : "完成"}
                  </button>
                </div>

                {/* 妍学姐 AI 测验总结 */}
                <AIReviewPanel />
              </div>
            )}
          </div>
        )}
{step === 3 && (
          <div className="motion-step">
            <h2 className="motion-step__title">错题回顾</h2>
            <p className="motion-step__hint">根据错题关联的知识点进行巩固复习</p>
            {allReviewCards.length === 0 ? (
              <div className="empty-hint">
                {quizResults.filter(r => !r.correct).length === 0 ? "全部正确！无需回顾 ð" : "未找到关联闪卡，请手动复习"}
              </div>
            ) : (
              <>
                <div className="motion-step__progress">
                  <div className="motion-step__progress-bar">
                    <div className="motion-step__progress-fill"
                      style={{ width: `${((errorCardIdx + 1) / allReviewCards.length) * 100}%` }} />
                  </div>
                </div>
                {allReviewCards[errorCardIdx]?.type === "atlas" ? (
                  <div className="motion-atlas-card">
                    <div className="motion-atlas-card__header">
                      <span className="motion-atlas-card__tag">图谱回顾</span>
                      <span className="motion-atlas-card__title">{allReviewCards[errorCardIdx]?.title}</span>
                    </div>
                    <div className="motion-atlas-card__structures">
                      <ul>
                        {(allReviewCards[errorCardIdx]?.structures || []).map((s, si) => (
                          <li key={si}><strong>{s.label}</strong>{s.desc ? " —— " + s.desc : ""}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                ) : (
                  <div className="motion-flashcard motion-flashcard--flipped">
                    <div className="motion-flashcard__inner">
                      <div className="motion-flashcard__front">
                        <span className="motion-flashcard__tag">知识点</span>
                        <p>{allReviewCards[errorCardIdx]?.front}</p>
                      </div>
                      <div className="motion-flashcard__back">
                        <span className="motion-flashcard__tag">答案</span>
                        <p>{allReviewCards[errorCardIdx]?.back}</p>
                      </div>
                    </div>
                  </div>
                )}
                <div className="motion-step__nav">
                  <button className="btn btn--outline btn--sm" disabled={errorCardIdx === 0} onClick={() => setErrorCardIdx(i => i - 1)}>← 上一张</button>
                  <span className="motion-step__pos">{errorCardIdx + 1} / {allReviewCards.length}</span>
                  <button className="btn btn--outline btn--sm" disabled={errorCardIdx >= allReviewCards.length - 1} onClick={() => setErrorCardIdx(i => i + 1)}>下一张 →</button>
                </div>
                <button className="btn btn--primary btn--lg btn--block" style={{ marginTop: 16 }} onClick={goToReTest}>复习完，开始错题复测 →</button>
              </>
            )}
          </div>
        )}
{step === 4 && (
          <div className="motion-step">
            <h2 className="motion-step__title">错题复测</h2>
            <p className="motion-step__hint">{reTestQuestions.length} 道错题重新检测</p>
            {reTestQuestions.length === 0 ? (
              <div className="empty-hint">没有需要复测的题目</div>
            ) : (
              <>
                {renderQuizItems(reTestQuestions, reTestAnswers, reTestSubmitted, reTestResults, handleReTestAnswer, true)}
                {!reTestSubmitted ? (
                  <button className="btn btn--primary btn--lg btn--block" style={{ marginTop: 16 }} onClick={handleReTestSubmit}>提交复测</button>
                ) : (
                  <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 12 }}>
                    <div className="motion-step__score">
                      复测：{reTestResults.filter(r => r.correct === true).length} / {reTestResults.length} 正确
                      {reTestResults.every(r => r.correct === true) ? " 🎉" : ""}
                    </div>
                    <button className="btn btn--primary btn--lg btn--block" onClick={() => setStep(0)}>返回开始</button>

                    {/* 妍学姐 AI 复测总结 */}
                    <AIReviewPanel />
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

