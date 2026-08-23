"""
Streamlit recruiter dashboard.

Talks to the FastAPI backend over HTTP only - no business logic, no direct
DB or LLM access here, per the project's layered architecture. Run the
backend first (`uvicorn app.main:app --reload` from `backend/`), then:

    streamlit run frontend/app.py
"""

import os

import requests
import streamlit as st

BACKEND_URL = os.environ.get("BACKEND_URL", "http://localhost:8000")

st.set_page_config(page_title="Smart Resume Screener", layout="wide")

BAND_COLOR = {
    "Strong Match": "🟢",
    "Good Match": "🟡",
    "Partial Match": "🟠",
    "Low Match": "🔴",
}
RECOMMENDATION_COLOR = {
    "SHORTLIST": "✅ SHORTLIST",
    "CONSIDER": "🤔 CONSIDER",
    "REJECT": "❌ REJECT",
}


def api_post(path: str, **kwargs):
    resp = requests.post(f"{BACKEND_URL}{path}", timeout=120, **kwargs)
    if not resp.ok:
        try:
            detail = resp.json().get("detail", resp.text)
        except Exception:
            detail = resp.text
        st.error(f"{resp.status_code}: {detail}")
        return None
    return resp.json()


def api_get(path: str):
    resp = requests.get(f"{BACKEND_URL}{path}", timeout=60)
    if not resp.ok:
        st.error(f"{resp.status_code}: {resp.text}")
        return None
    return resp.json()


st.title("🧠 Smart Resume Screener")
st.caption(
    "Upload resumes and a job description to get a ranked, evidence-backed shortlist."
)

if "candidate_ids" not in st.session_state:
    st.session_state.candidate_ids = {}  # filename -> candidate_id
if "job_id" not in st.session_state:
    st.session_state.job_id = None
if "screening_result" not in st.session_state:
    st.session_state.screening_result = None

col_job, col_resumes = st.columns(2)

with col_job:
    st.subheader("1. Job Description")
    job_description = st.text_area(
        "Paste the job description",
        height=220,
        placeholder="e.g. We are hiring a Machine Learning Engineer. Required skills: Python, "
        "Machine Learning, PyTorch. Preferred: Docker, AWS, FastAPI. Minimum 2 years "
        "experience. Requires a degree in Computer Science...",
    )
    if st.button("Save Job Description", type="secondary"):
        if len(job_description.strip()) < 20:
            st.warning("Please paste a fuller job description (at least 20 characters).")
        else:
            with st.spinner("Extracting structured job requirements..."):
                result = api_post("/api/jobs", json={"description": job_description})
            if result:
                st.session_state.job_id = result["job_id"]
                st.success(f"Job saved (id: {result['job_id']})")

with col_resumes:
    st.subheader("2. Candidate Resumes")
    uploaded_files = st.file_uploader(
        "Upload PDF or TXT resumes", type=["pdf", "txt"], accept_multiple_files=True
    )
    if st.button("Process Resumes", type="secondary"):
        if not uploaded_files:
            st.warning("Please upload at least one resume.")
        else:
            progress = st.progress(0.0, text="Processing resumes...")
            for i, f in enumerate(uploaded_files):
                if f.name not in st.session_state.candidate_ids:
                    result = api_post(
                        "/api/resumes/upload",
                        files={"file": (f.name, f.getvalue(), f.type or "application/octet-stream")},
                    )
                    if result:
                        st.session_state.candidate_ids[f.name] = result["candidate_id"]
                progress.progress((i + 1) / len(uploaded_files), text=f"Processed {f.name}")
            progress.empty()
            st.success(f"{len(st.session_state.candidate_ids)} resume(s) ready.")

if st.session_state.candidate_ids:
    with st.expander(f"Processed candidates ({len(st.session_state.candidate_ids)})"):
        for fname, cid in st.session_state.candidate_ids.items():
            st.write(f"- **{fname}** -> `{cid}`")

st.divider()

st.subheader("3. Screen Candidates")
screen_disabled = not (st.session_state.job_id and st.session_state.candidate_ids)
if screen_disabled:
    st.info("Save a job description and process at least one resume before screening.")

if st.button("🔍 SCREEN CANDIDATES", type="primary", disabled=screen_disabled):
    with st.spinner("Running hybrid matching against all candidates..."):
        result = api_post(
            "/api/screen",
            json={
                "job_id": st.session_state.job_id,
                "candidate_ids": list(st.session_state.candidate_ids.values()),
            },
        )
    st.session_state.screening_result = result

st.divider()

if st.session_state.screening_result:
    st.subheader("Candidate Ranking")
    results = st.session_state.screening_result["results"]

    for rank, r in enumerate(results, start=1):
        band = r["match_band"]
        rec = r["recommendation"]
        name = r["candidate_name"] or r["candidate_id"]
        overall_10 = round(r["scores"]["overall_score"] / 10, 1)

        with st.container(border=True):
            header_col, score_col = st.columns([3, 1])
            with header_col:
                st.markdown(f"### {rank}. {name}")
                st.markdown(f"{BAND_COLOR.get(band, '')} **{band}** &nbsp;|&nbsp; {RECOMMENDATION_COLOR.get(rec, rec)}")
            with score_col:
                st.metric("Overall Score", f"{overall_10}/10", f"{r['scores']['overall_score']:.0f}/100")

            m1, m2, m3, m4 = st.columns(4)
            m1.metric("Required Skills", f"{r['scores']['skill_score']:.0f}%")
            m2.metric("Experience", f"{r['scores']['experience_score']:.0f}%")
            m3.metric("Responsibilities", f"{r['scores']['responsibility_score']:.0f}%")
            m4.metric("Education", f"{r['scores']['education_score']:.0f}%")

            skill_col1, skill_col2 = st.columns(2)
            with skill_col1:
                st.markdown("**Matched Skills**")
                for s in r["matched_required_skills"]:
                    st.markdown(f"✓ {s} *(required)*")
                for s in r["matched_preferred_skills"]:
                    st.markdown(f"✓ {s} *(preferred)*")
            with skill_col2:
                st.markdown("**Missing Skills**")
                for s in r["missing_required_skills"]:
                    st.markdown(f"✗ {s} *(required)*")
                for s in r["missing_preferred_skills"]:
                    st.markdown(f"✗ {s} *(preferred)*")

            with st.expander("Why this ranking? (strengths, weaknesses, justification)"):
                if r["strengths"]:
                    st.markdown("**Strengths**")
                    for s in r["strengths"]:
                        st.markdown(f"- {s}")
                if r["weaknesses"]:
                    st.markdown("**Weaknesses**")
                    for w in r["weaknesses"]:
                        st.markdown(f"- {w}")
                st.markdown("**Justification**")
                st.write(r["justification"])

    st.caption(f"Screening ID: `{st.session_state.screening_result['screening_id']}`")
