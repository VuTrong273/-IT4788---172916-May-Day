import type { AuthenticatedUser } from '../auth/jwt-auth.guard.js';
import { TemplatesRepository } from './templates.repository.js';
import { TemplatesService } from './templates.service.js';

const admin: AuthenticatedUser = { userId: 1, roleId: 1, jti: 'test', expiresAt: 0 };

describe('TemplatesService', () => {
  const roleName = vi.fn();
  const create = vi.fn();
  const list = vi.fn();
  let service: TemplatesService;

  beforeEach(() => {
    vi.resetAllMocks();
    roleName.mockResolvedValue('admin');
    service = new TemplatesService({ roleName, create, list } as unknown as TemplatesRepository);
  });

  it('creates an active template with the current admin as creator', async () => {
    create.mockResolvedValue({ code_template: 'TPL_TEST', name: 'Phiếu thử' });
    await service.create(admin, { code_template: 'TPL_TEST', name: 'Phiếu thử' });
    expect(create).toHaveBeenCalledWith({ code: 'TPL_TEST', name: 'Phiếu thử', description: null,
      version: '1.0', active: '1', userId: 1 });
  });

  it('rejects template creation by a non-admin', async () => {
    roleName.mockResolvedValue('patient');
    await expect(service.create({ ...admin, roleId: 3 }, { code_template: 'TPL_TEST', name: 'Phiếu thử' }))
      .rejects.toMatchObject({ status: 403, response: { code: '3102' } });
    expect(create).not.toHaveBeenCalled();
  });

  it('maps a duplicate template code to 4102', async () => {
    create.mockRejectedValue({ code: '23505' });
    await expect(service.create(admin, { code_template: 'TPL_TEST', name: 'Phiếu thử' }))
      .rejects.toMatchObject({ status: 409, response: { code: '4102' } });
  });
});
