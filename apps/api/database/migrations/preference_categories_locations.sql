CREATE TABLE preference_categories (
    user_id UUID NOT NULL
        REFERENCES preferences(user_id) ON DELETE CASCADE,
    category_id UUID NOT NULL
        REFERENCES property_categories(id) ON DELETE RESTRICT,
    PRIMARY KEY (user_id, category_id)
);

CREATE TABLE preference_locations (
    user_id UUID NOT NULL
        REFERENCES preferences(user_id) ON DELETE CASCADE,
    location_id UUID NOT NULL
        REFERENCES property_locations(id) ON DELETE RESTRICT,
    PRIMARY KEY (user_id, location_id)
);

BEGIN;

-- 1. Add missing categories from existing buyer preferences.
INSERT INTO property_categories (name)
SELECT DISTINCT BTRIM(pref_type.value)
FROM preferences p
CROSS JOIN LATERAL UNNEST(p.property_types) AS pref_type(value)
WHERE BTRIM(pref_type.value) <> ''
  AND NOT EXISTS (
    SELECT 1
    FROM property_categories pc
    WHERE LOWER(BTRIM(pc.name)) = LOWER(BTRIM(pref_type.value))
  )
ON CONFLICT DO NOTHING;


-- 2. Add missing locations from existing buyer preferences.
INSERT INTO property_locations (name)
SELECT DISTINCT BTRIM(pref_location.value)
FROM preferences p
CROSS JOIN LATERAL UNNEST(p.locations) AS pref_location(value)
WHERE BTRIM(pref_location.value) <> ''
  AND NOT EXISTS (
    SELECT 1
    FROM property_locations pl
    WHERE LOWER(BTRIM(pl.name)) = LOWER(BTRIM(pref_location.value))
  )
ON CONFLICT DO NOTHING;


-- 3. Link buyers to their preferred categories.
INSERT INTO preference_categories (user_id, category_id)
SELECT DISTINCT p.user_id, pc.id
FROM preferences p
CROSS JOIN LATERAL UNNEST(p.property_types) AS pref_type(value)
JOIN property_categories pc
  ON LOWER(BTRIM(pc.name)) = LOWER(BTRIM(pref_type.value))
WHERE BTRIM(pref_type.value) <> ''
ON CONFLICT DO NOTHING;


-- 4. Link buyers to their preferred locations.
INSERT INTO preference_locations (user_id, location_id)
SELECT DISTINCT p.user_id, pl.id
FROM preferences p
CROSS JOIN LATERAL UNNEST(p.locations) AS pref_location(value)
JOIN property_locations pl
  ON LOWER(BTRIM(pl.name)) = LOWER(BTRIM(pref_location.value))
WHERE BTRIM(pref_location.value) <> ''
ON CONFLICT DO NOTHING;


COMMIT;