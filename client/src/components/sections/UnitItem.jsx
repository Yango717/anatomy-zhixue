import { useNavigate } from 'react-router-dom';

const BADGE_STYLES = {
  completed: { color: '#1e6b9b', bg: '#E3F2FD' },
  pending: { color: '#8b8b8f', bg: '#f0f0f0' },
};

export default function UnitItem({ part, chapterId, subsectionId, phase = 0 }) {
  const navigate = useNavigate();
  const unitId = `${subsectionId}-part-${part.id}`;
  const isCompleted = phase >= 1;

  function handleClick() {
    navigate(`/learn/${encodeURIComponent(unitId)}`, {
      state: { chapterId, sectionId: chapterId, subsectionId, partId: part.id, partTitle: part.title },
    });
  }

  const style = isCompleted ? BADGE_STYLES.completed : BADGE_STYLES.pending;

  return (
    <button className="unit-item" onClick={handleClick}>
      <span className="unit-item__name">{part.title}</span>
      <span
        className="unit-item__badge"
        style={{ backgroundColor: style.bg, color: style.color }}
      >
        {isCompleted ? '已完成' : '未开始'}
      </span>
    </button>
  );
}
