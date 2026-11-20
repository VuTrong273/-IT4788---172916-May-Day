import type pg from 'pg';
import { fail } from '../common/database.service.js';
import { dateOnly } from './access.service.js';

export function validateAnswerType(
  type: string,
  text: string | null,
  value: unknown,
  option: number | null,
) {
  if (type === 'image') {
    if (
      text !== null ||
      option !== null ||
      (value !== null && (!Array.isArray(value) || value.length))
    )
      fail('2003', 'Image answers must use linked attachments');
    return;
  }
  if (['text', 'textarea', 'number', 'date'].includes(type)) {
    if (text === null || value !== null || option !== null)
      fail('2003', 'Answer type does not match question');
    if (
      type === 'number' &&
      (!/^[+-]?(\d+(\.\d+)?|\.\d+)$/.test(text) ||
        !Number.isFinite(Number(text)))
    )
      fail('2003', 'Expected a finite number');
    if (type === 'date') dateOnly(text);
  } else if (type === 'checkbox') {
    if (
      !Array.isArray(value) ||
      !value.length ||
      text !== null ||
      option !== null ||
      new Set(value).size !== value.length
    )
      fail('2003', 'Expected distinct checkbox choices');
  } else if (['select', 'radio'].includes(type)) {
    if (
      text !== null ||
      (option === null && typeof value !== 'string') ||
      (option !== null && value !== null)
    )
      fail('2003', 'Expected one choice');
  }
}

export async function assertCompleteForm(
  tx: pg.PoolClient,
  recordId: number,
  templateId: string,
) {
  const questions = (
    await tx.query(
      `SELECT q.*,s.title,s.is_required AS section_required,s.section_id FROM questions q JOIN template_sections s USING(section_id) WHERE s.template_id=$1 ORDER BY s.sort_order,q.sort_order`,
      [templateId],
    )
  ).rows;
  if (!questions.length) fail('4007', 'The template has no questions');
  const answers = (
    await tx.query(
      `SELECT a.*,o.option_value,EXISTS(SELECT 1 FROM answer_images i WHERE i.answer_id=a.answer_id) AS has_images FROM answers a LEFT JOIN question_options o ON o.option_id=a.question_option_id WHERE a.medical_record_id=$1`,
      [recordId],
    )
  ).rows;
  const byQuestion = new Map(
    answers.map((answer) => [answer.question_id, answer]),
  );
  const visibility = new Map<string, boolean>();
  const visible = (
    question: (typeof questions)[number],
    visiting = new Set<string>(),
  ): boolean => {
    if (visibility.has(question.question_id))
      return visibility.get(question.question_id)!;
    if (visiting.has(question.question_id))
      fail('2003', 'Question display conditions contain a cycle');
    visiting.add(question.question_id);
    let result = true;
    if (question.parent_question_id && question.show_if_answer) {
      const parent = questions.find(
        (q) => q.question_id === question.parent_question_id,
      );
      const allowed = question.show_if_answer[question.parent_question_id];
      if (!parent || !Array.isArray(allowed))
        fail('2003', 'Invalid question display condition');
      const answer = byQuestion.get(parent.question_id);
      const values = answer
        ? [
            answer.option_value,
            ...(Array.isArray(answer.answer_value)
              ? answer.answer_value
              : [answer.answer_value]),
            answer.answer_text,
          ]
        : [];
      result =
        visible(parent, visiting) &&
        values.some((value) => allowed.includes(value));
    }
    visibility.set(question.question_id, result);
    return result;
  };
  const hasValue = (question: (typeof questions)[number]) => {
    const answer = byQuestion.get(question.question_id);
    if (!answer) return false;
    if (question.type_question === 'image') return answer.has_images;
    return (
      answer.question_option_id !== null ||
      !!answer.answer_text?.trim() ||
      (Array.isArray(answer.answer_value)
        ? answer.answer_value.length > 0
        : answer.answer_value !== null)
    );
  };
  for (const question of questions) {
    if (visible(question) && question.is_required === 1 && !hasValue(question))
      fail('4007', `Missing required answer: ${question.question_text}`);
  }
  for (const sectionId of new Set(
    questions.filter((q) => q.section_required === 1).map((q) => q.section_id),
  )) {
    const active = questions.filter(
      (q) => q.section_id === sectionId && visible(q),
    );
    if (active.length && !active.some(hasValue))
      fail('4007', `Missing required section: ${active[0].title}`);
  }
}
