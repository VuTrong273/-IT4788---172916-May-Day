import type { AuthenticatedUser } from '../auth/jwt-auth.guard.js';
import { TemplatesRepository } from './templates.repository.js';
import { TemplatesService } from './templates.service.js';

const admin: AuthenticatedUser = {
  userId: 1,
  roleId: 1,
  jti: 'test',
  expiresAt: 0,
};

describe('TemplatesService', () => {
  const roleName = vi.fn();
  const create = vi.fn();
  const list = vi.fn();
  const update = vi.fn();
  const remove = vi.fn();
  const getByCode = vi.fn();
  let service: TemplatesService;

  beforeEach(() => {
    vi.resetAllMocks();
    roleName.mockResolvedValue('admin');
    service = new TemplatesService({
      roleName,
      create,
      list,
      update,
      delete: remove,
      getByCode,
    } as unknown as TemplatesRepository);
  });

  it('creates an active template with the current admin as creator', async () => {
    create.mockResolvedValue({ code_template: 'TPL_TEST', name: 'Phiếu thử' });
    await service.create(admin, {
      code_template: 'TPL_TEST',
      name: 'Phiếu thử',
    });
    expect(create).toHaveBeenCalledWith({
      code: 'TPL_TEST',
      name: 'Phiếu thử',
      description: null,
      version: '1.0',
      active: '1',
      userId: 1,
    });
  });

  it('rejects template creation by a non-admin', async () => {
    roleName.mockResolvedValue('patient');
    await expect(
      service.create(
        { ...admin, roleId: 3 },
        { code_template: 'TPL_TEST', name: 'Phiếu thử' },
      ),
    ).rejects.toMatchObject({ status: 403, response: { code: '3102' } });
    expect(create).not.toHaveBeenCalled();
  });

  it('maps a duplicate template code to 4102', async () => {
    create.mockRejectedValue({ code: '23505' });
    await expect(
      service.create(admin, { code_template: 'TPL_TEST', name: 'Phiếu thử' }),
    ).rejects.toMatchObject({ status: 409, response: { code: '4102' } });
  });

  it('updates only supplied fields, preserving the template code', async () => {
    update.mockResolvedValue({ code_template: 'TPL_TEST', is_active: '0' });
    await expect(
      service.update(admin, 'TPL_TEST', { is_active: '0', name: ' Test ' }),
    ).resolves.toMatchObject({ code: '1000' });
    expect(update).toHaveBeenCalledWith('TPL_TEST', {
      is_active: '0',
      name: 'Test',
    });
  });

  it.each([
    {},
    null,
    [],
    { code_template: 'OTHER' },
    { name: ' ' },
    { version: 'x'.repeat(21) },
    { is_active: '2' },
  ])('rejects invalid update payload %j', async (body) => {
    await expect(service.update(admin, 'TPL_TEST', body)).rejects.toMatchObject(
      { status: 400 },
    );
    expect(update).not.toHaveBeenCalled();
  });

  it('rejects wrong field types', async () => {
    await expect(
      service.update(admin, 'TPL_TEST', { is_active: 1 }),
    ).rejects.toMatchObject({ response: { code: '2002' } });
  });

  it('denies non-admin updates and deletions', async () => {
    roleName.mockResolvedValue('doctor');
    await expect(
      service.update(admin, 'TPL_TEST', { name: 'Test' }),
    ).rejects.toMatchObject({ status: 403 });
    await expect(service.delete(admin, 'TPL_TEST')).rejects.toMatchObject({
      status: 403,
    });
    expect(update).not.toHaveBeenCalled();
    expect(remove).not.toHaveBeenCalled();
  });

  it('keeps missing templates as 404 for read, update and delete', async () => {
    getByCode.mockResolvedValue(null);
    update.mockResolvedValue(null);
    remove.mockResolvedValue(false);
    for (const result of [
      () => service.get('missing'),
      () => service.update(admin, 'missing', { name: 'Test' }),
      () => service.delete(admin, 'missing'),
    ]) {
      await expect(result()).rejects.toMatchObject({
        status: 404,
        response: { code: '4101' },
      });
    }
  });

  it('deletes an unused template', async () => {
    remove.mockResolvedValue(true);
    await expect(service.delete(admin, 'TPL_TEST')).resolves.toEqual({
      code: '1000',
      message: 'OK',
      data: {},
    });
  });

  it('reports a referenced template as a conflict', async () => {
    remove.mockRejectedValue({ code: '23503' });
    await expect(service.delete(admin, 'TPL_TEST')).rejects.toMatchObject({
      status: 409,
      response: { code: '4105' },
    });
  });

  it('maps database failures to 503', async () => {
    update.mockRejectedValue(new Error('offline'));
    remove.mockRejectedValue(new Error('offline'));
    await expect(
      service.update(admin, 'TPL_TEST', { name: 'Test' }),
    ).rejects.toMatchObject({ status: 503 });
    await expect(service.delete(admin, 'TPL_TEST')).rejects.toMatchObject({
      status: 503,
    });
  });
});
