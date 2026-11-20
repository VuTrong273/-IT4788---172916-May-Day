-- Each authenticated account can read its own effective grants.
-- Authentication and account checks remain enforced by SelfAccess/JwtAuthGuard.
INSERT INTO api_endpoints (name, method, path, is_public)
VALUES ('Read own effective permissions', 'GET', '/api/v1/auth/access', 0)
ON CONFLICT (method, path) DO NOTHING;
