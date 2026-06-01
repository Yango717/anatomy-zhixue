# AI 番茄钟 iOS 原型 · Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 构建一个可交互的 AI 番茄钟 iOS 原型（单文件 HTML），4 屏 Tab 切换，计时器真实可跑，AI 数据模拟。

**Architecture:** 单文件 HTML，内嵌 React 18 + Babel standalone。AppPhone 组件管理 tab 状态和计时器状态，4 个子屏组件接收 props 和 callbacks。IosFrame 组件提供 iPhone 15 Pro 外壳。全部 CSS 通过 inline style 对象或单个 `<style>` 标签注入。

**Tech Stack:** React 18 (CDN), Babel standalone (CDN), vanilla CSS, setInterval 计时

---

## File Structure

| File | Responsibility |
|------|---------------|
| `d:/ABstuye/ai-pomodoro-prototype.html` | 唯一文件。包含 HTML 骨架、CDN 引用、IosFrame 组件、AppPhone 状态机、4 屏组件、TabBar、全部样式、计时器逻辑 |

---

### Task 1: 创建 HTML 骨架 + CDN 引用 + 全局样式

**Files:**
- Create: `d:/ABstuye/ai-pomodoro-prototype.html`

- [ ] **Step 1: 写入 HTML 骨架**

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>AI 番茄钟 · Pomodoro</title>
<script src="https://unpkg.com/react@18/umd/react.production.min.js" crossorigin></script>
<script src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js" crossorigin></script>
<script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    display: flex; align-items: center; justify-content: center;
    min-height: 100vh; background: #F2E8DC;
    font-family: -apple-system, 'SF Pro Text', sans-serif;
  }
</style>
</head>
<body>
<div id="root"></div>
<script type="text/babel">
// IosFrame component goes here
// AppPhone component goes here
// Screen components go here
// TabBar component goes here
// Render
const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<AppPhone />);
</script>
</body>
</html>
```

- [ ] **Step 2: 浏览器打开验证骨架加载无控制台错误**

Run: `npx playwright open file:///d:/ABstuye/ai-pomodoro-prototype.html` (manual check)

Expected: 空白页，无 console error，React 和 Babel 正常加载。

---

### Task 2: 内嵌 IosFrame 组件 + 全局常量

**Files:**
- Modify: `d:/ABstuye/ai-pomodoro-prototype.html` — 在 `<script type="text/babel">` 顶部插入 IosFrame 组件和 CSS 变量常量

- [ ] **Step 1: 写入 IosFrame 组件和设计常量**

在 `<script type="text/babel">` 开头插入以下代码：

```jsx
// ===== 设计常量 =====
const COLORS = {
  pageBg: '#FBF7F4',
  cardBg: '#FFFFFF',
  accent: '#C04A1A',
  ink: '#2C2416',
  secondary: '#8B7355',
  warmGray: '#F2E8DC',
  border: '#E8D5C4',
};

// ===== IosFrame — iPhone 15 Pro 外壳 =====
const iosFrameStyles = {
  wrapper: {
    display: 'inline-block',
    padding: 12,
    background: '#000',
    borderRadius: 60,
    boxShadow: '0 0 0 2px #1f2937, 0 20px 60px rgba(0,0,0,0.3)',
    position: 'relative',
  },
  screen: {
    position: 'relative',
    borderRadius: 48,
    overflow: 'hidden',
    background: '#fff',
  },
  statusBar: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    height: 54,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0 32px 0 32px',
    fontSize: 16,
    fontWeight: 600,
    fontFamily: '-apple-system, "SF Pro Text", sans-serif',
    zIndex: 20,
    pointerEvents: 'none',
  },
  dynamicIsland: {
    position: 'absolute',
    top: 12,
    left: '50%',
    transform: 'translateX(-50%)',
    width: 124, height: 36,
    background: '#000',
    borderRadius: 999,
    zIndex: 30,
  },
  content: {
    position: 'absolute',
    top: 54, left: 0, right: 0, bottom: 34,
    overflow: 'auto',
  },
  homeIndicator: {
    position: 'absolute',
    bottom: 10,
    left: '50%',
    transform: 'translateX(-50%)',
    width: 140, height: 5,
    background: 'rgba(0,0,0,0.3)',
    borderRadius: 999,
    zIndex: 10,
  },
};

function IosFrame({ children, time = '9:41', battery = 85 }) {
  return (
    <div style={iosFrameStyles.wrapper}>
      <div style={{ ...iosFrameStyles.screen, width: 393, height: 852 }}>
        <div style={{ ...iosFrameStyles.statusBar, color: '#000' }}>
          <span>{time}</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 12 }}>
              <div style={{ width: 3, height: 4, background: '#000', borderRadius: 1 }} />
              <div style={{ width: 3, height: 6, background: '#000', borderRadius: 1 }} />
              <div style={{ width: 3, height: 9, background: '#000', borderRadius: 1 }} />
              <div style={{ width: 3, height: 11, background: '#000', borderRadius: 1 }} />
            </div>
            <svg width="16" height="12" viewBox="0 0 16 12" fill="none">
              <path d="M8 11.5a1 1 0 100-2 1 1 0 000 2z" fill="#000" />
              <path d="M3 7.5a7 7 0 0110 0" stroke="#000" strokeWidth="1.3" fill="none" strokeLinecap="round" />
              <path d="M1 4.5a11 11 0 0114 0" stroke="#000" strokeWidth="1.3" fill="none" strokeLinecap="round" opacity="0.7" />
            </svg>
            <div style={{ width: 26, height: 12, border: '1.5px solid #000', borderRadius: 3, padding: 1, position: 'relative', opacity: 0.8 }}>
              <div style={{ width: `${battery}%`, height: '100%', background: '#000', borderRadius: 1, opacity: 0.9 }} />
              <div style={{ position: 'absolute', top: 3, right: -3, width: 2, height: 6, background: '#000', borderRadius: '0 1px 1px 0' }} />
            </div>
          </div>
        </div>
        <div style={iosFrameStyles.dynamicIsland} />
        <div style={{ ...iosFrameStyles.content, background: COLORS.pageBg }}>
          {children}
        </div>
        <div style={iosFrameStyles.homeIndicator} />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 浏览器验证 iPhone 外壳正确渲染**

Run: `npx playwright open file:///d:/ABstuye/ai-pomodoro-prototype.html`

Expected: 黑色 iPhone 边框 + Dynamic Island + 状态栏 9:41 + Home Indicator，内容区米白色背景。

---

### Task 3: AppPhone 状态机 + TabBar

**Files:**
- Modify: `d:/ABstuye/ai-pomodoro-prototype.html`

- [ ] **Step 1: 写入 TabBar 组件**

```jsx
// ===== TabBar =====
const tabs = [
  { key: 'timer', label: '计时' },
  { key: 'insights', label: '洞察' },
  { key: 'stats', label: '统计' },
  { key: 'settings', label: '设置' },
];

function TabBar({ active, onChange }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-around',
      padding: '8px 16px', background: COLORS.cardBg,
      borderRadius: 16, border: `1px solid ${COLORS.warmGray}`,
      margin: '0 16px', flexShrink: 0,
    }}>
      {tabs.map(t => (
        <div key={t.key} onClick={() => onChange(t.key)} style={{
          fontSize: 12, fontWeight: active === t.key ? 600 : 400,
          color: active === t.key ? COLORS.accent : COLORS.secondary,
          cursor: 'pointer', padding: '4px 12px',
          transition: 'color 0.2s',
        }}>
          {t.label}
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: 写入 AppPhone 状态机**

```jsx
// ===== AppPhone — 主状态机 =====
function AppPhone() {
  const [tab, setTab] = React.useState('timer');

  // Timer state
  const [timerRunning, setTimerRunning] = React.useState(false);
  const [secondsLeft, setSecondsLeft] = React.useState(25 * 60); // 25 min
  const [currentPomodoro, setCurrentPomodoro] = React.useState(3);
  const [totalPomodoros] = React.useState(8);
  const pomodoroDuration = 25 * 60;

  // Settings state
  const [focusDuration, setFocusDuration] = React.useState(25);
  const [aiRecommend, setAiRecommend] = React.useState(true);
  const [aiAnalysis, setAiAnalysis] = React.useState(true);
  const [aiEncourage, setAiEncourage] = React.useState(true);

  // Timer effect
  React.useEffect(() => {
    if (!timerRunning) return;
    const id = setInterval(() => {
      setSecondsLeft(s => {
        if (s <= 1) {
          setTimerRunning(false);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [timerRunning]);

  const progress = 1 - (secondsLeft / pomodoroDuration);

  const screenProps = {
    timerRunning, setTimerRunning,
    secondsLeft, setSecondsLeft,
    currentPomodoro, totalPomodoros,
    pomodoroDuration, progress,
    focusDuration, setFocusDuration,
    aiRecommend, setAiRecommend,
    aiAnalysis, setAiAnalysis,
    aiEncourage, setAiEncourage,
  };

  const renderScreen = () => {
    switch (tab) {
      case 'timer': return <TimerScreen {...screenProps} />;
      case 'insights': return <InsightsScreen />;
      case 'stats': return <StatsScreen />;
      case 'settings': return <SettingsScreen {...screenProps} />;
      default: return <TimerScreen {...screenProps} />;
    }
  };

  return (
    <IosFrame time="9:41" battery={85}>
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <div style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
          {renderScreen()}
        </div>
        <div style={{ paddingBottom: 8 }}>
          <TabBar active={tab} onChange={setTab} />
        </div>
      </div>
    </IosFrame>
  );
}
```

- [ ] **Step 3: 占位渲染验证 Tab 切换**

先渲染一个占位 div 确认 Tab 切换逻辑正确：

```jsx
// 临时放在 renderScreen 位置测试
const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<AppPhone />);
```

Expected: Tab 点击切换 active 色（accent），内容区显示对应屏名称。

---

### Task 4: TimerScreen 组件（计时主屏）

**Files:**
- Modify: `d:/ABstuye/ai-pomodoro-prototype.html`

- [ ] **Step 1: 写入 TimerScreen 组件**

```jsx
// ===== TimerScreen =====
const encouragements = [
  '「上轮你坚持了 25 分钟，再来一轮？」',
  '「下午是你的效率高峰，趁热打铁！」',
  '「专注的每一分钟都在积累。」',
  '「休息一下，你已经很棒了。」',
];

function TimerScreen({ timerRunning, setTimerRunning, secondsLeft, setSecondsLeft,
  currentPomodoro, totalPomodoros, pomodoroDuration, progress }) {

  const mins = Math.floor(secondsLeft / 60);
  const secs = secondsLeft % 60;
  const timeStr = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  const progressDeg = progress * 360;
  const encourageText = React.useMemo(() =>
    encouragements[Math.floor(Math.random() * encouragements.length)], []);

  const handleStartPause = () => setTimerRunning(!timerRunning);
  const handleSkip = () => {
    setTimerRunning(false);
    setSecondsLeft(pomodoroDuration);
  };

  return (
    <div style={{ padding: '20px 20px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
      {/* Task info */}
      <div style={{ textAlign: 'center', marginTop: 4 }}>
        <div style={{ fontSize: 11, color: COLORS.accent, fontWeight: 500, letterSpacing: '0.05em' }}>
          AI 推荐 · 25 分钟
        </div>
        <div style={{ fontSize: 15, color: COLORS.ink, fontWeight: 500, marginTop: 2 }}>
          解剖学复习 · 骨学章节
        </div>
      </div>

      {/* Timer Ring */}
      <div style={{
        width: 180, height: 180, borderRadius: '50%',
        background: `conic-gradient(${COLORS.accent} 0deg ${progressDeg}deg, ${COLORS.warmGray} ${progressDeg}deg 360deg)`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <div style={{
          width: 148, height: 148, borderRadius: '50%',
          background: COLORS.cardBg,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        }}>
          <span style={{ fontFamily: 'Georgia, serif', fontSize: 40, color: COLORS.ink, letterSpacing: '0.02em' }}>
            {timeStr}
          </span>
          <span style={{ fontSize: 11, color: COLORS.secondary, marginTop: 2 }}>
            第 {currentPomodoro}/{totalPomodoros} 个番茄
          </span>
        </div>
      </div>

      {/* Controls */}
      <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
        {/* Pause button */}
        <div onClick={handleStartPause} style={{
          width: 48, height: 48, borderRadius: '50%',
          border: `1.5px solid ${COLORS.border}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer',
        }}>
          {timerRunning
            ? <div style={{ width: 12, height: 12, background: COLORS.accent }} />
            : <div style={{ width: 0, height: 0, borderLeft: '12px solid ' + COLORS.accent, borderTop: '7px solid transparent', borderBottom: '7px solid transparent', marginLeft: 3 }} />
          }
        </div>
        {/* Play button */}
        <div onClick={handleStartPause} style={{
          width: 56, height: 56, borderRadius: '50%',
          background: COLORS.accent,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer',
        }}>
          {timerRunning
            ? <div style={{ width: 14, height: 14, display: 'flex', gap: 4 }}><div style={{ width: 4, height: 14, background: 'white', borderRadius: 1 }} /><div style={{ width: 4, height: 14, background: 'white', borderRadius: 1 }} /></div>
            : <div style={{ width: 0, height: 0, borderLeft: '18px solid white', borderTop: '11px solid transparent', borderBottom: '11px solid transparent', marginLeft: 4 }} />
          }
        </div>
        {/* Skip */}
        <div onClick={handleSkip} style={{
          padding: '10px 20px', borderRadius: 22,
          border: `1.5px solid ${COLORS.border}`,
          color: COLORS.secondary, fontSize: 13,
          cursor: 'pointer',
        }}>
          跳过
        </div>
      </div>

      {/* AI Encouragement */}
      <div style={{
        background: COLORS.cardBg, borderRadius: 12,
        padding: '12px 16px', border: `1px solid ${COLORS.warmGray}`,
        width: '100%', textAlign: 'center',
      }}>
        <div style={{ fontSize: 12, color: COLORS.secondary }}>{encourageText}</div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 浏览器验证计时器交互**

打开 `file:///d:/ABstuye/ai-pomodoro-prototype.html`，验证：
- 点击播放按钮 → 倒计时开始跑
- 再次点击 → 暂停
- 点击跳过 → 重置到 25:00
- 环形进度随倒计时变化

---

### Task 5: InsightsScreen 组件（AI 洞察屏）

**Files:**
- Modify: `d:/ABstuye/ai-pomodoro-prototype.html`

- [ ] **Step 1: 写入 InsightsScreen 组件**

```jsx
// ===== InsightsScreen =====
function InsightsScreen() {
  const hourData = [
    { hour: 8, h: 20 }, { hour: 10, h: 28 }, { hour: 12, h: 35 },
    { hour: 14, h: 52 }, { hour: 16, h: 58 }, { hour: 18, h: 42 },
    { hour: 20, h: 30 }, { hour: 22, h: 22 },
  ];
  const maxH = 58;

  return (
    <div style={{ padding: '20px 20px 0', display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div>
        <div style={{ fontSize: 18, color: COLORS.ink, fontWeight: 600 }}>今日洞察</div>
        <div style={{ fontSize: 12, color: COLORS.secondary }}>5月28日 周三</div>
      </div>

      {/* Summary */}
      <div style={{
        background: COLORS.cardBg, borderRadius: 14, padding: 16,
        border: `1px solid ${COLORS.warmGray}`,
        display: 'flex', justifyContent: 'space-around',
      }}>
        {[
          { val: '3h 12m', label: '今日专注' },
          { val: '7', label: '完成番茄' },
          { val: '92%', label: '完成率' },
        ].map((item, i) => (
          <div key={i} style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 22, color: i === 0 ? COLORS.accent : COLORS.ink, fontWeight: 600 }}>
              {item.val}
            </div>
            <div style={{ fontSize: 10, color: COLORS.secondary }}>{item.label}</div>
          </div>
        ))}
      </div>

      {/* AI Discovery */}
      <div style={{
        background: COLORS.cardBg, borderRadius: 14, padding: 16,
        border: `1px solid ${COLORS.warmGray}`,
      }}>
        <div style={{ fontSize: 11, color: COLORS.accent, fontWeight: 600, letterSpacing: '0.05em', marginBottom: 6 }}>
          AI 发现
        </div>
        <div style={{ fontSize: 13, color: COLORS.ink, lineHeight: 1.6 }}>
          你在 <strong>14:00-16:00</strong> 的专注完成率比其他时段高 <strong>32%</strong>。建议把重要任务安排在这个窗口。
        </div>
      </div>

      {/* Peak Hours Chart */}
      <div style={{
        background: COLORS.cardBg, borderRadius: 14, padding: 16,
        border: `1px solid ${COLORS.warmGray}`,
      }}>
        <div style={{ fontSize: 12, color: COLORS.ink, fontWeight: 500, marginBottom: 8 }}>
          专注时段分布
        </div>
        <div style={{ display: 'flex', gap: 2, alignItems: 'flex-end', justifyContent: 'space-around', height: 60 }}>
          {hourData.map((d, i) => (
            <div key={i} style={{
              width: 16, height: `${(d.h / maxH) * 60}px`,
              background: d.h >= 50 ? COLORS.accent : COLORS.warmGray,
              borderRadius: 3, transition: 'height 0.4s',
            }} />
          ))}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-around', fontSize: 9, color: COLORS.secondary, marginTop: 4 }}>
          {hourData.map((d, i) => <span key={i}>{d.hour}</span>)}
        </div>
      </div>

      {/* AI Suggestion */}
      <div style={{
        background: COLORS.cardBg, borderRadius: 14, padding: 16,
        border: `1px solid ${COLORS.warmGray}`,
      }}>
        <div style={{ fontSize: 11, color: COLORS.accent, fontWeight: 600, letterSpacing: '0.05em', marginBottom: 6 }}>
          AI 建议
        </div>
        <div style={{ fontSize: 13, color: COLORS.ink, lineHeight: 1.6 }}>
          你的<strong>连续专注天数</strong>已达 5 天，比上周提升 2 天。保持这个节奏！
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 浏览器验证洞察屏内容**

切换到「洞察」Tab，验证：摘要卡片、AI 发现卡片、柱状图、AI 建议卡片全部渲染正确。

---

### Task 6: StatsScreen 组件（统计屏）

**Files:**
- Modify: `d:/ABstuye/ai-pomodoro-prototype.html`

- [ ] **Step 1: 写入 StatsScreen 组件**

```jsx
// ===== StatsScreen =====
function StatsScreen() {
  const [range, setRange] = React.useState('week');
  const dayData = [
    { day: '一', h: 4.8 }, { day: '二', h: 3.2 }, { day: '三', h: 6.0 },
    { day: '四', h: 5.2 }, { day: '五', h: 4.4 }, { day: '六', h: 2.8 },
    { day: '日', h: 1.6 },
  ];
  const maxDayH = 6.0;
  const todayIdx = 2; // Wednesday

  return (
    <div style={{ padding: '20px 20px 0', display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div>
        <div style={{ fontSize: 18, color: COLORS.ink, fontWeight: 600 }}>专注统计</div>
      </div>

      {/* Range selector */}
      <div style={{ display: 'flex', gap: 8 }}>
        {['week', 'month', 'all'].map(r => (
          <span key={r} onClick={() => setRange(r)} style={{
            fontSize: 12, padding: '5px 14px', borderRadius: 12,
            background: range === r ? COLORS.accent : COLORS.warmGray,
            color: range === r ? '#fff' : COLORS.secondary,
            cursor: 'pointer',
          }}>
            {{ week: '本周', month: '本月', all: '全部' }[r]}
          </span>
        ))}
      </div>

      {/* Big numbers */}
      <div style={{ display: 'flex', gap: 32, justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 28, color: COLORS.accent, fontWeight: 600 }}>18.5h</div>
          <div style={{ fontSize: 10, color: COLORS.secondary }}>总专注</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 28, color: COLORS.ink, fontWeight: 600 }}>42</div>
          <div style={{ fontSize: 10, color: COLORS.secondary }}>番茄数</div>
        </div>
      </div>

      {/* Bar chart */}
      <div style={{
        background: COLORS.cardBg, borderRadius: 14, padding: 16,
        border: `1px solid ${COLORS.warmGray}`,
      }}>
        <div style={{ fontSize: 12, color: COLORS.ink, fontWeight: 500, marginBottom: 10 }}>
          每日专注时长 (h)
        </div>
        <div style={{ display: 'flex', gap: 4, alignItems: 'flex-end', justifyContent: 'space-around', height: 90 }}>
          {dayData.map((d, i) => (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
              <div style={{
                width: 22, height: `${(d.h / maxDayH) * 70}px`,
                background: i === todayIdx ? COLORS.accent : COLORS.warmGray,
                borderRadius: 3,
              }} />
              <span style={{ fontSize: 9, color: COLORS.secondary }}>{d.day}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Streak */}
      <div style={{
        background: COLORS.cardBg, borderRadius: 14, padding: 16,
        border: `1px solid ${COLORS.warmGray}`,
        display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <div style={{ fontSize: 32 }}>🔥</div>
        <div>
          <div style={{ fontSize: 14, color: COLORS.ink, fontWeight: 500 }}>连续专注 5 天</div>
          <div style={{ fontSize: 11, color: COLORS.secondary }}>个人最佳：12 天</div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 浏览器验证统计屏**

切换到「统计」Tab，验证：范围切换按钮、大数字、柱状图、打卡卡片正常渲染。点击范围切换按钮有选中态变化。

---

### Task 7: SettingsScreen 组件（设置屏）

**Files:**
- Modify: `d:/ABstuye/ai-pomodoro-prototype.html`

- [ ] **Step 1: 写入 SettingsScreen 组件**

```jsx
// ===== SettingsScreen =====
function ToggleSwitch({ on, onClick }) {
  return (
    <div onClick={onClick} style={{
      width: 40, height: 22, borderRadius: 11,
      background: on ? COLORS.accent : COLORS.warmGray,
      position: 'relative', cursor: 'pointer',
      transition: 'background 0.2s',
      flexShrink: 0,
    }}>
      <div style={{
        width: 18, height: 18, borderRadius: '50%', background: '#fff',
        position: 'absolute', top: 2,
        left: on ? 20 : 2,
        transition: 'left 0.2s',
        boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
      }} />
    </div>
  );
}

function SettingsScreen({
  focusDuration, setFocusDuration,
  aiRecommend, setAiRecommend,
  aiAnalysis, setAiAnalysis,
  aiEncourage, setAiEncourage,
}) {
  return (
    <div style={{ padding: '20px 20px 0', display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ fontSize: 18, color: COLORS.ink, fontWeight: 600 }}>设置</div>

      {/* Focus Duration */}
      <div style={{
        background: COLORS.cardBg, borderRadius: 14, padding: 16,
        border: `1px solid ${COLORS.warmGray}`,
      }}>
        <div style={{ fontSize: 11, color: COLORS.accent, fontWeight: 600, letterSpacing: '0.05em', marginBottom: 10 }}>
          番茄时长
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {[25, 45, 'custom'].map(d => (
            <span key={d} onClick={() => typeof d === 'number' && setFocusDuration(d)} style={{
              fontSize: 12, padding: '6px 14px', borderRadius: 14,
              background: (d === focusDuration || (d === 'custom' && ![25, 45].includes(focusDuration)))
                ? COLORS.accent : COLORS.warmGray,
              color: (d === focusDuration || (d === 'custom' && ![25, 45].includes(focusDuration)))
                ? '#fff' : COLORS.secondary,
              cursor: 'pointer',
            }}>
              {d === 'custom' ? '自定义' : `${d} 分钟`}
            </span>
          ))}
        </div>
      </div>

      {/* Break Settings */}
      <div style={{
        background: COLORS.cardBg, borderRadius: 14, padding: 16,
        border: `1px solid ${COLORS.warmGray}`,
      }}>
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '6px 0',
        }}>
          <div>
            <div style={{ fontSize: 13, color: COLORS.ink }}>短休息</div>
            <div style={{ fontSize: 10, color: COLORS.secondary }}>每个番茄结束后</div>
          </div>
          <span style={{ fontSize: 14, color: COLORS.ink }}>5 分钟</span>
        </div>
        <div style={{ height: 1, background: COLORS.warmGray, margin: '8px 0' }} />
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '6px 0',
        }}>
          <div>
            <div style={{ fontSize: 13, color: COLORS.ink }}>长休息</div>
            <div style={{ fontSize: 10, color: COLORS.secondary }}>每 4 个番茄后</div>
          </div>
          <span style={{ fontSize: 14, color: COLORS.ink }}>15 分钟</span>
        </div>
      </div>

      {/* AI Toggles */}
      <div style={{
        background: COLORS.cardBg, borderRadius: 14, padding: 16,
        border: `1px solid ${COLORS.warmGray}`,
      }}>
        <div style={{ fontSize: 11, color: COLORS.accent, fontWeight: 600, letterSpacing: '0.05em', marginBottom: 8 }}>
          AI 助手
        </div>
        {[
          { label: '智能时长推荐', value: aiRecommend, setter: setAiRecommend },
          { label: '专注分析报告', value: aiAnalysis, setter: setAiAnalysis },
          { label: '个性化鼓励提醒', value: aiEncourage, setter: setAiEncourage },
        ].map((item, i) => (
          <div key={i}>
            {i > 0 && <div style={{ height: 1, background: COLORS.warmGray, margin: '8px 0' }} />}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0' }}>
              <span style={{ fontSize: 13, color: COLORS.ink }}>{item.label}</span>
              <ToggleSwitch on={item.value} onClick={() => item.setter(!item.value)} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 浏览器验证设置屏交互**

切换到「设置」Tab，验证：
- 番茄时长三个选项可点击切换
- 三个 AI toggle 可独立开关
- 所有交互有视觉反馈

---

### Task 8: Playwright 点击测试 + 最终验证

**Files:**
- Modify: `d:/ABstuye/ai-pomodoro-prototype.html` (if fixes needed)

- [ ] **Step 1: 运行 Playwright 交互测试**

```bash
npx playwright test --config=<(echo '{}') <<'EOF'
const { test, expect } = require('@playwright/test');
test('pomodoro prototype click test', async ({ page }) => {
  page.on('pageerror', err => { throw err; });
  await page.goto('file:///d:/ABstuye/ai-pomodoro-prototype.html');
  await page.waitForTimeout(2000);

  // 1. Verify all 4 tabs exist
  await expect(page.locator('text=计时').first()).toBeVisible();
  await expect(page.locator('text=洞察').first()).toBeVisible();
  await expect(page.locator('text=统计').first()).toBeVisible();
  await expect(page.locator('text=设置').first()).toBeVisible();

  // 2. Click Insights tab
  await page.locator('text=洞察').first().click();
  await page.waitForTimeout(500);
  await expect(page.locator('text=AI 发现')).toBeVisible();

  // 3. Click Stats tab
  await page.locator('text=统计').first().click();
  await page.waitForTimeout(500);
  await expect(page.locator('text=总专注')).toBeVisible();

  // 4. Click Settings tab
  await page.locator('text=设置').first().click();
  await page.waitForTimeout(500);
  await expect(page.locator('text=AI 助手')).toBeVisible();

  // 5. Back to Timer
  await page.locator('text=计时').first().click();
  await page.waitForTimeout(500);

  console.log('All tests passed');
});
EOF
```

Expected: All assertions pass, no page errors.

- [ ] **Step 2: 手动在浏览器中完整走一遍流程**

打开 `file:///d:/ABstuye/ai-pomodoro-prototype.html`，执行：
1. 计时屏：按播放 → 倒计时开始 → 按暂停 → 按跳过重置
2. 切换到洞察 Tab → 查看所有卡片
3. 切换到统计 Tab → 切换时间范围
4. 切换到设置 Tab → 切换时长、开关 toggle
5. 切回计时 Tab → 确认状态保持

Expected: 全部交互正常，无 UI 错位，无 console error。

- [ ] **Step 3: 提交**

```bash
git add d:/ABstuye/ai-pomodoro-prototype.html
git commit -m "feat: add AI Pomodoro iOS prototype with 4 interactive screens"
```
