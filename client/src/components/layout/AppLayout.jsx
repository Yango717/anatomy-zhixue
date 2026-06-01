import TopBar from './TopBar';
import GlobalAIChat from '../ai/GlobalAIChat';

export default function AppLayout({ children }) {
  return (
    <div className="app-layout">
      <TopBar />
      <main className="app-main">
        {children}
      </main>
      <GlobalAIChat />
    </div>
  );
}
