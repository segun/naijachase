-- MySQL 8+: export the 35 venue archetypes currently stored in `venues`.
-- `experience_json` is the imported venue-experiences.csv row represented as
-- a JSON array. Run with --batch --skip-column-names --raw and redirect stdout.
SELECT JSON_PRETTY(
  JSON_OBJECT(
    'schema_version', 1,
    'renderer', 'babylon_procedural_v1',
    'venue_archetypes', JSON_ARRAYAGG(
      JSON_OBJECT(
        'venue_id', venue_id,
        'venue_name', venue_name,
        'opens_hour', opens_hour,
        'closes_hour', closes_hour,
        'interview_minutes', interview_minutes,
        'witness_roles', witness_roles,
        'arrival_day', JSON_UNQUOTE(JSON_EXTRACT(experience_json, '$[1]')),
        'arrival_night', JSON_UNQUOTE(JSON_EXTRACT(experience_json, '$[2]')),
        'arrival_weekend', JSON_UNQUOTE(JSON_EXTRACT(experience_json, '$[3]')),
        'arrival_event_day', JSON_UNQUOTE(JSON_EXTRACT(experience_json, '$[4]')),
        'intro_1', JSON_UNQUOTE(JSON_EXTRACT(experience_json, '$[5]')),
        'intro_2', JSON_UNQUOTE(JSON_EXTRACT(experience_json, '$[6]')),
        'intro_3', JSON_UNQUOTE(JSON_EXTRACT(experience_json, '$[7]')),
        'wait_event', JSON_UNQUOTE(JSON_EXTRACT(experience_json, '$[8]')),
        'investigation_event', JSON_UNQUOTE(JSON_EXTRACT(experience_json, '$[9]')),
        'event_minutes', CAST(JSON_UNQUOTE(JSON_EXTRACT(experience_json, '$[10]')) AS UNSIGNED)
      )
    )
  )
)
FROM (
  SELECT * FROM venues ORDER BY venue_id
) AS ordered_venues;

-- Location-specific placements are canonical in
-- data/gameplay/location-venue-map.csv and are included by `make
-- export-witness-scenes`. They are not currently projected into their own
-- normalized MySQL table, so a database-only query cannot include them.
