import { int, str, type Fields } from '../common/validation.js';

export type CatalogConfig = {
  table: string;
  pk: string;
  fields: Fields;
  required: string[];
  filters?: string[];
  paginated?: boolean;
};
export const catalogs: Record<string, CatalogConfig> = {
  branches: {
    table: 'branches',
    pk: 'branch_id',
    fields: { name: str(150), address: str(255), phone: str(20) },
    required: ['name', 'address', 'phone'],
  },
  departments: {
    table: 'departments',
    pk: 'department_id',
    fields: { name: str(150), description: str(255, true), branch_id: int() },
    required: ['name', 'branch_id'],
    filters: ['branch_id'],
  },
  rooms: {
    table: 'rooms',
    pk: 'room_id',
    fields: {
      name: str(150),
      description: str(255, true),
      department_id: int(),
    },
    required: ['name', 'department_id'],
    filters: ['department_id'],
  },
  roles: {
    table: 'roles',
    pk: 'role_id',
    fields: {
      name: str(50),
      description: str(255, true),
      parent_role_id: int(1, 2147483647, true),
      actor_type: { ...str(10, true), values: ['admin', 'doctor'] },
    },
    required: ['name'],
  },
  permissions: {
    table: 'permissions',
    pk: 'permission_id',
    fields: { name: str(100), description: str(255, true) },
    required: ['name'],
  },
  api_endpoints: {
    table: 'api_endpoints',
    pk: 'endpoint_id',
    fields: {
      name: str(100),
      method: { ...str(10), values: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] },
      path: str(255),
      description: str(255, true),
      is_public: int(0, 1),
    },
    required: ['name', 'method', 'path'],
    filters: ['method'],
    paginated: true,
  },
};
