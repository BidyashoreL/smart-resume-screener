import React from 'react';
import type { MatchBand, Recommendation } from '../../types/api';

interface MatchBandBadgeProps {
  band: MatchBand | string;
  size?: 'sm' | 'md';
}

export const MatchBandBadge: React.FC<MatchBandBadgeProps> = ({ band, size = 'md' }) => {
  let badgeClass = 'badge-neutral';
  let dotColor = '#94a3b8';

  switch (band) {
    case 'Strong Match':
      badgeClass = 'badge-strong';
      dotColor = '#10b981';
      break;
    case 'Good Match':
      badgeClass = 'badge-good';
      dotColor = '#38bdf8';
      break;
    case 'Partial Match':
      badgeClass = 'badge-partial';
      dotColor = '#f59e0b';
      break;
    case 'Low Match':
      badgeClass = 'badge-low';
      dotColor = '#f43f5e';
      break;
  }

  const paddingStyle = size === 'sm' ? { fontSize: '0.7rem', padding: '2px 6px' } : {};

  return (
    <span className={`badge ${badgeClass}`} style={paddingStyle}>
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: '50%',
          backgroundColor: dotColor,
          display: 'inline-block',
        }}
      />
      {band}
    </span>
  );
};

interface RecommendationBadgeProps {
  recommendation: Recommendation | string;
}

export const RecommendationBadge: React.FC<RecommendationBadgeProps> = ({ recommendation }) => {
  let badgeClass = 'badge-neutral';
  let icon = '•';

  switch (recommendation) {
    case 'SHORTLIST':
      badgeClass = 'badge-strong';
      icon = '✓';
      break;
    case 'CONSIDER':
      badgeClass = 'badge-partial';
      icon = '⚡';
      break;
    case 'REJECT':
      badgeClass = 'badge-low';
      icon = '✕';
      break;
  }

  return (
    <span className={`badge ${badgeClass}`}>
      <span style={{ fontWeight: 700 }}>{icon}</span>
      {recommendation}
    </span>
  );
};

interface SkillChipProps {
  skill: string;
  status?: 'matched' | 'missing' | 'neutral';
  type?: 'required' | 'preferred';
}

export const SkillChip: React.FC<SkillChipProps> = ({ skill, status = 'neutral', type }) => {
  let chipClass = 'skill-chip';
  if (status === 'matched') chipClass += ' skill-chip-matched';
  if (status === 'missing') chipClass += ' skill-chip-missing';

  return (
    <span className={chipClass}>
      {status === 'matched' && <span style={{ color: '#34d399' }}>✓</span>}
      {status === 'missing' && <span style={{ color: '#fb7185' }}>✕</span>}
      {skill}
      {type && (
        <span style={{ opacity: 0.6, fontSize: '0.7rem', marginLeft: 2 }}>
          ({type === 'required' ? 'req' : 'pref'})
        </span>
      )}
    </span>
  );
};
