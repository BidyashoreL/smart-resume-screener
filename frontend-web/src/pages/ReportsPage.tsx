import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Download, FileJson, FileSpreadsheet, RefreshCw } from 'lucide-react';
import { api } from '../services/api';
import type { AnalyticsOverview } from '../types/api';
import { Card } from '../components/common/Card';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { ErrorMessage } from '../components/common/ErrorMessage';

// Reporting surface for GET /api/screen/analytics/overview. This page only
// formats and exports values the backend has already computed - it does not
// recompute scores, bands, recommendations, or rankings.

const formatTimestamp = (iso: string) => {
  if (!iso) return 'Unknown date';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const downloadBlob = (content: string, filename: string, mimeType: string) => {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

const csvEscape = (value: string | number) => {
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
};

const buildCsv = (overview: AnalyticsOverview): string => {
  const lines: string[] = [];

  lines.push('Smart Resume Screener - Analytics Snapshot');
  lines.push(`Generated At,${new Date().toISOString()}`);
  lines.push('');

  lines.push('Summary Metric,Value');
  lines.push(`Total Candidates,${overview.total_candidates}`);
  lines.push(`Active Jobs,${overview.active_jobs}`);
  lines.push(`Total Screening Batches,${overview.total_screenings}`);
  lines.push(`Candidates Screened,${overview.candidates_screened}`);
  lines.push(`Shortlisted,${overview.shortlisted_count}`);
  lines.push(`Consider,${overview.consider_count}`);
  lines.push(`Rejected,${overview.rejected_count}`);
  lines.push(`Average Score,${overview.average_score}`);
  lines.push('');

  lines.push('Job Performance');
  lines.push('Job Title,Job ID,Candidates Screened,Shortlist,Consider,Reject,Average Score');
  overview.job_performance.forEach((j) => {
    lines.push(
      [j.job_title, j.job_id, j.candidates_screened, j.shortlist_count, j.consider_count, j.reject_count, j.average_score]
        .map(csvEscape)
        .join(',')
    );
  });
  lines.push('');

  lines.push('Screening History');
  lines.push('Screening ID,Job Title,Candidates,Shortlist,Consider,Reject,Average Score,Run At');
  overview.recent_screenings.forEach((s) => {
    lines.push(
      [s.screening_id, s.job_title, s.candidates_count, s.shortlist_count, s.consider_count, s.reject_count, s.average_score, s.created_at]
        .map(csvEscape)
        .join(',')
    );
  });
  lines.push('');

  lines.push('Frequently Matched Required Skills');
  lines.push('Skill,Count');
  overview.frequently_matched_required_skills.forEach((s) => lines.push(`${csvEscape(s.skill)},${s.count}`));
  lines.push('');

  lines.push('Frequently Missing Required Skills');
  lines.push('Skill,Count');
  overview.frequently_missing_required_skills.forEach((s) => lines.push(`${csvEscape(s.skill)},${s.count}`));
  lines.push('');

  lines.push('Frequently Matched Preferred Skills');
  lines.push('Skill,Count');
  overview.frequently_matched_preferred_skills.forEach((s) => lines.push(`${csvEscape(s.skill)},${s.count}`));

  return lines.join('\n');
};

const SectionHeader: React.FC<{ title: string; subtitle?: string }> = ({ title, subtitle }) => (
  <div>
    <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#fff' }}>{title}</h2>
    {subtitle && <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '2px' }}>{subtitle}</p>}
  </div>
);

const StatBlock: React.FC<{ label: string; value: string | number; color?: string }> = ({ label, value, color }) => (
  <div>
    <span style={{ fontSize: '0.72rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>
      {label}
    </span>
    <div style={{ fontSize: '1.6rem', fontWeight: 700, color: color || '#fff', marginTop: '4px' }}>{value}</div>
  </div>
);

export const ReportsPage: React.FC = () => {
  const navigate = useNavigate();
  const [overview, setOverview] = useState<AnalyticsOverview | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchOverview = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getAnalyticsOverview();
      setOverview(data);
    } catch (err: any) {
      setError(err?.detail || 'Failed to load analytics data from backend.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOverview();
  }, []);

  if (loading) {
    return <LoadingSpinner message="Compiling recruiting intelligence report..." fullPage />;
  }

  if (error || !overview) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 700, color: '#fff' }}>Recruiting Intelligence Reports</h1>
        </div>
        <ErrorMessage
          title="Report Data Unavailable"
          message={error || 'The analytics overview could not be loaded.'}
          onRetry={fetchOverview}
        />
      </div>
    );
  }

  const totalDecided = overview.shortlisted_count + overview.consider_count + overview.rejected_count;
  const shortlistPct = totalDecided > 0 ? ((overview.shortlisted_count / totalDecided) * 100).toFixed(1) : '0.0';
  const considerPct = totalDecided > 0 ? ((overview.consider_count / totalDecided) * 100).toFixed(1) : '0.0';
  const rejectPct = totalDecided > 0 ? ((overview.rejected_count / totalDecided) * 100).toFixed(1) : '0.0';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 700, color: '#fff' }}>Recruiting Intelligence Reports</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '4px' }}>
            Historical screening analytics, pipeline outcome distribution, and skill-gap analysis — sourced live from
            the screening engine.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={fetchOverview} className="btn btn-ghost" title="Refresh report data">
            <RefreshCw size={16} />
          </button>
          <button onClick={() => downloadBlob(buildCsv(overview), 'screening-analytics-snapshot.csv', 'text/csv')} className="btn btn-secondary">
            <FileSpreadsheet size={16} /> Export CSV
          </button>
          <button
            onClick={() => downloadBlob(JSON.stringify(overview, null, 2), 'screening-analytics-snapshot.json', 'application/json')}
            className="btn btn-secondary"
          >
            <FileJson size={16} /> Export JSON
          </button>
        </div>
      </div>

      {/* 1. Screening Overview */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <SectionHeader title="Screening Overview" subtitle="Aggregated across every screening batch on record" />
        <Card elevated>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '20px' }}>
            <StatBlock label="Total Screenings" value={overview.total_screenings} />
            <StatBlock label="Candidates Screened" value={overview.candidates_screened} />
            <StatBlock label="Average Score" value={overview.average_score.toFixed(1)} color="#38bdf8" />
            <StatBlock label="Shortlist Rate" value={`${shortlistPct}%`} color="#10b981" />
            <StatBlock label="Consider Rate" value={`${considerPct}%`} color="#f59e0b" />
            <StatBlock label="Reject Rate" value={`${rejectPct}%`} color="#f43f5e" />
          </div>
          <div style={{ display: 'flex', gap: '8px', marginTop: '20px', flexWrap: 'wrap' }}>
            <span className="badge badge-strong">{overview.shortlisted_count} Shortlist</span>
            <span className="badge badge-partial">{overview.consider_count} Consider</span>
            <span className="badge badge-low">{overview.rejected_count} Reject</span>
          </div>
        </Card>
      </div>

      {/* 2. Job Performance */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <SectionHeader title="Job Performance Comparison" subtitle="Outcome distribution per job requisition" />
        <Card style={{ padding: 0, overflow: 'hidden' }}>
          {overview.job_performance.length === 0 ? (
            <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-secondary)' }}>
              No job requisitions yet.
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-medium)', textAlign: 'left', color: 'var(--text-muted)' }}>
                    <th style={{ padding: '12px 16px' }}>Job</th>
                    <th style={{ padding: '12px 16px' }}>Screened</th>
                    <th style={{ padding: '12px 16px' }}>Shortlist</th>
                    <th style={{ padding: '12px 16px' }}>Consider</th>
                    <th style={{ padding: '12px 16px' }}>Reject</th>
                    <th style={{ padding: '12px 16px' }}>Avg Score</th>
                  </tr>
                </thead>
                <tbody>
                  {overview.job_performance.map((j) => (
                    <tr
                      key={j.job_id}
                      onClick={() => navigate(`/jobs/${j.job_id}`)}
                      style={{ borderBottom: '1px solid var(--border-subtle)', cursor: 'pointer' }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.03)')}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                    >
                      <td style={{ padding: '12px 16px', color: '#fff', fontWeight: 600 }}>{j.job_title}</td>
                      <td style={{ padding: '12px 16px' }}>{j.candidates_screened}</td>
                      <td style={{ padding: '12px 16px', color: '#34d399' }}>{j.shortlist_count}</td>
                      <td style={{ padding: '12px 16px', color: '#fbbf24' }}>{j.consider_count}</td>
                      <td style={{ padding: '12px 16px', color: '#fb7185' }}>{j.reject_count}</td>
                      <td style={{ padding: '12px 16px', fontWeight: 700, color: '#38bdf8' }}>
                        {j.candidates_screened > 0 ? j.average_score.toFixed(1) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      {/* 3. Skill Gap Analysis */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <SectionHeader title="Skill Gap Analysis" subtitle="Required vs. preferred skill coverage across all screened candidates" />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '18px' }}>
          <Card>
            <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#fb7185', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Frequently Missing Required Skills
            </span>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px', marginBottom: '12px' }}>
              Highest-signal skill gaps in the candidate pool — strong candidates for upskilling programs or sourcing focus.
            </p>
            {overview.frequently_missing_required_skills.length === 0 ? (
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>No data yet</span>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {overview.frequently_missing_required_skills.map((s) => (
                  <div key={s.skill} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem' }}>
                    <span style={{ color: '#e2e8f0' }}>{s.skill}</span>
                    <span className="badge badge-low">{s.count}×</span>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card>
            <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#34d399', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Frequently Matched Required Skills
            </span>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px', marginBottom: '12px' }}>
              Required skills the current pipeline covers well.
            </p>
            {overview.frequently_matched_required_skills.length === 0 ? (
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>No data yet</span>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {overview.frequently_matched_required_skills.map((s) => (
                  <div key={s.skill} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem' }}>
                    <span style={{ color: '#e2e8f0' }}>{s.skill}</span>
                    <span className="badge badge-strong">{s.count}×</span>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card>
            <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#818cf8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Frequently Matched Preferred Skills
            </span>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px', marginBottom: '12px' }}>
              Bonus skills candidates already bring beyond the minimum bar.
            </p>
            {overview.frequently_matched_preferred_skills.length === 0 ? (
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>No data yet</span>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {overview.frequently_matched_preferred_skills.map((s) => (
                  <div key={s.skill} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem' }}>
                    <span style={{ color: '#e2e8f0' }}>{s.skill}</span>
                    <span className="badge badge-indigo">{s.count}×</span>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* 4. Screening History */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <SectionHeader title="Screening History" subtitle="Every screening batch run to date" />
        <Card style={{ padding: 0, overflow: 'hidden' }}>
          {overview.recent_screenings.length === 0 ? (
            <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-secondary)' }}>
              No screenings have been run yet.
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-medium)', textAlign: 'left', color: 'var(--text-muted)' }}>
                    <th style={{ padding: '12px 16px' }}>Screening ID</th>
                    <th style={{ padding: '12px 16px' }}>Job</th>
                    <th style={{ padding: '12px 16px' }}>Candidates</th>
                    <th style={{ padding: '12px 16px' }}>Shortlist</th>
                    <th style={{ padding: '12px 16px' }}>Consider</th>
                    <th style={{ padding: '12px 16px' }}>Reject</th>
                    <th style={{ padding: '12px 16px' }}>Avg Score</th>
                    <th style={{ padding: '12px 16px' }}>Date / Time</th>
                  </tr>
                </thead>
                <tbody>
                  {overview.recent_screenings.map((s) => (
                    <tr
                      key={s.screening_id}
                      onClick={() => navigate(`/screening/${s.screening_id}`)}
                      style={{ borderBottom: '1px solid var(--border-subtle)', cursor: 'pointer' }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.03)')}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                    >
                      <td style={{ padding: '12px 16px', fontFamily: 'monospace', color: 'var(--text-secondary)' }}>
                        {s.screening_id}
                      </td>
                      <td style={{ padding: '12px 16px', color: '#fff', fontWeight: 600 }}>{s.job_title}</td>
                      <td style={{ padding: '12px 16px' }}>{s.candidates_count}</td>
                      <td style={{ padding: '12px 16px', color: '#34d399' }}>{s.shortlist_count}</td>
                      <td style={{ padding: '12px 16px', color: '#fbbf24' }}>{s.consider_count}</td>
                      <td style={{ padding: '12px 16px', color: '#fb7185' }}>{s.reject_count}</td>
                      <td style={{ padding: '12px 16px', fontWeight: 700, color: '#38bdf8' }}>{s.average_score.toFixed(1)}</td>
                      <td style={{ padding: '12px 16px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                        {formatTimestamp(s.created_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      {/* 5. Export footnote */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-muted)', fontSize: '0.78rem' }}>
        <Download size={13} />
        CSV/JSON exports above are a client-side snapshot of the data already returned by the analytics API — no
        scores or rankings are recalculated. Server-generated PDF reports are not yet implemented by the backend.
      </div>
    </div>
  );
};
