-- Add lyapunov map type to saved_configurations table
-- This migration ensures the database supports the new Lyapunov Exponents module

-- No schema changes needed as map_type is already a text field
-- This migration is for documentation purposes to track the addition of 'lyapunov' as a valid map type

-- Example query to verify lyapunov configurations:
-- SELECT * FROM saved_configurations WHERE map_type = 'lyapunov';
