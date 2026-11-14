
BEGIN;

-- 1. Ensure existing values can safely become lookup names.
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM properties
        WHERE property_type IS NULL
           OR LENGTH(BTRIM(property_type)) = 0
           OR location IS NULL
           OR LENGTH(BTRIM(location)) = 0
    ) THEN
        RAISE EXCEPTION
            'Migration stopped: properties contain blank category or location values. Clean these records first.';
    END IF;
END $$;

-- 2. Create property categories.
CREATE TABLE property_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL ,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT property_categories_name_not_blank
        CHECK (LENGTH(BTRIM(name)) > 0)
);

-- 3. Create property locations.
CREATE TABLE property_locations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL ,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT property_locations_name_not_blank
        CHECK (LENGTH(BTRIM(name)) > 0)
);
CREATE UNIQUE INDEX property_categories_name_lower_idx
    ON property_categories (LOWER(name));

CREATE UNIQUE INDEX property_locations_name_lower_idx
    ON property_locations (LOWER(name));

-- 4. Copy existing distinct values into the lookup tables.
INSERT INTO property_categories (name)
SELECT DISTINCT ON (LOWER(BTRIM(property_type)))
       BTRIM(property_type)
FROM properties
ORDER BY LOWER(BTRIM(property_type)), BTRIM(property_type);

INSERT INTO property_locations (name)
SELECT DISTINCT ON (LOWER(BTRIM(location)))
       BTRIM(location)
FROM properties
ORDER BY LOWER(BTRIM(location)), BTRIM(location);

-- 5. Add nullable foreign-key columns first.
ALTER TABLE properties
    ADD COLUMN category_id UUID,
    ADD COLUMN location_id UUID;

-- 6. Backfill the new foreign keys.
UPDATE properties AS p
SET category_id = c.id
FROM property_categories AS c
WHERE LOWER(BTRIM(p.property_type)) = LOWER(c.name);

UPDATE properties AS p
SET location_id = l.id
FROM property_locations AS l
WHERE LOWER(BTRIM(p.location)) = LOWER(l.name);

-- 7. Verify every property was successfully mapped.
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM properties
        WHERE category_id IS NULL OR location_id IS NULL
    ) THEN
        RAISE EXCEPTION
            'Migration stopped: one or more properties could not be mapped.';
    END IF;
END $$;

-- 8. Enforce the new relationships.
ALTER TABLE properties
    ALTER COLUMN category_id SET NOT NULL,
    ALTER COLUMN location_id SET NOT NULL;

ALTER TABLE properties
    ADD CONSTRAINT properties_category_id_fkey
        FOREIGN KEY (category_id)
        REFERENCES property_categories(id)
        ON DELETE RESTRICT,
    ADD CONSTRAINT properties_location_id_fkey
        FOREIGN KEY (location_id)
        REFERENCES property_locations(id)
        ON DELETE RESTRICT;

-- 9. Index the new foreign-key columns.
CREATE INDEX properties_category_id_idx
    ON properties (category_id);

CREATE INDEX properties_location_id_idx
    ON properties (location_id);

COMMIT;
