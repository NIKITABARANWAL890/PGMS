"""Criterion 7: Phase 1 must not contain Phase 2-6 work.

These are plain synchronous checks -- they inspect the app's own metadata, so
they need no database and no event loop.
"""

from __future__ import annotations


def test_no_phase_2_to_6_tables_are_modelled():
    """Phase 1 owns 8 tables. Anything else here would be the next phase's work."""
    from app.models import Base

    assert sorted(Base.metadata.tables) == [
        "beds",
        "buildings",
        "floors",
        "pgs",
        "refresh_tokens",
        "rooms",
        "staff_assignments",
        "users",
    ]


def test_no_tenant_billing_or_complaint_endpoints_exist():
    from app.main import app

    paths = list(app.openapi()["paths"])
    forbidden = (
        "tenant",
        "invoice",
        "bill",
        "payment",
        "complaint",
        "moveout",
        "move-out",
        "settlement",
        "notice",
        "notification",
    )
    offenders = [p for p in paths if any(word in p.lower() for word in forbidden)]
    assert offenders == [], f"Phase 2-6 endpoints leaked into Phase 1: {offenders}"


def test_no_staff_permissions_table_exists():
    """The deferred permission matrix must stay deferred (plan section 2A)."""
    from app.models import Base

    assert "staff_permissions" not in Base.metadata.tables
    assert "roles" not in Base.metadata.tables, "roles is a fixed enum, not a table"
