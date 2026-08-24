import React from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';

interface ErrorMessageProps {
  title?: string;
  message: string;
  errorName?: string;
  statusCode?: number;
  onRetry?: () => void;
}

export const ErrorMessage: React.FC<ErrorMessageProps> = ({
  title = 'Application Error',
  message,
  errorName,
  statusCode,
  onRetry,
}) => {
  return (
    <div
      style={{
        backgroundColor: 'rgba(244, 63, 94, 0.08)',
        border: '1px solid rgba(244, 63, 94, 0.3)',
        borderRadius: 'var(--radius-md)',
        padding: '20px',
        margin: '16px 0',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <AlertCircle size={22} style={{ color: 'var(--color-low-match)' }} />
        <div>
          <h4 style={{ fontSize: '0.95rem', fontWeight: 600, color: '#fda4af' }}>
            {title} {statusCode ? `(HTTP ${statusCode})` : ''}
          </h4>
          {errorName && (
            <span style={{ fontSize: '0.75rem', color: '#f43f5e', fontFamily: 'monospace' }}>
              {errorName}
            </span>
          )}
        </div>
      </div>

      <p style={{ fontSize: '0.875rem', color: '#fecdd3', lineHeight: 1.5 }}>{message}</p>

      {onRetry && (
        <div style={{ marginTop: '4px' }}>
          <button
            onClick={onRetry}
            className="btn btn-secondary"
            style={{
              fontSize: '0.8rem',
              padding: '6px 12px',
              borderColor: 'rgba(244, 63, 94, 0.4)',
            }}
          >
            <RefreshCw size={14} /> Retry Request
          </button>
        </div>
      )}
    </div>
  );
};
