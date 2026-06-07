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
import './styles/autopilot-chat.css';
import './styles/motion-flow.css';
import './styles/learning-center.css';
import './styles/learning-portrait.css';
import './styles/learning-path.css';

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
