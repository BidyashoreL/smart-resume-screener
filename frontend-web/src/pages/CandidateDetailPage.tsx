import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Mail,
  Phone,
  Briefcase,
  GraduationCap,
  FolderGit2,
  Sparkles,
  Quote,
  CheckCircle2,
  Calendar,
  Layers,
} from 'lucide-react';
import { api } from '../services/api';
import type { CandidateResponse } from '../types/api';
import { Card } from '../components/common/Card';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { ErrorMessage } from '../components/common/ErrorMessage';

export const CandidateDetailPage: React.FC = () => {
  const { candidateId } = useParams<{ candidateId: string }>();
  const navigate = useNavigate();
  const [candidate, setCandidate] = useState<CandidateResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCandidate = async () => {
    if (!candidateId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await api.getCandidate(candidateId);
      setCandidate(data);
    } catch (err: any) {
      setError(err?.detail || `Failed to load candidate dossier for ID: ${candidateId}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCandidate();
  }, [candidateId]);

  const formatExperience = (months?: number | null) => {
    if (months === null || months === undefined) return 'Experience duration not specified';
    if (months === 0) return 'Entry Level';
    const years = Math.floor(months / 12);
    const remMonths = months % 12;
    if (years === 0) return `${remMonths} months`;
    if (remMonths === 0) return `${years} year${years > 1 ? 's' : ''}`;
    return `${years} yr${years > 1 ? 's' : ''} ${remMonths} mo${remMonths > 1 ? 's' : ''}`;
  };

  if (loading) {
    return <LoadingSpinner message="Retrieving candidate profile & evidence dossier..." fullPage />;
  }

  if (error || !candidate) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <Link to="/candidates" className="btn btn-secondary" style={{ width: 'fit-content' }}>
          <ArrowLeft size={16} /> Back to Candidates
        </Link>
        <ErrorMessage
          title="Candidate Not Found"
          message={error || 'The requested candidate ID does not exist in the database.'}
          onRetry={fetchCandidate}
        />
      </div>
    );
  }

  const profile = candidate.profile;
  const displayName = candidate.name || profile.name || 'Unnamed Candidate';
  const skills = profile.skills || [];
  const experience = profile.experience || [];
  const education = profile.education || [];
  const projects = profile.projects || [];

  // Group skills by category
  const skillsByCategory: { [category: string]: typeof skills } = {};
  skills.forEach((s) => {
    const cat = s.category || 'General Technical';
    if (!skillsByCategory[cat]) skillsByCategory[cat] = [];
    skillsByCategory[cat].push(s);
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Breadcrumb Navigation */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem' }}>
        <Link to="/candidates" style={{ color: 'var(--text-secondary)', textDecoration: 'none' }}>
          Candidates
        </Link>
        <span style={{ color: 'var(--text-muted)' }}>/</span>
        <span style={{ color: '#fff', fontWeight: 500 }}>{displayName}</span>
      </div>

      {/* Hero Dossier Header */}
      <Card elevated style={{ padding: '24px 28px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '20px' }}>
          <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
            <div
              style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #6366f1, #3b82f6)',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 700,
                fontSize: '1.5rem',
                boxShadow: '0 0 20px rgba(99, 102, 241, 0.35)',
              }}
            >
              {displayName.charAt(0).toUpperCase()}
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <h1 style={{ fontSize: '1.6rem', fontWeight: 700, color: '#fff', letterSpacing: '-0.02em' }}>
                  {displayName}
                </h1>
                <span className="badge badge-strong">
                  <CheckCircle2 size={12} /> Profile Extracted
                </span>
              </div>

              {/* Contact Chips */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '14px', marginTop: '10px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                {(candidate.email || profile.email) && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Mail size={14} style={{ color: '#818cf8' }} />
                    {candidate.email || profile.email}
                  </span>
                )}
                {profile.phone && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Phone size={14} style={{ color: '#38bdf8' }} />
                    {profile.phone}
                  </span>
                )}
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Briefcase size={14} style={{ color: '#10b981' }} />
                  Total Experience: <strong style={{ color: '#fff' }}>{formatExperience(profile.total_experience_months)}</strong>
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Calendar size={14} style={{ color: 'var(--text-muted)' }} />
                  Added: {new Date(candidate.created_at).toLocaleDateString()}
                </span>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={() => navigate('/screening')}
              className="btn btn-primary"
            >
              <Sparkles size={15} /> Run Screening Match
            </button>
          </div>
        </div>
      </Card>

      {/* 3-Column Content Layout */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(320px, 1.2fr) minmax(320px, 1.4fr) minmax(280px, 1fr)',
          gap: '24px',
          alignItems: 'start',
        }}
      >
        {/* Column 1: Extracted Skills & Verifiable Evidence */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Layers size={18} style={{ color: '#818cf8' }} />
            <h2 style={{ fontSize: '1.1rem', fontWeight: 600, color: '#fff' }}>
              Extracted Skills & Evidence ({skills.length})
            </h2>
          </div>

          {skills.length === 0 ? (
            <Card>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No skills identified in this resume.</p>
            </Card>
          ) : (
            Object.entries(skillsByCategory).map(([category, catSkills]) => (
              <Card key={category} elevated>
                <h3
                  style={{
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    color: '#818cf8',
                    marginBottom: '14px',
                  }}
                >
                  {category}
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {catSkills.map((skill, sIdx) => (
                    <div
                      key={sIdx}
                      style={{
                        backgroundColor: 'var(--bg-app)',
                        borderRadius: 'var(--radius-sm)',
                        padding: '10px 12px',
                        border: '1px solid var(--border-subtle)',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: skill.evidence ? '6px' : '0' }}>
                        <span style={{ fontWeight: 600, color: '#f8fafc', fontSize: '0.875rem' }}>
                          {skill.name}
                        </span>
                      </div>
                      {skill.evidence && (
                        <div
                          style={{
                            display: 'flex',
                            gap: '8px',
                            fontSize: '0.78rem',
                            color: 'var(--text-secondary)',
                            backgroundColor: 'rgba(255, 255, 255, 0.02)',
                            padding: '6px 8px',
                            borderRadius: '4px',
                            borderLeft: '2px solid var(--accent-primary)',
                          }}
                        >
                          <Quote size={12} style={{ color: 'var(--accent-primary)', flexShrink: 0, marginTop: '2px' }} />
                          <span style={{ fontStyle: 'italic' }}>"{skill.evidence}"</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </Card>
            ))
          )}
        </div>

        {/* Column 2: Career Timeline & Experience */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Briefcase size={18} style={{ color: '#10b981' }} />
            <h2 style={{ fontSize: '1.1rem', fontWeight: 600, color: '#fff' }}>
              Career Timeline & Experience ({experience.length})
            </h2>
          </div>

          {experience.length === 0 ? (
            <Card>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No specific employment history extracted.</p>
            </Card>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {experience.map((exp, eIdx) => (
                <Card key={eIdx} elevated style={{ position: 'relative' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                    <div>
                      <h3 style={{ fontSize: '1rem', fontWeight: 600, color: '#fff' }}>
                        {exp.role || 'Position Title Not Specified'}
                      </h3>
                      <span style={{ fontSize: '0.85rem', color: '#818cf8', fontWeight: 500 }}>
                        {exp.company || 'Company Not Specified'}
                      </span>
                    </div>
                    {exp.duration_months !== null && exp.duration_months !== undefined && (
                      <span className="badge badge-indigo">
                        {formatExperience(exp.duration_months)}
                      </span>
                    )}
                  </div>

                  {exp.description && (
                    <p
                      style={{
                        fontSize: '0.825rem',
                        color: 'var(--text-secondary)',
                        lineHeight: 1.6,
                        marginTop: '10px',
                        whiteSpace: 'pre-line',
                      }}
                    >
                      {exp.description}
                    </p>
                  )}
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Column 3: Education & Projects */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Education */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <GraduationCap size={18} style={{ color: '#38bdf8' }} />
              <h2 style={{ fontSize: '1.1rem', fontWeight: 600, color: '#fff' }}>
                Education ({education.length})
              </h2>
            </div>

            {education.length === 0 ? (
              <Card>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No degree history found.</p>
              </Card>
            ) : (
              education.map((edu, eduIdx) => (
                <Card key={eduIdx} elevated>
                  <h3 style={{ fontSize: '0.95rem', fontWeight: 600, color: '#fff' }}>
                    {edu.degree || 'Degree'} {edu.field ? `in ${edu.field}` : ''}
                  </h3>
                  <div style={{ fontSize: '0.825rem', color: '#38bdf8', marginTop: '2px' }}>
                    {edu.institution || 'Institution Not Specified'}
                  </div>
                  {edu.graduation_year && (
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
                      Class of {edu.graduation_year}
                    </span>
                  )}
                </Card>
              ))
            )}
          </div>

          {/* Projects */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <FolderGit2 size={18} style={{ color: '#f59e0b' }} />
              <h2 style={{ fontSize: '1.1rem', fontWeight: 600, color: '#fff' }}>
                Key Projects ({projects.length})
              </h2>
            </div>

            {projects.length === 0 ? (
              <Card>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No individual projects listed.</p>
              </Card>
            ) : (
              projects.map((proj, pIdx) => (
                <Card key={pIdx} elevated>
                  <h3 style={{ fontSize: '0.9rem', fontWeight: 600, color: '#fff' }}>
                    {proj.name || 'Project'}
                  </h3>
                  {proj.description && (
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '6px', lineHeight: 1.5 }}>
                      {proj.description}
                    </p>
                  )}
                </Card>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
