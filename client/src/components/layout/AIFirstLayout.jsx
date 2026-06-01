import { useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import GlobalAIChat from '../ai/GlobalAIChat';

export default function AIFirstLayout({ children }) {
  const location = useLocation();
  const isHome = location.pathname === '/' || location.pathname === '';

  return (
    <div className="ai-first-layout">
      <Sidebar />

      <main className="ai-first-main">
        {children}
      </main>

      {/* Show chat bubble on non-home pages */}
      {!isHome && <GlobalAIChat />}
    </div>
  );
}
