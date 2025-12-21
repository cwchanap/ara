-- Add rossler map type to saved_configurations constraint
ALTER TABLE "saved_configurations"
DROP CONSTRAINT IF EXISTS "check_valid_map_type";

ALTER TABLE "saved_configurations"
ADD CONSTRAINT "check_valid_map_type"
CHECK ("map_type" IN (
    'lorenz',
    'rossler',
    'henon',
    'logistic',
    'newton',
    'standard',
    'bifurcation-logistic',
    'bifurcation-henon',
    'chaos-esthetique'
));
