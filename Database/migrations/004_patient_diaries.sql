BEGIN;
-- Retain existing links as optional references; deleting a visit must not delete a diary.
ALTER TABLE lesion_episodes ALTER COLUMN medical_record_id DROP NOT NULL;
ALTER TABLE lesion_episodes DROP CONSTRAINT IF EXISTS lesion_episodes_medical_record_id_fkey;
ALTER TABLE lesion_episodes ADD CONSTRAINT lesion_episodes_medical_record_id_fkey
  FOREIGN KEY (medical_record_id) REFERENCES medical_records(medical_record_id) ON DELETE SET NULL;
ALTER TABLE uas7_scores ALTER COLUMN medical_record_id DROP NOT NULL;
ALTER TABLE uas7_scores DROP CONSTRAINT IF EXISTS uas7_scores_medical_record_id_fkey;
ALTER TABLE uas7_scores ADD CONSTRAINT uas7_scores_medical_record_id_fkey
  FOREIGN KEY (medical_record_id) REFERENCES medical_records(medical_record_id) ON DELETE SET NULL;
INSERT INTO api_endpoints (name,method,path,description,is_public)
VALUES ('listPatientLesionEpisodes','GET','/api/v1/lesion-episodes/patient/:patient_id','Patient diary across visits; assigned doctors only',0)
ON CONFLICT (method,path) DO UPDATE SET is_public=0;
INSERT INTO permissions_endpoints (permission_id,endpoint_id)
SELECT p.permission_id,e.endpoint_id FROM permissions p CROSS JOIN api_endpoints e
WHERE p.name='lesion_episode.read_record' AND e.method='GET'
  AND e.path='/api/v1/lesion-episodes/patient/:patient_id'
ON CONFLICT DO NOTHING;
COMMIT;
