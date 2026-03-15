"""referentiel industriel — sites buildings workshops machines

Revision ID: 0002_referentiel
Revises: 0001_init_users
Create Date: 2025-01-01 00:00:01
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0002_referentiel"
down_revision: Union[str, None] = "0001_init_users"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "sites",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("address", sa.String(255), nullable=True),
        sa.Column("manager", sa.String(255), nullable=True),
        sa.Column("country", sa.String(100), nullable=True),
        sa.Column("timezone", sa.String(100), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "buildings",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("site_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("floors", sa.Integer(), nullable=True),
        sa.Column("surface", sa.Float(), nullable=True),
        sa.Column("manager", sa.String(255), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["site_id"], ["sites.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_buildings_site_id", "buildings", ["site_id"])

    op.create_table(
        "workshops",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("building_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("location", sa.String(255), nullable=True),
        sa.Column("responsible", sa.String(255), nullable=True),
        sa.Column("oee_threshold_good", sa.Float(), nullable=False, server_default="0.85"),
        sa.Column("oee_threshold_warn", sa.Float(), nullable=False, server_default="0.65"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["building_id"], ["buildings.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_workshops_building_id", "workshops", ["building_id"])

    op.create_table(
        "machines",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("workshop_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("machine_type", sa.String(100), nullable=False, server_default="Other"),
        sa.Column("machine_function", sa.String(100), nullable=False, server_default="Other"),
        sa.Column(
            "status",
            sa.Enum(
                "running", "idle", "down", "maint", "inactive",
                name="machine_status",
                create_type=True,
                checkfirst=True,   # ne recrée pas si déjà existant
            ),
            nullable=False,
            server_default="idle",
        ),
        sa.Column("serial_number", sa.String(100), nullable=True),
        sa.Column("manufacturer", sa.String(255), nullable=True),
        sa.Column("year_installed", sa.Integer(), nullable=True),
        sa.Column("cadence_ref", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("tags", postgresql.ARRAY(sa.String()), nullable=False, server_default="{}"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["workshop_id"], ["workshops.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_machines_workshop_id", "machines", ["workshop_id"])
    op.create_index("ix_machines_status", "machines", ["status"])


def downgrade() -> None:
    op.drop_index("ix_machines_status", table_name="machines")
    op.drop_index("ix_machines_workshop_id", table_name="machines")
    op.drop_table("machines")
    op.drop_index("ix_workshops_building_id", table_name="workshops")
    op.drop_table("workshops")
    op.drop_index("ix_buildings_site_id", table_name="buildings")
    op.drop_table("buildings")
    op.drop_table("sites")
    op.execute("DROP TYPE IF EXISTS machine_status")
