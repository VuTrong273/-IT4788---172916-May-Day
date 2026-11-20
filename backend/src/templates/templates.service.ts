import { Injectable } from '@nestjs/common';
import type pg from 'pg';
import { DatabaseService, fail, success } from '../common/database.service.js';
import { CatalogService } from '../catalog/catalog.service.js';
import {
  id,
  int,
  object,
  page,
  str,
  text,
  validate,
  type Fields,
  type Input,
} from '../common/validation.js';

const templateFields: Fields = {
  code_template: str(225),
  name: str(255),
  description: str(10000, true),
  version: str(20),
  is_active: { ...str(1), values: ['0', '1'] },
  intake_duration: { ...str(5, true), values: ['lt6w', 'gte6w'] },
};
const sectionFields: Fields = {
  title: str(255),
  order: { ...int(0), column: 'sort_order' },
  is_required: int(0, 1),
  filled_by: { ...str(10), values: ['patient', 'doctor', 'patdoc'] },
};
const questionFields: Fields = {
  question_id: str(50),
  question_text: str(10000),
  type_question: {
    ...str(20),
    values: [
      'text',
      'textarea',
      'number',
      'date',
      'radio',
      'checkbox',
      'select',
      'image',
    ],
  },
  placeholder: str(255, true),
  help_text: str(10000, true),
  order: { ...int(0), column: 'sort_order' },
  is_required: int(0, 1),
  allow_image: int(0, 1),
  parent_question_id: str(50, true),
  show_if_answer: { type: 'json', nullable: true },
};
const optionFields: Fields = {
  id: { ...int(), column: 'option_id' },
  option_text: str(255),
  option_value: str(100),
  order: { ...int(0), column: 'sort_order' },
  trigger_image_upload: int(0, 1),
};
function present(row: Input): Input {
  const { sort_order, ...rest } = row;
  return sort_order === undefined ? rest : { ...rest, order: sort_order };
}

function conditionValues(value: unknown, parentId: string): string[] {
  let condition = value;
  if (typeof condition === 'string') {
    try {
      condition = JSON.parse(condition) as unknown;
    } catch {
      fail('2003', 'Invalid question display condition');
    }
  }
  if (!condition || typeof condition !== 'object' || Array.isArray(condition))
    fail('2003', 'Invalid question display condition');
  const allowed = (condition as Record<string, unknown>)[parentId];
  if (
    !Array.isArray(allowed) ||
    !allowed.length ||
    allowed.some((answer) => typeof answer !== 'string')
  )
    fail('2003', 'Invalid question display condition');
  return allowed;
}

@Injectable()
export class TemplatesService {
  constructor(
    private readonly db: DatabaseService,
    private readonly catalog: CatalogService,
  ) {}

  async list(query: Input) {
    const paging = page(query);
    const values: unknown[] = [];
    let where = '';
    if (query.is_active !== undefined) {
      if (query.is_active !== '0' && query.is_active !== '1')
        fail('2003', 'Invalid active flag');
      values.push(Number(query.is_active));
      where = 'WHERE is_active = $1';
    }
    return this.db.transaction(async (tx) => {
      const count = await tx.query(
        `SELECT count(*) FROM templates ${where}`,
        values,
      );
      const rows = await tx.query(
        `SELECT * FROM templates ${where} ORDER BY created_at DESC, code_template LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
        [...values, paging.limit, (paging.page - 1) * paging.limit],
      );
      return {
        ...success(
          rows.rows.map((row) => ({
            ...row,
            is_active: String(row.is_active),
          })),
        ),
        total: Number(count.rows[0].count),
        ...paging,
      };
    });
  }

  async get(rawId: string) {
    const templateId = text(rawId, 225);
    return this.db.transaction(async (tx) => {
      await tx.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ');
      const result = await tx.query(
        'SELECT * FROM templates WHERE code_template = $1',
        [templateId],
      );
      if (!result.rows[0]) fail('4101', 'Template not found', 404);
      const sections = (
        await tx.query(
          'SELECT * FROM template_sections WHERE template_id = $1 ORDER BY sort_order, section_id',
          [templateId],
        )
      ).rows;
      const questions = (
        await tx.query(
          'SELECT q.* FROM questions q JOIN template_sections s USING(section_id) WHERE s.template_id = $1 ORDER BY q.sort_order, q.question_id',
          [templateId],
        )
      ).rows;
      const options = (
        await tx.query(
          'SELECT o.* FROM question_options o JOIN questions q USING(question_id) JOIN template_sections s USING(section_id) WHERE s.template_id = $1 ORDER BY o.sort_order, o.option_id',
          [templateId],
        )
      ).rows;
      return success({
        ...result.rows[0],
        is_active: String(result.rows[0].is_active),
        sections: sections.map((section) => ({
          ...present(section),
          questions: questions
            .filter((q) => q.section_id === section.section_id)
            .map((q) => ({
              ...present(q),
              show_if_answer:
                q.show_if_answer === null
                  ? null
                  : JSON.stringify(q.show_if_answer),
              options: options
                .filter((o) => o.question_id === q.question_id)
                .map((o) => ({ ...present(o), id: o.option_id })),
            })),
        })),
      });
    });
  }

  async write(body: unknown, actorId: number, rawId?: string) {
    const fields = { ...templateFields };
    if (rawId) delete fields.code_template;
    const data = validate(body, fields, rawId ? [] : ['code_template', 'name']);
    if (!Object.keys(data).length) fail('2001', 'No changes supplied');
    return this.db.transaction(async (tx) => {
      const row = await this.catalog.save(
        tx,
        'templates',
        'code_template',
        rawId ? data : { ...data, created_by: actorId },
        rawId,
      );
      return success({ ...row, is_active: String(row.is_active) }, !rawId);
    });
  }

  private async editable(
    tx: pg.PoolClient,
    templateId: string,
    deletingTemplate = false,
  ) {
    const template = await tx.query(
      'SELECT code_template FROM templates WHERE code_template = $1 FOR UPDATE',
      [templateId],
    );
    if (!template.rowCount) fail('4101', 'Template not found', 404);
    // Protect historical forms from structural changes after first use.
    const used = await tx.query(
      'SELECT 1 FROM medical_records WHERE template_id = $1 LIMIT 1',
      [templateId],
    );
    if (used.rowCount)
      fail(
        deletingTemplate ? '4105' : '2003',
        'Template is used by medical records; create a new version to edit its structure',
        deletingTemplate ? 409 : 400,
      );
  }

  async section(body: unknown, templateId?: string, rawId?: string) {
    const data = validate(body, sectionFields, rawId ? [] : ['title', 'order']);
    if (!Object.keys(data).length) fail('2001', 'No changes supplied');
    const sectionId = rawId ? id(rawId) : undefined;
    return this.db.transaction(async (tx) => {
      const parent =
        templateId ??
        (
          await tx.query(
            'SELECT template_id FROM template_sections WHERE section_id = $1',
            [sectionId],
          )
        ).rows[0]?.template_id;
      if (!parent) fail('4103', 'Section not found', 404);
      await this.editable(tx, parent);
      const row = await this.catalog.save(
        tx,
        'template_sections',
        'section_id',
        templateId ? { ...data, template_id: text(templateId, 225) } : data,
        sectionId,
      );
      return success(present(row), !rawId);
    });
  }

  async question(body: unknown, rawSectionId?: string, questionId?: string) {
    const input = object(body);
    const { options, ...rest } = input;
    const fields = { ...questionFields };
    if (questionId) {
      delete fields.question_id;
    }
    const data = validate(
      rest,
      fields,
      questionId
        ? []
        : ['question_id', 'question_text', 'type_question', 'order'],
    );
    let optionData: Input[] | undefined;
    if (options !== undefined) {
      if (!Array.isArray(options) || options.length > 100)
        fail('2003', 'Invalid question options');
      optionData = options.map((option) =>
        validate(option, optionFields, ['option_text', 'option_value']),
      );
      if (
        new Set(optionData.map((option) => option.option_value)).size !==
        optionData.length
      )
        fail('2003', 'Option values must be unique');
    }
    if (!Object.keys(data).length && !optionData)
      fail('2001', 'No changes supplied');
    return this.db.transaction(async (tx) => {
      const sectionId = rawSectionId
        ? id(rawSectionId)
        : (
            await tx.query(
              'SELECT section_id FROM questions WHERE question_id = $1',
              [text(questionId, 50)],
            )
          ).rows[0]?.section_id;
      if (!sectionId)
        fail(
          questionId ? '4104' : '4103',
          'Question or section not found',
          404,
        );
      const section = await tx.query(
        'SELECT template_id FROM template_sections WHERE section_id = $1',
        [sectionId],
      );
      if (!section.rows[0]) fail('4103', 'Section not found', 404);
      await this.editable(tx, section.rows[0].template_id);
      const current = questionId
        ? (
            await tx.query(
              'SELECT parent_question_id FROM questions WHERE question_id = $1',
              [text(questionId, 50)],
            )
          ).rows[0]
        : undefined;
      const parentQuestionId =
        data.parent_question_id === undefined
          ? current?.parent_question_id
          : data.parent_question_id;
      if (data.parent_question_id) {
        const parent = await tx.query(
          'SELECT s.template_id FROM questions q JOIN template_sections s USING(section_id) WHERE q.question_id = $1',
          [data.parent_question_id],
        );
        if (
          !parent.rows[0] ||
          parent.rows[0].template_id !== section.rows[0].template_id
        )
          fail('2003', 'Parent question must belong to the same template');
      }
      if (questionId && parentQuestionId) {
        const cycle = await tx.query(
          `WITH RECURSIVE descendants(question_id, path) AS (
             SELECT question_id, ARRAY[question_id] FROM questions WHERE question_id = $1
             UNION ALL
             SELECT child.question_id, descendants.path || child.question_id
             FROM questions child
             JOIN descendants ON child.parent_question_id = descendants.question_id
             WHERE NOT child.question_id = ANY(descendants.path)
           )
           SELECT 1 FROM descendants WHERE question_id = $2 LIMIT 1`,
          [questionId, parentQuestionId],
        );
        if (cycle.rowCount)
          fail('2003', 'Question display conditions cannot contain a cycle');
      }
      let question: Input;
      if (!questionId)
        question = await this.catalog.save(tx, 'questions', 'question_id', {
          ...data,
          section_id: sectionId,
        });
      else if (Object.keys(data).length)
        question = await this.catalog.save(
          tx,
          'questions',
          'question_id',
          data,
          questionId,
        );
      else
        question = (
          await tx.query('SELECT * FROM questions WHERE question_id = $1', [
            questionId,
          ])
        ).rows[0];
      if (
        ['radio', 'checkbox', 'select'].includes(
          String(question.type_question),
        ) &&
        !questionId &&
        !optionData?.length
      )
        fail('2001', 'Choice questions require options');
      for (const option of optionData ?? []) {
        const { option_id, ...values } = option;
        if (option_id) {
          const owned = await tx.query(
            'SELECT 1 FROM question_options WHERE option_id = $1 AND question_id = $2',
            [option_id, question.question_id],
          );
          if (!owned.rowCount)
            fail('2003', 'Option does not belong to this question');
          await this.catalog.save(
            tx,
            'question_options',
            'option_id',
            values,
            option_id as number,
          );
        } else
          await this.catalog.save(tx, 'question_options', 'option_id', {
            ...values,
            question_id: question.question_id,
          });
      }
      if (optionData) {
        await tx.query(
          'DELETE FROM question_options WHERE question_id = $1 AND NOT (option_value = ANY($2::varchar[]))',
          [
            question.question_id,
            optionData.map((option) => String(option.option_value)),
          ],
        );
      }
      const choices = await tx.query(
        'SELECT option_id AS id, option_text, option_value, sort_order AS "order", trigger_image_upload FROM question_options WHERE question_id = $1 ORDER BY sort_order, option_id',
        [question.question_id],
      );
      if (
        ['radio', 'checkbox', 'select'].includes(
          String(question.type_question),
        ) &&
        !choices.rowCount
      )
        fail('2001', 'Choice questions require options');
      if (question.parent_question_id || question.show_if_answer) {
        const conditionParentId = question.parent_question_id;
        if (typeof conditionParentId !== 'string' || !question.show_if_answer)
          fail(
            '2003',
            'A display condition requires both a parent and an answer',
          );
        const allowed = conditionValues(
          question.show_if_answer,
          conditionParentId,
        );
        const parent = await tx.query(
          'SELECT type_question FROM questions WHERE question_id = $1',
          [conditionParentId],
        );
        if (
          !parent.rows[0] ||
          !['radio', 'checkbox', 'select'].includes(
            parent.rows[0].type_question,
          )
        )
          fail('2003', 'Parent question must have selectable answers');
        const parentOptions = await tx.query(
          'SELECT option_value FROM question_options WHERE question_id = $1',
          [conditionParentId],
        );
        const validValues = new Set(
          parentOptions.rows.map((option) => option.option_value),
        );
        if (allowed.some((answer) => !validValues.has(answer)))
          fail('2003', 'Display condition references an unknown parent answer');
      }
      const childConditions = await tx.query(
        'SELECT show_if_answer FROM questions WHERE parent_question_id = $1',
        [question.question_id],
      );
      const optionValues = new Set(
        choices.rows.map((option) => option.option_value),
      );
      for (const child of childConditions.rows) {
        const allowed = conditionValues(
          child.show_if_answer,
          String(question.question_id),
        );
        if (allowed.some((answer) => !optionValues.has(answer)))
          fail(
            '2003',
            'An option is used by a dependent question and cannot be removed or changed',
          );
      }
      return success(
        {
          ...present(question),
          show_if_answer:
            question.show_if_answer === null ||
            question.show_if_answer === undefined
              ? null
              : typeof question.show_if_answer === 'string'
                ? question.show_if_answer
                : JSON.stringify(question.show_if_answer),
          options: choices.rows,
        },
        !questionId,
      );
    });
  }

  async remove(kind: 'template' | 'section' | 'question', rawId: string) {
    const key =
      kind === 'section'
        ? id(rawId)
        : text(rawId, kind === 'template' ? 225 : 50);
    return this.db.transaction(async (tx) => {
      const parent =
        kind === 'template'
          ? key
          : kind === 'section'
            ? (
                await tx.query(
                  'SELECT template_id FROM template_sections WHERE section_id = $1',
                  [key],
                )
              ).rows[0]?.template_id
            : (
                await tx.query(
                  'SELECT s.template_id FROM questions q JOIN template_sections s USING(section_id) WHERE q.question_id = $1',
                  [key],
                )
              ).rows[0]?.template_id;
      if (!parent) fail('2008', 'Resource not found', 404);
      await this.editable(tx, String(parent), kind === 'template');
      const table =
        kind === 'template'
          ? 'templates'
          : kind === 'section'
            ? 'template_sections'
            : 'questions';
      const pk =
        kind === 'template'
          ? 'code_template'
          : kind === 'section'
            ? 'section_id'
            : 'question_id';
      const result = await tx.query(
        `DELETE FROM ${table} WHERE ${pk} = $1 RETURNING ${pk}`,
        [key],
      );
      if (!result.rowCount) fail('2008', 'Resource not found', 404);
      return success({});
    });
  }
}
