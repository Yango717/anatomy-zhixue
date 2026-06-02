// v3.2 线程修复迁移：清除可能被竞态污染的数据
// 之前 switchThread 闭包 bug 可能覆写 localStorage 为空，导致消息丢失
// 这里自动清理并重建干净状态
(function migrateStorageV3() {
  try {
    const FLAG = 'ai_v3_storage_migrated';
    if (localStorage.getItem(FLAG)) return; // 已迁移，跳过
    // 清除所有 autoPilot + thread 相关数据
    const keysToRemove = [
      'ai_autopilot_enabled',
      'ai_autopilot_plan',
      'ai_autopilot_state',
      'ai_autopilot_daily_summary',
      'ai_autopilot_v3_migrated',
      'ai_threads',
      'ai_global_chat',
    ];
    keysToRemove.forEach(k => { try { localStorage.removeItem(k); } catch {} });
    localStorage.setItem(FLAG, '1');
    console.log('[v3迁移] 已清理旧数据，自动模式将默认开启');
  } catch {}
})();

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/globals.css';
import './styles/modules.css';
import './styles/content.css';
import './styles/quiz.css';
import './styles/flashcards.css';
import './styles/responsive.css';
import './styles/print.css';
import './styles/ai.css';
import './styles/autopilot.css';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null, errorInfo: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  componentDidCatch(error, errorInfo) {
    console.error('[ErrorBoundary]', error, errorInfo);
    this.setState({ errorInfo });
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 24, color: '#ff4444', fontFamily: 'monospace' }}>
          <h2>渲染出错</h2>
          <pre>{this.state.error?.toString()}</pre>
          <details>
            <summary>详细信息</summary>
            <pre>{this.state.errorInfo?.componentStack}</pre>
          </details>
        </div>
      );
    }
    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <ErrorBoundary>
    <React.StrictMode>
      <App />
    </React.StrictMode>
  </ErrorBoundary>
);
