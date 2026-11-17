import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
} from '@nestjs/common';
import { DatabaseService, fail, success } from '../common/database.service.js';
import { array, id, object } from '../common/validation.js';

@Controller('api/v1')
export class AccessController {
  constructor(private readonly db: DatabaseService) {}

  private async assign(kind: 'role' | 'permission', body: unknown) {
    const b = object(body);
    const role = kind === 'role';
    const parent = id(b[role ? 'role_id' : 'permission_id']);
    const children = [
      ...new Set(
        array(b[role ? 'permissions' : 'endpoints']).map((value) => id(value)),
      ),
    ];
    return this.db.transaction(async (tx) => {
      const table = role ? 'role_permissions' : 'permissions_endpoints';
      const parentColumn = role ? 'role_id' : 'permission_id';
      const childColumn = role ? 'permission_id' : 'endpoint_id';
      await tx.query(
        `INSERT INTO ${table} (${parentColumn}, ${childColumn}) SELECT $1, unnest($2::int[]) ON CONFLICT (${parentColumn}, ${childColumn}) DO NOTHING`,
        [parent, children],
      );
      return success({});
    });
  }

  @Post('role_permissions')
  @HttpCode(200)
  assignRole(@Body() body: unknown) {
    return this.assign('role', body);
  }
  @Post('permission_endpoints')
  @HttpCode(200)
  assignPermission(@Body() body: unknown) {
    return this.assign('permission', body);
  }

  @Get('role_permissions/role/:role_id')
  rolePermissions(@Param('role_id') roleId: string) {
    const value = id(roleId);
    return this.db.transaction(async (tx) => {
      const parent = await tx.query('SELECT 1 FROM roles WHERE role_id = $1', [
        value,
      ]);
      if (!parent.rowCount) fail('2008', 'Role not found', 404);
      return success(
        (
          await tx.query(
            'SELECT rp.role_permission_id, rp.permission_id, p.name, p.description, rp.assigned_at FROM role_permissions rp JOIN permissions p USING(permission_id) WHERE rp.role_id = $1 ORDER BY rp.permission_id',
            [value],
          )
        ).rows,
      );
    });
  }

  @Get('permission_endpoints/permission/:permission_id')
  permissionEndpoints(@Param('permission_id') permissionId: string) {
    const value = id(permissionId);
    return this.db.transaction(async (tx) => {
      const parent = await tx.query(
        'SELECT 1 FROM permissions WHERE permission_id = $1',
        [value],
      );
      if (!parent.rowCount) fail('2008', 'Permission not found', 404);
      return success(
        (
          await tx.query(
            'SELECT pe.permission_endpoint_id, e.endpoint_id, e.name, e.method, e.path, pe.assigned_at FROM permissions_endpoints pe JOIN api_endpoints e USING(endpoint_id) WHERE pe.permission_id = $1 ORDER BY e.endpoint_id',
            [value],
          )
        ).rows,
      );
    });
  }

  @Delete('role_permissions/role/:role_id/permission/:permission_id')
  revokeRole(
    @Param('role_id') roleId: string,
    @Param('permission_id') permissionId: string,
  ) {
    const parent = id(roleId),
      child = id(permissionId);
    return this.db.transaction(async (tx) => {
      const result = await tx.query(
        'DELETE FROM role_permissions WHERE role_id = $1 AND permission_id = $2 RETURNING role_permission_id',
        [parent, child],
      );
      if (!result.rowCount) fail('2008', 'Assignment not found', 404);
      return success({});
    });
  }

  @Delete(
    'permission_endpoints/permission/:permission_id/endpoint/:endpoint_id',
  )
  revokeEndpoint(
    @Param('permission_id') permissionId: string,
    @Param('endpoint_id') endpointId: string,
  ) {
    const parent = id(permissionId),
      child = id(endpointId);
    return this.db.transaction(async (tx) => {
      const result = await tx.query(
        'DELETE FROM permissions_endpoints WHERE permission_id = $1 AND endpoint_id = $2 RETURNING permission_endpoint_id',
        [parent, child],
      );
      if (!result.rowCount) fail('2008', 'Assignment not found', 404);
      return success({});
    });
  }
}
