/**
 * Centralized, typed API client for Smart Resume Screener.
 * Configured via VITE_API_BASE_URL (defaults to http://127.0.0.1:8000).
 */

import type {
  AnalyticsOverview,
  CandidateResponse,
  HealthResponse,
  JobCreateResponse,
  JobResponse,
  ResumeUploadResponse,
  ScreeningResponse,
} from '../types/api';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000';

export class ApiServiceError extends Error {
  status: number;
  errorName?: string;
  detail: string;

  constructor(status: number, detail: string, errorName?: string) {
    super(detail);
    this.name = 'ApiServiceError';
    this.status = status;
    this.detail = detail;
    this.errorName = errorName;
  }
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let errorDetail = response.statusText;
    let errorName: string | undefined;
    try {
      const data = await response.json();
      if (data.detail) {
        if (typeof data.detail === 'string') {
          errorDetail = data.detail;
        } else if (Array.isArray(data.detail)) {
          // FastAPI 422 validation errors
          errorDetail = data.detail.map((err: { loc: string[]; msg: string }) => `${err.loc.join('.')}: ${err.msg}`).join('; ');
        } else {
          errorDetail = JSON.stringify(data.detail);
        }
      }
      if (data.error) {
        errorName = data.error;
      }
    } catch {
      // Body is not JSON
    }
    throw new ApiServiceError(response.status, errorDetail, errorName);
  }
  return response.json();
}

export const api = {
  // System
  async checkHealth(): Promise<HealthResponse> {
    const res = await fetch(`${API_BASE}/health`, {
      headers: { Accept: 'application/json' },
    });
    return handleResponse<HealthResponse>(res);
  },

  // Jobs
  async createJob(description: string, titleHint?: string): Promise<JobCreateResponse> {
    const res = await fetch(`${API_BASE}/api/jobs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        description,
        title_hint: titleHint || undefined,
      }),
    });
    return handleResponse<JobCreateResponse>(res);
  },

  async listJobs(): Promise<JobResponse[]> {
    const res = await fetch(`${API_BASE}/api/jobs`, {
      headers: { Accept: 'application/json' },
    });
    return handleResponse<JobResponse[]>(res);
  },

  async getJob(jobId: string): Promise<JobResponse> {
    const res = await fetch(`${API_BASE}/api/jobs/${encodeURIComponent(jobId)}`, {
      headers: { Accept: 'application/json' },
    });
    return handleResponse<JobResponse>(res);
  },

  // Candidates / Resumes
  async uploadResume(file: File): Promise<ResumeUploadResponse> {
    const formData = new FormData();
    formData.append('file', file);

    const res = await fetch(`${API_BASE}/api/resumes/upload`, {
      method: 'POST',
      body: formData,
      headers: {
        Accept: 'application/json',
      },
    });
    return handleResponse<ResumeUploadResponse>(res);
  },

  async listCandidates(): Promise<CandidateResponse[]> {
    const res = await fetch(`${API_BASE}/api/resumes`, {
      headers: { Accept: 'application/json' },
    });
    return handleResponse<CandidateResponse[]>(res);
  },

  async getCandidate(candidateId: string): Promise<CandidateResponse> {
    const res = await fetch(`${API_BASE}/api/resumes/${encodeURIComponent(candidateId)}`, {
      headers: { Accept: 'application/json' },
    });
    return handleResponse<CandidateResponse>(res);
  },

  // Screening
  async screenCandidates(jobId: string, candidateIds: string[]): Promise<ScreeningResponse> {
    const res = await fetch(`${API_BASE}/api/screen`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        job_id: jobId,
        candidate_ids: candidateIds,
      }),
    });
    return handleResponse<ScreeningResponse>(res);
  },

  async getScreening(screeningId: string): Promise<ScreeningResponse> {
    const res = await fetch(`${API_BASE}/api/screen/${encodeURIComponent(screeningId)}`, {
      headers: { Accept: 'application/json' },
    });
    return handleResponse<ScreeningResponse>(res);
  },

  // Analytics
  async getAnalyticsOverview(): Promise<AnalyticsOverview> {
    const res = await fetch(`${API_BASE}/api/screen/analytics/overview`, {
      headers: { Accept: 'application/json' },
    });
    return handleResponse<AnalyticsOverview>(res);
  },
};
