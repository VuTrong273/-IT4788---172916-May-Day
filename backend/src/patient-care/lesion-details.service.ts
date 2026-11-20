import { Injectable } from '@nestjs/common';
import type pg from 'pg';
import type { AuthenticatedUser } from '../auth/jwt-auth.guard.js';
import { DatabaseService, fail, success } from '../common/database.service.js';
import { id, object, text } from '../common/validation.js';
import { PatientAccessService, stringNumbers } from './access.service.js';
import { ImagesService } from './images.service.js';

function timestamp(value: unknown) {
  if (value === null) return null;
  if (
    typeof value !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}T/.test(value) ||
    !Number.isFinite(Date.parse(value))
  )
    fail('2006', 'Invalid timestamp');
  return new Date(value).toISOString();
}

function locationFields(body: unknown, creating: boolean) {
  const input = object(body);
  const allowed = [
    'body_part',
    'occurred_at',
    'context_tags',
    'context_other',
    'medication_name',
    'medication_taken_ago',
    'medication_unit',
    ...(creating ? ['episode_id'] : []),
  ];
  const values: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (!allowed.includes(key)) fail('2003', `Unknown field: ${key}`);
    if (key === 'episode_id') continue;
    if (value === null && key !== 'body_part') {
      values[key] = null;
      continue;
    }
    if (key === 'occurred_at') values[key] = timestamp(value);
    else if (key === 'context_tags') {
      let tags: unknown;
      try {
        tags = typeof value === 'string' ? JSON.parse(value) : value;
      } catch {
        fail('7005', 'Invalid context tags');
      }
      if (
        !Array.isArray(tags) ||
        tags.length > 50 ||
        tags.some((tag) => typeof tag !== 'string' || tag.length > 100)
      )
        fail('7005', 'Invalid context tags');
      values[key] = JSON.stringify(tags);
    } else if (key === 'medication_taken_ago') {
      if (
        (typeof value !== 'string' && typeof value !== 'number') ||
        !/^\d+(\.\d{1,2})?$/.test(String(value)) ||
        Number(value) > 999999.99
      )
        fail('2003', 'Invalid medication interval');
      values[key] = Number(value);
    } else if (key === 'medication_unit') {
      if (
        typeof value !== 'string' ||
        !['minute', 'hour', 'day'].includes(value)
      )
        fail('2003', 'Invalid medication unit');
      values[key] = value;
    } else
      values[key] = text(
        value,
        key === 'body_part' ? 100 : key === 'context_other' ? 500 : 255,
      );
  }
  if (creating && !values.body_part) fail('7005', 'Body part is required');
  if (!Object.keys(values).length) fail('2001', 'No changes supplied');
  return { input, values };
}

function photoFields(body: unknown, creating: boolean) {
  const input = object(body);
  const allowed = [
    'milestone',
    'itch_score',
    'pain_score',
    'burn_score',
    'hives_count',
    'local_auas',
    ...(creating
      ? [
          'episode_id',
          'location_id',
          'attachment_id',
          'taken_at',
          'annotated_url',
        ]
      : []),
  ];
  const values: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (!allowed.includes(key)) fail('2003', `Unknown field: ${key}`);
    if (['episode_id', 'location_id', 'attachment_id'].includes(key)) continue;
    if (key === 'milestone') {
      if (
        typeof value !== 'string' ||
        !['start', 'peak', 'normal'].includes(value)
      )
        fail('7006', 'Invalid milestone');
      values[key] = value;
    } else if (key === 'taken_at') values[key] = timestamp(value);
    else if (key === 'annotated_url') {
      if (value !== null && value !== '')
        fail('2003', 'Image annotation is outside the project scope');
    } else if (value === null) values[key] = null;
    else {
      if (
        (typeof value !== 'number' && typeof value !== 'string') ||
        !/^\d+(\.\d{1,2})?$/.test(String(value))
      )
        fail('7007', 'Invalid symptom score');
      const number = Number(value);
      const maximum =
        key === 'local_auas'
          ? 9999.99
          : key === 'hives_count'
            ? 2147483647
            : 10;
      if (
        number > maximum ||
        (key !== 'local_auas' && !Number.isSafeInteger(number))
      )
        fail('7007', 'Symptom score is out of range');
      values[key] = number;
    }
  }
  if (creating && !values.milestone) fail('7006', 'Milestone is required');
  if (!Object.keys(values).length) fail('2001', 'No changes supplied');
  return { input, values };
}

@Injectable()
export class LesionDetailsService {
  constructor(
    private readonly db: DatabaseService,
    private readonly access: PatientAccessService,
    private readonly images: ImagesService,
  ) {}

  private async episode(
    tx: pg.PoolClient,
    user: AuthenticatedUser,
    rawId: unknown,
    write: boolean,
  ) {
    const row = (
      await tx.query('SELECT * FROM lesion_episodes WHERE episode_id=$1', [
        id(rawId),
      ])
    ).rows[0];
    if (!row) fail('7001', 'Lesion episode not found', 404);
    const { role } = write
      ? await this.access.monitoringRecord(tx, user, row.medical_record_id)
      : await this.access.record(tx, user, row.medical_record_id);
    if (write && (role !== 'patient' || row.patient_id !== user.userId))
      fail('3106', 'Only the patient owner can edit monitoring data', 403);
    return row;
  }

  private async location(
    tx: pg.PoolClient,
    user: AuthenticatedUser,
    rawId: unknown,
    write: boolean,
  ) {
    const row = (
      await tx.query('SELECT * FROM lesion_locations WHERE location_id=$1', [
        id(rawId),
      ])
    ).rows[0];
    if (!row) fail('7002', 'Lesion location not found', 404);
    await this.episode(tx, user, row.episode_id, write);
    return row;
  }

  private presentLocation(row: Record<string, unknown>) {
    return stringNumbers({
      ...row,
      context_tags:
        row.context_tags == null ? null : JSON.stringify(row.context_tags),
    });
  }

  createLocation(user: AuthenticatedUser, body: unknown) {
    const { input, values } = locationFields(body, true);
    return this.db.transaction(async (tx) => {
      const episode = await this.episode(tx, user, input.episode_id, true);
      const keys = Object.keys(values);
      const row = (
        await tx.query(
          `INSERT INTO lesion_locations(episode_id,${keys.join(',')}) VALUES($1,${keys.map((_, i) => `$${i + 2}`).join(',')}) RETURNING *`,
          [episode.episode_id, ...Object.values(values)],
        )
      ).rows[0];
      return success(this.presentLocation(row), true);
    });
  }

  listLocations(user: AuthenticatedUser, episodeId: unknown) {
    return this.db.transaction(async (tx) => {
      const episode = await this.episode(tx, user, episodeId, false);
      const rows = (
        await tx.query(
          'SELECT * FROM lesion_locations WHERE episode_id=$1 ORDER BY COALESCE(occurred_at,created_at),location_id',
          [episode.episode_id],
        )
      ).rows;
      return success(rows.map((row) => this.presentLocation(row)));
    });
  }

  changeLocation(user: AuthenticatedUser, locationId: unknown, body?: unknown) {
    const changes =
      body === undefined ? undefined : locationFields(body, false).values;
    return this.db.transaction(async (tx) => {
      const location = await this.location(tx, user, locationId, true);
      if (!changes) {
        await tx.query('DELETE FROM lesion_locations WHERE location_id=$1', [
          location.location_id,
        ]);
        return success({});
      }
      const row = (
        await tx.query(
          `UPDATE lesion_locations SET ${Object.keys(changes)
            .map((key, i) => `${key}=$${i + 2}`)
            .join(',')} WHERE location_id=$1 RETURNING *`,
          [location.location_id, ...Object.values(changes)],
        )
      ).rows[0];
      if (!row) fail('7002', 'Lesion location not found', 404);
      return success(this.presentLocation(row));
    });
  }

  private presentPhoto(row: Record<string, unknown>, origin: string) {
    const { attachment, ...photo } = row;
    return {
      ...stringNumbers(photo, [
        'itch_score',
        'pain_score',
        'burn_score',
        'hives_count',
        'local_auas',
      ]),
      attachment: this.images.present(
        attachment as Record<string, unknown>,
        origin,
      ),
    };
  }

  createPhoto(user: AuthenticatedUser, body: unknown, origin: string) {
    const { input, values } = photoFields(body, true);
    return this.db.transaction(async (tx) => {
      const episode = await this.episode(tx, user, input.episode_id, true);
      const location =
        input.location_id == null
          ? null
          : await this.location(tx, user, input.location_id, true);
      if (location && location.episode_id !== episode.episode_id)
        fail('7002', 'Location does not belong to this episode', 400);
      const attachment = (
        await tx.query(
          'SELECT * FROM media_attachments WHERE attachment_id=$1 FOR UPDATE',
          [id(input.attachment_id)],
        )
      ).rows[0];
      if (!attachment) fail('6005', 'Attachment not found', 404);
      if (
        attachment.user_id !== user.userId ||
        attachment.question_id !== null ||
        (attachment.medical_record_id !== null &&
          attachment.medical_record_id !== episode.medical_record_id)
      )
        fail('3106', 'Attachment cannot be linked to this episode', 403);
      if (
        (
          await tx.query('SELECT 1 FROM lesion_photos WHERE attachment_id=$1', [
            attachment.attachment_id,
          ])
        ).rowCount
      )
        fail('2009', 'Image already linked to a lesion photo', 409);
      await tx.query(
        'UPDATE media_attachments SET medical_record_id=$2 WHERE attachment_id=$1',
        [attachment.attachment_id, episode.medical_record_id],
      );
      attachment.medical_record_id = episode.medical_record_id;
      const keys = Object.keys(values);
      const row = (
        await tx.query(
          `INSERT INTO lesion_photos(episode_id,location_id,attachment_id,${keys.join(',')}) VALUES($1,$2,$3,${keys.map((_, i) => `$${i + 4}`).join(',')}) RETURNING *`,
          [
            episode.episode_id,
            location?.location_id ?? null,
            attachment.attachment_id,
            ...Object.values(values),
          ],
        )
      ).rows[0];
      return success(this.presentPhoto({ ...row, attachment }, origin), true);
    });
  }

  listPhotos(
    user: AuthenticatedUser,
    parentId: unknown,
    byLocation: boolean,
    origin: string,
  ) {
    return this.db.transaction(async (tx) => {
      const parent = byLocation
        ? await this.location(tx, user, parentId, false)
        : await this.episode(tx, user, parentId, false);
      const column = byLocation ? 'location_id' : 'episode_id';
      const rows = (
        await tx.query(
          `SELECT p.*,to_jsonb(a) AS attachment FROM lesion_photos p JOIN media_attachments a USING(attachment_id) WHERE p.${column}=$1 ORDER BY COALESCE(p.taken_at,p.created_at),p.photo_id`,
          [parent[column]],
        )
      ).rows;
      return success(rows.map((row) => this.presentPhoto(row, origin)));
    });
  }

  changePhoto(
    user: AuthenticatedUser,
    photoId: unknown,
    origin: string,
    body?: unknown,
  ) {
    const changes =
      body === undefined ? undefined : photoFields(body, false).values;
    return this.db.transaction(async (tx) => {
      const row = (
        await tx.query('SELECT * FROM lesion_photos WHERE photo_id=$1', [
          id(photoId),
        ])
      ).rows[0];
      if (!row) fail('7003', 'Lesion photo not found', 404);
      await this.episode(tx, user, row.episode_id, true);
      if (!changes) {
        await tx.query('DELETE FROM lesion_photos WHERE photo_id=$1', [
          row.photo_id,
        ]);
        return success({});
      }
      const updated = (
        await tx.query(
          `UPDATE lesion_photos SET ${Object.keys(changes)
            .map((key, i) => `${key}=$${i + 2}`)
            .join(',')} WHERE photo_id=$1 RETURNING *`,
          [row.photo_id, ...Object.values(changes)],
        )
      ).rows[0];
      if (!updated) fail('7003', 'Lesion photo not found', 404);
      const attachment = (
        await tx.query(
          'SELECT * FROM media_attachments WHERE attachment_id=$1',
          [row.attachment_id],
        )
      ).rows[0];
      return success(this.presentPhoto({ ...updated, attachment }, origin));
    });
  }
}
