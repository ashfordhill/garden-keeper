import pytest


@pytest.fixture(autouse=True)
def _default_stub_mode(request, monkeypatch):
    """Fast tests run against the stub backend so no weights are ever needed.

    Slow (real-inference) tests opt out via the `slow` marker and manage
    GK_INFERENCE themselves.
    """
    if request.node.get_closest_marker("slow") is None:
        monkeypatch.setenv("GK_INFERENCE", "stub")
