import { Injectable } from '@nestjs/common';
import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { Client } from 'minio';
import type { AuthenticatedUser } from '../auth/jwt-auth.guard.js';
import { DatabaseService, fail, success } from '../common/database.service.js';
import { id, object, text } from '../common/validation.js';
import { PatientAccessService } from './access.service.js';
import {
  IMAGE_LINK_TTL_SECONDS,
  validateUploadedImages,
  type UploadedImage,
} from './image-validation.js';

@Injectable()
export class ImagesService {
  constructor(
    private readonly db: DatabaseService,
    private readonly access: PatientAccessService,
  ) {}
  private storage() {
    return new Client({
      endPoint: process.env.MINIO_ENDPOINT ?? 'localhost',
      port: Number(process.env.MINIO_PORT ?? 9000),
      useSSL: process.env.MINIO_USE_SSL === 'true',
      accessKey: process.env.MINIO_ACCESS_KEY,
      secretKey: process.env.MINIO_SECRET_KEY,
    });
  }
  private bucket() {
    return process.env.MINIO_BUCKET ?? 'mayday';
  }
  private signature(imageId: number, expires: string) {
    const secret = process.env.JWT_SECRET;
    if (!secret || secret.length < 32)
      fail('9901', 'Media signing is unavailable', 503);
    return createHmac('sha256', secret)
      .update(`media:${imageId}:${expires}`)
      .digest('hex');
  }
  present(row: Record<string, unknown>, origin: string) {
    const imageId = Number(row.attachment_id);
    const expires = String(
      Math.floor(Date.now() / 1000) + IMAGE_LINK_TTL_SECONDS,
    );
    return {
      ...row,
      id: imageId,
      file_path: undefined,
      file_url: `${origin}/api/v1/media-files/${imageId}?expires=${expires}&signature=${this.signature(imageId, expires)}`,
    };
  }
  async read(imageId: unknown, expires: unknown, signature: unknown) {
    const number = id(imageId);
    if (
      typeof expires !== 'string' ||
      !/^\d{10}$/.test(expires) ||
      Number(expires) < Date.now() / 1000 ||
      Number(expires) > Date.now() / 1000 + IMAGE_LINK_TTL_SECONDS + 5 ||
      typeof signature !== 'string' ||
      !/^[a-f0-9]{64}$/.test(signature) ||
      !timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(this.signature(number, expires)),
      )
    )
      fail('3101', 'Image link is invalid or expired', 403);
    const row = await this.db.transaction(
      async (tx) =>
        (
          await tx.query(
            'SELECT * FROM media_attachments WHERE attachment_id=$1',
            [number],
          )
        ).rows[0],
    );
    if (!row) fail('6001', 'Image not found', 404);
    try {
      return {
        stream: await this.storage().getObject(this.bucket(), row.file_path),
        type: row.file_type,
      };
    } catch {
      return fail('9903', 'Image storage is unavailable', 503);
    }
  }
  async upload(
    user: AuthenticatedUser,
    files: UploadedImage[],
    body: unknown,
    origin: string,
    multiple: boolean,
  ) {
    validateUploadedImages(files);
    const input = object(body);
    const stored: string[] = [];
    try {
      const rows = await this.db.transaction(async (tx) => {
        const recordValue = input.medical_record_id ?? input.recordId;
        const recordId = recordValue === undefined ? null : id(recordValue);
        if (recordId) await this.access.record(tx, user, recordId, true);
        const questionValue = input.question_id ?? input.questionId;
        const questionId =
          questionValue === undefined ? null : text(questionValue, 50);
        if (questionId) {
          if (!recordId)
            fail('2001', 'recordId is required for a question image');
          if (
            !(
              await tx.query(
                'SELECT 1 FROM questions q JOIN template_sections s USING(section_id) JOIN medical_records r ON r.template_id=s.template_id WHERE q.question_id=$1 AND r.medical_record_id=$2',
                [questionId, recordId],
              )
            ).rowCount
          )
            fail('4008', 'Question does not belong to record');
        }
        const result: Record<string, unknown>[] = [];
        for (const file of files) {
          const key = `images/${user.userId}/${randomUUID()}`;
          try {
            await this.storage().putObject(
              this.bucket(),
              key,
              file.buffer,
              file.size,
              { 'Content-Type': file.mimetype },
            );
          } catch {
            fail('9903', 'Image storage is unavailable', 503);
          }
          stored.push(key);
          const row = (
            await tx.query(
              "INSERT INTO media_attachments(user_id,medical_record_id,question_id,file_path,file_url,file_name,file_type,file_size) VALUES($1,$2,$3,$4,'',$5,$6,$7) RETURNING *",
              [
                user.userId,
                recordId,
                questionId,
                key,
                text(file.originalname, 255),
                file.mimetype,
                file.size,
              ],
            )
          ).rows[0];
          result.push(this.present(row, origin));
        }
        return result;
      });
      return success(multiple ? rows : rows[0], true);
    } catch (error) {
      await Promise.allSettled(
        stored.map((key) => this.storage().removeObject(this.bucket(), key)),
      );
      throw error;
    }
  }
  list(user: AuthenticatedUser, userId: unknown, origin: string) {
    return this.db.transaction(async (tx) => {
      const target = id(userId);
      const role = await this.access.role(tx, user);
      if (target !== user.userId) await this.access.patient(tx, user, target);
      const rows = await tx.query(
        `SELECT a.* FROM media_attachments a WHERE a.user_id=$1 ${role === 'doctor' && target !== user.userId ? 'AND EXISTS(SELECT 1 FROM medical_records r WHERE r.medical_record_id=a.medical_record_id AND r.assigned_doctor_id=$2)' : ''} ORDER BY a.created_at DESC`,
        role === 'doctor' && target !== user.userId
          ? [target, user.userId]
          : [target],
      );
      return success(rows.rows.map((row) => this.present(row, origin)));
    });
  }
  async remove(user: AuthenticatedUser, imageId: unknown) {
    const key = await this.db.transaction(async (tx) => {
      const row = (
        await tx.query(
          'SELECT * FROM media_attachments WHERE attachment_id=$1 FOR UPDATE',
          [id(imageId)],
        )
      ).rows[0];
      if (!row) fail('6001', 'Image not found', 404);
      const role = await this.access.role(tx, user);
      if (row.user_id !== user.userId && role !== 'admin')
        fail('3106', 'Only the owner can delete this image', 403);
      const records = await tx.query(
        'SELECT medical_record_id FROM answers WHERE answer_id IN (SELECT answer_id FROM answer_images WHERE attachment_id=$1) UNION SELECT e.medical_record_id FROM lesion_episodes e JOIN lesion_photos p USING(episode_id) WHERE p.attachment_id=$1',
        [row.attachment_id],
      );
      if (row.medical_record_id)
        await this.access.record(tx, user, row.medical_record_id, true);
      for (const record of records.rows)
        await this.access.record(tx, user, record.medical_record_id, true);
      await tx.query('DELETE FROM media_attachments WHERE attachment_id=$1', [
        row.attachment_id,
      ]);
      return String(row.file_path);
    });
    // Metadata deletion immediately revokes signed links; storage cleanup is best effort.
    await this.storage()
      .removeObject(this.bucket(), key)
      .catch(() => undefined);
    return success({});
  }
  answerImages(user: AuthenticatedUser, answerId: unknown, origin: string) {
    return this.db.transaction(async (tx) => {
      const answer = (
        await tx.query('SELECT * FROM answers WHERE answer_id=$1', [
          id(answerId),
        ])
      ).rows[0];
      if (!answer) fail('6001', 'Answer not found', 404);
      await this.access.record(tx, user, answer.medical_record_id);
      const rows = await tx.query(
        'SELECT ai.*,to_jsonb(a) AS attachment FROM answer_images ai JOIN media_attachments a USING(attachment_id) WHERE ai.answer_id=$1 ORDER BY ai.answer_image_id',
        [answer.answer_id],
      );
      return success(
        rows.rows.map((row) => ({
          ...row,
          id: row.answer_image_id,
          attachment: this.present(row.attachment, origin),
        })),
      );
    });
  }
  link(user: AuthenticatedUser, body: unknown, origin: string) {
    const input = object(body);
    return this.db.transaction(async (tx) => {
      const answer = (
        await tx.query(
          'SELECT a.*,q.allow_image,q.type_question,s.filled_by FROM answers a JOIN questions q USING(question_id) JOIN template_sections s USING(section_id) WHERE answer_id=$1 FOR UPDATE OF a',
          [id(input.answer_id)],
        )
      ).rows[0];
      if (!answer) fail('6001', 'Answer not found', 404);
      const { role } = await this.access.record(
        tx,
        user,
        answer.medical_record_id,
        true,
      );
      if (!['patdoc', role].includes(answer.filled_by))
        fail('3101', 'Section is not writable by this role', 403);
      if (!answer.allow_image && answer.type_question !== 'image')
        fail('6002', 'Question does not accept images');
      const attachment = (
        await tx.query(
          'SELECT * FROM media_attachments WHERE attachment_id=$1 FOR UPDATE',
          [id(input.attachment_id)],
        )
      ).rows[0];
      if (!attachment) fail('6001', 'Image not found', 404);
      if (
        attachment.user_id !== user.userId ||
        (attachment.medical_record_id !== null &&
          attachment.medical_record_id !== answer.medical_record_id) ||
        (attachment.question_id !== null &&
          attachment.question_id !== answer.question_id)
      )
        fail('3106', 'Image does not belong to this answer', 403);
      const option =
        input.option_value === undefined ? null : text(input.option_value, 255);
      if (
        option &&
        !(
          await tx.query(
            'SELECT 1 FROM question_options WHERE question_id=$1 AND option_value=$2',
            [answer.question_id, option],
          )
        ).rowCount
      )
        fail('2003', 'Invalid option');
      if (
        (
          await tx.query(
            'SELECT 1 FROM answer_images WHERE answer_id=$1 AND attachment_id=$2',
            [answer.answer_id, attachment.attachment_id],
          )
        ).rowCount
      )
        fail('6006', 'Image already linked', 409);
      await tx.query(
        'UPDATE media_attachments SET medical_record_id=$2,question_id=$3 WHERE attachment_id=$1',
        [
          attachment.attachment_id,
          answer.medical_record_id,
          answer.question_id,
        ],
      );
      const row = (
        await tx.query(
          'INSERT INTO answer_images(answer_id,attachment_id,option_value) VALUES($1,$2,$3) RETURNING *',
          [answer.answer_id, attachment.attachment_id, option],
        )
      ).rows[0];
      return success(
        {
          ...row,
          id: row.answer_image_id,
          attachment: this.present(attachment, origin),
        },
        true,
      );
    });
  }
  unlink(user: AuthenticatedUser, linkId: unknown) {
    return this.db.transaction(async (tx) => {
      const row = (
        await tx.query(
          'SELECT ai.*,a.medical_record_id,s.filled_by FROM answer_images ai JOIN answers a USING(answer_id) JOIN questions q USING(question_id) JOIN template_sections s USING(section_id) WHERE ai.answer_image_id=$1 FOR UPDATE OF ai',
          [id(linkId)],
        )
      ).rows[0];
      if (!row) fail('6001', 'Answer image not found', 404);
      const { role } = await this.access.record(
        tx,
        user,
        row.medical_record_id,
        true,
      );
      if (!['patdoc', role].includes(row.filled_by))
        fail('3101', 'Section is not writable by this role', 403);
      await tx.query('DELETE FROM answer_images WHERE answer_image_id=$1', [
        row.answer_image_id,
      ]);
      return success({});
    });
  }
}
