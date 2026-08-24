import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Sparkles,
  Plus,
  Loader2,
  Clock,
  Layers,
  UploadCloud,
} from 'lucide-react';
import { api } from '../services/api';
import type { JobResponse, CandidateResponse } from '../types/api';
import { Card } from '../components/common/Card';
import { SkillChip } from '../components/common/Badge';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { ErrorMessage } from '../components/common/ErrorMessage';
import { ResumeUploader } from '../components/candidates/ResumeUploader';


export const ScreeningPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const preselectedJobId = searchParams.get('jobId');

  const [jobs, setJobs] = useState<JobResponse[]>([]);
  const [candidates, setCandidates] = useState<CandidateResponse[]>([]);
  const [loadingInitial, setLoadingInitial] = useState<boolean>(true);
  const [initialError, setInitialError] = useState<string | null>(null);

  // Workflow Selection State
  const [selectedJobId, setSelectedJobId] = useState<string>(preselectedJobId || '');
  const [selectedCandidateIds, setSelectedCandidateIds] = useState<string[]>([]);

  // Execution State
  const [isScreening, setIsScreening] = useState<boolean>(false);
  const [screeningError, setScreeningError] = useState<string | null>(null);

  // Uploader Modal
  const [isUploaderOpen, setIsUploaderOpen] = useState<boolean>(false);

  useEffect(() => {
    let mounted = true;
    const loadData = async () => {
      setLoadingInitial(true);
      setInitialError(null);
      try {
        const [jobsData, candidatesData] = await Promise.all([
          api.listJobs(),
          api.listCandidates(),
        ]);
        if (mounted) {
          setJobs(jobsData);
          setCandidates(candidatesData);
          if (jobsData.length > 0 && !selectedJobId) {
            setSelectedJobId(preselectedJobId || jobsData[0].job_id);
          }
          // Default select all candidates initially for convenience
          if (candidatesData.length > 0 && selectedCandidateIds.length === 0) {
            setSelectedCandidateIds(candidatesData.map((c) => c.candidate_id));
          }
        }
      } catch (err: any) {
        if (mounted) {
          setInitialError(err?.detail || 'Failed to load jobs or candidate talent pool.');
        }
      } finally {
        if (mounted) setLoadingInitial(false);
      }
    };

    loadData();
    return () => {
      mounted = false;
    };
  }, [preselectedJobId]);

  const toggleCandidate = (id: string) => {
    if (isScreening) return;
    setSelectedCandidateIds((prev) =>
      prev.includes(id) ? prev.filter((cId) => cId !== id) : [...prev, id]
    );
  };

  const selectAllCandidates = () => {
    if (isScreening) return;
    setSelectedCandidateIds(candidates.map((c) => c.candidate_id));
  };

  const deselectAllCandidates = () => {
    if (isScreening) return;
    setSelectedCandidateIds([]);
  };

  const handleRunScreening = async () => {
    if (!selectedJobId) {
      setScreeningError('Please select a target job requisition.');
      return;
    }
    if (selectedCandidateIds.length === 0) {
      setScreeningError('Please select at least one candidate for screening.');
      return;
    }

    setIsScreening(true);
    setScreeningError(null);

    try {
      const screeningResult = await api.screenCandidates(selectedJobId, selectedCandidateIds);
      navigate(`/screening/${screeningResult.screening_id}`);
    } catch (err: any) {
      setScreeningError(err?.detail || 'Screening execution failed on the backend.');
      setIsScreening(false);
    }
  };

  const selectedJob = jobs.find((j) => j.job_id === selectedJobId);

  if (loadingInitial) {
    return <LoadingSpinner message="Initializing Screening Studio & loading cohorts..." fullPage />;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 700, letterSpacing: '-0.02em', color: '#fff' }}>
            AI Screening & Shortlisting Studio
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '4px' }}>
            Pair target job requirements with candidate cohorts for hybrid deterministic + semantic evaluation
          </p>
        </div>

        <button
          onClick={() => setIsUploaderOpen(true)}
          className="btn btn-secondary"
          disabled={isScreening}
        >
          <UploadCloud size={16} /> Upload More Resumes
        </button>
      </div>

      {initialError && (
        <ErrorMessage
          title="Initialization Error"
          message={initialError}
          onRetry={() => window.location.reload()}
        />
      )}

      {/* 3-Step Guided Workflow Layout */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        {/* Step 1: Target Job Selection */}
        <Card elevated style={{ padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
            <div
              style={{
                width: '28px',
                height: '28px',
                borderRadius: '50%',
                backgroundColor: 'var(--accent-primary)',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 700,
                fontSize: '0.85rem',
              }}
            >
              1
            </div>
            <h2 style={{ fontSize: '1.15rem', fontWeight: 600, color: '#fff' }}>
              Target Job Selection
            </h2>
            {selectedJob && (
              <span className="badge badge-indigo" style={{ marginLeft: 'auto' }}>
                Job ID: {selectedJob.job_id}
              </span>
            )}
          </div>

          {jobs.length === 0 ? (
            <div style={{ padding: '16px', backgroundColor: 'var(--bg-app)', borderRadius: 'var(--radius-sm)', textAlign: 'center' }}>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '12px' }}>
                No active jobs available. Please create a job description first.
              </p>
              <button onClick={() => navigate('/jobs')} className="btn btn-primary">
                <Plus size={14} /> Create Job Description
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                <select
                  value={selectedJobId}
                  onChange={(e) => setSelectedJobId(e.target.value)}
                  disabled={isScreening}
                  className="select-input"
                  style={{ fontSize: '0.95rem', fontWeight: 500 }}
                >
                  {jobs.map((job) => (
                    <option key={job.job_id} value={job.job_id}>
                      {job.profile.title || job.title || 'Untitled Role'} ({job.job_id})
                    </option>
                  ))}
                </select>
              </div>

              {/* Selected Job Requirements Summary */}
              {selectedJob && (
                <div
                  style={{
                    backgroundColor: 'var(--bg-app)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '14px 18px',
                    border: '1px solid var(--border-subtle)',
                    display: 'flex',
                    flexWrap: 'wrap',
                    alignItems: 'center',
                    gap: '16px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    <Clock size={14} style={{ color: '#818cf8' }} />
                    Min Exp:{' '}
                    <strong style={{ color: '#fff' }}>
                      {selectedJob.profile.minimum_experience_months
                        ? `${selectedJob.profile.minimum_experience_months} mos`
                        : 'None'}
                    </strong>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                    <Layers size={14} style={{ color: '#10b981' }} />
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Required:</span>
                    {selectedJob.profile.required_skills.map((skill, sIdx) => (
                      <SkillChip key={sIdx} skill={skill} status="matched" type="required" />
                    ))}
                  </div>

                  {selectedJob.profile.preferred_skills.length > 0 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                      <Sparkles size={14} style={{ color: '#818cf8' }} />
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Preferred:</span>
                      {selectedJob.profile.preferred_skills.slice(0, 4).map((skill, sIdx) => (
                        <SkillChip key={sIdx} skill={skill} status="neutral" type="preferred" />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </Card>

        {/* Step 2: Candidate Cohort Selection */}
        <Card elevated style={{ padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div
                style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '50%',
                  backgroundColor: 'var(--accent-primary)',
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 700,
                  fontSize: '0.85rem',
                }}
              >
                2
              </div>
              <h2 style={{ fontSize: '1.15rem', fontWeight: 600, color: '#fff' }}>
                Candidate Cohort Selection
              </h2>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span className="badge badge-strong">
                {selectedCandidateIds.length} of {candidates.length} candidates selected
              </span>
              <button
                type="button"
                onClick={selectAllCandidates}
                disabled={isScreening || candidates.length === 0}
                className="btn btn-ghost"
                style={{ fontSize: '0.75rem', padding: '4px 8px' }}
              >
                Select All
              </button>
              <button
                type="button"
                onClick={deselectAllCandidates}
                disabled={isScreening || selectedCandidateIds.length === 0}
                className="btn btn-ghost"
                style={{ fontSize: '0.75rem', padding: '4px 8px' }}
              >
                Clear Selection
              </button>
            </div>
          </div>

          {candidates.length === 0 ? (
            <div style={{ padding: '24px', backgroundColor: 'var(--bg-app)', borderRadius: 'var(--radius-sm)', textAlign: 'center' }}>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '12px' }}>
                No candidate resumes available in the pool. Upload resumes to proceed with screening.
              </p>
              <button onClick={() => setIsUploaderOpen(true)} className="btn btn-primary">
                <UploadCloud size={14} /> Upload Resumes
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '360px', overflowY: 'auto' }}>
              {candidates.map((cand) => {
                const isChecked = selectedCandidateIds.includes(cand.candidate_id);
                const profile = cand.profile;
                const name = cand.name || profile.name || 'Unnamed Candidate';
                const skills = profile.skills || [];

                return (
                  <div
                    key={cand.candidate_id}
                    onClick={() => toggleCandidate(cand.candidate_id)}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '32px 240px 140px 1fr',
                      alignItems: 'center',
                      padding: '10px 14px',
                      backgroundColor: isChecked ? 'rgba(99, 102, 241, 0.08)' : 'var(--bg-app)',
                      border: `1px solid ${isChecked ? 'rgba(99, 102, 241, 0.4)' : 'var(--border-subtle)'}`,
                      borderRadius: 'var(--radius-sm)',
                      cursor: isScreening ? 'not-allowed' : 'pointer',
                      transition: 'all 0.15s ease',
                      gap: '12px',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => {}}
                      disabled={isScreening}
                      style={{ cursor: 'pointer', accentColor: 'var(--accent-primary)' }}
                    />
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 600, color: '#fff', fontSize: '0.875rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {name}
                      </div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                        {cand.email || profile.email || cand.candidate_id}
                      </div>
                    </div>

                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                      {profile.total_experience_months
                        ? `${(profile.total_experience_months / 12).toFixed(1)} yrs exp`
                        : 'Exp: N/A'}
                    </div>

                    <div style={{ display: 'flex', gap: '5px', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                      {skills.slice(0, 4).map((s, idx) => (
                        <SkillChip key={idx} skill={s.name} />
                      ))}
                      {skills.length > 4 && (
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', alignSelf: 'center' }}>
                          +{skills.length - 4}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        {/* Step 3: Execution & Evaluation Engine */}
        <Card elevated style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div
                style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '50%',
                  backgroundColor: 'var(--accent-primary)',
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 700,
                  fontSize: '0.85rem',
                }}
              >
                3
              </div>
              <div>
                <h2 style={{ fontSize: '1.15rem', fontWeight: 600, color: '#fff' }}>
                  Execution & Evaluation Engine
                </h2>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                  Hybrid Scorer (Deterministic + Gemini LLM Semantic Matcher)
                </span>
              </div>
            </div>

            <button
              onClick={handleRunScreening}
              disabled={isScreening || !selectedJobId || selectedCandidateIds.length === 0}
              className="btn btn-success"
              style={{ padding: '12px 24px', fontSize: '0.95rem' }}
            >
              {isScreening ? (
                <>
                  <Loader2 size={18} className="animate-spin" /> Screening in Progress...
                </>
              ) : (
                <>
                  <Sparkles size={18} /> Execute Batch Screening ({selectedCandidateIds.length} Candidates)
                </>
              )}
            </button>
          </div>

          {/* Active Processing Indeterminate Banner */}
          {isScreening && (
            <div
              style={{
                backgroundColor: 'rgba(99, 102, 241, 0.08)',
                border: '1px solid rgba(99, 102, 241, 0.3)',
                borderRadius: 'var(--radius-md)',
                padding: '20px',
                display: 'flex',
                alignItems: 'center',
                gap: '16px',
              }}
            >
              <Loader2 size={24} className="animate-spin" style={{ color: 'var(--accent-primary)', flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: '0.95rem', fontWeight: 600, color: '#fff' }}>
                  Evaluating {selectedCandidateIds.length} Candidate{selectedCandidateIds.length > 1 ? 's' : ''} against Target Job
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                  Running hybrid deterministic normalization and Gemini LLM semantic evidence matching on backend...
                </div>
              </div>
            </div>
          )}

          {screeningError && (
            <ErrorMessage
              title="Screening Execution Failed"
              message={screeningError}
              onRetry={handleRunScreening}
            />
          )}
        </Card>
      </div>

      {/* Resume Uploader Modal */}
      <ResumeUploader
        isOpen={isUploaderOpen}
        onClose={() => setIsUploaderOpen(false)}
        onUploadSuccess={() => {
          api.listCandidates().then((cands) => {
            setCandidates(cands);
            setSelectedCandidateIds(cands.map((c) => c.candidate_id));
          });
        }}
      />
    </div>
  );
};
