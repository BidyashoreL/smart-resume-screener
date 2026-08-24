import React from 'react';
import { useNavigate } from 'react-router-dom';
import { PlusCircle, Sparkles, User, FileText } from 'lucide-react';

export const TopNav: React.FC = () => {
  const navigate = useNavigate();

  return (
    <header
      style={{
        height: '64px',
        backgroundColor: 'var(--bg-surface-glass)',
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid var(--border-subtle)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 28px',
        position: 'sticky',
        top: 0,
        zIndex: 30,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
          Workspace: <strong style={{ color: '#fff' }}>Talent Acquisition / Engineering</strong>
        </span>
      </div>

      {/* Quick Action Hub */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <button
          onClick={() => navigate('/candidates')}
          className="btn btn-secondary"
          style={{ fontSize: '0.8rem', padding: '6px 12px' }}
        >
          <FileText size={15} /> Upload Resumes
        </button>

        <button
          onClick={() => navigate('/jobs')}
          className="btn btn-secondary"
          style={{ fontSize: '0.8rem', padding: '6px 12px' }}
        >
          <PlusCircle size={15} /> New Job
        </button>

        <button
          onClick={() => navigate('/screening')}
          className="btn btn-primary"
          style={{ fontSize: '0.8rem', padding: '6px 14px' }}
        >
          <Sparkles size={15} /> Run Screening
        </button>

        <div
          style={{
            height: '24px',
            width: '1px',
            backgroundColor: 'var(--border-subtle)',
            margin: '0 4px',
          }}
        />

        {/* User Profile Avatar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '4px 10px',
            borderRadius: 'var(--radius-full)',
            backgroundColor: 'var(--bg-surface-elevated)',
            border: '1px solid var(--border-subtle)',
            cursor: 'pointer',
          }}
        >
          <div
            style={{
              width: '26px',
              height: '26px',
              borderRadius: '50%',
              backgroundColor: '#4338ca',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              fontSize: '0.75rem',
            }}
          >
            <User size={14} />
          </div>
          <span style={{ fontSize: '0.8rem', fontWeight: 500, color: 'var(--text-primary)' }}>
            Lead Recruiter
          </span>
        </div>
      </div>
    </header>
  );
};
