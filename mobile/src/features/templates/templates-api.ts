import {
  apiRequest,
  requireApiCode,
  type ApiEnvelope,
} from '@/api/client';
import type { Session } from '@/features/auth/session';

export type TemplateSummary = {
  code_template: string;
  name: string;
  description?: string | null;
  version?: string;
  is_active?: '1' | '0';
  created_at?: string;
};

export type TemplateOption = {
  id: number;
  option_text: string;
  option_value: string;
  order?: number;
  trigger_image_upload?: number;
};

export type TemplateQuestion = {
  question_id: string;
  question_text: string;
  type_question: TemplateQuestionType;
  placeholder?: string | null;
  help_text?: string | null;
  order?: number;
  is_required?: number;
  allow_image?: number;
  parent_question_id?: string | null;
  show_if_answer?: string | null;
  condition_rules?: string | null;
  options?: TemplateOption[];
};

export type TemplateQuestionType =
  | 'text'
  | 'textarea'
  | 'number'
  | 'date'
  | 'radio'
  | 'checkbox'
  | 'select'
  | 'image';

export type TemplateSection = {
  section_id: number;
  title: string;
  order?: number;
  is_required?: number;
  filled_by?: 'patient' | 'doctor' | 'patdoc';
  questions?: TemplateQuestion[];
};

export type TemplateOptionInput = {
  id?: number;
  option_text: string;
  option_value: string;
  order?: number;
  trigger_image_upload?: number;
};

export type TemplateSectionInput = {
  title: string;
  order: number;
  is_required?: number;
  filled_by?: 'patient' | 'doctor' | 'patdoc';
};

export type TemplateSectionUpdateInput = Partial<TemplateSectionInput>;

export type TemplateQuestionCreateInput = {
  question_id: string;
  question_text: string;
  type_question: TemplateQuestionType;
  order: number;
  placeholder?: string | null;
  help_text?: string | null;
  is_required?: number;
  allow_image?: number;
  parent_question_id?: string | null;
  show_if_answer?: string | null;
  options?: Omit<TemplateOptionInput, 'id'>[];
};

export type TemplateQuestionUpdateInput = {
  question_text?: string;
  order?: number;
  placeholder?: string | null;
  help_text?: string | null;
  is_required?: number;
  allow_image?: number;
  show_if_answer?: string | null;
  options?: TemplateOptionInput[];
};

export type TemplateDetail = TemplateSummary & {
  sections: TemplateSection[];
};

export type TemplateListResponse = ApiEnvelope<TemplateSummary[]> & {
  total: number;
  page: number;
  limit: number;
};

export type TemplateWriteInput = {
  code_template: string;
  name: string;
  description?: string;
  version?: string;
  is_active?: '1' | '0';
};

export type TemplateUpdateInput = Omit<TemplateWriteInput, 'code_template'>;

function dataFor<T>(
  response: ApiEnvelope<T>,
  acceptedCodes: readonly string[],
  operation: string,
): T {
  return requireApiCode(response, acceptedCodes, operation).data;
}

export const templatesApi = {
  async list(
    session: Session,
    options: { page: number; limit: number; is_active?: '1' | '0' },
  ): Promise<TemplateListResponse> {
    const response = await apiRequest<TemplateListResponse>(
      {
        method: 'get',
        url: '/templates/all',
        params: {
          page: options.page,
          limit: options.limit,
          ...(options.is_active ? { is_active: options.is_active } : {}),
        },
      },
      session.token,
    );
    return requireApiCode(response, ['1000'], 'GET /templates/all');
  },

  async get(session: Session, code: string): Promise<TemplateDetail> {
    const path = `/templates/${encodeURIComponent(code)}`;
    const response = await apiRequest<ApiEnvelope<TemplateDetail>>(
      { method: 'get', url: path },
      session.token,
    );
    return dataFor(response, ['1000'], `GET ${path}`);
  },

  async create(session: Session, input: TemplateWriteInput): Promise<TemplateSummary> {
    const response = await apiRequest<ApiEnvelope<TemplateSummary>>(
      { method: 'post', url: '/templates', data: input },
      session.token,
    );
    return dataFor(response, ['1001'], 'POST /templates');
  },

  async update(
    session: Session,
    code: string,
    input: TemplateUpdateInput,
  ): Promise<TemplateSummary> {
    const path = `/templates/${encodeURIComponent(code)}`;
    const response = await apiRequest<ApiEnvelope<TemplateSummary>>(
      { method: 'put', url: path, data: input },
      session.token,
    );
    return dataFor(response, ['1000'], `PUT ${path}`);
  },

  async remove(session: Session, code: string): Promise<void> {
    const path = `/templates/${encodeURIComponent(code)}`;
    const response = await apiRequest<ApiEnvelope<Record<string, never>>>(
      { method: 'delete', url: path },
      session.token,
    );
    dataFor(response, ['1000'], `DELETE ${path}`);
  },

  async createSection(
    session: Session,
    templateCode: string,
    input: TemplateSectionInput,
  ): Promise<TemplateSection> {
    const path = `/templates/${encodeURIComponent(templateCode)}/sections`;
    const response = await apiRequest<ApiEnvelope<TemplateSection>>(
      { method: 'post', url: path, data: input },
      session.token,
    );
    return dataFor(response, ['1001'], `POST ${path}`);
  },

  async updateSection(
    session: Session,
    sectionId: number,
    input: TemplateSectionUpdateInput,
  ): Promise<TemplateSection> {
    const path = `/templates/sections/${sectionId}`;
    const response = await apiRequest<ApiEnvelope<TemplateSection>>(
      { method: 'put', url: path, data: input },
      session.token,
    );
    return dataFor(response, ['1000'], `PUT ${path}`);
  },

  async removeSection(session: Session, sectionId: number): Promise<void> {
    const path = `/templates/sections/${sectionId}`;
    const response = await apiRequest<ApiEnvelope<Record<string, never>>>(
      { method: 'delete', url: path },
      session.token,
    );
    dataFor(response, ['1000'], `DELETE ${path}`);
  },

  async createQuestion(
    session: Session,
    sectionId: number,
    input: TemplateQuestionCreateInput,
  ): Promise<TemplateQuestion> {
    const path = `/templates/sections/${sectionId}/questions`;
    const response = await apiRequest<ApiEnvelope<TemplateQuestion>>(
      { method: 'post', url: path, data: input },
      session.token,
    );
    return dataFor(response, ['1001'], `POST ${path}`);
  },

  async updateQuestion(
    session: Session,
    questionId: string,
    input: TemplateQuestionUpdateInput,
  ): Promise<TemplateQuestion> {
    const path = `/templates/questions/${encodeURIComponent(questionId)}`;
    const response = await apiRequest<ApiEnvelope<TemplateQuestion>>(
      { method: 'put', url: path, data: input },
      session.token,
    );
    return dataFor(response, ['1000'], `PUT ${path}`);
  },

  async removeQuestion(session: Session, questionId: string): Promise<void> {
    const path = `/templates/questions/${encodeURIComponent(questionId)}`;
    const response = await apiRequest<ApiEnvelope<Record<string, never>>>(
      { method: 'delete', url: path },
      session.token,
    );
    dataFor(response, ['1000'], `DELETE ${path}`);
  },
};
