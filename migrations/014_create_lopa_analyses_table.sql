-- Migration: 014_create_lopa_analyses_table
-- Description: Create lopa_analyses table for LOPA (Layers of Protection Analysis) workflow
-- Task: COMP-08
-- Date: 2026-02-11

-- Set search path to use the hazop schema
SET search_path TO hazop, public;

-- ============================================================================
-- LOPA_ANALYSES TABLE
-- ============================================================================
-- Stores LOPA (Layers of Protection Analysis) for analysis entries.
-- LOPA is triggered for high-risk scenarios to validate adequate protection.

-- Create LOPA status enum type
DO $$ BEGIN
    CREATE TYPE lopa_status AS ENUM ('draft', 'in_review', 'approved', 'requires_action');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- Create LOPA gap status enum type
DO $$ BEGIN
    CREATE TYPE lopa_gap_status AS ENUM ('adequate', 'marginal', 'inadequate');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- Create IPL type enum
DO $$ BEGIN
    CREATE TYPE ipl_type AS ENUM (
        'safety_instrumented_function',
        'basic_process_control',
        'relief_device',
        'physical_containment',
        'mechanical',
        'human_intervention',
        'emergency_response',
        'other'
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- Create initiating event category enum
DO $$ BEGIN
    CREATE TYPE initiating_event_category AS ENUM (
        'equipment_failure',
        'human_error',
        'external_event',
        'process_upset',
        'loss_of_utility',
        'other'
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE lopa_analyses (
    -- Primary key
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Foreign key to analysis_entries table
    analysis_entry_id UUID NOT NULL,

    -- Description of the scenario being analyzed
    scenario_description TEXT NOT NULL,

    -- Consequence description
    consequence TEXT NOT NULL,

    -- Severity level from HazOp (1-5) - copied from the analysis entry at time of LOPA creation
    severity SMALLINT NOT NULL CHECK (severity >= 1 AND severity <= 5),

    -- Category of the initiating event
    initiating_event_category initiating_event_category NOT NULL,

    -- Description of the initiating event
    initiating_event_description TEXT NOT NULL,

    -- Frequency of the initiating event (per year) - stored as numeric for precision
    initiating_event_frequency NUMERIC(20, 10) NOT NULL CHECK (initiating_event_frequency > 0),

    -- Independent protection layers credited (stored as JSONB array of IPL objects)
    ipls JSONB NOT NULL DEFAULT '[]'::JSONB,

    -- Target mitigated event likelihood (per year)
    target_frequency NUMERIC(20, 10) NOT NULL CHECK (target_frequency > 0),

    -- Calculated mitigated event likelihood (per year)
    mitigated_event_likelihood NUMERIC(20, 10) NOT NULL,

    -- Total risk reduction factor (product of all IPL RRFs)
    total_risk_reduction_factor NUMERIC(20, 4) NOT NULL CHECK (total_risk_reduction_factor >= 1),

    -- Required risk reduction factor to meet target
    required_risk_reduction_factor NUMERIC(20, 4) NOT NULL CHECK (required_risk_reduction_factor >= 1),

    -- Gap analysis result
    gap_status lopa_gap_status NOT NULL,

    -- Gap ratio (actual RRF / required RRF) - >1 is adequate
    gap_ratio NUMERIC(10, 4) NOT NULL,

    -- Current status of this LOPA analysis
    status lopa_status NOT NULL DEFAULT 'draft',

    -- Recommendations if gap exists (stored as JSONB array of strings)
    recommendations JSONB NOT NULL DEFAULT '[]'::JSONB,

    -- Required SIL for new SIF if protection is inadequate (null if adequate)
    required_sil SMALLINT DEFAULT NULL CHECK (required_sil IS NULL OR (required_sil >= 1 AND required_sil <= 4)),

    -- Additional notes and assumptions
    notes TEXT DEFAULT NULL,

    -- User who created this analysis
    created_by_id UUID NOT NULL,

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- ========================================================================
    -- CONSTRAINTS
    -- ========================================================================

    -- Foreign key to analysis_entries - cascade delete when entry is deleted
    CONSTRAINT lopa_analyses_fk_entry FOREIGN KEY (analysis_entry_id)
        REFERENCES analysis_entries(id) ON DELETE CASCADE ON UPDATE CASCADE,

    -- Foreign key to users for creator - restrict deletion
    CONSTRAINT lopa_analyses_fk_created_by FOREIGN KEY (created_by_id)
        REFERENCES users(id) ON DELETE RESTRICT ON UPDATE CASCADE,

    -- Scenario description must not be empty
    CONSTRAINT lopa_analyses_scenario_not_empty CHECK (LENGTH(TRIM(scenario_description)) > 0),

    -- Consequence must not be empty
    CONSTRAINT lopa_analyses_consequence_not_empty CHECK (LENGTH(TRIM(consequence)) > 0),

    -- Initiating event description must not be empty
    CONSTRAINT lopa_analyses_ie_desc_not_empty CHECK (LENGTH(TRIM(initiating_event_description)) > 0),

    -- Target frequency must be less than initiating event frequency
    CONSTRAINT lopa_analyses_freq_ordering CHECK (target_frequency < initiating_event_frequency),

    -- One LOPA analysis per analysis entry (can be updated but not duplicated)
    CONSTRAINT lopa_analyses_unique_entry UNIQUE (analysis_entry_id)
);

-- ============================================================================
-- TABLE AND COLUMN COMMENTS
-- ============================================================================

COMMENT ON TABLE lopa_analyses IS
    'LOPA (Layers of Protection Analysis) analyses. Each LOPA evaluates whether '
    'sufficient independent protection layers exist to reduce the frequency of '
    'a hazardous scenario to an acceptable target level.';

COMMENT ON COLUMN lopa_analyses.id IS
    'Unique identifier (UUID) for the LOPA analysis';

COMMENT ON COLUMN lopa_analyses.analysis_entry_id IS
    'Foreign key reference to the HazOp analysis entry this LOPA is for';

COMMENT ON COLUMN lopa_analyses.scenario_description IS
    'Description of the hazardous scenario being analyzed';

COMMENT ON COLUMN lopa_analyses.consequence IS
    'Description of the consequence if the scenario occurs';

COMMENT ON COLUMN lopa_analyses.severity IS
    'Severity level (1-5) from the HazOp analysis entry';

COMMENT ON COLUMN lopa_analyses.initiating_event_category IS
    'Category of the initiating event (equipment_failure, human_error, etc.)';

COMMENT ON COLUMN lopa_analyses.initiating_event_description IS
    'Description of the specific initiating event';

COMMENT ON COLUMN lopa_analyses.initiating_event_frequency IS
    'Frequency of the initiating event in occurrences per year';

COMMENT ON COLUMN lopa_analyses.ipls IS
    'JSON array of credited Independent Protection Layers with their details';

COMMENT ON COLUMN lopa_analyses.target_frequency IS
    'Target mitigated event likelihood in occurrences per year';

COMMENT ON COLUMN lopa_analyses.mitigated_event_likelihood IS
    'Calculated mitigated event likelihood after IPLs (per year)';

COMMENT ON COLUMN lopa_analyses.total_risk_reduction_factor IS
    'Combined risk reduction factor from all credited IPLs';

COMMENT ON COLUMN lopa_analyses.required_risk_reduction_factor IS
    'Required RRF to achieve target frequency (IEF / target)';

COMMENT ON COLUMN lopa_analyses.gap_status IS
    'Result of gap analysis: adequate, marginal, or inadequate';

COMMENT ON COLUMN lopa_analyses.gap_ratio IS
    'Ratio of actual RRF to required RRF (>1 is adequate, 0.5-1 is marginal, <0.5 is inadequate)';

COMMENT ON COLUMN lopa_analyses.status IS
    'Current status: draft, in_review, approved, or requires_action';

COMMENT ON COLUMN lopa_analyses.recommendations IS
    'JSON array of recommendations if protection is inadequate or marginal';

COMMENT ON COLUMN lopa_analyses.required_sil IS
    'Required Safety Integrity Level for new SIF if protection is inadequate (1-4)';

COMMENT ON COLUMN lopa_analyses.notes IS
    'Additional notes, assumptions, or documentation';

COMMENT ON COLUMN lopa_analyses.created_by_id IS
    'Foreign key reference to the user who created this LOPA analysis';

COMMENT ON COLUMN lopa_analyses.created_at IS
    'Timestamp when the LOPA analysis was created';

COMMENT ON COLUMN lopa_analyses.updated_at IS
    'Timestamp when the LOPA analysis was last updated';

-- ============================================================================
-- PERFORMANCE INDEXES
-- ============================================================================

-- Index for querying LOPA by analysis entry (primary lookup)
CREATE INDEX idx_lopa_analyses_entry_id
    ON lopa_analyses (analysis_entry_id);

-- Index for filtering by status
CREATE INDEX idx_lopa_analyses_status
    ON lopa_analyses (status);

-- Index for filtering by gap status
CREATE INDEX idx_lopa_analyses_gap_status
    ON lopa_analyses (gap_status);

-- Index for querying by creator
CREATE INDEX idx_lopa_analyses_created_by_id
    ON lopa_analyses (created_by_id);

-- Index for sorting by creation date
CREATE INDEX idx_lopa_analyses_created_at
    ON lopa_analyses (created_at DESC);

-- Index for finding inadequate/marginal LOPAs (prioritization)
CREATE INDEX idx_lopa_analyses_gap_ratio
    ON lopa_analyses (gap_ratio) WHERE gap_status != 'adequate';

-- GIN index for searching within IPLs JSONB array
CREATE INDEX idx_lopa_analyses_ipls_gin
    ON lopa_analyses USING GIN (ipls);

-- GIN index for searching within recommendations JSONB array
CREATE INDEX idx_lopa_analyses_recommendations_gin
    ON lopa_analyses USING GIN (recommendations);
