import React from 'react';
import { useAppState } from './context/AppContext';
import { Sidebar } from './components/layout/Sidebar';
import { HomePage } from './pages/HomePage';
import { IntakeStep1Page } from './pages/IntakeStep1Page';
import { IntakeStep2Page } from './pages/IntakeStep2Page';
import { IntakeStep3Page } from './pages/IntakeStep3Page';
import { DagWorkspacePage } from './pages/DagWorkspacePage';
import { TestRunnerPage } from './pages/TestRunnerPage';
import { TestResultPage } from './pages/TestResultPage';
import { TestQueuePage } from './pages/TestQueuePage';
import { CapstoneAttemptPage } from './pages/CapstoneAttemptPage';
import { AchievementLogPage } from './pages/AchievementLogPage';
import { OptionsPage } from './pages/OptionsPage';

const SIDEBAR_VIEWS = new Set([
  'home', 'dag-workspace', 'test-queue', 'options', 'achievement-log',
]);

export function App() {
  const state = useAppState();
  const showSidebar = SIDEBAR_VIEWS.has(state.view);

  function renderPage() {
    switch (state.view) {
      case 'home': return <HomePage />;
      case 'intake':
      case 'intake-step1': return <IntakeStep1Page />;
      case 'intake-step2': return <IntakeStep2Page />;
      case 'intake-step3':
      case 'capstone-review': return <IntakeStep3Page />;
      case 'dag-workspace': return <DagWorkspacePage />;
      case 'test-queue': return <TestQueuePage />;
      case 'options': return <OptionsPage />;
      case 'test-running': return <TestRunnerPage />;
      case 'test-result': return <TestResultPage />;
      case 'capstone-attempt': return <CapstoneAttemptPage />;
      case 'achievement-log': return <AchievementLogPage />;
      default: return <HomePage />;
    }
  }

  if (showSidebar) {
    return (
      <div className="h-screen bg-gray-950 flex overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-hidden">
          {renderPage()}
        </main>
      </div>
    );
  }

  return <div className="h-screen bg-gray-950 overflow-hidden">{renderPage()}</div>;
}
