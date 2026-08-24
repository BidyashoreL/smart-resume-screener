import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Briefcase,
  Clock,
  GraduationCap,
  ListChecks,
  Sparkles,
  Layers,
  Calendar,
} from 'lucide-react';
import { api } from '../services/api';
import type { JobResponse } from '../types/api';
import { Card } from '../components/common/Card';
import { SkillChip } from '../components/common/Badge';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { ErrorMessage } from '../components/common/ErrorMessage';

export const JobDetailPage: React.FC = () => {
  const { jobId } = useParams<{ jobId: string }>();
  const navigate = useNavigate();
  const [job, setJob] = useState<JobResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchJob = async () => {
    if (!jobId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await api.getJob(jobId);
      setJob(data);
    } catch (err: any) {
      setError(err?.detail || `Failed to load job requisition for ID: ${jobId}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchJob();
  }, [jobId]);

  const formatExperience = (months?: number | null) => {
    if (!months) return 'No minimum specified';
    const years = (months / 12).toFixed(1).replace(/\.0$/, '');
    return `${months} Months (${years} Year${months >= 24 ? 's' : ''})`;
  };

  if (loading) {
    return <LoadingSpinner message="Retrieving structured job requirements..." fullPage />;
  }

  if (error || !job) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <Link to="/jobs" className="btn btn-secondary" style={{ width: 'fit-content' }}>
          <ArrowLeft size={16} /> Back to Jobs Library
        </Link>
        <ErrorMessage
          title="Job Requisition Not Found"
          message={error || 'The requested Job ID does not exist in the database.'}
          onRetry={fetchJob}
        />
      </div>
    );
  }

  const profile = job.profile;
  const title = profile.title || job.title || 'Untitled Role';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Breadcrumb */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem' }}>
        <Link to="/jobs" style={{ color: 'var(--text-secondary)', textDecoration: 'none' }}>
          Job Postings
        </Link>
        <span style={{ color: 'var(--text-muted)' }}>/</span>
        <span style={{ color: '#fff', fontWeight: 500 }}>{title}</span>
      </div>

      {/* Hero Job Requisition Header */}
      <Card elevated style={{ padding: '24px 28px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '20px' }}>
          <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
            <div
              style={{
                width: '60px',
                height: '60px',
                borderRadius: 'var(--radius-md)',
                background: 'linear-gradient(135deg, #3b82f6, #6366f1)',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 0 20px rgba(59, 130, 246, 0.35)',
              }}
            >
              <Briefcase size={28} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <h1 style={{ fontSize: '1.6rem', fontWeight: 700, color: '#fff', letterSpacing: '-0.02em' }}>
                  {title}
                </h1>
                <span className="badge badge-indigo">Active Requisition</span>
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', marginTop: '8px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                <span style={{ fontFamily: 'monospace', color: '#94a3b8' }}>
                  ID: {job.job_id}
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Clock size={14} style={{ color: '#818cf8' }} />
                  Min Experience: <strong style={{ color: '#fff' }}>{formatExperience(profile.minimum_experience_months)}</strong>
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Calendar size={14} style={{ color: 'var(--text-muted)' }} />
                  Created: {new Date(job.created_at).toLocaleDateString()}
                </span>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={() => navigate(`/screening?jobId=${job.job_id}`)}
              className="btn btn-primary"
            >
              <Sparkles size={16} /> Screen Candidates for this Job
            </button>
          </div>
        </div>
      </Card>

      {/* Requirements Details Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(340px, 1.2fr) minmax(340px, 1.2fr)',
          gap: '24px',
        }}
      >
        {/* Left Column: Skills Breakdown */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Required Skills */}
          <Card elevated>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
              <Layers size={18} style={{ color: '#10b981' }} />
              <h2 style={{ fontSize: '1.1rem', fontWeight: 600, color: '#fff' }}>
                Required Skills ({profile.required_skills.length})
              </h2>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {profile.required_skills.map((skill, idx) => (
                <SkillChip key={idx} skill={skill} status="matched" type="required" />
              ))}
              {profile.required_skills.length === 0 && (
                <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No required skills parsed.</span>
              )}
            </div>
          </Card>

          {/* Preferred Skills */}
          <Card elevated>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
              <Sparkles size={18} style={{ color: '#818cf8' }} />
              <h2 style={{ fontSize: '1.1rem', fontWeight: 600, color: '#fff' }}>
                Preferred / Nice-to-Have Skills ({profile.preferred_skills.length})
              </h2>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {profile.preferred_skills.map((skill, idx) => (
                <SkillChip key={idx} skill={skill} status="neutral" type="preferred" />
              ))}
              {profile.preferred_skills.length === 0 && (
                <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No preferred skills parsed.</span>
              )}
            </div>
          </Card>
        </div>

        {/* Right Column: Education & Responsibilities */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Education Requirements */}
          <Card elevated>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
              <GraduationCap size={18} style={{ color: '#38bdf8' }} />
              <h2 style={{ fontSize: '1.1rem', fontWeight: 600, color: '#fff' }}>
                Education Criteria ({profile.education_requirements.length})
              </h2>
            </div>
            {profile.education_requirements.length > 0 ? (
              <ul style={{ paddingLeft: '20px', fontSize: '0.9rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {profile.education_requirements.map((edu, idx) => (
                  <li key={idx} style={{ lineHeight: 1.5 }}>{edu}</li>
                ))}
              </ul>
            ) : (
              <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No specific degree specified.</span>
            )}
          </Card>

          {/* Key Responsibilities */}
          <Card elevated>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
              <ListChecks size={18} style={{ color: '#f59e0b' }} />
              <h2 style={{ fontSize: '1.1rem', fontWeight: 600, color: '#fff' }}>
                Core Responsibilities ({profile.responsibilities.length})
              </h2>
            </div>
            {profile.responsibilities.length > 0 ? (
              <ul style={{ paddingLeft: '20px', fontSize: '0.9rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {profile.responsibilities.map((resp, idx) => (
                  <li key={idx} style={{ lineHeight: 1.5 }}>{resp}</li>
                ))}
              </ul>
            ) : (
              <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No responsibilities parsed.</span>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
};
