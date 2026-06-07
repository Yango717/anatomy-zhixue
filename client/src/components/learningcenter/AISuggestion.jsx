import { useNavigate } from 'react-router-dom';

// sectionId 到中文名映射（MotionFlowPage 需要 section 中文名）
const SECTION_NAMES = {
  'section-01-01': '骨学',
  'section-01-02': '关节学',
  'section-01-03': '肌学',
  'section-02-01': '消化系统',
  'section-03-01': '呼吸系统',
  'section-04-01': '泌尿系统',
  'section-05-01': '生殖系统',
  'section-06-01': '心血管系统',
  'section-06-02': '淋巴系统',
  'section-07-01': '感觉器',
  'section-08-01': '中枢神经系统',
  'section-08-02': '周围神经系统',
  'section-09-01': '内分泌系统',
};

function AvatarIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c0-4 4-7 8-7s8 3 8 7" />
    </svg>
  );
}

export default function AISuggestion({ suggestions }) {
  const navigate = useNavigate();

  if (!suggestions || suggestions.length === 0) return null;

  function handleAction(action) {
    if (action.type === 'atlas') {
      // MotionFlowPage 需要 section 中文名参数
      const sectionName = SECTION_NAMES[action.sectionId] || '';
      const params = new URLSearchParams({ chapter: action.chapterId });
      if (sectionName) params.set('section', sectionName);
      navigate(`/motion-flow?${params.toString()}`);
    } else if (action.type === 'practice') {
      navigate(`/practice/${action.chapterId}`);
    } else if (action.type === 'test') {
      navigate('/exam');
    }
  }

  return (
    <div className="lc-suggestion">
      {suggestions.map((s, si) => (
        <div key={s.sectionId || si}>
          <div className="lc-suggestion__header">
            <div className="lc-suggestion__avatar">
              <AvatarIcon />
            </div>
            <span className="lc-suggestion__name">妍学姐建议</span>
          </div>
          <div className="lc-suggestion__text">{s.message}</div>
          {s.actions.map((a, ai) => (
            <button
              key={ai}
              className="lc-suggestion__action"
              onClick={() => handleAction(a)}
            >
              <span className="lc-suggestion__num">
                {ai + 1}
              </span>
              {a.label}
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}
