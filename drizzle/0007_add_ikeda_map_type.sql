-- Add the ikeda map type to both configuration table constraints
-- (ikeda is positioned after lozi to match VALID_MAP_TYPES order)

-- Update saved_configurations constraint with all 13 map types
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
    'logistic',
    'newton',
    'standard',
    'bifurcation-logistic',
    'bifurcation-henon',
    'chaos-esthetique',
    'lyapunov',
    'chua'
));

-- Update shared_configurations constraint with all 13 map types
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
    'logistic',
    'newton',
    'standard',
    'bifurcation-logistic',
    'bifurcation-henon',
    'chaos-esthetique',
    'lyapunov',
    'chua'
));
