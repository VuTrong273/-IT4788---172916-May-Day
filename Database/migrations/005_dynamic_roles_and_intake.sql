-- Add configuration without changing accounts or clinical history.
BEGIN;
ALTER TABLE roles ADD COLUMN IF NOT EXISTS actor_type VARCHAR(10)
  CHECK (actor_type IN ('admin','doctor'));
CREATE OR REPLACE FUNCTION base_role(selected_role INTEGER) RETURNS TEXT
LANGUAGE SQL STABLE AS $$
  WITH RECURSIVE ancestors AS (
    SELECT role_id, name, actor_type, parent_role_id, 0 AS depth, ARRAY[role_id] AS path
    FROM roles WHERE role_id = selected_role
    UNION ALL
    SELECT r.role_id,r.name,r.actor_type,r.parent_role_id,a.depth+1,a.path || r.role_id
    FROM roles r JOIN ancestors a ON r.role_id=a.parent_role_id
    WHERE NOT r.role_id=ANY(a.path)
  )
  SELECT CASE WHEN name IN ('admin','doctor','patient') THEN name ELSE actor_type END
  FROM ancestors WHERE name IN ('admin','doctor','patient') OR actor_type IS NOT NULL
  ORDER BY depth LIMIT 1
$$;

DO $$
BEGIN
  IF NOT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=current_schema() AND table_name='templates' AND column_name='intake_duration') THEN
    ALTER TABLE templates ADD COLUMN intake_duration VARCHAR(5) CHECK (intake_duration IN ('lt6w','gte6w'));
    UPDATE templates SET intake_duration='lt6w' WHERE code_template='TPL_ACUTE_V1';
    UPDATE templates SET intake_duration='gte6w' WHERE code_template='TPL_CHRONIC_V1';
  END IF;
END $$;
CREATE UNIQUE INDEX IF NOT EXISTS uq_templates_active_intake_duration
  ON templates(intake_duration) WHERE is_active=1 AND intake_duration IS NOT NULL;
COMMIT;
