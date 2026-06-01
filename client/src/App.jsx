import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AIContextProvider } from './components/ai/AIContextProvider';
import AppLayout from './components/layout/AppLayout';
import HomePage from './pages/HomePage';
import ModulesPage from './pages/ModulesPage';
import SectionsPage from './pages/SectionsPage';
import LearnPage from './pages/LearnPage';
import QuizPage from './pages/QuizPage';
import ReviewPage from './pages/ReviewPage';
import TestPage from './pages/TestPage';
import FinalExamPage from './pages/FinalExamPage';
import PracticePage from './pages/PracticePage';
import ReviewHubPage from './pages/ReviewHubPage';
import ExamHubPage from './pages/ExamHubPage';
import ProfilePage from './pages/ProfilePage';

export default function App() {
  return (
    <BrowserRouter>
      <AIContextProvider>
        <AppLayout>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/modules" element={<ModulesPage />} />
          <Route path="/sections/:chapterId" element={<SectionsPage />} />
          <Route path="/learn/:unitId" element={<LearnPage />} />
          <Route path="/quiz/:unitId" element={<QuizPage />} />
          <Route path="/review/:unitId" element={<ReviewPage />} />
          <Route path="/test/:unitId" element={<TestPage />} />
          <Route path="/finalexam/:unitId" element={<FinalExamPage />} />
          <Route path="/practice" element={<PracticePage />} />
          <Route path="/practice/:chapterId" element={<PracticePage />} />

          {/* New hub routes */}
          <Route path="/review" element={<ReviewHubPage />} />
          <Route path="/exam" element={<ExamHubPage />} />
          <Route path="/me" element={<ProfilePage />} />

          {/* Legacy redirects */}
          <Route path="/errorbook" element={<Navigate to="/review" replace />} />
          <Route path="/settings" element={<Navigate to="/me" replace />} />

          <Route path="*" element={
            <div className="page" style={{ textAlign: 'center', paddingTop: 'var(--spacing-3xl)' }}>
              <h2 className="page__title">404</h2>
              <p style={{ color: 'var(--color-text-hint)' }}>页面不存在</p>
            </div>
          } />
        </Routes>
      </AppLayout>
      </AIContextProvider>
    </BrowserRouter>
  );
}
