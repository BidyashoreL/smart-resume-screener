import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  elevated?: boolean;
  style?: React.CSSProperties;
  onClick?: () => void;
}

export const Card: React.FC<CardProps> = ({
  children,
  className = '',
  elevated = false,
  style,
  onClick,
}) => {
  return (
    <div
      className={`${elevated ? 'glass-panel-elevated' : 'glass-panel'} ${className}`}
      style={{
        padding: '20px',
        ...style,
      }}
      onClick={onClick}
    >
      {children}
    </div>
  );
};
