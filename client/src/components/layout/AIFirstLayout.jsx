import { useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import GlobalAIChat from '../ai/GlobalAIChat';
import AutoPilotMiniAvatar from '../ai/AutoPilotMiniAvatar';
import AutoPilotCheckin from '../ai/AutoPilotCheckin';

export default function AIFirstLayout({ children }) {
  const location = useLocation();
  const isHome = location.pathname === '/' || location.pathname === '';

  return (
    <div className="ai-first-layout">
      <Sidebar />

      <main className="ai-first-main">
        {children}
      </main>

      {/* AutoPilot: mini avatar (visible on all pages when auto mode is on) */}
      <AutoPilotMiniAvatar />

      {/* AutoPilot: invisible checkin delivery system */}
      <AutoPilotCheckin />

      {/* Show chat bubble on non-home pages */}
      {!isHome && <GlobalAIChat />}
    </div>
  );
}
