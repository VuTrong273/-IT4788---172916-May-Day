import {
  authorize,
  imageType,
  score,
  timestamp,
  type ImageUpload,
} from './lesions.validation.js';
const record = {
  medical_record_id: 1,
  patient_id: 15,
  assigned_doctor_id: 8,
  status: 'in_progress',
};
describe('Lesion ownership and validation', () => {
  it('allows only the owning patient and assigned doctor', () => {
    expect(authorize(record, 15, 'patient', false)).toEqual(record);
    expect(authorize(record, 8, 'doctor', false)).toEqual(record);
    expect(() => authorize(record, 16, 'patient', false)).toThrow(
      expect.objectContaining({
        status: 403,
        response: expect.objectContaining({ code: '3106' }),
      }),
    );
    expect(() => authorize(record, 9, 'doctor', false)).toThrow(
      expect.objectContaining({
        status: 403,
        response: expect.objectContaining({ code: '3105' }),
      }),
    );
  });
  it('keeps completed data readable and rejects writes', () => {
    const completed = { ...record, status: 'completed' };
    expect(authorize(completed, 8, 'doctor', false)).toEqual(completed);
    expect(() => authorize(completed, 15, 'patient', true)).toThrow(
      expect.objectContaining({ status: 409 }),
    );
  });
  it('rejects missing records and unknown roles', () => {
    expect(() => authorize(undefined, 15, 'patient', false)).toThrow(
      expect.objectContaining({ status: 404 }),
    );
    expect(() => authorize(record, 15, 'unknown', false)).toThrow(
      expect.objectContaining({ status: 403 }),
    );
  });
  it.each([-1, 11, 1.5, '2', NaN])(
    'rejects invalid symptom score %s',
    (value) => expect(() => score(value)).toThrow(),
  );
  it('preserves zero separately from missing scores', () => {
    expect(score(0)).toBe(0);
    expect(score(undefined)).toBeNull();
  });
  it.each(['bad', '2026-02-30T12:00:00Z', '2026-13-01T12:00:00Z'])(
    'rejects invalid timestamp %s',
    (value) => expect(() => timestamp(value)).toThrow(),
  );
  it('checks file bytes instead of trusting the MIME label', () => {
    const file: ImageUpload = {
      buffer: Buffer.from('<script>bad</script>'),
      mimetype: 'image/png',
      originalname: 'photo.png',
      size: 20,
    };
    expect(() => imageType(file)).toThrow(
      expect.objectContaining({
        response: expect.objectContaining({ code: '6002' }),
      }),
    );
    file.buffer = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
    expect(imageType(file)).toBe('image/png');
    file.mimetype = 'image/jpeg';
    expect(() => imageType(file)).toThrow();
  });
  it('rejects oversized and missing files', () => {
    expect(() => imageType(undefined)).toThrow(
      expect.objectContaining({
        response: expect.objectContaining({ code: '6001' }),
      }),
    );
    expect(() =>
      imageType({
        buffer: Buffer.alloc(5 * 1024 * 1024 + 1),
        mimetype: 'image/png',
        originalname: 'big.png',
        size: 1,
      }),
    ).toThrow(expect.objectContaining({ status: 413 }));
  });
});
