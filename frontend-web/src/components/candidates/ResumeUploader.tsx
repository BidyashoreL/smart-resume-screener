import React, { useState, useRef } from 'react';
import { UploadCloud, FileText, CheckCircle2, AlertCircle, Loader2, X } from 'lucide-react';
import { api } from '../../services/api';
import type { ResumeUploadResponse } from '../../types/api';

interface ResumeUploaderProps {
  onUploadSuccess: (newCandidate: ResumeUploadResponse) => void;
  isOpen: boolean;
  onClose: () => void;
}

interface UploadQueueItem {
  file: File;
  status: 'pending' | 'uploading' | 'success' | 'error';
  error?: string;
  response?: ResumeUploadResponse;
}

export const ResumeUploader: React.FC<ResumeUploaderProps> = ({
  onUploadSuccess,
  isOpen,
  onClose,
}) => {
  const [dragActive, setDragActive] = useState(false);
  const [queue, setQueue] = useState<UploadQueueItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const newItems: UploadQueueItem[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (file.name.endsWith('.pdf') || file.name.endsWith('.txt')) {
        newItems.push({
          file,
          status: 'pending',
        });
      }
    }
    setQueue((prev) => [...prev, ...newItems]);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files) {
      handleFiles(e.dataTransfer.files);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const startUpload = async () => {
    if (queue.length === 0 || isProcessing) return;
    setIsProcessing(true);

    for (let i = 0; i < queue.length; i++) {
      const item = queue[i];
      if (item.status === 'success') continue;

      setQueue((prev) =>
        prev.map((q, idx) => (idx === i ? { ...q, status: 'uploading', error: undefined } : q))
      );

      try {
        const res = await api.uploadResume(item.file);
        setQueue((prev) =>
          prev.map((q, idx) => (idx === i ? { ...q, status: 'success', response: res } : q))
        );
        onUploadSuccess(res);
      } catch (err: any) {
        setQueue((prev) =>
          prev.map((q, idx) =>
            idx === i ? { ...q, status: 'error', error: err?.detail || 'Extraction failed' } : q
          )
        );
      }
    }

    setIsProcessing(false);
  };

  const removeQueueItem = (index: number) => {
    setQueue((prev) => prev.filter((_, idx) => idx !== index));
  };

  const clearCompleted = () => {
    setQueue((prev) => prev.filter((item) => item.status !== 'success'));
  };

  const pendingCount = queue.filter((q) => q.status === 'pending').length;
  const successCount = queue.filter((q) => q.status === 'success').length;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(8px)',
        zIndex: 50,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
      }}
      onClick={onClose}
    >
      <div
        className="glass-panel-elevated"
        style={{
          width: '100%',
          maxWidth: '680px',
          backgroundColor: '#111827',
          padding: '28px',
          display: 'flex',
          flexDirection: 'column',
          gap: '20px',
          boxShadow: '0 20px 40px rgba(0,0,0,0.6)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#fff' }}>
              Upload Candidate Resumes
            </h2>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
              PDF & TXT ingestion with PyMuPDF text parsing & Gemini LLM structured profile extraction
            </p>
          </div>
          <button onClick={onClose} className="btn-ghost" style={{ padding: '6px' }}>
            <X size={20} />
          </button>
        </div>

        {/* Dropzone */}
        <div
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          style={{
            border: `2px dashed ${dragActive ? 'var(--accent-primary)' : 'rgba(255, 255, 255, 0.15)'}`,
            backgroundColor: dragActive ? 'rgba(99, 102, 241, 0.08)' : 'rgba(15, 23, 42, 0.6)',
            borderRadius: 'var(--radius-md)',
            padding: '36px 20px',
            textAlign: 'center',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '12px',
          }}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".pdf,.txt,text/plain,application/pdf"
            style={{ display: 'none' }}
            onChange={(e) => handleFiles(e.target.files)}
          />
          <div
            style={{
              width: '48px',
              height: '48px',
              borderRadius: '50%',
              backgroundColor: 'rgba(99, 102, 241, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--accent-primary)',
            }}
          >
            <UploadCloud size={26} />
          </div>
          <div>
            <span style={{ fontWeight: 600, color: '#fff', fontSize: '0.95rem' }}>
              Click to browse or drag and drop resumes
            </span>
            <span style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '4px' }}>
              Supports PDF and TXT formats (OCR check included)
            </span>
          </div>
        </div>

        {/* Queue List */}
        {queue.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '220px', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                Files Queue ({queue.length})
              </span>
              {successCount > 0 && (
                <button
                  onClick={clearCompleted}
                  className="btn-ghost"
                  style={{ fontSize: '0.75rem', padding: '2px 8px' }}
                >
                  Clear Processed
                </button>
              )}
            </div>

            {queue.map((item, index) => (
              <div
                key={`${item.file.name}-${index}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 14px',
                  backgroundColor: 'var(--bg-surface)',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-subtle)',
                  fontSize: '0.85rem',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                  <FileText size={18} style={{ color: 'var(--accent-primary)', flexShrink: 0 }} />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 500, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {item.file.name}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                      {(item.file.size / 1024).toFixed(1)} KB
                      {item.response?.name && ` • Name: ${item.response.name}`}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
                  {item.status === 'pending' && (
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Ready</span>
                  )}
                  {item.status === 'uploading' && (
                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: '#818cf8' }}>
                      <Loader2 size={14} className="animate-spin" /> Extracting...
                    </span>
                  )}
                  {item.status === 'success' && (
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', color: '#10b981' }}>
                      <CheckCircle2 size={14} /> Parsed
                    </span>
                  )}
                  {item.status === 'error' && (
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', color: '#f43f5e' }}>
                      <AlertCircle size={14} /> {item.error}
                    </span>
                  )}

                  {!isProcessing && (
                    <button
                      onClick={() => removeQueueItem(index)}
                      className="btn-ghost"
                      style={{ padding: '2px', color: 'var(--text-muted)' }}
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Footer Actions */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', paddingTop: '10px', borderTop: '1px solid var(--border-subtle)' }}>
          <button onClick={onClose} className="btn btn-secondary" disabled={isProcessing}>
            {successCount > 0 && pendingCount === 0 ? 'Done' : 'Cancel'}
          </button>
          {pendingCount > 0 && (
            <button
              onClick={startUpload}
              className="btn btn-primary"
              disabled={isProcessing}
            >
              {isProcessing ? (
                <>
                  <Loader2 size={16} className="animate-spin" /> Processing Resumes...
                </>
              ) : (
                `Extract & Save ${pendingCount} Resume${pendingCount > 1 ? 's' : ''}`
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
