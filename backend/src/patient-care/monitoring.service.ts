import { Injectable } from '@nestjs/common';
import type { AuthenticatedUser } from '../auth/jwt-auth.guard.js';
import { DatabaseService, fail, success } from '../common/database.service.js';
import { id, object, text } from '../common/validation.js';
import {
  PatientAccessService,
  dateOnly,
  stringNumbers,
} from './access.service.js';

@Injectable()
export class MonitoringService {
  constructor(
    private readonly db: DatabaseService,
    private readonly access: PatientAccessService,
  ) {}

  eligibility(user: AuthenticatedUser) {
    return this.db.transaction(async (tx) => {
      const role = await this.access.role(tx, user);
      if (role !== 'patient') fail('3106', 'Patient access required', 403);
      const result = await tx.query(
        "SELECT medical_record_id FROM medical_records WHERE patient_id=$1 AND status IN ('in_progress','completed') AND followup_active=true ORDER BY created_at DESC,medical_record_id DESC LIMIT 1",
        [user.userId],
      );
      return success(
        result.rows.length
          ? {
              eligible: 'true',
              medical_record_id: String(result.rows[0].medical_record_id),
            }
          : { eligible: 'false' },
      );
    });
  }

  createScore(user: AuthenticatedUser, body: unknown) {
    const input = object(body);
    const scoreDate = dateOnly(input.score_date);
    const today = new Date().toLocaleDateString('en-CA', {
      timeZone: 'Asia/Ho_Chi_Minh',
    });
    if (scoreDate > today) fail('2006', 'Cannot score a future date');
    const score = (value: unknown, code: string) => {
      if (
        (typeof value !== 'string' && typeof value !== 'number') ||
        !/^[0-3]$/.test(String(value))
      )
        fail(code, 'Score must be between 0 and 3');
      return Number(value);
    };
    const itch = score(input.iss7, '5003');
    const hives = score(input.hss7, '5004');
    const note =
      input.note == null || input.note === '' ? null : text(input.note, 500);
    return this.db.transaction(async (tx) => {
      const { row, role } = await this.access.record(
        tx,
        user,
        input.medical_record_id,
      );
      if (role !== 'patient') fail('3106', 'Patient access required', 403);
      if (
        !['in_progress', 'completed'].includes(row.status) ||
        row.followup_active === false
      )
        fail('5001', 'Record is not eligible for UAS7', 409);
      const duplicate = await tx.query(
        'SELECT 1 FROM uas7_scores WHERE patient_id=$1 AND score_date=$2',
        [user.userId, scoreDate],
      );
      if (duplicate.rowCount)
        fail('5002', 'Score already exists for this date', 409);
      const result = await tx.query(
        'INSERT INTO uas7_scores(patient_id,medical_record_id,score_date,iss7,hss7,note) VALUES($1,$2,$3,$4,$5,$6) RETURNING *,score_date::text',
        [user.userId, row.medical_record_id, scoreDate, itch, hives, note],
      );
      return success(
        stringNumbers(result.rows[0], ['iss7', 'hss7', 'daily_score']),
        true,
      );
    });
  }

  scores(
    user: AuthenticatedUser,
    patient: unknown,
    week: boolean,
    start?: unknown,
  ) {
    const startDate =
      start === undefined
        ? new Date(
            Date.parse(
              `${new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' })}T00:00:00Z`,
            ) -
              6 * 86400000,
          )
            .toISOString()
            .slice(0, 10)
        : dateOnly(start);
    return this.db.transaction(async (tx) => {
      const { patientId, role } = await this.access.patient(tx, user, patient);
      const result = await tx.query(
        `SELECT s.*,s.score_date::text FROM uas7_scores s JOIN medical_records r ON r.medical_record_id=s.medical_record_id WHERE s.patient_id=$1 AND ($2::boolean=false OR r.assigned_doctor_id=$3) ${week ? 'AND s.score_date >= $4::date AND s.score_date < $4::date+7' : ''} ORDER BY s.score_date DESC`,
        week
          ? [patientId, role === 'doctor', user.userId, startDate]
          : [patientId, role === 'doctor', user.userId],
      );
      if (!week)
        return success(
          result.rows.map((row) =>
            stringNumbers(row, ['iss7', 'hss7', 'daily_score']),
          ),
        );
      const sum = result.rows.reduce(
        (total, row) => total + Number(row.daily_score),
        0,
      );
      const severity =
        result.rowCount !== 7
          ? 'Chưa đủ dữ liệu 7 ngày'
          : sum === 0
            ? 'Không hoạt động'
            : sum <= 6
              ? 'Kiểm soát tốt'
              : sum <= 15
                ? 'Nhẹ'
                : sum <= 27
                  ? 'Vừa'
                  : 'Nặng';
      return success({
        patient_id: String(patientId),
        week_score: String(sum),
        completed_days: String(result.rowCount),
        severity_label: severity,
      });
    });
  }

  private episodeInput(body: unknown, creating: boolean) {
    const input = object(body);
    const allowed = [
      'name',
      'occurred_at',
      'context_tags',
      'context_other',
      'medication_name',
      'medication_taken_ago',
      'medication_unit',
      'description',
      ...(creating ? ['medical_record_id'] : []),
    ];
    for (const key of Object.keys(input))
      if (!allowed.includes(key)) fail('2003', `Unknown field: ${key}`);
    const values: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(input)) {
      if (key === 'medical_record_id') continue;
      if (value === null) {
        if (key === 'name') fail('2003', 'Name is required');
        values[key] = null;
        continue;
      }
      if (key === 'occurred_at') {
        if (typeof value !== 'string' || !Number.isFinite(Date.parse(value)))
          fail('2006', 'Invalid timestamp');
        values[key] = new Date(value).toISOString();
      } else if (key === 'context_tags') {
        let parsed: unknown;
        try {
          parsed = typeof value === 'string' ? JSON.parse(value) : value;
        } catch {
          fail('2003', 'Invalid context tags');
        }
        if (
          !Array.isArray(parsed) ||
          parsed.length > 50 ||
          parsed.some((tag) => typeof tag !== 'string' || tag.length > 100)
        )
          fail('2003', 'Invalid context tags');
        values[key] = JSON.stringify(parsed);
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
          key === 'name' || key === 'medication_name'
            ? 255
            : key === 'context_other'
              ? 500
              : 10000,
        );
    }
    if (creating && !values.name) fail('2001', 'Name is required');
    if (!Object.keys(values).length) fail('2001', 'No changes supplied');
    return { input, values };
  }

  private serialize(row: Record<string, unknown>) {
    return stringNumbers({
      ...row,
      context_tags:
        row.context_tags == null ? null : JSON.stringify(row.context_tags),
    });
  }

  createEpisode(user: AuthenticatedUser, body: unknown) {
    const { input, values } = this.episodeInput(body, true);
    return this.db.transaction(async (tx) => {
      const { row, role } = await this.access.monitoringRecord(
        tx,
        user,
        input.medical_record_id,
      );
      if (role !== 'patient') fail('3106', 'Patient access required', 403);
      const keys = Object.keys(values);
      const result = await tx.query(
        `INSERT INTO lesion_episodes(medical_record_id,patient_id,${keys.join(',')}) VALUES($1,$2,${keys.map((_, i) => `$${i + 3}`).join(',')}) RETURNING *`,
        [row.medical_record_id, user.userId, ...Object.values(values)],
      );
      return success(this.serialize(result.rows[0]), true);
    });
  }

  listEpisodes(user: AuthenticatedUser, recordId?: unknown) {
    return this.db.transaction(async (tx) => {
      if (recordId !== undefined) await this.access.record(tx, user, recordId);
      else if ((await this.access.role(tx, user)) !== 'patient')
        fail('3106', 'Patient access required', 403);
      const result = await tx.query(
        `SELECT * FROM lesion_episodes WHERE ${recordId === undefined ? 'patient_id=$1' : 'medical_record_id=$1'} ORDER BY COALESCE(occurred_at,created_at) DESC`,
        [recordId === undefined ? user.userId : id(recordId)],
      );
      return success(result.rows.map((row) => this.serialize(row)));
    });
  }

  episode(
    user: AuthenticatedUser,
    episodeId: unknown,
    action: 'get' | 'patch' | 'delete',
    body?: unknown,
  ) {
    const changes =
      action === 'patch' ? this.episodeInput(body, false).values : undefined;
    return this.db.transaction(async (tx) => {
      const result = await tx.query(
        'SELECT * FROM lesion_episodes WHERE episode_id=$1',
        [id(episodeId)],
      );
      const episode = result.rows[0];
      if (!episode) fail('4001', 'Episode not found', 404);
      const { role } =
        action === 'get'
          ? await this.access.record(tx, user, episode.medical_record_id)
          : await this.access.monitoringRecord(
              tx,
              user,
              episode.medical_record_id,
            );
      if (action === 'get') return success(this.serialize(episode));
      if (role !== 'patient' || episode.patient_id !== user.userId)
        fail('3106', 'Only the owner can edit this episode', 403);
      if (action === 'delete') {
        await tx.query('DELETE FROM lesion_episodes WHERE episode_id=$1', [
          episode.episode_id,
        ]);
        return success({});
      }
      const keys = Object.keys(changes!);
      const updated = await tx.query(
        `UPDATE lesion_episodes SET ${keys.map((key, i) => `${key}=$${i + 2}`).join(',')},updated_at=clock_timestamp() WHERE episode_id=$1 RETURNING *`,
        [episode.episode_id, ...Object.values(changes!)],
      );
      return success(this.serialize(updated.rows[0]));
    });
  }
}
