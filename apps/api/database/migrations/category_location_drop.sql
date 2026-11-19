BEGIN;

ALTER TABLE properties
    DROP COLUMN property_type,
    DROP COLUMN location;

ALTER TABLE preferences
    DROP COLUMN property_types,
    DROP COLUMN locations;

COMMIT;