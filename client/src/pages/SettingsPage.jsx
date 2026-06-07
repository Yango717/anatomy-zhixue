import { useState, useEffect } from 'react';
import { api } from '../utils/api';

export default function SettingsPage() {
  const [name, setName] = useState('');
  const [target, setTarget] = useState('');
  const [saved, setSaved] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [dailyGoal, setDailyGoal] = useState(20);

  useEffect(() => {
    api.get('/countdown').then((d) => {
      setName(d.name || '');
      setTarget(d.target ? d.target.slice(0, 16) : '');
    }).catch(() => {});
    // Load daily goal from localStorage
    const saved = localStorage.getItem('dailyGoal');
    if (saved) setDailyGoal(parseInt(saved, 10));
  }, []);


  function handleSaveGoal() {
    localStorage.setItem('dailyGoal', dailyGoal);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  async function handleSave() {
    await api.put('/countdown', { name, target });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  async function handleReset() {
    if (!resetting) { setResetting(true); return; }
    await api.put('/countdown', {
      name: '距离解剖学期末考试',
      target: new Date(Date.now() + 60 * 24 * 3600 * 1000).toISOString(),
    });
    setName('距离解剖学期末考试');
    setTarget('');
    setResetting(false);
  }

  return (
    <div className="page">
      <h2 className="page__title">更多</h2>

      <div className="settings-section">
        <h3 className="settings-section__title">倒计时设置</h3>
        <label className="settings-label">名称</label>
        <input className="settings-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="倒计时名称" />
        <label className="settings-label">目标日期时间</label>
        <input className="settings-input" type="datetime-local" value={target} onChange={(e) => setTarget(e.target.value)} />
        <button className="btn btn--primary btn--block" onClick={handleSave} style={{ marginTop: 'var(--spacing-md)' }}>
          {saved ? '已保存 ✓' : '保存设置'}
        </button>
      </div>

      <div className="settings-section">
        <h3 className="settings-section__title">数据管理</h3>
        <p className="settings-hint">重置后将清除所有学习进度和错题</p>
        {!resetting ? (
          <button className="btn btn--outline btn--block" onClick={handleReset}>重置数据</button>
        ) : (
          <div className="settings-confirm">
            <p style={{ color: 'var(--color-error)', fontSize: 'var(--font-size-sm)', marginBottom: 'var(--spacing-md)' }}>确认重置？所有进度和错题将被删除。</p>
            <div style={{ display: 'flex', gap: 'var(--spacing-sm)' }}>
              <button className="btn btn--outline btn--sm" onClick={() => setResetting(false)}>取消</button>
              <button className="btn btn--danger btn--sm" onClick={handleReset}>确认重置</button>
            </div>
          </div>
        )}
      </div>

      <div className="settings-section">
        <h3 className="settings-section__title">每日学习目标</h3>
        <label className="settings-label">每日答题数量</label>
        <input
          className="settings-input"
          type="number"
          min="5"
          max="100"
          value={dailyGoal}
          onChange={(e) => setDailyGoal(e.target.value)}
          placeholder="如：20"
        />
        <button className="btn btn--primary btn--block" style={{ marginTop: 'var(--spacing-md)' }} onClick={handleSaveGoal}>
          保存目标
        </button>
      </div>

      <div className="settings-section">
        <h3 className="settings-section__title">关于</h3>
        <p className="settings-hint">解剖智学 v0.5 — 医学生解剖学学习系统</p>
      </div>
    </div>
  );
}
