import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  User,
} from 'lucide-react';
import { api } from '../services/api';
import type { ScreeningResponse, JobResponse } from '../types/api';
import { Card } from '../components/common/Card';
import { MatchBandBadge, RecommendationBadge, SkillChip } from '../components/common/Badge';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { ErrorMessage } from '../components/common/ErrorMessage';

export const CandidateComparePage: React.FC = () => {
  const { screeningId } = useParams<{ screeningId: string }>();
  const navigate = useNavigate();

  const [screening, setScreening] = useState<ScreeningResponse | null>(null);
  const [job, setJob] = useState<JobResponse | null>(null);
  const [candidatesMap, setCandidatesMap] = useState<{ [id: string]: string }>({});
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!screeningId) return;
    const loadData = async () => {
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
        try {
          const jobData = await api.getJob(screeningData.job_id);
          setJob(jobData);
        } catch {
          // Job info optional
        }
      } catch (err: any) {
        setError(err?.detail || `Failed to load screening comparison: ${screeningId}`);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [screeningId]);

  if (loading) {
    return <LoadingSpinner message="Generating side-by-side candidate comparison matrix..." fullPage />;
  }

  if (error || !screening) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <Link to={`/screening/${screeningId}`} className="btn btn-secondary" style={{ width: 'fit-content' }}>
          <ArrowLeft size={16} /> Back to Screening Results
        </Link>
        <ErrorMessage
          title="Comparison Load Error"
          message={error || 'The requested screening data could not be loaded.'}
          onRetry={() => window.location.reload()}
        />
      </div>
    );
  }

  const results = screening.results || [];
  const jobTitle = job?.profile.title || job?.title || screening.job_id;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', marginBottom: '4px' }}>
            <Link to={`/screening/${screeningId}`} style={{ color: 'var(--text-secondary)', textDecoration: 'none' }}>
              Screening Results
            </Link>
            <span style={{ color: 'var(--text-muted)' }}>/</span>
            <span style={{ color: '#fff' }}>Side-by-Side Comparison</span>
          </div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 700, letterSpacing: '-0.02em', color: '#fff' }}>
            Candidate Comparison Matrix
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '2px' }}>
            Target: <strong style={{ color: '#fff' }}>{jobTitle}</strong> • {results.length} Candidates Compared
          </p>
        </div>

        <Link to={`/screening/${screeningId}`} className="btn btn-secondary">
          <ArrowLeft size={16} /> Back to Results Shortlist
        </Link>
      </div>

      {/* Comparison Grid */}
      <div style={{ overflowX: 'auto', paddingBottom: '16px' }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: `240px repeat(${results.length}, minmax(300px, 1fr))`,
            gap: '16px',
            minWidth: 'fit-content',
          }}
        >
          {/* Row 1: Headers & Identity */}
          <Card elevated style={{ display: 'flex', alignItems: 'center', fontWeight: 700, color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
            Candidate Overview
          </Card>

          {results.map((cand, idx) => (
            <Card
              key={cand.candidate_id}
              elevated
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                border: idx === 0 ? '1px solid rgba(16, 185, 129, 0.4)' : undefined,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: idx === 0 ? '#10b981' : '#818cf8' }}>
                  Rank #{idx + 1}
                </span>
                <MatchBandBadge band={cand.match_band} size="sm" />
              </div>

              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#fff' }}>
                {cand.candidate_name || candidatesMap[cand.candidate_id] || `Candidate (${cand.candidate_id})`}
              </h3>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
                <RecommendationBadge recommendation={cand.recommendation} />
                <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#fff' }}>
                  {cand.scores.overall_score.toFixed(1)} <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>/100</span>
                </div>
              </div>

              <button
                onClick={() => navigate(`/candidates/${cand.candidate_id}`)}
                className="btn btn-ghost"
                style={{ fontSize: '0.75rem', padding: '4px 8px', marginTop: '4px', border: '1px solid var(--border-subtle)' }}
              >
                <User size={13} /> View Full Dossier
              </button>
            </Card>
          ))}

          {/* Row 2: Score Breakdown Bars */}
          <Card style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            Dimensional Scores
          </Card>

          {results.map((cand) => (
            <Card key={`scores-${cand.candidate_id}`} style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.8rem' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)', marginBottom: '2px' }}>
                  <span>Required Skills:</span>
                  <strong style={{ color: '#34d399' }}>{cand.scores.skill_score.toFixed(0)}%</strong>
                </div>
                <div style={{ height: '5px', backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: '999px', overflow: 'hidden' }}>
                  <div style={{ width: `${cand.scores.skill_score}%`, height: '100%', backgroundColor: '#10b981' }} />
                </div>
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)', marginBottom: '2px' }}>
                  <span>Experience Fit:</span>
                  <strong style={{ color: '#38bdf8' }}>{cand.scores.experience_score.toFixed(0)}%</strong>
                </div>
                <div style={{ height: '5px', backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: '999px', overflow: 'hidden' }}>
                  <div style={{ width: `${cand.scores.experience_score}%`, height: '100%', backgroundColor: '#38bdf8' }} />
                </div>
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)', marginBottom: '2px' }}>
                  <span>Responsibilities:</span>
                  <strong style={{ color: '#818cf8' }}>{cand.scores.responsibility_score.toFixed(0)}%</strong>
                </div>
                <div style={{ height: '5px', backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: '999px', overflow: 'hidden' }}>
                  <div style={{ width: `${cand.scores.responsibility_score}%`, height: '100%', backgroundColor: '#818cf8' }} />
                </div>
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)', marginBottom: '2px' }}>
                  <span>Education:</span>
                  <strong style={{ color: '#fbbf24' }}>{cand.scores.education_score.toFixed(0)}%</strong>
                </div>
                <div style={{ height: '5px', backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: '999px', overflow: 'hidden' }}>
                  <div style={{ width: `${cand.scores.education_score}%`, height: '100%', backgroundColor: '#fbbf24' }} />
                </div>
              </div>
            </Card>
          ))}

          {/* Row 3: Matched Skills */}
          <Card style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            Matched Skills
          </Card>

          {results.map((cand) => (
            <Card key={`matched-${cand.candidate_id}`} style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', alignContent: 'flex-start' }}>
              {cand.matched_required_skills.map((s, idx) => (
                <SkillChip key={`req-${idx}`} skill={s} status="matched" type="required" />
              ))}
              {cand.matched_preferred_skills.map((s, idx) => (
                <SkillChip key={`pref-${idx}`} skill={s} status="matched" type="preferred" />
              ))}
            </Card>
          ))}

          {/* Row 4: Missing Skills */}
          <Card style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            Skill Gaps
          </Card>

          {results.map((cand) => (
            <Card key={`missing-${cand.candidate_id}`} style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', alignContent: 'flex-start' }}>
              {cand.missing_required_skills.map((s, idx) => (
                <SkillChip key={`miss-req-${idx}`} skill={s} status="missing" type="required" />
              ))}
              {cand.missing_preferred_skills.map((s, idx) => (
                <SkillChip key={`miss-pref-${idx}`} skill={s} status="missing" type="preferred" />
              ))}
              {cand.missing_required_skills.length === 0 && cand.missing_preferred_skills.length === 0 && (
                <span style={{ fontSize: '0.78rem', color: '#10b981' }}>None</span>
              )}
            </Card>
          ))}

          {/* Row 5: Strengths Summary */}
          <Card style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            Key Strengths
          </Card>

          {results.map((cand) => (
            <Card key={`str-${cand.candidate_id}`}>
              {cand.strengths && cand.strengths.length > 0 ? (
                <ul style={{ paddingLeft: '16px', fontSize: '0.78rem', color: '#e2e8f0', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {cand.strengths.map((s, idx) => (
                    <li key={idx}>{s}</li>
                  ))}
                </ul>
              ) : (
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>None noted</span>
              )}
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
};
