import {
  HttpException,
  Injectable,
  Logger,
  StreamableFile,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { AuthenticatedUser } from '../auth/jwt-auth.guard.js';
import { LesionsRepository } from './lesions.repository.js';
import { ObjectStorageService } from './object-storage.service.js';
import {
  body,
  fail,
  id,
  imageType,
  score,
  text,
  timestamp,
  type ImageUpload,
} from './lesions.validation.js';

const EPISODE_SELECT = `SELECT episode_id::text, medical_record_id::text, patient_id::text, name, occurred_at,
  context_tags::text, context_other, medication_name, medication_taken_ago::text, medication_unit, description, created_at, updated_at FROM lesion_episodes`;
const PHOTO_SELECT = `SELECT p.photo_id::text, p.episode_id::text, p.location_id::text, p.attachment_id::text,
  p.taken_at, p.milestone, p.itch_score, p.pain_score, p.burn_score, p.hives_count, p.local_auas, p.annotated_url, p.created_at, p.updated_at,
  json_build_object('attachment_id',p.attachment_id::text,'file_url','/image-attachments/' || p.attachment_id || '/content') AS attachment,
  l.body_part, '/image-attachments/' || p.attachment_id || '/content' AS file_url
  FROM lesion_photos p LEFT JOIN lesion_locations l ON l.location_id=p.location_id`;

@Injectable()
export class LesionsService {
  private readonly logger = new Logger(LesionsService.name);
  constructor(
    private readonly repo: LesionsRepository,
    private readonly storage: ObjectStorageService,
  ) {}
  private async patient(user: AuthenticatedUser) {
    if ((await this.repo.role(user)) !== 'patient')
      fail('3101', 'Patient role required', 403);
  }
  private async database<T>(action: () => Promise<T>) {
    try {
      return await action();
    } catch (error) {
      if (error instanceof HttpException) throw error;
      return fail('9902', 'Database error', 503);
    }
  }
  async episodes(user: AuthenticatedUser, recordId?: string) {
    return this.database(async () => {
      const data =
        recordId === undefined
          ? (
              await (async () => {
                await this.patient(user);
                return this.repo.pool.query(
                  `${EPISODE_SELECT} WHERE patient_id=$1 ORDER BY occurred_at DESC NULLS LAST, episode_id DESC`,
                  [user.userId],
                );
              })()
            ).rows
          : await this.repo.withRecord(
              user,
              id(recordId),
              false,
              async (client) =>
                (
                  await client.query(
                    `${EPISODE_SELECT} WHERE medical_record_id=$1 ORDER BY occurred_at DESC NULLS LAST, episode_id DESC`,
                    [id(recordId)],
                  )
                ).rows,
            );
      return { code: '1000', message: 'OK', data };
    });
  }
  async patientEpisodes(user: AuthenticatedUser, rawPatientId: string) {
    return this.database(async () => {
      const patientId = id(rawPatientId);
      const data = await this.repo.withPatient(
        user,
        patientId,
        false,
        async (client) =>
          (
            await client.query(
              `${EPISODE_SELECT} WHERE patient_id=$1 ORDER BY occurred_at DESC NULLS LAST, episode_id DESC`,
              [patientId],
            )
          ).rows,
      );
      return { code: '1000', message: 'OK', data };
    });
  }
  async createEpisode(user: AuthenticatedUser, raw: unknown) {
    return this.database(async () => {
      await this.patient(user);
      const input = body(raw);
      const recordId =
        input.medical_record_id == null ? null : id(input.medical_record_id);
      const name = text(input.name, 255, true);
      const occurred = timestamp(input.occurred_at);
      let tags: string | null = null;
      if (input.context_tags !== undefined && input.context_tags !== null) {
        if (typeof input.context_tags !== 'string')
          fail('7004', 'Invalid context tags');
        try {
          const parsed: unknown = JSON.parse(input.context_tags);
          if (
            !Array.isArray(parsed) ||
            parsed.length > 30 ||
            parsed.some((item) => typeof item !== 'string' || item.length > 100)
          )
            fail('7004', 'Invalid context tags');
          tags = JSON.stringify(parsed);
        } catch {
          fail('7004', 'Invalid context tags');
        }
      }
      const medication = text(input.medication_name, 255);
      const unit = text(input.medication_unit, 10);
      const ago = input.medication_taken_ago;
      if (unit && !['minute', 'hour', 'day'].includes(unit))
        fail('2007', 'Invalid medication unit');
      if (
        ago != null &&
        (typeof ago !== 'string' ||
          !/^\d+(\.\d{1,2})?$/.test(ago) ||
          Number(ago) > 999999.99)
      )
        fail('2007', 'Invalid medication interval');
      const values = [
        name,
        occurred,
        tags,
        text(input.context_other, 500),
        medication,
        ago ?? null,
        unit,
        text(input.description, 10000),
      ];
      const data = await this.repo.withPatient(
        user,
        user.userId,
        true,
        async (client) => {
          if (recordId !== null) {
            const linked = await client.query(
              'SELECT patient_id FROM medical_records WHERE medical_record_id=$1',
              [recordId],
            );
            if (!linked.rows[0]) fail('4001', 'Medical record not found', 404);
            if (linked.rows[0].patient_id !== user.userId)
              fail('3106', 'Foreign medical record', 403);
          }
          const inserted = await client.query<{ episode_id: number }>(
            `INSERT INTO lesion_episodes (medical_record_id,patient_id,name,occurred_at,context_tags,context_other,medication_name,medication_taken_ago,medication_unit,description)
          VALUES ($1,$2,$3,$4,$5::jsonb,$6,$7,$8,$9,$10) RETURNING episode_id`,
            [recordId, user.userId, ...values],
          );
          return (
            await client.query(`${EPISODE_SELECT} WHERE episode_id=$1`, [
              inserted.rows[0].episode_id,
            ])
          ).rows[0];
        },
      );
      return { code: '1001', message: 'Created successfully', data };
    });
  }
  async locations(user: AuthenticatedUser, episodeId: string) {
    return this.database(async () => {
      const episode = id(episodeId);
      const patientId = await this.repo.episodePatient(episode);
      const data = await this.repo.withPatient(
        user,
        patientId,
        false,
        async (client) =>
          (
            await client.query(
              'SELECT location_id::text, episode_id::text, body_part, occurred_at, created_at FROM lesion_locations WHERE episode_id=$1 ORDER BY location_id',
              [episode],
            )
          ).rows,
      );
      return { code: '1000', message: 'OK', data };
    });
  }
  async createLocation(user: AuthenticatedUser, raw: unknown) {
    return this.database(async () => {
      await this.patient(user);
      const input = body(raw),
        episode = id(input.episode_id);
      const part = text(input.body_part, 100, true),
        occurred = timestamp(input.occurred_at);
      const patientId = await this.repo.episodePatient(episode);
      const data = await this.repo.withPatient(
        user,
        patientId,
        true,
        async (client) =>
          (
            await client.query(
              'INSERT INTO lesion_locations (episode_id,body_part,occurred_at) VALUES ($1,$2,$3) RETURNING location_id::text, episode_id::text, body_part, occurred_at, created_at',
              [episode, part, occurred],
            )
          ).rows[0],
      );
      return { code: '1001', message: 'Created successfully', data };
    });
  }
  async photos(user: AuthenticatedUser, episodeId: string) {
    return this.database(async () => {
      const episode = id(episodeId),
        patientId = await this.repo.episodePatient(episode);
      const data = await this.repo.withPatient(
        user,
        patientId,
        false,
        async (client) =>
          (
            await client.query(
              `${PHOTO_SELECT} WHERE p.episode_id=$1 ORDER BY COALESCE(p.taken_at,p.created_at), p.photo_id`,
              [episode],
            )
          ).rows,
      );
      return { code: '1000', message: 'OK', data };
    });
  }
  async createPhoto(user: AuthenticatedUser, raw: unknown) {
    return this.database(async () => {
      await this.patient(user);
      const input = body(raw),
        episode = id(input.episode_id),
        attachment = id(input.attachment_id);
      const location = input.location_id == null ? null : id(input.location_id);
      if (!['start', 'peak', 'normal'].includes(String(input.milestone)))
        fail('7006', 'Invalid milestone');
      const values = [
        timestamp(input.taken_at),
        input.milestone,
        score(input.itch_score),
        score(input.pain_score),
        score(input.burn_score),
        score(input.hives_count, 2147483647),
      ];
      const patientId = await this.repo.episodePatient(episode);
      const data = await this.repo.withPatient(
        user,
        patientId,
        true,
        async (client) => {
          if (
            location !== null &&
            !(
              await client.query(
                'SELECT 1 FROM lesion_locations WHERE location_id=$1 AND episode_id=$2',
                [location, episode],
              )
            ).rowCount
          )
            fail('7002', 'Location does not belong to episode', 404);
          const media = await client.query<{
            user_id: number;
            medical_record_id: number | null;
          }>(
            'SELECT user_id,medical_record_id FROM media_attachments WHERE attachment_id=$1 FOR UPDATE',
            [attachment],
          );
          if (!media.rows[0]) fail('6005', 'Image not found', 404);
          if (media.rows[0].user_id !== user.userId)
            fail('3106', 'Image does not belong to this patient', 403);
          const inserted = await client.query<{ photo_id: number }>(
            `INSERT INTO lesion_photos (episode_id,location_id,attachment_id,taken_at,milestone,itch_score,pain_score,burn_score,hives_count) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING photo_id`,
            [episode, location, attachment, ...values],
          );
          return (
            await client.query(`${PHOTO_SELECT} WHERE p.photo_id=$1`, [
              inserted.rows[0].photo_id,
            ])
          ).rows[0];
        },
      );
      return { code: '1001', message: 'Created successfully', data };
    });
  }
  async upload(user: AuthenticatedUser, raw: unknown, files: ImageUpload[]) {
    const input = body(raw);
    if (!files?.length) fail('6001', 'Image file is required');
    if (files.length > 10) fail('6004', 'At most 10 images');
    const types = files.map(imageType);
    const recordId =
      input.medical_record_id == null ? null : id(input.medical_record_id);
    const keys: string[] = [];
    try {
      return await this.database(async () => {
        const role = await this.repo.role(user);
        if (!['doctor', 'patient'].includes(role ?? ''))
          fail('3101', 'Permission denied', 403);
        const save = async (client: import('pg').PoolClient) => {
          const result: { id: string; file_url: string }[] = [];
          for (let index = 0; index < files.length; index++) {
            const file = files[index],
              key = `images/${user.userId}/${randomUUID()}`;
            try {
              await this.storage.put(key, file.buffer, types[index]);
              keys.push(key);
            } catch {
              fail('6007', 'Image storage unavailable', 502);
            }
            const inserted = await client.query<{ id: string }>(
              `INSERT INTO media_attachments (user_id,medical_record_id,file_path,file_name,file_type,file_size,category,description) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING attachment_id::text AS id`,
              [
                user.userId,
                recordId,
                key,
                file.originalname.slice(0, 255),
                types[index],
                file.buffer.length,
                text(input.category, 50),
                text(input.description, 500),
              ],
            );
            const mediaId = inserted.rows[0].id;
            result.push({
              id: mediaId,
              file_url: `/image-attachments/${mediaId}/content`,
            });
          }
          return result;
        };
        let data;
        if (recordId !== null)
          data = await this.repo.withRecord(user, recordId, true, save);
        else {
          const client = await this.repo.pool.connect();
          try {
            await client.query('BEGIN');
            data = await save(client);
            await client.query('COMMIT');
          } catch (error) {
            await client.query('ROLLBACK');
            throw error;
          } finally {
            client.release();
          }
        }
        return {
          code: '1001',
          message: 'Created successfully',
          data,
          total: String(data.length),
        };
      });
    } catch (error) {
      for (const key of keys) {
        try {
          await this.storage.remove(key);
        } catch {
          this.logger.error('Failed to clean up an unlinked uploaded object');
        }
      }
      throw error;
    }
  }
  async content(user: AuthenticatedUser, attachmentId: string) {
    return this.database(async () => {
      const result = await this.repo.pool.query<{
        user_id: number;
        medical_record_id: number | null;
        file_path: string;
        file_type: string;
        file_size: number;
        diary_patient_id: number | null;
      }>(
        `SELECT m.user_id,m.medical_record_id,m.file_path,m.file_type,m.file_size,
          (SELECT e.patient_id FROM lesion_photos p JOIN lesion_episodes e ON e.episode_id=p.episode_id
           WHERE p.attachment_id=m.attachment_id LIMIT 1) AS diary_patient_id
         FROM media_attachments m WHERE m.attachment_id=$1`,
        [id(attachmentId)],
      );
      const media = result.rows[0];
      if (!media) fail('6005', 'Image not found', 404);
      if (media.diary_patient_id != null)
        await this.repo.withPatient(
          user,
          media.diary_patient_id,
          false,
          async () => undefined,
        );
      else if (media.medical_record_id !== null)
        await this.repo.withRecord(
          user,
          media.medical_record_id,
          false,
          async () => undefined,
        );
      else if (
        media.user_id !== user.userId &&
        (await this.repo.role(user)) !== 'admin'
      )
        fail('3106', 'Image is private', 403);
      try {
        return new StreamableFile(await this.storage.get(media.file_path), {
          type: media.file_type,
          length: media.file_size,
          disposition: 'inline',
        });
      } catch {
        return fail('6007', 'Image storage unavailable', 502);
      }
    });
  }
}
