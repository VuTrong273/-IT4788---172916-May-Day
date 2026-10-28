BEGIN;
INSERT INTO api_endpoints (name,method,path,description,is_public)
VALUES ('getImageContent','GET','/api/v1/image-attachments/:id/content','Read private image after record ownership checks',0)
ON CONFLICT (method,path) DO UPDATE SET is_public=0;
INSERT INTO permissions_endpoints (permission_id,endpoint_id)
SELECT p.permission_id,e.endpoint_id FROM permissions p CROSS JOIN api_endpoints e
WHERE p.name='media.read' AND e.method='GET' AND e.path='/api/v1/image-attachments/:id/content'
ON CONFLICT DO NOTHING;
COMMIT;
