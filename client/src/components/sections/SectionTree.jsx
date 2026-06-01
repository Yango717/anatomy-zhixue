import { useState } from 'react';
import UnitItem from './UnitItem';
import { useProgress } from '../../hooks/useProgress';

export default function SectionTree({ sections, chapterId }) {
  const progress = useProgress(chapterId);
  const [expanded, setExpanded] = useState(() => {
    const init = {};
    (sections || []).forEach((s) => { init[s.id] = true; });
    return init;
  });

  function toggle(sectionId) {
    setExpanded((prev) => ({ ...prev, [sectionId]: !prev[sectionId] }));
  }

  if (!sections?.length) return <p className="empty-hint">暂无内容</p>;

  return (
    <div className="section-tree">
      {sections.map((section) => (
        <div key={section.id} className="section-group">
          <button
            className="section-group__header"
            onClick={() => toggle(section.id)}
          >
            <span className={`section-group__arrow ${expanded[section.id] ? 'section-group__arrow--open' : ''}`}>▶</span>
            <span className="section-group__icon">📖</span>
            <span className="section-group__title">{section.title}</span>
          </button>
          {expanded[section.id] && (
            <div className="section-group__body">
              {(section.subsections || []).map((sub) => (
                <div key={sub.id} className="subsection-block">
                  <span className="subsection-block__label">{sub.title}</span>
                  <div className="unit-list">
                    {(sub.parts || []).map((part) => (
                      <UnitItem
                        key={part.id}
                        part={part}
                        chapterId={chapterId}
                        sectionId={chapterId}
                        subsectionId={sub.id}
                        phase={progress[`${sub.id}-part-${part.id}`] ?? 0}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
