/**
 * TypeScript definitions corresponding directly to the FastAPI Pydantic schemas.
 * The backend schema is the single source of truth.
 */

// --- Candidate Domain ---

export interface Skill {
  name: string;
  category?: string | null;
  evidence?: string | null;
}

export interface Experience {
  company?: string | null;
  role?: string | null;
  duration_months?: number | null;
  description?: string | null;
}

export interface Education {
  degree?: string | null;
  field?: string | null;
  institution?: string | null;
  graduation_year?: number | null;
}

export interface Project {
  name?: string | null;
  description?: string | null;
}

export interface CandidateProfile {
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  skills: Skill[];
  experience: Experience[];
  education: Education[];
  projects: Project[];
  total_experience_months?: number | null;
}

export interface CandidateResponse {
  candidate_id: string;
  name?: string | null;
  email?: string | null;
  profile: CandidateProfile;
  created_at: string;
}

export interface ResumeUploadResponse {
  candidate_id: string;
  status: string;
  name?: string | null;
  warnings: string[];
}

// --- Job Domain ---

export interface JobProfile {
  title?: string | null;
  required_skills: string[];
  preferred_skills: string[];
  minimum_experience_months?: number | null;
  education_requirements: string[];
  responsibilities: string[];
}

export interface JobCreateRequest {
  description: string;
  title_hint?: string | null;
}

export interface JobCreateResponse {
  job_id: string;
  status: string;
}

export interface JobResponse {
  job_id: string;
  title?: string | null;
  profile: JobProfile;
  created_at: string;
}

// --- Screening Domain ---

export type MatchBand = 'Strong Match' | 'Good Match' | 'Partial Match' | 'Low Match';
export type Recommendation = 'SHORTLIST' | 'CONSIDER' | 'REJECT';

export interface RelevantExperienceEvidence {
  evidence: string;
  relevance: 'high' | 'medium' | 'low';
}

export interface SkillEvidence {
  skill: string;
  required: boolean;
  matched: boolean;
  source?: string | null;
}

export interface ScoreBreakdown {
  skill_score: number;
  experience_score: number;
  responsibility_score: number;
  education_score: number;
  overall_score: number;
}

export interface CandidateScreeningResult {
  candidate_id: string;
  candidate_name?: string | null;
  scores: ScoreBreakdown;
  match_band: MatchBand;
  recommendation: Recommendation;
  matched_required_skills: string[];
  missing_required_skills: string[];
  matched_preferred_skills: string[];
  missing_preferred_skills: string[];
  skill_evidence: SkillEvidence[];
  strengths: string[];
  weaknesses: string[];
  justification: string;
}

export interface ScreeningRequest {
  job_id: string;
  candidate_ids: string[];
}

export interface ScreeningResponse {
  screening_id: string;
  job_id: string;
  results: CandidateScreeningResult[];
}

// --- Analytics Domain (GET /api/screen/analytics/overview) ---
// Mirrors backend/app/schemas/screening.py exactly. The backend computes
// every count/average/ranking here; this file only types the response shape.

export interface ScreeningBatchSummary {
  screening_id: string;
  job_id: string;
  job_title: string;
  candidates_count: number;
  shortlist_count: number;
  consider_count: number;
  reject_count: number;
  average_score: number;
  created_at: string;
}

export interface TopCandidateItem {
  candidate_id: string;
  candidate_name: string;
  job_id: string;
  job_title: string;
  overall_score: number;
  match_band: string;
  recommendation: string;
  strengths: string[];
  screening_id: string;
}

export interface JobPerformanceItem {
  job_id: string;
  job_title: string;
  candidates_screened: number;
  shortlist_count: number;
  consider_count: number;
  reject_count: number;
  average_score: number;
}

export interface SkillInsightItem {
  skill: string;
  count: number;
}

export interface AnalyticsOverview {
  total_candidates: number;
  active_jobs: number;
  total_screenings: number;
  candidates_screened: number;
  shortlisted_count: number;
  consider_count: number;
  rejected_count: number;
  average_score: number;
  match_band_distribution: Record<string, number>;
  recommendation_distribution: Record<string, number>;
  recent_screenings: ScreeningBatchSummary[];
  top_candidates: TopCandidateItem[];
  job_performance: JobPerformanceItem[];
  frequently_matched_required_skills: SkillInsightItem[];
  frequently_missing_required_skills: SkillInsightItem[];
  frequently_matched_preferred_skills: SkillInsightItem[];
}

// --- System & Errors ---

export interface HealthResponse {
  status: string;
  service: string;
}

export interface ApiError {
  error?: string;
  detail: string;
  status?: number;
}
