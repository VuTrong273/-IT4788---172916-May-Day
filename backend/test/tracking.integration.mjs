// Run after `npm run build`, with local PostgreSQL and MinIO running.
// Creates isolated fixtures and removes only those fixtures in finally.
import 'reflect-metadata';
import assert from 'node:assert/strict';
import { randomInt, randomUUID } from 'node:crypto';
import { loadEnvFile } from 'node:process';
import { LesionsRepository } from '../dist/lesions/lesions.repository.js';
import { LesionsService } from '../dist/lesions/lesions.service.js';
import { ObjectStorageService } from '../dist/lesions/object-storage.service.js';
import { Uas7Repository } from '../dist/uas7/uas7.repository.js';
import { Uas7Service } from '../dist/uas7/uas7.service.js';
import { MedicalRecordsRepository } from '../dist/medical-records/medical-records.repository.js';

loadEnvFile('.env');
if (process.argv.includes('--compose')) {
  const connection = new URL('postgresql://127.0.0.1');
  connection.port = process.env.POSTGRES_PORT || '5432';
  connection.username = process.env.POSTGRES_USER;
  connection.password = process.env.POSTGRES_PASSWORD;
  connection.pathname = process.env.POSTGRES_DB;
  process.env.DATABASE_URL = connection.toString();
}
const repo = new LesionsRepository();
const storage = new ObjectStorageService();
const lesions = new LesionsService(repo, storage);
const scoresRepo = new Uas7Repository();
const scores = new Uas7Service(scoresRepo);
const records = new MedicalRecordsRepository();
const template = `TEST_TRACKING_${randomUUID()}`;
const users = [];
let recordId;
let templateCreated = false;
try {
  for (const role of ['patient', 'doctor']) {
    const phone = `09${String(randomInt(0, 100000000)).padStart(8, '0')}`;
    const result = await repo.pool.query(
      `INSERT INTO users(full_name,phone,password_hash,role_id)
      SELECT $1,$2,'not-a-login-hash',role_id FROM roles WHERE name=$3 RETURNING user_id,role_id`,
      [template, phone, role],
    );
    assert.equal(result.rowCount, 1);
    users.push({
      userId: result.rows[0].user_id,
      roleId: result.rows[0].role_id,
      jti: 'integration-only',
      expiresAt: 0,
    });
  }
  const [patient, doctor] = users;
  await repo.pool.query('INSERT INTO patients(user_id) VALUES($1)', [
    patient.userId,
  ]);
  await repo.pool.query(
    'INSERT INTO templates(code_template,name) VALUES($1,$1)',
    [template],
  );
  templateCreated = true;
  assert.equal((await scores.eligibility(patient)).data.eligible, 'true');
  await scores.create(patient, { score_date: '2026-09-01', iss7: 1, hss7: 0 });
  const independentEpisode = (
    await lesions.createEpisode(patient, { name: 'Before first visit' })
  ).data;
  assert.equal(independentEpisode.medical_record_id, null);
  const record = await repo.pool.query(
    `INSERT INTO medical_records(patient_id,assigned_doctor_id,template_id,status) VALUES($1,$2,$3,'in_progress') RETURNING medical_record_id`,
    [patient.userId, doctor.userId, template],
  );
  recordId = record.rows[0].medical_record_id;
  const episode = (
    await lesions.createEpisode(patient, {
      medical_record_id: String(recordId),
      name: 'Integration episode',
      occurred_at: '2026-10-01T08:00:00Z',
      context_tags: '["test"]',
    })
  ).data;
  const location = (
    await lesions.createLocation(patient, {
      episode_id: episode.episode_id,
      body_part: 'Test arm',
    })
  ).data;
  const bytes = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jD1sAAAAASUVORK5CYII=',
    'base64',
  );
  const upload = (
    await lesions.upload(patient, {}, [
      {
        buffer: bytes,
        size: bytes.length,
        mimetype: 'image/png',
        originalname: 'integration.png',
      },
    ])
  ).data[0];
  await lesions.createPhoto(patient, {
    episode_id: episode.episode_id,
    location_id: location.location_id,
    attachment_id: upload.id,
    milestone: 'start',
    itch_score: 3,
    pain_score: 0,
    burn_score: 1,
    hives_count: 5,
    taken_at: '2026-10-01T08:05:00Z',
  });
  const photos = await lesions.photos(doctor, episode.episode_id);
  assert.equal(photos.data.length, 1);
  assert.equal(photos.data[0].body_part, 'Test arm');
  const stream = (await lesions.content(doctor, upload.id)).getStream();
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  assert.deepEqual(Buffer.concat(chunks), bytes);
  await assert.rejects(
    lesions.photos(
      { ...doctor, userId: doctor.userId + 1000000 },
      episode.episode_id,
    ),
    (error) => error.getStatus() === 403,
  );
  await scores.create(patient, {
    medical_record_id: String(recordId),
    score_date: '2026-10-01',
    iss7: 2,
    hss7: 1,
  });
  const week = (await scores.week(doctor, String(patient.userId), '2026-10-01'))
    .data;
  assert.equal(week.week_score, '3');
  assert.equal(week.completed_days, '1');
  await repo.pool.query(
    "UPDATE medical_records SET status='completed',completed_at=now() WHERE medical_record_id=$1",
    [recordId],
  );
  await lesions.createLocation(patient, {
    episode_id: episode.episode_id,
    body_part: 'After visit completion',
  });
  await scores.create(patient, { score_date: '2026-10-02', iss7: 1, hss7: 1 });
  assert.equal(
    (await lesions.patientEpisodes(doctor, String(patient.userId))).data.length,
    2,
  );
  await assert.rejects(
    lesions.patientEpisodes(
      { ...doctor, userId: doctor.userId + 1000000 },
      String(patient.userId),
    ),
    (error) => error.getStatus() === 403,
  );
  const completed = await records.list({
    doctorId: doctor.userId,
    status: 'completed',
    page: 1,
    limit: 20,
  });
  assert.equal(completed.data.length, 1);
  assert.equal(completed.data[0].medical_record_id, recordId);
  assert.equal(
    (await lesions.photos(doctor, episode.episode_id)).data.length,
    1,
  );
  await repo.pool.query(
    'DELETE FROM medical_records WHERE medical_record_id=$1',
    [recordId],
  );
  recordId = undefined;
  assert.equal((await lesions.episodes(patient)).data.length, 2);
  assert.equal(
    (await scores.history(patient, String(patient.userId))).data.length,
    3,
  );
  assert.equal(
    (await lesions.photos(patient, episode.episode_id)).data.length,
    1,
  );
  await assert.rejects(
    lesions.content(doctor, upload.id),
    (error) => error.getStatus() === 403,
  );
  console.log(
    'PASS: real PostgreSQL + MinIO upload/read, private access, UAS7, patient diaries before/after visits, retained history and doctor access revocation.',
  );
} finally {
  try {
    if (users.length) {
      const media = await repo.pool.query(
        'SELECT attachment_id,file_path FROM media_attachments WHERE user_id=ANY($1::int[])',
        [users.map((user) => user.userId)],
      );
      for (const image of media.rows) await storage.remove(image.file_path);
      await repo.pool.query(
        'DELETE FROM media_attachments WHERE user_id=ANY($1::int[])',
        [users.map((user) => user.userId)],
      );
    }
    if (recordId)
      await repo.pool.query(
        'DELETE FROM medical_records WHERE medical_record_id=$1',
        [recordId],
      );
    if (templateCreated)
      await repo.pool.query('DELETE FROM templates WHERE code_template=$1', [
        template,
      ]);
    if (users.length)
      await repo.pool.query('DELETE FROM users WHERE user_id=ANY($1::int[])', [
        users.map((user) => user.userId),
      ]);
  } finally {
    await Promise.all([
      repo.onModuleDestroy(),
      scoresRepo.onModuleDestroy(),
      records.onModuleDestroy(),
    ]);
  }
}
