from app.services.normalization_service import normalize_skill, normalize_skill_set


def test_ml_normalizes_to_machine_learning():
    assert normalize_skill("ML") == "machine learning"


def test_python3_normalizes_to_python():
    assert normalize_skill("Python3") == "python"


def test_postgres_normalizes_to_postgresql():
    assert normalize_skill("Postgres") == "postgresql"


def test_reactjs_normalizes_to_react():
    assert normalize_skill("ReactJS") == "react"


def test_node_normalizes_to_nodejs():
    assert normalize_skill("Node") == "node.js"


def test_unrecognized_skill_is_just_case_and_punctuation_normalized():
    assert normalize_skill("Terraform") == "terraform"


def test_normalization_is_case_insensitive():
    assert normalize_skill("MACHINE LEARNING") == normalize_skill("machine learning")


def test_normalize_skill_set_deduplicates_aliases():
    result = normalize_skill_set(["ML", "Machine Learning", "python3", "Python"])
    assert result == {"machine learning", "python"}


def test_normalize_skill_set_ignores_blank_entries():
    result = normalize_skill_set(["Python", "", "   "])
    assert result == {"python"}
