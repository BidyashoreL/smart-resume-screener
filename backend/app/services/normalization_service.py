"""
Skill normalization.

Prevents the naive failure mode where "Machine Learning" (job requirement)
and "ML" (resume) are treated as different skills just because the strings
don't match exactly. This is a deliberately small, curated alias table
focused on common variants rather than an attempt at an exhaustive skills
ontology - the spec explicitly warns against building a huge hardcoded
synonym dictionary. Anything this layer can't resolve deterministically is
left to the LLM's semantic matching step.
"""

import re

# canonical_name -> set of raw aliases (already lowercase, punctuation-stripped)
_ALIAS_GROUPS: dict[str, set[str]] = {
    "machine learning": {"ml", "machinelearning"},
    "artificial intelligence": {"ai"},
    "natural language processing": {"nlp"},
    "python": {"python3", "python2", "py"},
    "postgresql": {"postgres", "psql"},
    "node.js": {"node", "nodejs"},
    "react": {"reactjs", "react.js"},
    "javascript": {"js", "ecmascript"},
    "typescript": {"ts"},
    "amazon web services": {"aws"},
    "google cloud platform": {"gcp"},
    "microsoft azure": {"azure"},
    "kubernetes": {"k8s"},
    "docker": {"containerization"},
    "structured query language": {"sql"},
    "pytorch": {"torch"},
    "tensorflow": {"tf"},
    "continuous integration continuous deployment": {"ci/cd", "cicd", "ci cd"},
    "representational state transfer": {"rest", "restful", "rest api"},
    "application programming interface": {"api"},
    "fastapi": {"fast api"},
    "computer vision": {"cv"},
    "deep learning": {"dl"},
}

# Reverse index: alias -> canonical name, built once at import time.
_ALIAS_TO_CANONICAL: dict[str, str] = {}
for canonical, aliases in _ALIAS_GROUPS.items():
    _ALIAS_TO_CANONICAL[canonical] = canonical
    for alias in aliases:
        _ALIAS_TO_CANONICAL[alias] = canonical

_PUNCTUATION_RE = re.compile(r"[^a-z0-9./+#\s]")
_WHITESPACE_RE = re.compile(r"\s+")


def _basic_normalize(raw_skill: str) -> str:
    """Lowercase + strip punctuation/whitespace noise, without alias resolution."""
    text = raw_skill.strip().lower()
    text = _PUNCTUATION_RE.sub("", text)
    text = _WHITESPACE_RE.sub(" ", text).strip()
    return text


def normalize_skill(raw_skill: str) -> str:
    """
    Normalize a single skill string to its canonical form.

    Examples:
        "ML"        -> "machine learning"
        "Python3"   -> "python"
        "Postgres"  -> "postgresql"
        "ReactJS"   -> "react"
        "Terraform" -> "terraform"  (no alias needed, just case/punctuation normalized)
    """
    basic = _basic_normalize(raw_skill)
    return _ALIAS_TO_CANONICAL.get(basic, basic)


def normalize_skill_set(raw_skills: list[str]) -> set[str]:
    """Normalize a list of skill strings into a de-duplicated canonical set."""
    return {normalize_skill(s) for s in raw_skills if s and s.strip()}
