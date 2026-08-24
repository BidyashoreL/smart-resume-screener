import React from 'react';
import { Link } from 'react-router-dom';

export { CandidatesPage } from './CandidatesPage';
export { CandidateDetailPage } from './CandidateDetailPage';


export { JobsPage } from './JobsPage';
export { JobDetailPage } from './JobDetailPage';


export { ScreeningPage } from './ScreeningPage';
export { ScreeningResultsPage } from './ScreeningResultsPage';
export { CandidateComparePage } from './CandidateComparePage';


export { ReportsPage } from './ReportsPage';

export const NotFoundPage: React.FC = () => {
  return (
    <div style={{ padding: '64px', textAlign: 'center' }}>
      <h2 style={{ fontSize: '2rem', fontWeight: 700, color: '#fff' }}>404 - Page Not Found</h2>
      <p style={{ color: 'var(--text-secondary)', margin: '12px 0 24px 0' }}>
        The requested screen does not exist in the ATS suite.
      </p>
      <Link to="/" className="btn btn-primary">
        Return to Dashboard
      </Link>
    </div>
  );
};
