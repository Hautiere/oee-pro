"""events interventions planned_maintenance

Revision ID: 0003_events
Revises: 0002_referentiel
Create Date: 2025-01-01 00:00:02
"""
from typing import Sequence, Union
from alembic import op

revision: str = "0003_events"
down_revision: Union[str, None] = "0002_referentiel"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Un op.execute() par commande — contrainte asyncpg
    op.execute("DO $$ BEGIN CREATE TYPE event_type AS ENUM ('running','idle','down','maint'); EXCEPTION WHEN duplicate_object THEN null; END $$")
    op.execute("DO $$ BEGIN CREATE TYPE maint_type AS ENUM ('maint','down','idle'); EXCEPTION WHEN duplicate_object THEN null; END $$")

    op.execute("""
        CREATE TABLE machine_events (
            id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            machine_id  UUID NOT NULL REFERENCES machines(id) ON DELETE CASCADE,
            event_type  event_type NOT NULL,
            started_at  TIMESTAMPTZ NOT NULL,
            ended_at    TIMESTAMPTZ,
            quality_pct INTEGER NOT NULL DEFAULT 100,
            note        TEXT,
            created_by  UUID REFERENCES users(id) ON DELETE SET NULL,
            created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
        )
    """)
    op.execute("CREATE INDEX ix_machine_events_machine_id ON machine_events(machine_id)")
    op.execute("CREATE INDEX ix_machine_events_started_at ON machine_events(started_at)")

    op.execute("""
        CREATE TABLE interventions (
            id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            event_id     UUID NOT NULL REFERENCES machine_events(id) ON DELETE CASCADE,
            machine_id   UUID NOT NULL REFERENCES machines(id) ON DELETE CASCADE,
            cause        VARCHAR(500),
            action       VARCHAR(500),
            technician   VARCHAR(255),
            duration_min INTEGER,
            created_by   UUID REFERENCES users(id) ON DELETE SET NULL,
            created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
        )
    """)
    op.execute("CREATE INDEX ix_interventions_event_id ON interventions(event_id)")
    op.execute("CREATE INDEX ix_interventions_machine_id ON interventions(machine_id)")

    op.execute("""
        CREATE TABLE planned_maintenance (
            id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            machine_id   UUID NOT NULL REFERENCES machines(id) ON DELETE CASCADE,
            planned_date TIMESTAMPTZ NOT NULL,
            duration_min INTEGER NOT NULL,
            maint_type   maint_type NOT NULL DEFAULT 'maint',
            reason       VARCHAR(500),
            is_done      BOOLEAN NOT NULL DEFAULT false,
            created_by   UUID REFERENCES users(id) ON DELETE SET NULL,
            created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
        )
    """)
    op.execute("CREATE INDEX ix_planned_maintenance_machine_id ON planned_maintenance(machine_id)")
    op.execute("CREATE INDEX ix_planned_maintenance_planned_date ON planned_maintenance(planned_date)")


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS planned_maintenance")
    op.execute("DROP TABLE IF EXISTS interventions")
    op.execute("DROP TABLE IF EXISTS machine_events")
    op.execute("DROP TYPE IF EXISTS maint_type")
    op.execute("DROP TYPE IF EXISTS event_type")
