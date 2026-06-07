import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../utils/api';
import { PHASE_LABELS } from '../utils/constants';
import SystemProgressRing from '../components/systems/SystemProgressRing';
import SystemIcon from '../components/systems/SystemIcon';

const PHASE_COLORS = {
  0: '#CCCCCC', 1: '#3498DB', 2: '#F1C40F',
  3: '#1ABC9C', 4: '#9B59B6', 5: '#1e6b9b',
};

function countUnits(chapter) {
  let n = 0;
  for (const s of (chapter.sections || []))
    for (const sub of (s.subsections || []))
      n += (sub.parts || []).length;
  return n;
}

// 各章节子分类定义 — 与 knowledge_cards.json 的 subsection 字段一致
const CHAPTER_MOTION_CONFIG = {
  "chapter-01": {
    icon: "🧬",
    groups: [
      {
        section: "骨学", icon: "🧬",
        subs: [
          { key: "系统总论", label: "系统总论", cards: 1 },
          { key: "骨的概述", label: "骨的概述", cards: 15 },
          { key: "躯干骨-椎骨", label: "躯干骨 · 椎骨", cards: 15 },
          { key: "躯干骨-胸骨和肋", label: "躯干骨 · 胸骨和肋", cards: 5 },
          { key: "颅骨", label: "颅骨", cards: 24 },
          { key: "附肢骨-上肢", label: "附肢骨 · 上肢", cards: 10 },
          { key: "附肢骨-下肢", label: "附肢骨 · 下肢", cards: 13 },
          { key: "骨性标志", label: "骨性标志", cards: 4 },
        ],
      },
      {
        section: "关节学", icon: "🔗",
        subs: [
          { key: "关节概述", label: "关节概述", cards: 9 },
          { key: "脊柱和胸廓", label: "脊柱和胸廓", cards: 6 },
          { key: "颅骨连结", label: "颅骨连结", cards: 2 },
          { key: "上肢关节", label: "上肢关节", cards: 7 },
          { key: "下肢关节", label: "下肢关节", cards: 11 },
        ],
      },
      {
        section: "肌学", icon: "💪",
        subs: [
          { key: "肌的概述", label: "肌的概述", cards: 6 },
          { key: "头肌", label: "头肌", cards: 5 },
          { key: "颈肌", label: "颈肌", cards: 2 },
          { key: "躯干肌", label: "躯干肌", cards: 8 },
          { key: "上肢肌", label: "上肢肌", cards: 6 },
          { key: "下肢肌", label: "下肢肌", cards: 8 },
        ],
      },
    ],
  },
  "chapter-02": {
    icon: "🍽",
    groups: [
      { section: "消化系统", icon: "🍽", subs: [
        { key: "系统总论", label: "系统总论", cards: 2 },
        { key: "口腔的境界与分部", label: "口腔", cards: 4 },
        { key: "牙的萌出与脱落", label: "牙的萌出与脱落", cards: 3 },
        { key: "牙的形态与结构", label: "牙的形态与结构", cards: 5 },
        { key: "舌的形态与分部", label: "舌", cards: 6 },
        { key: "大唾液腺", label: "唾液腺", cards: 2 },
        { key: "咽的位置与分部", label: "咽", cards: 4 },
        { key: "食管的位置与分部", label: "食管", cards: 2 },
        { key: "胃的形态与分部", label: "胃", cards: 4 },
        { key: "十二指肠的形态与分部", label: "十二指肠", cards: 4 },
        { key: "空肠与回肠的比较", label: "空肠与回肠", cards: 3 },
        { key: "盲肠与阑尾", label: "盲肠与阑尾", cards: 3 },
        { key: "结肠的形态与分部", label: "结肠", cards: 1 },
        { key: "直肠与肛管", label: "直肠与肛管", cards: 2 },
        { key: "肛管的结构", label: "肛管", cards: 4 },
        { key: "肝的形态与结构", label: "肝", cards: 6 },
        { key: "胆囊与胆管", label: "胆囊与胆管", cards: 3 },
        { key: "胰的形态与结构", label: "胰", cards: 3 },
        { key: "腹膜与腹膜腔", label: "腹膜", cards: 3 },
      ]},
    ],
  },
  "chapter-03": {
    icon: "🫁",
    groups: [
      { section: "呼吸系统", icon: "🫁", subs: [
        { key: "系统总论", label: "系统总论", cards: 2 },
        { key: "鼻腔的分部与鼻中隔", label: "鼻腔", cards: 4 },
        { key: "鼻旁窦的位置与开口", label: "鼻旁窦", cards: 2 },
        { key: "喉软骨的组成", label: "喉软骨", cards: 1 },
        { key: "喉连结", label: "喉连结", cards: 1 },
        { key: "喉腔的分部", label: "喉腔", cards: 3 },
        { key: "气管的位置与结构", label: "气管", cards: 2 },
        { key: "左右主支气管的特点", label: "主支气管", cards: 1 },
        { key: "肺的形态与分叶", label: "肺的形态与分叶", cards: 2 },
        { key: "肺门与肺根", label: "肺门与肺根", cards: 1 },
        { key: "胸膜的分部", label: "胸膜", cards: 1 },
        { key: "胸膜腔与胸膜隐窝", label: "胸膜腔与隐窝", cards: 1 },
        { key: "纵隔的分部", label: "纵隔", cards: 1 },
      ]},
    ],
  },
  "chapter-04": {
    icon: "🫘",
    groups: [
      { section: "泌尿系统", icon: "🫘", subs: [
        { key: "系统总论", label: "系统总论", cards: 1 },
        { key: "肾的形态", label: "肾的形态", cards: 1 },
        { key: "肾的位置", label: "肾的位置", cards: 1 },
        { key: "肾的毗邻", label: "肾的毗邻", cards: 1 },
        { key: "肾的结构", label: "肾的结构", cards: 1 },
        { key: "肾的被膜", label: "肾的被膜", cards: 2 },
        { key: "输尿管的位置与分部", label: "输尿管", cards: 1 },
        { key: "膀胱的形态与分部", label: "膀胱形态", cards: 1 },
        { key: "膀胱三角", label: "膀胱三角", cards: 1 },
        { key: "膀胱的位置与毗邻", label: "膀胱位置与毗邻", cards: 1 },
        { key: "女性尿道特点", label: "女性尿道", cards: 1 },
      ]},
    ],
  },
  "chapter-05": {
    icon: "🫄",
    groups: [
      { section: "生殖系统", icon: "🫄", subs: [
        { key: "系统总论", label: "系统总论", cards: 1 },
        { key: "睾丸的形态与结构", label: "睾丸", cards: 2 },
        { key: "附睾", label: "附睾", cards: 1 },
        { key: "输精管的分部", label: "输精管与射精管", cards: 2 },
        { key: "前列腺", label: "前列腺", cards: 1 },
        { key: "男性尿道", label: "男性尿道", cards: 1 },
        { key: "卵巢的位置与固定", label: "卵巢", cards: 1 },
        { key: "输卵管的分部", label: "输卵管", cards: 1 },
        { key: "子宫的形态与分部", label: "子宫的形态与分部", cards: 1 },
        { key: "子宫的位置与固定", label: "子宫位置与固定", cards: 1 },
        { key: "阴道", label: "阴道", cards: 1 },
        { key: "乳房的结构", label: "乳房", cards: 1 },
        { key: "会阴的定义与分区", label: "会阴", cards: 1 },
      ]},
    ],
  },
  "chapter-09": {
    icon: "🔬",
    groups: [
      { section: "内分泌系统", icon: "🔬", subs: [
        { key: "系统总论", label: "系统总论", cards: 1 },
        { key: "垂体的位置与分部", label: "垂体位置与分部", cards: 1 },
        { key: "垂体前叶与后叶功能", label: "垂体前叶与后叶", cards: 1 },
        { key: "松果体", label: "松果体", cards: 1 },
        { key: "甲状腺的形态与位置", label: "甲状腺形态与位置", cards: 1 },
        { key: "甲状腺功能与甲状腺素", label: "甲状腺功能", cards: 1 },
        { key: "甲状旁腺的位置", label: "甲状旁腺", cards: 1 },
        { key: "肾上腺的位置与形态", label: "肾上腺位置与形态", cards: 1 },
        { key: "肾上腺皮质与髓质功能", label: "肾上腺功能", cards: 1 },
        { key: "胸腺", label: "胸腺", cards: 1 },
        { key: "睾丸功能", label: "睾丸功能", cards: 1 },
        { key: "胰岛", label: "胰岛", cards: 1 },
      ]},
    ],
  },
  "chapter-06": {
    icon: "🫀",
    groups: [
      { section: "循环系统", icon: "🫀", subs: [
        { key: "心血管系统总论", label: "心血管总论", cards: 2 },
        { key: "心的位置与外形", label: "心的位置与外形", cards: 2 },
        { key: "心腔的结构", label: "心腔的结构", cards: 3 },
        { key: "心的传导系统", label: "传导系统", cards: 1 },
        { key: "心的血管", label: "心的血管", cards: 1 },
        { key: "心包", label: "心包", cards: 1 },
        { key: "主动脉与肺动脉", label: "主动脉与肺动脉", cards: 1 },
        { key: "头颈部和上肢动脉", label: "头颈与上肢动脉", cards: 2 },
        { key: "胸腹部动脉", label: "胸腹部动脉", cards: 1 },
        { key: "盆部和下肢动脉", label: "盆部与下肢动脉", cards: 1 },
        { key: "静脉概述与上腔静脉系", label: "上腔静脉系", cards: 1 },
        { key: "下腔静脉系与门静脉系", label: "下腔静脉与门静脉", cards: 1 },
        { key: "淋巴系统概述", label: "淋巴系统", cards: 1 },
      ]},
    ],
  },
  "chapter-07": {
    icon: "👁",
    groups: [
      { section: "感觉器", icon: "👁", subs: [
        { key: "感觉器概述", label: "感觉器概述", cards: 1 },
        { key: "眼球壁的结构", label: "眼球壁", cards: 4 },
        { key: "眼球内容物", label: "眼球内容物", cards: 2 },
        { key: "眼附属器", label: "眼附属器", cards: 1 },
        { key: "眼的血管", label: "眼的血管", cards: 1 },
        { key: "外耳与中耳", label: "外耳与中耳", cards: 3 },
        { key: "内耳的结构", label: "内耳", cards: 3 },
      ]},
    ],
  },
  "chapter-08": {
    icon: "🧠",
    groups: [
      { section: "神经系统", icon: "🧠", subs: [
        { key: "神经系统总论", label: "神经系统总论", cards: 1 },
        { key: "脊髓的位置与外形", label: "脊髓外形", cards: 2 },
        { key: "脊髓的内部结构", label: "脊髓内部结构", cards: 1 },
        { key: "脑干的外形", label: "脑干外形", cards: 1 },
        { key: "脑干的内部结构", label: "脑干内部结构", cards: 1 },
        { key: "小脑", label: "小脑", cards: 1 },
        { key: "间脑", label: "间脑", cards: 2 },
        { key: "端脑的外形", label: "端脑外形", cards: 1 },
        { key: "大脑皮质的机能定位", label: "大脑皮质机能定位", cards: 1 },
        { key: "基底核与内囊", label: "基底核与内囊", cards: 1 },
        { key: "脑和脊髓的被膜", label: "脑和脊髓被膜", cards: 1 },
        { key: "脑脊液循环", label: "脑脊液循环", cards: 1 },
        { key: "脑的血管", label: "脑的血管", cards: 1 },
        { key: "脊神经概述", label: "脊神经", cards: 1 },
        { key: "脑神经概述", label: "脑神经", cards: 1 },
        { key: "内脏神经", label: "内脏神经", cards: 1 },
        { key: "感觉传导通路", label: "感觉传导通路", cards: 1 },
        { key: "运动传导通路", label: "运动传导通路", cards: 1 },
      ]},
    ],
  },
};

function ChapterMotionFlow({ chapterId, navigate, progress, chapterData }) {
  const cfg = CHAPTER_MOTION_CONFIG[chapterId];
  if (!cfg) return null;

  const totalKC = cfg.groups.reduce((s, g) => s + g.subs.reduce((ss, sub) => ss + sub.cards, 0), 0);
  const totalGroups = cfg.groups.length;
  const totalSubs = cfg.groups.reduce((s, g) => s + g.subs.length, 0);

  // 根据 chapterData 中的 sections 数据计算每个 section 的加权掌握率
  function getSectionPct(sectionTitle) {
    if (!chapterData) return 0;
    const section = (chapterData.sections || []).find(s => s.title === sectionTitle);
    if (!section) return 0;
    let total = 0, weighted = 0;
    for (const sub of section.subsections || []) {
      for (const part of sub.parts || []) {
        total++;
        const uid = `${sub.id}-part-${part.id}`;
        const phase = progress[uid] || 0;
        weighted += phase / 5; // phase 0→0%, 1→20%, 2→40%, 3→60%, 4→80%, 5→100%
      }
    }
    return total > 0 ? Math.round(weighted / total * 100) : 0;
  }

  return (
    <div style={{ padding: "12px 16px" }}>
      <div style={{ fontSize: 13, color: "var(--color-text-hint)", marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }}>
        <span>📚 {totalGroups} 个模块 · {totalSubs} 个子分类 · {totalKC} 张知识闪卡</span>
      </div>
      {cfg.groups.map(grp => {
        const sectionPct = getSectionPct(grp.section);
        return (
          <div key={grp.section} style={{ marginBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
              <span style={{ fontSize: 15, fontWeight: 600, color: "var(--color-text-primary)" }}>
                {grp.icon} {grp.section}
              </span>
              <SystemProgressRing pct={sectionPct} size={22} />
              <button
                className="btn btn--outline btn--sm"
                style={{ marginLeft: "auto", borderRadius: 8, fontSize: 11, padding: "2px 10px" }}
                onClick={() => navigate(`/motion-flow?chapter=${chapterId}&section=${encodeURIComponent(grp.section)}`)}
              >
                全部
              </button>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {grp.subs.map(sub => (
                <button
                  key={sub.key}
                  className="system-part"
                  style={{ flex: "0 0 auto", padding: "10px 14px", borderRadius: 10, border: "1px solid var(--color-border)", background: "var(--color-card)", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 2, transition: "border-color .15s, box-shadow .15s" }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--color-primary)"; e.currentTarget.style.boxShadow = "var(--shadow-sm)"; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--color-border)"; e.currentTarget.style.boxShadow = "none"; }}
                  onClick={() => navigate(`/motion-flow?chapter=${chapterId}&section=${encodeURIComponent(grp.section)}&subsection=${encodeURIComponent(sub.key)}`)}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ fontSize: 13, fontWeight: 500, color: "var(--color-text-primary)" }}>{sub.label}</span>
                    <SystemProgressRing pct={sectionPct} size={16} />
                  </div>
                  <span style={{ fontSize: 11, color: "var(--color-text-hint)" }}>{sub.cards} 张闪卡</span>
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function ModulesPage() {
  const navigate = useNavigate();
  const [chapters, setChapters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState({});
  const [progress, setProgress] = useState({}); // { [chapterId]: { [unitId]: phase } }

  useEffect(() => {
    api.get('/chapters')
      .then((d) => setChapters(d.chapters || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const loadProgress = useCallback(async (chapterId) => {
    try {
      const data = await api.get(`/progress/chapter/${chapterId}`);
      const map = {};
      // data 可能是 { units: [...] } 或直接是数组
      const items = Array.isArray(data) ? data : (data?.units || []);
      items.forEach((item) => { map[item.unitId] = item.phase ?? item.currentPhase ?? 0; });
      setProgress((prev) => ({ ...prev, [chapterId]: map }));
    } catch {}
  }, []);

  async function toggle(chapterId) {
    if (!expanded[chapterId]) {
      await loadProgress(chapterId);
    }
    setExpanded((prev) => ({ ...prev, [chapterId]: !prev[chapterId] }));
  }

  if (loading) return <div className="page-loading">加载中...</div>;

  return (
    <div className="page page--systems">
      <h2 className="page__title">系统</h2>

      <div className="system-list">
        {chapters.map((ch) => {
          const isOpen = !!expanded[ch.chapterId];
          const chProgress = progress[ch.chapterId] || {};
          const total = countUnits(ch);
          const completed = Object.values(chProgress).filter((p) => p >= 5).length;
          const pct = total > 0 ? Math.round((completed / total) * 100) : 0;

          return (
            <div key={ch.chapterId} className={`system-accordion ${isOpen ? 'system-accordion--open' : ''}`}>
              <button className="system-accordion__bar" onClick={() => toggle(ch.chapterId)}>
                <SystemIcon chapterId={ch.chapterId} size={28} />
                <div className="system-accordion__info">
                  <span className="system-accordion__title">{ch.title}</span>
                  <span className="system-accordion__meta">{total} 个知识点</span>
                </div>
                <SystemProgressRing pct={pct} size={32} />
                <span className={`system-accordion__arrow ${isOpen ? 'system-accordion__arrow--open' : ''}`}>▸</span>
              </button>

              {isOpen && (
                <div className="system-accordion__body">
              {isOpen && CHAPTER_MOTION_CONFIG[ch.chapterId] ? (
                <ChapterMotionFlow chapterId={ch.chapterId} navigate={navigate} progress={chProgress} chapterData={ch} />
              ) : (
                  (ch.sections || []).map((sec) => (
                    <div key={sec.id} className="system-section">
                      <div className="system-section__header">{sec.title}</div>
                      {(sec.subsections || []).map((sub) => (
                        <div key={sub.id} className="system-subsection">
                          {(sub.parts || []).map((part) => {
                            const uid = `${sub.id}-part-${part.id}`;
                            const phase = chProgress[uid] || 0;
                            return (
                              <button key={part.id} className="system-part"
                                onClick={() => navigate(`/learn/${encodeURIComponent(uid)}`, {
                                  state: { sectionId: sec.id, subsectionId: sub.id, partId: part.id, partTitle: part.title, chapterId: ch.chapterId }
                                })}>
                                <span className="system-part__title">{part.title}</span>
                                <span className="system-part__phase"
                                  style={{ backgroundColor: PHASE_COLORS[phase] || PHASE_COLORS[0] }}>
                                  {PHASE_LABELS[phase] || PHASE_LABELS[0]}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      ))}
                    </div>
                  ))
              )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
