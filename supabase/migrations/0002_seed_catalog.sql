-- =============================================================================
-- Greenscape Proposal Agent — line item catalog seed
-- =============================================================================
-- Prices reflect typical Phoenix-market residential pricing for a premium
-- design-build company. Marcus's real spreadsheet would replace these.
-- All prices in cents (USD).
-- =============================================================================

insert into public.line_items_catalog
    (sku_id, category, name, description, unit, unit_price_cents, min_charge_cents, margin_pct, active)
values
    -- ── Patios & hardscape surfaces ──────────────────────────────────────────
    ('PATIO_TRAVERTINE',      'patio',     'Travertine patio',           'Premium tumbled travertine paver patio, installed on compacted base with polymeric sand joints.',
        'sqft', 3800, 250000, 38.00, true),
    ('PATIO_FLAGSTONE',       'patio',     'Flagstone patio',            'Arizona flagstone patio, irregular shape, dry-laid on compacted base.',
        'sqft', 3200, 220000, 38.00, true),
    ('PATIO_CONCRETE_PAVERS', 'patio',     'Concrete paver patio',       'Belgard or similar concrete paver patio with polymeric sand.',
        'sqft', 2400, 180000, 38.00, true),
    ('PATIO_STAMPED_CONCRETE','patio',     'Stamped concrete patio',     'Color-integrated, stamped pattern concrete patio with sealer.',
        'sqft', 1800, 150000, 38.00, true),
    ('PATIO_BRICK_PAVERS',    'patio',     'Brick paver patio',          'Clay brick paver patio.',
        'sqft', 2800, 180000, 38.00, true),

    -- ── Pergolas & shade structures ─────────────────────────────────────────
    ('PERGOLA_CEDAR_12X12',   'pergola',   'Cedar pergola 12x12',        'Western red cedar pergola, 12 ft x 12 ft, sealed.',
        'each', 950000, 0, 42.00, true),
    ('PERGOLA_CEDAR_16X16',   'pergola',   'Cedar pergola 16x16',        'Western red cedar pergola, 16 ft x 16 ft, sealed.',
        'each', 1450000, 0, 42.00, true),
    ('PERGOLA_ALUM_LOUVERED', 'pergola',   'Louvered aluminum pergola',  'Motorized louvered aluminum pergola, 12 ft x 14 ft, with remote.',
        'each', 2200000, 0, 38.00, true),

    -- ── Fire features ───────────────────────────────────────────────────────
    ('FIREPIT_GAS_36',        'fire',      'Gas fire pit 36"',           '36" round gas fire pit, lava-rock fill, run from existing gas line.',
        'each', 350000, 0, 45.00, true),
    ('FIREPIT_GAS_48',        'fire',      'Gas fire pit 48"',           '48" round gas fire pit, lava-rock fill, run from existing gas line.',
        'each', 480000, 0, 45.00, true),
    ('FIREPIT_WOOD_STONE',    'fire',      'Stone wood-burning fire pit','Natural-stone wood-burning fire pit, 42" diameter.',
        'each', 220000, 0, 45.00, true),

    -- ── Water features ──────────────────────────────────────────────────────
    ('WATER_PONDLESS',        'water',     'Pondless waterfall',         'Pondless recirculating waterfall with basin, pump, and rock feature.',
        'each', 850000, 0, 40.00, true),
    ('WATER_BUBBLER',         'water',     'Stone bubbler fountain',     'Single-stone bubbler fountain with hidden basin and pump.',
        'each', 320000, 0, 42.00, true),

    -- ── Outdoor kitchens ────────────────────────────────────────────────────
    ('KITCHEN_BBQ_ISLAND_8',  'kitchen',   'Outdoor kitchen island 8 ft','8 ft masonry island with stucco veneer, granite top, built-in gas BBQ, side burner, storage.',
        'each', 1800000, 0, 40.00, true),
    ('KITCHEN_BBQ_ISLAND_12', 'kitchen',   'Outdoor kitchen island 12 ft','12 ft L-shaped kitchen with BBQ, side burner, fridge, sink, and granite top.',
        'each', 3200000, 0, 40.00, true),

    -- ── Retaining walls ─────────────────────────────────────────────────────
    ('WALL_BLOCK_PER_LF',     'wall',      'Block retaining wall',       'Allan Block or similar dry-stack retaining wall, height per spec.',
        'linear_ft', 14000, 200000, 40.00, true),
    ('WALL_NATURAL_STONE_LF', 'wall',      'Natural stone wall',         'Natural Arizona-stone veneer retaining wall.',
        'linear_ft', 28000, 250000, 40.00, true),

    -- ── Turf & sod ──────────────────────────────────────────────────────────
    ('TURF_ARTIFICIAL',       'turf',      'Artificial turf install',    'Premium 60oz artificial turf with base prep and infill.',
        'sqft', 1400, 250000, 42.00, true),
    ('TURF_REMOVAL',          'turf',      'Existing turf removal',      'Demolition and haul-away of existing turf.',
        'sqft', 250, 75000, 30.00, true),
    ('SOD_BERMUDA',           'turf',      'Bermuda sod install',        'Hybrid bermuda sod with soil prep.',
        'sqft', 350, 60000, 35.00, true),

    -- ── Irrigation ──────────────────────────────────────────────────────────
    ('IRRIGATION_ZONE',       'irrigation','Irrigation zone install',    'New irrigation zone: valve, piping, heads, controller wiring.',
        'each', 95000, 0, 35.00, true),
    ('IRRIGATION_DRIP',       'irrigation','Drip irrigation zone',       'Drip irrigation for planting beds, per zone.',
        'each', 65000, 0, 35.00, true),
    ('IRRIGATION_REPAIR',     'irrigation','Irrigation repair',          'Diagnose and repair existing irrigation issues.',
        'job',  35000, 0, 30.00, true),

    -- ── Lighting ────────────────────────────────────────────────────────────
    ('LIGHT_LOW_VOLT_FIXTURE','lighting',  'Low-voltage landscape fixture','Path light or uplight, brass or composite, including wiring.',
        'each', 22000, 0, 38.00, true),
    ('LIGHT_TRANSFORMER',     'lighting',  'Lighting transformer + run', '300W transformer with timer and 100ft trunk run.',
        'each', 85000, 0, 38.00, true),

    -- ── Planting & soft landscape ───────────────────────────────────────────
    ('PLANTING_BED_SQFT',     'planting',  'Planting bed install',       'Designed planting bed: soil amendment, drip, mulch, and plants.',
        'sqft', 1800, 150000, 40.00, true),
    ('MULCH_INSTALL',         'planting',  'Mulch install',              'Premium hardwood mulch, 3" depth.',
        'sqft', 250, 50000, 32.00, true),
    ('DECOMP_GRANITE',        'planting',  'Decomposed granite',         '1/4 minus decomposed granite, 3" depth, compacted.',
        'sqft', 350, 75000, 32.00, true),

    -- ── Site prep & misc ────────────────────────────────────────────────────
    ('DEMO_HARDSCAPE',        'sitework',  'Hardscape demolition',       'Demo and haul-away of existing concrete/pavers.',
        'sqft', 600, 100000, 30.00, true),
    ('GRADING',               'sitework',  'Grading and leveling',       'Rough grading and leveling of yard areas.',
        'sqft', 200, 100000, 28.00, true),
    ('HOA_SUBMISSION_PACK',   'admin',     'HOA submission package',     'HOA documentation package: site plan, elevations, material specs.',
        'job', 35000, 0, 60.00, true),
    ('PERMIT_PULL_STANDARD',  'admin',     'Standard permit pull',       'City of Phoenix or surrounding municipality permit pull and revisions.',
        'job', 75000, 0, 40.00, true)

on conflict (sku_id) do update set
    name = excluded.name,
    description = excluded.description,
    unit = excluded.unit,
    unit_price_cents = excluded.unit_price_cents,
    min_charge_cents = excluded.min_charge_cents,
    margin_pct = excluded.margin_pct,
    category = excluded.category,
    active = excluded.active,
    updated_at = now();
