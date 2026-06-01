import { useState, useEffect } from 'react';
import { api } from '../utils/api';
import { useAIContext } from '../components/ai/AIContextProvider';

export default function ProfilePage() {
  const [name, setName] = useState('');
  const [target, setTarget] = useState('');
  const [saved, setSaved] = useState(false);
  const [apiKeySaved, setApiKeySaved] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [dailyGoal, setDailyGoal] = useState(20);
  const [stats, setStats] = useState(null);
  const { apiKey, saveApiKey, ttsKey, saveTtsKey, ttsAppId, saveTtsAppId } = useAIContext();
  const [ttsSaved, setTtsSaved] = useState(false);

  useEffect(() => {
    api.get('/countdown').then((d) => {
      setName(d.name || '');
      setTarget(d.target ? d.target.slice(0, 16) : '');
    }).catch(() => {});
    const saved = localStorage.getItem('dailyGoal');
    if (saved) setDailyGoal(parseInt(saved, 10));
    api.get('/progress/overview').then(setStats).catch(() => {});
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
      <h2 className="page__title">我的</h2>

      {stats && (
        <div className="profile-stats">
          <div className="profile-stat">
            <span className="profile-stat__num">{stats.completedUnits || 0}/{stats.totalUnits || 0}</span>
            <span className="profile-stat__label">已完成单元</span>
          </div>
          <div className="profile-stat">
            <span className="profile-stat__num">{stats.percentage || 0}%</span>
            <span className="profile-stat__label">整体进度</span>
          </div>
          <div className="profile-stat">
            <span className="profile-stat__num">{stats.recentAttempts || 0}</span>
            <span className="profile-stat__label">本周答题</span>
          </div>
        </div>
      )}

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
        <h3 className="settings-section__title">AI助手设置</h3>
        <label className="settings-label">DeepSeek API Key</label>
        <input
          className="settings-input"
          type="password"
          value={apiKey}
          onChange={(e) => saveApiKey(e.target.value.trim())}
          placeholder="sk-xxxxxxxxxxxxxxxx"
        />
        <p className="settings-hint" style={{ marginTop: '4px', fontSize: '12px', color: 'var(--color-text-hint)' }}>
          用于"解剖学长"AI助手功能。Key仅保存在本地浏览器中。
          <br />
          <a href="https://platform.deepseek.com/api_keys" target="_blank" rel="noopener" style={{ color: 'var(--ai-accent)' }}>
            获取DeepSeek API Key →
          </a>
        </p>
        <button
          className="btn btn--primary btn--block"
          style={{ marginTop: 'var(--spacing-md)' }}
          onClick={() => {
            setApiKeySaved(true);
            setTimeout(() => setApiKeySaved(false), 2000);
          }}
        >
          {apiKeySaved ? '已保存 ✓' : (apiKey ? '确认保存' : '请输入Key')}
        </button>
      </div>

      <div className="settings-section">
        <h3 className="settings-section__title">学姐语音设置（豆包TTS）</h3>
        <label className="settings-label">Access Token</label>
        <input
          className="settings-input"
          type="password"
          value={ttsKey}
          onChange={(e) => saveTtsKey(e.target.value.trim())}
          placeholder="豆包TTS Access Token"
        />
        <label className="settings-label">语音音色（speaker）</label>
        <input
          className="settings-input"
          value={ttsAppId}
          onChange={(e) => saveTtsAppId(e.target.value.trim())}
          placeholder="默认：zh_female_xiaohe_uranus_bigtts"
        />
        <p className="settings-hint" style={{ marginTop: '4px', fontSize: '12px', color: 'var(--color-text-hint)' }}>
          已升级至 V3 API（seed-tts-2.0 情感模型）。可选：xiaohe_uranus / vv_uranus / xiaohe_jupiter
        </p>
        <button
          className="btn btn--primary btn--block"
          style={{ marginTop: 'var(--spacing-md)' }}
          onClick={() => {
            setTtsSaved(true);
            setTimeout(() => setTtsSaved(false), 2000);
          }}
        >
          {ttsSaved ? '已保存 ✓' : (ttsKey ? '确认保存' : '保存设置')}
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
        <h3 className="settings-section__title">关于</h3>
        <p className="settings-hint">解剖闪背 v0.2 — 医学生解剖学学习系统</p>
      </div>
    </div>
  );
}
