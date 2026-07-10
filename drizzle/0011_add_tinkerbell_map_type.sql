-- Add the tinkerbell map type to both configuration table constraints
-- (positioned after clifford to match VALID_MAP_TYPES order)
-- Wrapped in a transaction so a mid-migration failure leaves no partial state.

BEGIN;

-- Update saved_configurations constraint with all 17 map types
ALTER TABLE "saved_configurations"
DROP CONSTRAINT IF EXISTS "check_valid_map_type";

ALTER TABLE "saved_configurations"
ADD CONSTRAINT "check_valid_map_type"
CHECK ("map_type" IN (
    'lorenz',
    'rossler',
    'henon',
    'lozi',
    'ikeda',
    'clifford',
    'tinkerbell',
    'logistic',
    'newton',
    'standard',
    'bifurcation-logistic',
    'bifurcation-henon',
    'chaos-esthetique',
    'gumowski-mira',
    'lyapunov',
    'chua',
    'double-pendulum'
));

-- Update shared_configurations constraint with all 17 map types
ALTER TABLE "shared_configurations"
DROP CONSTRAINT IF EXISTS "chk_shared_configurations_map_type";

ALTER TABLE "shared_configurations"
ADD CONSTRAINT "chk_shared_configurations_map_type"
CHECK ("map_type" IN (
    'lorenz',
    'rossler',
    'henon',
    'lozi',
    'ikeda',
    'clifford',
    'tinkerbell',
    'logistic',
    'newton',
    'standard',
    'bifurcation-logistic',
    'bifurcation-henon',
    'chaos-esthetique',
    'gumowski-mira',
    'lyapunov',
    'chua',
    'double-pendulum'
));

COMMIT;
