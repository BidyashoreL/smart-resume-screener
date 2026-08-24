import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AppLayout } from './components/layout/AppLayout';
import { DashboardPage } from './pages/DashboardPage';
import {
  CandidatesPage,
  CandidateDetailPage,
  JobsPage,
  JobDetailPage,
  ScreeningPage,
  ScreeningResultsPage,
  CandidateComparePage,
  ReportsPage,
  NotFoundPage,
} from './pages/index';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<AppLayout />}>
          <Route index element={<DashboardPage />} />
          <Route path="candidates" element={<CandidatesPage />} />
          <Route path="candidates/:candidateId" element={<CandidateDetailPage />} />
          <Route path="jobs" element={<JobsPage />} />
          <Route path="jobs/:jobId" element={<JobDetailPage />} />
          <Route path="screening" element={<ScreeningPage />} />
          <Route path="screening/:screeningId" element={<ScreeningResultsPage />} />
          <Route path="screening/:screeningId/compare" element={<CandidateComparePage />} />
          <Route path="reports" element={<ReportsPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
