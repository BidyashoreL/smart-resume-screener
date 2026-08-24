import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  Sparkles,
  ArrowLeft,
  CheckCircle2,
  BarChart2,
  Quote,
  ChevronDown,
  ChevronUp,
  User,
} from 'lucide-react';
import { api } from '../services/api';
import type { ScreeningResponse, JobResponse } from '../types/api';
import { Card } from '../components/common/Card';
import { MatchBandBadge, RecommendationBadge, SkillChip } from '../components/common/Badge';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { ErrorMessage } from '../components/common/ErrorMessage';

export const ScreeningResultsPage: React.FC = () => {
  const { screeningId } = useParams<{ screeningId: string }>();
  const navigate = useNavigate();

  const [screening, setScreening] = useState<ScreeningResponse | null>(null);
  const [job, setJob] = useState<JobResponse | null>(null);
  const [candidatesMap, setCandidatesMap] = useState<{ [id: string]: string }>({});
  const [expandedCards, setExpandedCards] = useState<{ [id: string]: boolean }>({});
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchResults = async () => {
    if (!screeningId) return;
    setLoading(true);
    setError(null);
    try {
      const [screeningData, candidatesList] = await Promise.all([
        api.getScreening(screeningId),
        api.listCandidates().catch(() => []),
      ]);

      const map: { [id: string]: string } = {};
      candidatesList.forEach((c) => {
        const n = c.name || c.profile.name;
        if (n) map[c.candidate_id] = n;
      });
      setCandidatesMap(map);
      setScreening(screeningData);

      // Auto-expand the top candidate
      if (screeningData.results.length > 0) {
        setExpandedCards({ [screeningData.results[0].candidate_id]: true });
      }

      // Fetch job context
      try {
        const jobData = await api.getJob(screeningData.job_id);
        setJob(jobData);
      } catch {
        // Job metadata optional
      }
    } catch (err: any) {
      setError(err?.detail || `Failed to retrieve screening batch: ${screeningId}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchResults();
  }, [screeningId]);

  const toggleExpand = (candidateId: string) => {
    setExpandedCards((prev) => ({
      ...prev,
      [candidateId]: !prev[candidateId],
    }));
  };

  if (loading) {
    return <LoadingSpinner message="Retrieving ranked screening shortlist & evidence audit..." fullPage />;
  }

  if (error || !screening) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <Link to="/screening" className="btn btn-secondary" style={{ width: 'fit-content' }}>
          <ArrowLeft size={16} /> Back to Screening Studio
        </Link>
        <ErrorMessage
          title="Screening Results Not Found"
          message={error || 'The requested screening batch could not be found.'}
          onRetry={fetchResults}
        />
      </div>
    );
  }

  const results = screening.results || [];
  const totalScreened = results.length;
  const shortlistCount = results.filter((r) => r.recommendation === 'SHORTLIST').length;
  const considerCount = results.filter((r) => r.recommendation === 'CONSIDER').length;
  const rejectCount = results.filter((r) => r.recommendation === 'REJECT').length;
  const strongMatchCount = results.filter((r) => r.match_band === 'Strong Match').length;

  const avgScore =
    totalScreened > 0
      ? (results.reduce((acc, r) => acc + r.scores.overall_score, 0) / totalScreened).toFixed(1)
      : '0.0';

  const jobTitle = job?.profile.title || job?.title || `Job ID: ${screening.job_id}`;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', marginBottom: '4px' }}>
            <Link to="/screening" style={{ color: 'var(--text-secondary)', textDecoration: 'none' }}>
              Screening Studio
            </Link>
            <span style={{ color: 'var(--text-muted)' }}>/</span>
            <span style={{ color: '#fff' }}>Results</span>
          </div>

          <h1 style={{ fontSize: '1.75rem', fontWeight: 700, letterSpacing: '-0.02em', color: '#fff' }}>
            Screening Results: {jobTitle}
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '4px', fontFamily: 'monospace' }}>
            Screening ID: {screening.screening_id} • {totalScreened} Candidates Evaluated • {strongMatchCount} Strong Match{strongMatchCount !== 1 ? 'es' : ''}
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={() => navigate(`/screening/${screening.screening_id}/compare`)}
            className="btn btn-secondary"
          >
            <BarChart2 size={16} /> Side-by-Side Comparison
          </button>
          <button
            onClick={() => navigate('/screening')}
            className="btn btn-primary"
          >
            <Sparkles size={16} /> New Screening
          </button>
        </div>
      </div>

      {/* Summary KPI Banner */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '16px',
        }}
      >
        <Card elevated>
          <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>
            Total Screened
          </span>
          <div style={{ fontSize: '2rem', fontWeight: 700, color: '#fff', marginTop: '4px' }}>
            {totalScreened}
          </div>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
            Candidate cohort size
          </span>
        </Card>

        <Card elevated>
          <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>
            Recommendations Breakdown
          </span>
          <div style={{ display: 'flex', gap: '8px', marginTop: '8px', flexWrap: 'wrap' }}>
            <span className="badge badge-strong">{shortlistCount} Shortlist</span>
            <span className="badge badge-partial">{considerCount} Consider</span>
            <span className="badge badge-low">{rejectCount} Reject</span>
          </div>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginTop: '6px' }}>
            {shortlistCount} candidate{shortlistCount !== 1 ? 's' : ''} recommended for interview
          </span>
        </Card>

        <Card elevated>
          <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>
            Average Overall Score
          </span>
          <div style={{ fontSize: '2rem', fontWeight: 700, color: '#38bdf8', marginTop: '4px' }}>
            {avgScore} <span style={{ fontSize: '1rem', color: 'var(--text-muted)' }}>/ 100</span>
          </div>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
            Weighted multi-dimensional average
          </span>
        </Card>

        <Card elevated>
          <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>
            Target Requisition
          </span>
          <div style={{ fontSize: '1rem', fontWeight: 600, color: '#fff', marginTop: '6px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {jobTitle}
          </div>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
            {screening.job_id}
          </span>
        </Card>
      </div>

      {/* Ranked Candidate List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#fff' }}>
            Ranked Candidates Shortlist
          </h2>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            Ranked by overall weighted fit score
          </span>
        </div>

        {results.map((candidateResult, index) => {
          const rank = index + 1;
          const candidateId = candidateResult.candidate_id;
          const isExpanded = !!expandedCards[candidateId];
          const overall10 = (candidateResult.scores.overall_score / 10).toFixed(1);
          const name = candidateResult.candidate_name || candidatesMap[candidateId] || `Candidate (${candidateId})`;

          return (
            <Card
              key={candidateId}
              elevated
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '16px',
                padding: '24px',
                border: rank === 1 ? '1px solid rgba(16, 185, 129, 0.4)' : undefined,
                boxShadow: rank === 1 ? '0 0 25px rgba(16, 185, 129, 0.15)' : undefined,
              }}
            >
              {/* Header Row */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
                <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                  {/* Rank Badge */}
                  <div
                    style={{
                      width: '42px',
                      height: '42px',
                      borderRadius: 'var(--radius-sm)',
                      backgroundColor: rank === 1 ? '#059669' : rank === 2 ? '#2563eb' : '#1e293b',
                      color: '#fff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 800,
                      fontSize: '1.1rem',
                      flexShrink: 0,
                    }}
                  >
                    #{rank}
                  </div>

                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                      <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#fff' }}>
                        {name}
                      </h3>
                      <MatchBandBadge band={candidateResult.match_band} />
                      <RecommendationBadge recommendation={candidateResult.recommendation} />
                    </div>

                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px', fontFamily: 'monospace' }}>
                      Candidate ID: {candidateId}
                    </div>
                  </div>
                </div>

                {/* Score and Quick Actions */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#fff' }}>
                      {candidateResult.scores.overall_score.toFixed(1)}{' '}
                      <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>/ 100</span>
                    </div>
                    <span style={{ fontSize: '0.75rem', color: '#818cf8', fontWeight: 600 }}>
                      Fit: {overall10} / 10
                    </span>
                  </div>

                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      onClick={() => navigate(`/candidates/${candidateId}`)}
                      className="btn btn-secondary"
                      style={{ fontSize: '0.75rem', padding: '6px 10px' }}
                    >
                      <User size={13} /> Dossier
                    </button>
                    <button
                      onClick={() => toggleExpand(candidateId)}
                      className="btn btn-ghost"
                      style={{ fontSize: '0.75rem', padding: '6px 10px' }}
                    >
                      {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </button>
                  </div>
                </div>
              </div>

              {/* 4-Column Score Breakdown Metrics */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                  gap: '12px',
                  backgroundColor: 'var(--bg-app)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '14px 18px',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                <div>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block' }}>
                    Required Skills
                  </span>
                  <div style={{ fontSize: '1.15rem', fontWeight: 700, color: '#34d399', marginTop: '2px' }}>
                    {candidateResult.scores.skill_score.toFixed(0)}%
                  </div>
                </div>

                <div>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block' }}>
                    Experience Fit
                  </span>
                  <div style={{ fontSize: '1.15rem', fontWeight: 700, color: '#38bdf8', marginTop: '2px' }}>
                    {candidateResult.scores.experience_score.toFixed(0)}%
                  </div>
                </div>

                <div>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block' }}>
                    Responsibilities
                  </span>
                  <div style={{ fontSize: '1.15rem', fontWeight: 700, color: '#818cf8', marginTop: '2px' }}>
                    {candidateResult.scores.responsibility_score.toFixed(0)}%
                  </div>
                </div>

                <div>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block' }}>
                    Education Score
                  </span>
                  <div style={{ fontSize: '1.15rem', fontWeight: 700, color: '#fbbf24', marginTop: '2px' }}>
                    {candidateResult.scores.education_score.toFixed(0)}%
                  </div>
                </div>
              </div>

              {/* Matched vs Missing Skills Preview */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'minmax(280px, 1fr) minmax(280px, 1fr)',
                  gap: '16px',
                }}
              >
                {/* Matched Skills */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#34d399', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Matched Skills ({candidateResult.matched_required_skills.length + candidateResult.matched_preferred_skills.length})
                  </span>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {candidateResult.matched_required_skills.map((s, idx) => (
                      <SkillChip key={`req-${idx}`} skill={s} status="matched" type="required" />
                    ))}
                    {candidateResult.matched_preferred_skills.map((s, idx) => (
                      <SkillChip key={`pref-${idx}`} skill={s} status="matched" type="preferred" />
                    ))}
                    {candidateResult.matched_required_skills.length === 0 && candidateResult.matched_preferred_skills.length === 0 && (
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>None matched</span>
                    )}
                  </div>
                </div>

                {/* Missing Skills */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#fb7185', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Missing Skills ({candidateResult.missing_required_skills.length + candidateResult.missing_preferred_skills.length})
                  </span>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {candidateResult.missing_required_skills.map((s, idx) => (
                      <SkillChip key={`miss-req-${idx}`} skill={s} status="missing" type="required" />
                    ))}
                    {candidateResult.missing_preferred_skills.map((s, idx) => (
                      <SkillChip key={`miss-pref-${idx}`} skill={s} status="missing" type="preferred" />
                    ))}
                    {candidateResult.missing_required_skills.length === 0 && candidateResult.missing_preferred_skills.length === 0 && (
                      <span style={{ fontSize: '0.8rem', color: '#10b981', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <CheckCircle2 size={13} /> Zero skill gaps identified
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Expanded Section: Qualitative Analysis & Evidence Audit Table */}
              {isExpanded && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', borderTop: '1px solid var(--border-subtle)', paddingTop: '16px' }}>
                  {/* Strengths, Weaknesses, Justification */}
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'minmax(260px, 1fr) minmax(260px, 1fr)',
                      gap: '16px',
                    }}
                  >
                    {/* Strengths */}
                    <div style={{ backgroundColor: 'rgba(16, 185, 129, 0.05)', borderRadius: 'var(--radius-sm)', padding: '14px', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                      <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#34d399', textTransform: 'uppercase', display: 'block', marginBottom: '8px' }}>
                        Key Strengths
                      </span>
                      {candidateResult.strengths && candidateResult.strengths.length > 0 ? (
                        <ul style={{ paddingLeft: '18px', fontSize: '0.825rem', color: '#e2e8f0', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          {candidateResult.strengths.map((st, idx) => (
                            <li key={idx}>{st}</li>
                          ))}
                        </ul>
                      ) : (
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>None noted</span>
                      )}
                    </div>

                    {/* Weaknesses */}
                    <div style={{ backgroundColor: 'rgba(244, 63, 94, 0.05)', borderRadius: 'var(--radius-sm)', padding: '14px', border: '1px solid rgba(244, 63, 94, 0.2)' }}>
                      <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#fb7185', textTransform: 'uppercase', display: 'block', marginBottom: '8px' }}>
                        Weaknesses / Skill Gaps
                      </span>
                      {candidateResult.weaknesses && candidateResult.weaknesses.length > 0 ? (
                        <ul style={{ paddingLeft: '18px', fontSize: '0.825rem', color: '#e2e8f0', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          {candidateResult.weaknesses.map((w, idx) => (
                            <li key={idx}>{w}</li>
                          ))}
                        </ul>
                      ) : (
                        <span style={{ fontSize: '0.8rem', color: '#34d399' }}>No major weaknesses identified</span>
                      )}
                    </div>
                  </div>

                  {/* Justification Quote */}
                  {candidateResult.justification && (
                    <div
                      style={{
                        backgroundColor: 'var(--bg-app)',
                        borderRadius: 'var(--radius-sm)',
                        padding: '14px 18px',
                        borderLeft: '3px solid var(--accent-primary)',
                        display: 'flex',
                        gap: '10px',
                      }}
                    >
                      <Quote size={18} style={{ color: 'var(--accent-primary)', flexShrink: 0, marginTop: '2px' }} />
                      <div>
                        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>
                          Evaluation Justification
                        </span>
                        <p style={{ fontSize: '0.85rem', color: '#cbd5e1', lineHeight: 1.6 }}>
                          {candidateResult.justification}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Section 15 Skill Evidence Audit Table */}
                  {candidateResult.skill_evidence && candidateResult.skill_evidence.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '6px' }}>
                      <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#fff', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        Verifiable Skill Evidence Audit
                      </span>
                      <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                          <thead>
                            <tr style={{ borderBottom: '1px solid var(--border-medium)', textAlign: 'left', color: 'var(--text-muted)' }}>
                              <th style={{ padding: '8px 10px' }}>Skill</th>
                              <th style={{ padding: '8px 10px' }}>Requirement</th>
                              <th style={{ padding: '8px 10px' }}>Status</th>
                              <th style={{ padding: '8px 10px' }}>Grounding Source Quote</th>
                            </tr>
                          </thead>
                          <tbody>
                            {candidateResult.skill_evidence.map((ev, evIdx) => (
                              <tr
                                key={evIdx}
                                style={{
                                  borderBottom: '1px solid var(--border-subtle)',
                                  backgroundColor: evIdx % 2 === 0 ? 'rgba(255,255,255,0.01)' : 'transparent',
                                }}
                              >
                                <td style={{ padding: '8px 10px', fontWeight: 600, color: '#fff' }}>
                                  {ev.skill}
                                </td>
                                <td style={{ padding: '8px 10px', color: ev.required ? '#34d399' : '#818cf8' }}>
                                  {ev.required ? 'Required' : 'Preferred'}
                                </td>
                                <td style={{ padding: '8px 10px' }}>
                                  {ev.matched ? (
                                    <span style={{ color: '#10b981', fontWeight: 600 }}>✓ Matched</span>
                                  ) : (
                                    <span style={{ color: '#f43f5e' }}>✕ Missing</span>
                                  )}
                                </td>
                                <td style={{ padding: '8px 10px', color: 'var(--text-secondary)', fontStyle: ev.source ? 'italic' : 'normal' }}>
                                  {ev.source || 'No evidence found in resume text'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
};
