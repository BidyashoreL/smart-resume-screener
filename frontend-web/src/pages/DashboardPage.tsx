import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users,
  Briefcase,
  Layers,
  ScanSearch,
  CheckCircle2,
  Zap,
  XCircle,
  Gauge,
  ArrowUpRight,
  TrendingUp,
  TrendingDown,
  Sparkles,
} from 'lucide-react';
import { api } from '../services/api';
import type { AnalyticsOverview } from '../types/api';
import { Card } from '../components/common/Card';
import { MatchBandBadge, RecommendationBadge } from '../components/common/Badge';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { ErrorMessage } from '../components/common/ErrorMessage';

// All numbers on this page are read directly from GET /api/screen/analytics/overview.
// This component performs no scoring, ranking, or recommendation logic of its own -
// it only formats and lays out values the backend already computed.

const MATCH_BAND_COLORS: Record<string, string> = {
  'Strong Match': '#10b981',
  'Good Match': '#38bdf8',
  'Partial Match': '#f59e0b',
  'Low Match': '#f43f5e',
};

const RECOMMENDATION_COLORS: Record<string, string> = {
  SHORTLIST: '#10b981',
  CONSIDER: '#f59e0b',
  REJECT: '#f43f5e',
};

const SectionHeader: React.FC<{ title: string; subtitle?: string; action?: React.ReactNode }> = ({
  title,
  subtitle,
  action,
}) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: '10px' }}>
    <div>
      <h2 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#fff' }}>{title}</h2>
      {subtitle && (
        <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '2px' }}>{subtitle}</p>
      )}
    </div>
    {action}
  </div>
);

interface KpiCardProps {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  accent: string;
  hint?: string;
}

const KpiCard: React.FC<KpiCardProps> = ({ label, value, icon, accent, hint }) => (
  <Card elevated>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'var(--text-muted)' }}>
      <span style={{ fontSize: '0.72rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {label}
      </span>
      <span style={{ color: accent, display: 'flex' }}>{icon}</span>
    </div>
    <div style={{ fontSize: '1.9rem', fontWeight: 700, color: '#fff', margin: '10px 0 2px 0' }}>{value}</div>
    {hint && <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>{hint}</span>}
  </Card>
);

const DistributionBars: React.FC<{ data: Record<string, number>; colors: Record<string, string> }> = ({
  data,
  colors,
}) => {
  const entries = Object.entries(data);
  const max = Math.max(1, ...entries.map(([, count]) => count));
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {entries.map(([label, count]) => (
        <div key={label}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '4px' }}>
            <span style={{ color: 'var(--text-secondary)' }}>{label}</span>
            <strong style={{ color: '#fff' }}>{count}</strong>
          </div>
          <div style={{ height: '8px', backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: '999px', overflow: 'hidden' }}>
            <div
              style={{
                width: `${(count / max) * 100}%`,
                height: '100%',
                backgroundColor: colors[label] || '#6366f1',
                transition: 'width 0.3s ease',
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
};

const SkillInsightList: React.FC<{
  title: string;
  items: { skill: string; count: number }[];
  tone: 'matched' | 'missing';
}> = ({ title, items, tone }) => {
  const color = tone === 'matched' ? '#34d399' : '#fb7185';
  const max = Math.max(1, ...items.map((i) => i.count));
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <span style={{ fontSize: '0.78rem', fontWeight: 700, color, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {title}
      </span>
      {items.length === 0 ? (
        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>No data yet</span>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {items.map((item) => (
            <div key={item.skill}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '3px' }}>
                <span style={{ color: '#e2e8f0' }}>{item.skill}</span>
                <span style={{ color: 'var(--text-muted)' }}>{item.count}</span>
              </div>
              <div style={{ height: '5px', backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: '999px', overflow: 'hidden' }}>
                <div style={{ width: `${(item.count / max) * 100}%`, height: '100%', backgroundColor: color }} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

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

export const DashboardPage: React.FC = () => {
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
      setError(err?.detail || 'Failed to load analytics overview from backend.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOverview();
  }, []);

  if (loading) {
    return <LoadingSpinner message="Loading executive analytics overview..." fullPage />;
  }

  if (error || !overview) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 700, color: '#fff' }}>Recruiting Intelligence Overview</h1>
        </div>
        <ErrorMessage
          title="Analytics Unavailable"
          message={error || 'The analytics overview could not be loaded.'}
          onRetry={fetchOverview}
        />
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 700, letterSpacing: '-0.02em', color: '#fff' }}>
            Recruiting Intelligence Overview
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '4px' }}>
            Executive ATS Command Center • Live data from the screening engine
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={() => navigate('/candidates')} className="btn btn-primary">
            + Upload Resumes
          </button>
          <button onClick={() => navigate('/jobs')} className="btn btn-secondary">
            + New Job Post
          </button>
          <button onClick={() => navigate('/screening')} className="btn btn-success">
            <Sparkles size={15} /> Run Screening
          </button>
        </div>
      </div>

      {/* 1. KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '18px' }}>
        <KpiCard label="Total Candidates" value={overview.total_candidates} icon={<Users size={17} />} accent="#818cf8" />
        <KpiCard label="Active Jobs" value={overview.active_jobs} icon={<Briefcase size={17} />} accent="#38bdf8" />
        <KpiCard label="Screening Batches" value={overview.total_screenings} icon={<Layers size={17} />} accent="#a78bfa" />
        <KpiCard label="Candidates Screened" value={overview.candidates_screened} icon={<ScanSearch size={17} />} accent="#818cf8" />
        <KpiCard label="Shortlisted" value={overview.shortlisted_count} icon={<CheckCircle2 size={17} />} accent="#10b981" />
        <KpiCard label="Consider" value={overview.consider_count} icon={<Zap size={17} />} accent="#f59e0b" />
        <KpiCard label="Rejected" value={overview.rejected_count} icon={<XCircle size={17} />} accent="#f43f5e" />
        <KpiCard
          label="Average Score"
          value={`${overview.average_score.toFixed(1)}`}
          icon={<Gauge size={17} />}
          accent="#38bdf8"
          hint="out of 100, across all screenings"
        />
      </div>

      {/* 2. Screening Distribution */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
        <Card elevated>
          <SectionHeader title="Match Band Distribution" subtitle="Every screened candidate, grouped by fit band" />
          <div style={{ marginTop: '16px' }}>
            <DistributionBars data={overview.match_band_distribution} colors={MATCH_BAND_COLORS} />
          </div>
        </Card>
        <Card elevated>
          <SectionHeader title="Recommendation Distribution" subtitle="Every screened candidate, grouped by recruiter recommendation" />
          <div style={{ marginTop: '16px' }}>
            <DistributionBars data={overview.recommendation_distribution} colors={RECOMMENDATION_COLORS} />
          </div>
        </Card>
      </div>

      {/* 3. Recent Screening Sessions */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <SectionHeader title="Recent Screening Sessions" subtitle="Click a session to view its full ranked results" />
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
                    <th style={{ padding: '12px 16px' }}>Screened</th>
                    <th style={{ padding: '12px 16px' }}>Shortlist</th>
                    <th style={{ padding: '12px 16px' }}>Consider</th>
                    <th style={{ padding: '12px 16px' }}>Reject</th>
                    <th style={{ padding: '12px 16px' }}>Avg Score</th>
                    <th style={{ padding: '12px 16px' }}>Run At</th>
                  </tr>
                </thead>
                <tbody>
                  {overview.recent_screenings.map((s) => (
                    <tr
                      key={s.screening_id}
                      onClick={() => navigate(`/screening/${s.screening_id}`)}
                      style={{
                        borderBottom: '1px solid var(--border-subtle)',
                        cursor: 'pointer',
                        transition: 'background-color 0.12s ease',
                      }}
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

      {/* 4. Top Candidates */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <SectionHeader title="Top Candidates" subtitle="Highest-scoring candidates across all screenings" />
        {overview.top_candidates.length === 0 ? (
          <Card>
            <div style={{ padding: '16px', textAlign: 'center', color: 'var(--text-secondary)' }}>
              No candidates have been screened yet.
            </div>
          </Card>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px' }}>
            {overview.top_candidates.map((c, idx) => (
              <Card
                key={`${c.candidate_id}-${c.screening_id}`}
                elevated
                onClick={() => navigate(`/candidates/${c.candidate_id}`)}
                style={{
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                  border: idx === 0 ? '1px solid rgba(16, 185, 129, 0.4)' : undefined,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#fff' }}>{c.candidate_name}</h3>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{c.job_title}</span>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#fff' }}>{c.overall_score.toFixed(1)}</div>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>/ 100</span>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <MatchBandBadge band={c.match_band} size="sm" />
                  <RecommendationBadge recommendation={c.recommendation} />
                </div>
                {c.strengths.length > 0 && (
                  <ul style={{ paddingLeft: '16px', fontSize: '0.78rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                    {c.strengths.slice(0, 3).map((s, i) => (
                      <li key={i}>{s}</li>
                    ))}
                  </ul>
                )}
                <span style={{ fontSize: '0.72rem', color: 'var(--accent-primary)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                  View candidate dossier <ArrowUpRight size={12} />
                </span>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* 5. Job Performance */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <SectionHeader title="Job Performance" subtitle="Screening outcomes broken down per job requisition" />
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

      {/* 6. Skill Insights */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <SectionHeader title="Skill Insights" subtitle="Aggregated across every screening result on file" />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '18px' }}>
          <Card>
            <SkillInsightList
              title="Frequently Matched Required Skills"
              items={overview.frequently_matched_required_skills}
              tone="matched"
            />
          </Card>
          <Card>
            <SkillInsightList
              title="Frequently Missing Required Skills"
              items={overview.frequently_missing_required_skills}
              tone="missing"
            />
          </Card>
          <Card>
            <SkillInsightList
              title="Frequently Matched Preferred Skills"
              items={overview.frequently_matched_preferred_skills}
              tone="matched"
            />
          </Card>
        </div>
      </div>

      {/* Trend hint footer - purely descriptive, no computation */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-muted)', fontSize: '0.78rem' }}>
        {overview.shortlisted_count >= overview.rejected_count ? (
          <TrendingUp size={14} style={{ color: '#10b981' }} />
        ) : (
          <TrendingDown size={14} style={{ color: '#f43f5e' }} />
        )}
        All figures above are computed by the FastAPI screening engine and reflect the current database state.
      </div>
    </div>
  );
};
