import React from 'react';
import { useAppState } from './context/AppContext';
import { HomePage } from './pages/HomePage';
import { IntakePage } from './pages/IntakePage';
import { CapstoneReviewPage } from './pages/CapstoneReviewPage';
import { DagWorkspacePage } from './pages/DagWorkspacePage';
import { NodeStudyPage } from './pages/NodeStudyPage';
import { TestRunnerPage } from './pages/TestRunnerPage';
import { TestResultPage } from './pages/TestResultPage';
import { CapstoneAttemptPage } from './pages/CapstoneAttemptPage';
import { AchievementLogPage } from './pages/AchievementLogPage';

export function App() {
  const state = useAppState();

  switch (state.view) {
    case 'home':
      return <HomePage />;
    case 'intake':
      return <IntakePage />;
    case 'capstone-review':
      return <CapstoneReviewPage />;
    case 'dag-workspace':
      return <DagWorkspacePage />;
    case 'node-study':
      return <NodeStudyPage />;
    case 'test-running':
      return <TestRunnerPage />;
    case 'test-result':
      return <TestResultPage />;
    case 'capstone-attempt':
      return <CapstoneAttemptPage />;
    case 'achievement-log':
      return <AchievementLogPage />;
    default:
      return <HomePage />;
  }
}
