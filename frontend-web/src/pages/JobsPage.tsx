import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Briefcase,
  Sparkles,
  ChevronRight,
  Clock,
  GraduationCap,
  ListChecks,
  RefreshCw,
  PlusCircle,
  FileCode,
  CheckCircle2,
} from 'lucide-react';
import { api } from '../services/api';
import type { JobResponse } from '../types/api';
import { Card } from '../components/common/Card';
import { SkillChip } from '../components/common/Badge';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { ErrorMessage } from '../components/common/ErrorMessage';

const SAMPLE_TEMPLATES = [
  {
    name: 'Machine Learning Engineer',
    title: 'Machine Learning Engineer',
    desc: `Job Title: Machine Learning Engineer\n\nWe are looking for a Machine Learning Engineer to join our AI platform team.\n\nRequired Skills:\n- Python\n- Machine Learning\n- PyTorch\n\nPreferred Skills:\n- Docker\n- AWS\n- FastAPI\n\nMinimum Experience: 2 years\n\nEducation: Bachelor's degree in Computer Science, Artificial Intelligence, or a related field.\n\nResponsibilities:\n- Build and train machine learning models for production use cases\n- Deploy ML services and APIs used by other engineering teams\n- Collaborate with data scientists to productionize research prototypes\n- Monitor model performance in production and iterate based on feedback`,
  },
  {
    name: 'Backend Engineer',
    title: 'Senior Python Backend Engineer',
    desc: `Job Title: Senior Python Backend Engineer\n\nWe are seeking a Senior Python Developer to scale our core microservices.\n\nRequired Skills:\n- Python\n- FastAPI\n- PostgreSQL\n- REST APIs\n\nPreferred Skills:\n- Redis\n- Docker\n- Kubernetes\n- AWS\n\nMinimum Experience: 3 years\n\nEducation: Bachelor's or Master's degree in Computer Science or Software Engineering.\n\nResponsibilities:\n- Design and implement scalable RESTful backend services\n- Optimize relational database queries and data models\n- Maintain CI/CD automated deployment pipelines`,
  },
];

export const JobsPage: React.FC = () => {
  const navigate = useNavigate();
  const [jobs, setJobs] = useState<JobResponse[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [titleHint, setTitleHint] = useState<string>('');
  const [jobDescription, setJobDescription] = useState<string>('');
  const [isExtracting, setIsExtracting] = useState<boolean>(false);
  const [extractError, setExtractError] = useState<string | null>(null);
  const [latestExtractedJob, setLatestExtractedJob] = useState<JobResponse | null>(null);

  const fetchJobs = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.listJobs();
      setJobs(data);
      if (data.length > 0 && !latestExtractedJob) {
        setLatestExtractedJob(data[0]);
      }
    } catch (err: any) {
      setError(err?.detail || 'Failed to load jobs list from backend.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchJobs();
  }, []);

  const handleExtractJob = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanDesc = jobDescription.trim();

    if (cleanDesc.length < 20) {
      setExtractError('Job description must be at least 20 characters long.');
      return;
    }

    setIsExtracting(true);
    setExtractError(null);

    try {
      const createdRes = await api.createJob(cleanDesc, titleHint.trim() || undefined);
      // Fetch the full structured job detail
      const fullJob = await api.getJob(createdRes.job_id);
      setLatestExtractedJob(fullJob);
      // Refresh list
      const updatedList = await api.listJobs();
      setJobs(updatedList);
      // Clear form
      setJobDescription('');
      setTitleHint('');
    } catch (err: any) {
      setExtractError(err?.detail || 'Extraction failed. Please check backend LLM connectivity.');
    } finally {
      setIsExtracting(false);
    }
  };

  const loadTemplate = (template: typeof SAMPLE_TEMPLATES[0]) => {
    setTitleHint(template.title);
    setJobDescription(template.desc);
    setExtractError(null);
  };

  const formatExperience = (months?: number | null) => {
    if (!months) return 'None specified';
    const years = (months / 12).toFixed(1).replace(/\.0$/, '');
    return `${months} Months (${years} Yrs)`;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 700, letterSpacing: '-0.02em', color: '#fff' }}>
            Job Requisitions & Extraction Studio
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '4px' }}>
            Create or parse raw job descriptions into structured screening criteria with Gemini LLM
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={fetchJobs} className="btn btn-ghost" title="Refresh list">
            <RefreshCw size={16} />
          </button>
        </div>
      </div>

      {error && <ErrorMessage title="Jobs Load Error" message={error} onRetry={fetchJobs} />}

      {/* Main Split-Screen Workspace */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(420px, 1fr) minmax(460px, 1.2fr)',
          gap: '24px',
          alignItems: 'start',
        }}
      >
        {/* Left Column: Job Description Input & Form */}
        <Card elevated style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <PlusCircle size={18} style={{ color: 'var(--accent-primary)' }} />
              <h2 style={{ fontSize: '1.1rem', fontWeight: 600, color: '#fff' }}>
                Job Description Input
              </h2>
            </div>
            <div style={{ display: 'flex', gap: '6px' }}>
              {SAMPLE_TEMPLATES.map((tmpl) => (
                <button
                  key={tmpl.name}
                  type="button"
                  onClick={() => loadTemplate(tmpl)}
                  className="btn btn-ghost"
                  style={{ fontSize: '0.72rem', padding: '3px 8px', border: '1px solid var(--border-subtle)' }}
                >
                  <FileCode size={12} /> {tmpl.name}
                </button>
              ))}
            </div>
          </div>

          <form onSubmit={handleExtractJob} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                Job Title Hint (Optional)
              </label>
              <input
                type="text"
                value={titleHint}
                onChange={(e) => setTitleHint(e.target.value)}
                placeholder="e.g. Senior Machine Learning Engineer"
                className="input-text"
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                Raw Job Description <span style={{ color: 'var(--accent-primary)' }}>*</span>
              </label>
              <textarea
                value={jobDescription}
                onChange={(e) => setJobDescription(e.target.value)}
                placeholder="Paste the full job description here (e.g. We are hiring a Machine Learning Engineer. Required skills: Python, PyTorch. Minimum 2 years experience...)"
                rows={12}
                className="textarea-input"
                style={{ resize: 'vertical', minHeight: '220px' }}
              />
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
                Minimum 20 characters required for structured LLM extraction.
              </span>
            </div>

            {extractError && (
              <ErrorMessage
                title="Job Creation Failed"
                message={extractError}
              />
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '6px' }}>
              <button
                type="button"
                onClick={() => {
                  setJobDescription('');
                  setTitleHint('');
                  setExtractError(null);
                }}
                className="btn btn-secondary"
                disabled={isExtracting || (!jobDescription && !titleHint)}
              >
                Clear
              </button>

              <button
                type="submit"
                className="btn btn-primary"
                disabled={isExtracting || jobDescription.trim().length < 20}
              >
                {isExtracting ? (
                  <>
                    <LoadingSpinner size={16} message="" /> Extracting Requirements...
                  </>
                ) : (
                  <>
                    <Sparkles size={16} /> Extract Requirements with AI
                  </>
                )}
              </button>
            </div>
          </form>
        </Card>

        {/* Right Column: Live Structured Extracted Preview */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <CheckCircle2 size={18} style={{ color: '#10b981' }} />
              <h2 style={{ fontSize: '1.1rem', fontWeight: 600, color: '#fff' }}>
                Structured Requirements (Inspection Preview)
              </h2>
            </div>
            {latestExtractedJob && (
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                ID: {latestExtractedJob.job_id}
              </span>
            )}
          </div>

          {!latestExtractedJob ? (
            <Card elevated style={{ padding: '48px 24px', textAlign: 'center', color: 'var(--text-secondary)' }}>
              <Briefcase size={36} style={{ color: 'var(--text-muted)', margin: '0 auto 12px auto' }} />
              <h3 style={{ color: '#fff', fontSize: '1.05rem', marginBottom: '6px' }}>No Job Selected</h3>
              <p style={{ fontSize: '0.85rem' }}>
                Paste and extract a new job description on the left, or select an existing job from the list below.
              </p>
            </Card>
          ) : (
            <Card elevated style={{ display: 'flex', flexDirection: 'column', gap: '18px', padding: '24px' }}>
              {/* Job Title & Experience Badge */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '16px' }}>
                <div>
                  <h3 style={{ fontSize: '1.35rem', fontWeight: 700, color: '#fff' }}>
                    {latestExtractedJob.profile.title || latestExtractedJob.title || 'Untitled Role'}
                  </h3>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', display: 'block', marginTop: '2px' }}>
                    Created: {new Date(latestExtractedJob.created_at).toLocaleDateString()}
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: 'rgba(99, 102, 241, 0.15)', padding: '6px 12px', borderRadius: 'var(--radius-full)', border: '1px solid rgba(99, 102, 241, 0.3)' }}>
                  <Clock size={14} style={{ color: '#818cf8' }} />
                  <span style={{ fontSize: '0.78rem', fontWeight: 600, color: '#c7d2fe' }}>
                    Min Exp: {formatExperience(latestExtractedJob.profile.minimum_experience_months)}
                  </span>
                </div>
              </div>

              {/* Required Skills */}
              <div>
                <span style={{ fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#34d399', display: 'block', marginBottom: '8px' }}>
                  Required Skills ({latestExtractedJob.profile.required_skills.length})
                </span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {latestExtractedJob.profile.required_skills.map((skill, idx) => (
                    <SkillChip key={idx} skill={skill} status="matched" type="required" />
                  ))}
                  {latestExtractedJob.profile.required_skills.length === 0 && (
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>None explicitly extracted</span>
                  )}
                </div>
              </div>

              {/* Preferred Skills */}
              <div>
                <span style={{ fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#818cf8', display: 'block', marginBottom: '8px' }}>
                  Preferred / Nice-to-Have Skills ({latestExtractedJob.profile.preferred_skills.length})
                </span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {latestExtractedJob.profile.preferred_skills.map((skill, idx) => (
                    <SkillChip key={idx} skill={skill} status="neutral" type="preferred" />
                  ))}
                  {latestExtractedJob.profile.preferred_skills.length === 0 && (
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>None explicitly listed</span>
                  )}
                </div>
              </div>

              {/* Education Requirements */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                  <GraduationCap size={15} style={{ color: '#38bdf8' }} />
                  <span style={{ fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#38bdf8' }}>
                    Education Requirements
                  </span>
                </div>
                {latestExtractedJob.profile.education_requirements.length > 0 ? (
                  <ul style={{ paddingLeft: '20px', fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {latestExtractedJob.profile.education_requirements.map((edu, idx) => (
                      <li key={idx}>{edu}</li>
                    ))}
                  </ul>
                ) : (
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>No specific degree constraints</span>
                )}
              </div>

              {/* Core Responsibilities */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                  <ListChecks size={15} style={{ color: '#f59e0b' }} />
                  <span style={{ fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#f59e0b' }}>
                    Key Responsibilities
                  </span>
                </div>
                {latestExtractedJob.profile.responsibilities.length > 0 ? (
                  <ul style={{ paddingLeft: '20px', fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {latestExtractedJob.profile.responsibilities.map((resp, idx) => (
                      <li key={idx}>{resp}</li>
                    ))}
                  </ul>
                ) : (
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>None extracted</span>
                )}
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', borderTop: '1px solid var(--border-subtle)', paddingTop: '16px' }}>
                <button
                  onClick={() => navigate(`/jobs/${latestExtractedJob.job_id}`)}
                  className="btn btn-secondary"
                  style={{ fontSize: '0.8rem' }}
                >
                  Full Dossier
                </button>
                <button
                  onClick={() => navigate(`/screening?jobId=${latestExtractedJob.job_id}`)}
                  className="btn btn-primary"
                  style={{ fontSize: '0.8rem' }}
                >
                  <Sparkles size={14} /> Screen Candidates for this Job
                </button>
              </div>
            </Card>
          )}
        </div>
      </div>

      {/* Active Jobs Library / Table */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '12px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#fff' }}>
            Active Requisitions Library ({jobs.length})
          </h2>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            Click a job row to preview or view details
          </span>
        </div>

        {loading ? (
          <LoadingSpinner message="Loading jobs library..." />
        ) : jobs.length === 0 ? (
          <Card>
            <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>
              No job postings created yet. Use the extraction studio above to parse your first job.
            </div>
          </Card>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {jobs.map((j) => {
              const reqSkills = j.profile.required_skills || [];
              const isSelected = latestExtractedJob?.job_id === j.job_id;

              return (
                <Card
                  key={j.job_id}
                  elevated={isSelected}
                  style={{
                    padding: '16px 20px',
                    cursor: 'pointer',
                    borderColor: isSelected ? 'var(--accent-primary)' : undefined,
                    transition: 'all 0.15s ease',
                  }}
                  onClick={() => setLatestExtractedJob(j)}
                >
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '260px 180px 1fr 180px',
                      alignItems: 'center',
                      gap: '16px',
                    }}
                  >
                    {/* Job Title */}
                    <div>
                      <h3 style={{ fontSize: '0.95rem', fontWeight: 600, color: '#fff' }}>
                        {j.profile.title || j.title || 'Untitled Role'}
                      </h3>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                        {j.job_id}
                      </span>
                    </div>

                    {/* Min Experience */}
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                      Min Exp: <strong style={{ color: '#fff' }}>{formatExperience(j.profile.minimum_experience_months)}</strong>
                    </div>

                    {/* Required Skills Chips */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', maxHeight: '42px', overflow: 'hidden' }}>
                      {reqSkills.slice(0, 4).map((s, sIdx) => (
                        <SkillChip key={sIdx} skill={s} status="matched" />
                      ))}
                      {reqSkills.length > 4 && (
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', alignSelf: 'center' }}>
                          +{reqSkills.length - 4} more
                        </span>
                      )}
                    </div>

                    {/* Actions */}
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/jobs/${j.job_id}`);
                        }}
                        className="btn btn-secondary"
                        style={{ fontSize: '0.75rem', padding: '5px 10px' }}
                      >
                        Details <ChevronRight size={13} />
                      </button>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
