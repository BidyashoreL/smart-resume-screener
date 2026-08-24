import React, { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  Briefcase,
  Sparkles,
  BarChart3,
  CheckCircle2,
  AlertTriangle,
  Cpu,
} from 'lucide-react';
import { api } from '../../services/api';

export const Sidebar: React.FC = () => {
  const [backendHealth, setBackendHealth] = useState<'checking' | 'healthy' | 'unreachable'>('checking');
  const [serviceName, setServiceName] = useState<string>('');

  useEffect(() => {
    let isMounted = true;
    const check = async () => {
      try {
        const res = await api.checkHealth();
        if (isMounted) {
          setBackendHealth('healthy');
          setServiceName(res.service || 'Smart Resume Screener');
        }
      } catch {
        if (isMounted) {
          setBackendHealth('unreachable');
        }
      }
    };

    check();
    const interval = setInterval(check, 15000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  const navItems = [
    { to: '/', label: 'Executive Dashboard', icon: LayoutDashboard, exact: true },
    { to: '/candidates', label: 'Candidate Pool', icon: Users },
    { to: '/jobs', label: 'Job Postings', icon: Briefcase },
    { to: '/screening', label: 'Screening Studio', icon: Sparkles },
    { to: '/reports', label: 'Reports & Analytics', icon: BarChart3 },
  ];

  return (
    <aside
      style={{
        width: '260px',
        backgroundColor: '#0a0e16',
        borderRight: '1px solid var(--border-subtle)',
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
        height: '100vh',
        position: 'sticky',
        top: 0,
        zIndex: 40,
      }}
    >
      {/* Brand Header */}
      <div
        style={{
          padding: '24px 20px',
          borderBottom: '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
        }}
      >
        <div
          style={{
            width: '36px',
            height: '36px',
            borderRadius: 'var(--radius-sm)',
            background: 'linear-gradient(135deg, #6366f1, #3b82f6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            boxShadow: '0 0 16px rgba(99, 102, 241, 0.4)',
          }}
        >
          <Cpu size={20} />
        </div>
        <div>
          <h1 style={{ fontSize: '1rem', fontWeight: 700, letterSpacing: '-0.02em', color: '#fff' }}>
            TalentLens ATS
          </h1>
          <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', display: 'block' }}>
            Resume Intelligence Engine
          </span>
        </div>
      </div>

      {/* Navigation Links */}
      <nav style={{ padding: '20px 12px', flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <div
          style={{
            fontSize: '0.68rem',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            color: 'var(--text-muted)',
            padding: '4px 12px 8px 12px',
          }}
        >
          Workspaces
        </div>
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.exact}
              style={({ isActive }) => ({
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '10px 14px',
                borderRadius: 'var(--radius-sm)',
                fontSize: '0.875rem',
                fontWeight: isActive ? 600 : 500,
                color: isActive ? '#ffffff' : 'var(--text-secondary)',
                backgroundColor: isActive ? 'rgba(99, 102, 241, 0.15)' : 'transparent',
                border: isActive ? '1px solid rgba(99, 102, 241, 0.3)' : '1px solid transparent',
                textDecoration: 'none',
                transition: 'all 0.15s ease',
              })}
            >
              <Icon size={18} style={{ opacity: 0.9 }} />
              <span>{item.label}</span>
            </NavLink>
          );
        })}
      </nav>

      {/* Pipeline / Engine Status Footer */}
      <div
        style={{
          padding: '16px',
          margin: '12px',
          backgroundColor: 'var(--bg-surface)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-md)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
          <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
            Pipeline Engine
          </span>
          {backendHealth === 'healthy' ? (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.7rem', color: '#10b981' }}>
              <CheckCircle2 size={12} /> Active
            </span>
          ) : backendHealth === 'checking' ? (
            <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>Checking...</span>
          ) : (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.7rem', color: '#f43f5e' }}>
              <AlertTriangle size={12} /> Offline
            </span>
          )}
        </div>
        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', lineHeight: 1.3 }}>
          FastAPI Backend @ :8000
          {serviceName && <div style={{ color: '#94a3b8', marginTop: '2px' }}>{serviceName}</div>}
        </div>
      </div>
    </aside>
  );
};
