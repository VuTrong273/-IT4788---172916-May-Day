import { Injectable, OnModuleDestroy } from '@nestjs/common';
import pg from 'pg';

export type TemplateSummary = {
  code_template: string;
  name: string;
  description: string | null;
  version: string;
  is_active: string;
  created_at: Date;
};

export type TemplateDetail = Omit<TemplateSummary, 'created_at'> & {
  sections: Array<{
    section_id: number;
    title: string;
    order: number;
    is_required: number;
    filled_by: 'patient' | 'doctor' | 'patdoc';
    questions: Array<{
      question_id: string;
      question_text: string;
      type_question: string;
      placeholder: string | null;
      help_text: string | null;
      order: number;
      is_required: number;
      allow_image: number;
      parent_question_id: string | null;
      show_if_answer: unknown;
      options: Array<{
        id: number;
        option_text: string;
        option_value: string;
      }>;
    }>;
  }>;
};

@Injectable()
export class TemplatesRepository implements OnModuleDestroy {
  private readonly pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    connectionTimeoutMillis: 5000,
    max: 10,
  });

  async roleName(roleId: number) {
    const result = await this.pool.query<{ name: string }>(
      'SELECT name FROM roles WHERE role_id = $1',
      [roleId],
    );
    return result.rows[0]?.name ?? null;
  }

  async list(page: number, limit: number, active?: '0' | '1') {
    const values: unknown[] = [];
    const where = active === undefined ? '' : 'WHERE is_active = $1';
    if (active !== undefined) values.push(Number(active));
    const count = await this.pool.query<{ count: string }>(
      `SELECT count(*) FROM templates ${where}`,
      values,
    );
    const result = await this.pool.query<TemplateSummary>(
      `SELECT code_template, name, description, version, is_active::text, created_at
       FROM templates ${where} ORDER BY created_at DESC, code_template
       LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
      [...values, limit, (page - 1) * limit],
    );
    return {
      data: result.rows,
      total: Number(count.rows[0].count),
      page,
      limit,
    };
  }

  async getByCode(code: string): Promise<TemplateDetail | null> {
    const templateResult = await this.pool.query<
      Omit<TemplateSummary, 'created_at'>
    >(
      `SELECT code_template, name, description, version, is_active::text
       FROM templates WHERE code_template = $1`,
      [code],
    );
    const template = templateResult.rows[0];
    if (!template) return null;

    const sectionsResult = await this.pool.query<{
      section_id: number;
      title: string;
      order: number;
      is_required: number;
      filled_by: 'patient' | 'doctor' | 'patdoc';
    }>(
      `SELECT section_id, title, sort_order AS "order", is_required, filled_by
       FROM template_sections WHERE template_id = $1
       ORDER BY sort_order, section_id`,
      [code],
    );

    const questionsResult = await this.pool.query<{
      question_id: string;
      section_id: number;
      question_text: string;
      type_question: string;
      placeholder: string | null;
      help_text: string | null;
      order: number;
      is_required: number;
      allow_image: number;
      parent_question_id: string | null;
      show_if_answer: unknown;
    }>(
      `SELECT q.question_id, q.section_id, q.question_text, q.type_question,
              q.placeholder, q.help_text, q.sort_order AS "order", q.is_required,
              q.allow_image, q.parent_question_id, q.show_if_answer
       FROM questions q
       JOIN template_sections s ON s.section_id = q.section_id
       WHERE s.template_id = $1
       ORDER BY s.sort_order, s.section_id, q.sort_order, q.question_id`,
      [code],
    );

    const optionsResult = await this.pool.query<{
      id: number;
      question_id: string;
      option_text: string;
      option_value: string;
    }>(
      `SELECT o.option_id AS id, o.question_id, o.option_text, o.option_value
       FROM question_options o
       JOIN questions q ON q.question_id = o.question_id
       JOIN template_sections s ON s.section_id = q.section_id
       WHERE s.template_id = $1
       ORDER BY q.sort_order, o.sort_order, o.option_id`,
      [code],
    );
    const optionsByQuestion = new Map<
      string,
      TemplateDetail['sections'][number]['questions'][number]['options']
    >();
    for (const option of optionsResult.rows) {
      const options = optionsByQuestion.get(option.question_id) ?? [];
      options.push({
        id: option.id,
        option_text: option.option_text,
        option_value: option.option_value,
      });
      optionsByQuestion.set(option.question_id, options);
    }
    const questionsBySection = new Map<
      number,
      TemplateDetail['sections'][number]['questions']
    >();
    for (const question of questionsResult.rows) {
      const questions = questionsBySection.get(question.section_id) ?? [];
      questions.push({
        question_id: question.question_id,
        question_text: question.question_text,
        type_question: question.type_question,
        placeholder: question.placeholder,
        help_text: question.help_text,
        order: question.order,
        is_required: question.is_required,
        allow_image: question.allow_image,
        parent_question_id: question.parent_question_id,
        show_if_answer: question.show_if_answer,
        options: optionsByQuestion.get(question.question_id) ?? [],
      });
      questionsBySection.set(question.section_id, questions);
    }

    return {
      ...template,
      sections: sectionsResult.rows.map((section) => ({
        ...section,
        questions: questionsBySection.get(section.section_id) ?? [],
      })),
    };
  }

  async create(input: {
    code: string;
    name: string;
    description: string | null;
    version: string;
    active: '0' | '1';
    userId: number;
  }) {
    const result = await this.pool.query<TemplateSummary>(
      `INSERT INTO templates (code_template, name, description, version, is_active, created_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING code_template, name, description, version, is_active::text, created_at`,
      [
        input.code,
        input.name,
        input.description,
        input.version,
        Number(input.active),
        input.userId,
      ],
    );
    return result.rows[0];
  }

  async onModuleDestroy() {
    await this.pool.end();
  }

  async update(code: string, fields: Record<string, string>) {
    const allowed = ['name', 'description', 'version', 'is_active'];
    const keys = allowed.filter((key) => fields[key] !== undefined);
    const result = await this.pool.query<TemplateSummary>(
      `UPDATE templates SET ${keys.map((key, index) => `${key} = $${index + 2}`).join(', ')}, updated_at = now()
       WHERE code_template = $1
       RETURNING code_template, name, description, version, is_active::text, created_at`,
      [code, ...keys.map((key) => fields[key])],
    );
    return result.rows[0] ?? null;
  }

  async delete(code: string) {
    const result = await this.pool.query(
      'DELETE FROM templates WHERE code_template = $1 RETURNING code_template',
      [code],
    );
    return result.rows.length > 0;
  }
}
