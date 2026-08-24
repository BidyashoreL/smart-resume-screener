import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  UploadCloud,
  Search,
  User,
  GraduationCap,
  Briefcase,
  ChevronRight,
  RefreshCw,
} from 'lucide-react';
import { api } from '../services/api';
import type { CandidateResponse } from '../types/api';
import { Card } from '../components/common/Card';
import { SkillChip } from '../components/common/Badge';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { ErrorMessage } from '../components/common/ErrorMessage';
import { ResumeUploader } from '../components/candidates/ResumeUploader';

export const CandidatesPage: React.FC = () => {
  const navigate = useNavigate();
  const [candidates, setCandidates] = useState<CandidateResponse[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isUploaderOpen, setIsUploaderOpen] = useState<boolean>(false);

  const fetchCandidates = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.listCandidates();
      setCandidates(data);
    } catch (err: any) {
      setError(err?.detail || 'Failed to load candidates from backend.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCandidates();
  }, []);

  const formatExperience = (months?: number | null) => {
    if (months === null || months === undefined) return 'Experience not specified';
    if (months === 0) return 'Entry Level';
    const years = Math.floor(months / 12);
    const remMonths = months % 12;
    if (years === 0) return `${remMonths} mos`;
    if (remMonths === 0) return `${years} yr${years > 1 ? 's' : ''}`;
    return `${years} yr${years > 1 ? 's' : ''} ${remMonths} mo${remMonths > 1 ? 's' : ''}`;
  };


  const filteredCandidates = candidates.filter((c) => {
    const query = searchQuery.toLowerCase().trim();
    if (!query) return true;

    const nameMatch = c.name?.toLowerCase().includes(query) || false;
    const emailMatch = c.email?.toLowerCase().includes(query) || false;
    const skillMatch = c.profile.skills.some((s) => s.name.toLowerCase().includes(query));
    const eduMatch = c.profile.education.some(
      (e) =>
        e.degree?.toLowerCase().includes(query) ||
        e.field?.toLowerCase().includes(query) ||
        e.institution?.toLowerCase().includes(query)
    );

    return nameMatch || emailMatch || skillMatch || eduMatch;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 700, letterSpacing: '-0.02em', color: '#fff' }}>
            Candidate Talent Pool
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '4px' }}>
            {candidates.length} candidate profile{candidates.length !== 1 ? 's' : ''} parsed & structured from resumes
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={fetchCandidates} className="btn btn-ghost" title="Refresh List">
            <RefreshCw size={16} />
          </button>
          <button onClick={() => setIsUploaderOpen(true)} className="btn btn-primary">
            <UploadCloud size={16} /> Upload Resumes
          </button>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <Card style={{ padding: '14px 20px' }}>
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <Search
              size={18}
              style={{
                position: 'absolute',
                left: '12px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--text-muted)',
              }}
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by candidate name, email, skills (e.g. Python, PyTorch), education..."
              className="input-text"
              style={{ paddingLeft: '38px' }}
            />
          </div>
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="btn btn-ghost"
              style={{ fontSize: '0.8rem' }}
            >
              Clear
            </button>
          )}
        </div>
      </Card>

      {/* Error state */}
      {error && <ErrorMessage title="Failed to Load Candidates" message={error} onRetry={fetchCandidates} />}

      {/* Loading state */}
      {loading && !error && <LoadingSpinner message="Loading candidate profiles from database..." fullPage />}

      {/* Candidates List / Table */}
      {!loading && !error && (
        <>
          {filteredCandidates.length === 0 ? (
            <Card elevated style={{ textAlign: 'center', padding: '48px 24px' }}>
              <div
                style={{
                  width: '56px',
                  height: '56px',
                  borderRadius: '50%',
                  backgroundColor: 'rgba(99, 102, 241, 0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--accent-primary)',
                  margin: '0 auto 16px auto',
                }}
              >
                <User size={28} />
              </div>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 600, color: '#fff', marginBottom: '8px' }}>
                {searchQuery ? 'No matching candidates found' : 'No Candidates Uploaded Yet'}
              </h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', maxWidth: '440px', margin: '0 auto 20px auto' }}>
                {searchQuery
                  ? `No candidates match "${searchQuery}". Try a different skill or name.`
                  : 'Upload candidate resumes (PDF or TXT) to automatically extract skills, experience timeline, and education.'}
              </p>
              {!searchQuery && (
                <button onClick={() => setIsUploaderOpen(true)} className="btn btn-primary">
                  <UploadCloud size={16} /> Upload First Resume
                </button>
              )}
            </Card>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {filteredCandidates.map((candidate) => {
                const profile = candidate.profile;
                const displayName = candidate.name || profile.name || 'Unnamed Candidate';
                const skills = profile.skills || [];
                const education = profile.education || [];
                const topEdu = education[0];
                const expFormatted = formatExperience(profile.total_experience_months);

                return (
                  <Card
                    key={candidate.candidate_id}
                    elevated
                    style={{
                      padding: '18px 22px',
                      cursor: 'pointer',
                      transition: 'border-color 0.15s ease, transform 0.15s ease',
                    }}
                    onClick={() => navigate(`/candidates/${candidate.candidate_id}`)}
                  >
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '260px 180px 1fr 200px 120px',
                        alignItems: 'center',
                        gap: '16px',
                      }}
                    >
                      {/* Candidate Identity */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div
                          style={{
                            width: '40px',
                            height: '40px',
                            borderRadius: '50%',
                            backgroundColor: 'rgba(99, 102, 241, 0.2)',
                            color: '#a5b4fc',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: 700,
                            fontSize: '0.95rem',
                            flexShrink: 0,
                          }}
                        >
                          {displayName.charAt(0).toUpperCase()}
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <h3 style={{ fontSize: '0.95rem', fontWeight: 600, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {displayName}
                          </h3>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {candidate.email || profile.email || 'No email provided'}
                          </span>
                        </div>
                      </div>

                      {/* Experience */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                        <Briefcase size={15} style={{ color: '#818cf8', flexShrink: 0 }} />
                        <span style={{ fontWeight: 500, color: '#e2e8f0' }}>{expFormatted}</span>
                      </div>

                      {/* Extracted Skills Chips */}
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', overflow: 'hidden', maxHeight: '56px' }}>
                        {skills.slice(0, 5).map((skill, sIdx) => (
                          <SkillChip key={sIdx} skill={skill.name} />
                        ))}
                        {skills.length > 5 && (
                          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', alignSelf: 'center' }}>
                            +{skills.length - 5} more
                          </span>
                        )}
                        {skills.length === 0 && (
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>No skills extracted</span>
                        )}
                      </div>

                      {/* Education */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                        <GraduationCap size={16} style={{ color: '#38bdf8', flexShrink: 0 }} />
                        <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {topEdu ? (
                            <>
                              <span style={{ color: '#e2e8f0', display: 'block' }}>{topEdu.degree || 'Degree'}</span>
                              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{topEdu.institution || ''}</span>
                            </>
                          ) : (
                            <span style={{ color: 'var(--text-muted)' }}>No degree listed</span>
                          )}
                        </div>
                      </div>

                      {/* Actions */}
                      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '8px' }}>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/candidates/${candidate.candidate_id}`);
                          }}
                          className="btn btn-secondary"
                          style={{ fontSize: '0.75rem', padding: '6px 10px' }}
                        >
                          Dossier <ChevronRight size={14} />
                        </button>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Resume Upload Modal */}
      <ResumeUploader
        isOpen={isUploaderOpen}
        onClose={() => setIsUploaderOpen(false)}
        onUploadSuccess={() => {
          fetchCandidates();
        }}
      />
    </div>
  );
};
