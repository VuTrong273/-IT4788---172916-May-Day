import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/page-header';
import { Panel } from '@/components/ui/panel';
import { label, useApi, useData, type Row } from './api';
import { Alert, Confirm, Editor, ResourcePanel, type Field } from './shared';

type Option = {
  id?: number;
  option_text: string;
  option_value: string;
  order: number;
  trigger_image_upload: number;
};
type Question = Row & {
  question_id: string;
  question_text: string;
  type_question: string;
  options: Option[];
};
type Section = Row & {
  section_id: number;
  title: string;
  questions: Question[];
};
type Template = Row & { sections: Section[] };
const templateFields: Field[] = [
  {
    name: 'code_template',
    label: 'Mã mẫu',
    required: true,
    maxLength: 225,
    createOnly: true,
  },
  { name: 'name', label: 'Tên mẫu', required: true, maxLength: 255 },
  { name: 'description', label: 'Mô tả', type: 'textarea', nullable: true },
  {
    name: 'intake_duration',
    label: 'Chọn tự động theo thời gian khởi phát',
    type: 'select',
    nullable: true,
    choices: [
      { value: 'lt6w', label: 'Dưới 6 tuần' },
      { value: 'gte6w', label: 'Từ 6 tuần' },
    ],
  },
  {
    name: 'version',
    label: 'Phiên bản',
    required: true,
    defaultValue: '1.0',
    maxLength: 20,
  },
  {
    name: 'is_active',
    label: 'Trạng thái',
    type: 'select',
    required: true,
    defaultValue: '1',
    choices: [
      { value: '1', label: 'Hoạt động' },
      { value: '0', label: 'Ngừng sử dụng' },
    ],
  },
];
const flags = [
  { value: '0', label: 'Không' },
  { value: '1', label: 'Có' },
];
const sectionFields: Field[] = [
  { name: 'title', label: 'Tên phần', required: true, maxLength: 255 },
  {
    name: 'order',
    label: 'Thứ tự',
    type: 'number',
    required: true,
    min: 0,
    defaultValue: '0',
  },
  {
    name: 'is_required',
    label: 'Bắt buộc',
    type: 'select',
    numeric: true,
    defaultValue: '0',
    choices: flags,
  },
  {
    name: 'filled_by',
    label: 'Người điền',
    type: 'select',
    required: true,
    defaultValue: 'patient',
    choices: [
      { value: 'patient', label: 'Bệnh nhân' },
      { value: 'doctor', label: 'Bác sĩ' },
      { value: 'patdoc', label: 'Cả hai' },
    ],
  },
];
const questionTypes = [
  { value: 'text', label: 'Văn bản ngắn' },
  { value: 'textarea', label: 'Văn bản dài' },
  { value: 'number', label: 'Số' },
  { value: 'date', label: 'Ngày' },
  { value: 'radio', label: 'Chọn một' },
  { value: 'checkbox', label: 'Chọn nhiều' },
  { value: 'select', label: 'Danh sách chọn' },
  { value: 'image', label: 'Hình ảnh' },
];

function QuestionEditor({
  sectionId,
  row,
  questions,
  onClose,
  onSaved,
}: {
  sectionId: number;
  row?: Question;
  questions: Question[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const api = useApi();
  const [options, setOptions] = useState<Option[]>(
    row?.options.map((o) => ({
      id: o.id,
      option_text: o.option_text,
      option_value: o.option_value,
      order: o.order,
      trigger_image_upload: o.trigger_image_upload,
    })) ?? [],
  );
  let condition = '';
  try {
    const parsed = row?.show_if_answer
      ? (JSON.parse(String(row.show_if_answer)) as Record<string, string[]>)
      : {};
    condition = parsed[String(row?.parent_question_id)]?.[0] ?? '';
  } catch {
    /* Existing invalid condition is not guessed. */
  }
  const fields: Field[] = [
    {
      name: 'question_id',
      label: 'Mã câu hỏi',
      required: true,
      maxLength: 50,
      createOnly: true,
    },
    {
      name: 'question_text',
      label: 'Nội dung câu hỏi',
      type: 'textarea',
      required: true,
    },
    {
      name: 'type_question',
      label: 'Kiểu trả lời',
      type: 'select',
      required: true,
      defaultValue: 'text',
      choices: questionTypes,
    },
    {
      name: 'order',
      label: 'Thứ tự',
      type: 'number',
      required: true,
      defaultValue: '0',
      min: 0,
    },
    {
      name: 'is_required',
      label: 'Bắt buộc',
      type: 'select',
      numeric: true,
      defaultValue: '0',
      choices: flags,
    },
    {
      name: 'allow_image',
      label: 'Cho đính kèm ảnh',
      type: 'select',
      numeric: true,
      defaultValue: '0',
      choices: flags,
    },
    {
      name: 'placeholder',
      label: 'Nội dung gợi ý',
      maxLength: 255,
      nullable: true,
    },
    { name: 'help_text', label: 'Hướng dẫn', type: 'textarea', nullable: true },
    {
      name: 'parent_question_id',
      label: 'Phụ thuộc câu hỏi',
      type: 'select',
      nullable: true,
      choices: questions
        .filter(
          (q) =>
            q.question_id !== row?.question_id &&
            ['radio', 'checkbox', 'select'].includes(q.type_question) &&
            q.options.length,
        )
        .map((q) => ({ value: q.question_id, label: q.question_text })),
    },
    {
      name: 'condition_value',
      label: 'Hiển thị khi câu trả lời là',
      type: 'select',
      nullable: true,
      dependsOn: 'parent_question_id',
      choices: questions.flatMap((question) =>
        question.options.map((option) => ({
          value: option.option_value,
          label: `${question.question_text} — ${option.option_text}`,
          parent: question.question_id,
        })),
      ),
    },
  ];
  function updateOption(index: number, changes: Partial<Option>) {
    setOptions((before) =>
      before.map((o, i) => (i === index ? { ...o, ...changes } : o)),
    );
  }
  return (
    <Editor
      title={row ? 'Cập nhật câu hỏi' : 'Thêm câu hỏi'}
      fields={fields}
      row={row ? { ...row, condition_value: condition } : undefined}
      onClose={onClose}
      prepare={(body, values) => {
        delete body.condition_value;
        const parent = values.parent_question_id;
        const conditionValue = values.condition_value;
        if (parent && conditionValue)
          body.show_if_answer = JSON.stringify({
            [String(parent)]: [conditionValue],
          });
        else if (parent)
          throw new Error(
            'Chọn câu trả lời để xác định khi nào hiển thị câu hỏi này.',
          );
        else body.show_if_answer = null;
        if (
          ['radio', 'checkbox', 'select'].includes(
            String(values.type_question ?? row?.type_question ?? 'text'),
          )
        ) {
          if (!options.length)
            throw new Error('Thêm ít nhất một lựa chọn cho câu hỏi.');
          if (
            new Set(options.map((o) => o.option_value.trim())).size !==
            options.length
          )
            throw new Error('Giá trị các lựa chọn không được trùng nhau.');
          body.options = options.map((option) => ({
            ...option,
            option_text: option.option_text.trim(),
            option_value: option.option_value.trim(),
          }));
        } else body.options = [];
        return body;
      }}
      onSave={async (body) => {
        await api(
          row
            ? `/templates/questions/${encodeURIComponent(row.question_id)}`
            : `/templates/sections/${sectionId}/questions`,
          row ? 'PUT' : 'POST',
          body,
        );
        onSaved();
      }}
    >
      {(values) => {
        const type = String(
          values.type_question ?? row?.type_question ?? 'text',
        );
        const parent = questions.find(
          (q) => q.question_id === values.parent_question_id,
        );
        return (
          <>
            {parent ? (
              <p className="ops-help">
                Câu hỏi này hiển thị khi “{parent.question_text}” có câu trả lời
                đã chọn.
              </p>
            ) : null}
            {['radio', 'checkbox', 'select'].includes(type) ? (
              <section className="ops-subform">
                <h3>Các lựa chọn</h3>
                {options.map((option, index) => (
                  <div
                    className="ops-option-row"
                    key={option.id ?? `new-${index}`}
                  >
                    <label className="ops-field">
                      Nhãn lựa chọn
                      <input
                        required
                        maxLength={255}
                        value={option.option_text}
                        onChange={(e) =>
                          updateOption(index, { option_text: e.target.value })
                        }
                      />
                    </label>
                    <label className="ops-field">
                      Giá trị
                      <input
                        required
                        maxLength={100}
                        value={option.option_value}
                        onChange={(e) =>
                          updateOption(index, { option_value: e.target.value })
                        }
                      />
                    </label>
                    <label className="ops-field">
                      Thứ tự
                      <input
                        type="number"
                        required
                        min={0}
                        value={option.order}
                        onChange={(e) =>
                          updateOption(index, { order: Number(e.target.value) })
                        }
                      />
                    </label>
                    <label className="ops-check">
                      <input
                        type="checkbox"
                        checked={option.trigger_image_upload === 1}
                        onChange={(e) =>
                          updateOption(index, {
                            trigger_image_upload: e.target.checked ? 1 : 0,
                          })
                        }
                      />
                      Yêu cầu ảnh
                    </label>
                    <Button
                      variant="quiet"
                      type="button"
                      onClick={() =>
                        setOptions((before) =>
                          before.filter((_, i) => i !== index),
                        )
                      }
                    >
                      Bỏ lựa chọn
                    </Button>
                  </div>
                ))}
                <Button
                  variant="secondary"
                  type="button"
                  onClick={() =>
                    setOptions((before) => [
                      ...before,
                      {
                        option_text: '',
                        option_value: '',
                        order: before.length,
                        trigger_image_upload: 0,
                      },
                    ])
                  }
                >
                  Thêm lựa chọn
                </Button>
              </section>
            ) : null}
          </>
        );
      }}
    </Editor>
  );
}

function TemplateBuilder({
  templateId,
  onBack,
}: {
  templateId: string;
  onBack: () => void;
}) {
  const api = useApi();
  const template = useData<Template>(
    `/templates/${encodeURIComponent(templateId)}`,
    { sections: [] },
  );
  const [sectionEditor, setSectionEditor] = useState<Section | 'new' | null>(
    null,
  );
  const [questionEditor, setQuestionEditor] = useState<{
    sectionId: number;
    row?: Question;
  } | null>(null);
  const [deleting, setDeleting] = useState<{
    path: string;
    name: string;
  } | null>(null);
  const [notice, setNotice] = useState('');
  const [selectedSection, setSelectedSection] = useState<number | null>(null);
  const [questionPage, setQuestionPage] = useState(1);
  const saved = () => {
    template.reload();
    setNotice('Đã lưu thay đổi vào mẫu phiếu.');
  };
  const questions = template.data.sections.flatMap(
    (section) => section.questions,
  );
  const currentSection = template.data.sections.find((section) => section.section_id === selectedSection) ?? template.data.sections[0];
  const questionPages = Math.max(1, Math.ceil((currentSection?.questions.length ?? 0) / 4));
  const currentQuestionPage = Math.min(questionPage, questionPages);
  return (
    <div className="templates-page template-builder">
      <Button variant="quiet" onClick={onBack}>
        ← Danh sách mẫu phiếu
      </Button>
      <PageHeader
        eyebrow={`THIẾT KẾ MẪU · ${templateId}`}
        title={label(template.data.name)}
        description="Sắp xếp các phần, câu hỏi và lựa chọn. Mẫu đã có bệnh án sẽ được bảo vệ khỏi thay đổi cấu trúc."
        actions={
          <Button permission={['POST', `/templates/${templateId}/sections`]}
            disabled={template.loading || Boolean(template.error)}
            onClick={() => setSectionEditor('new')}
          >
            Thêm phần
          </Button>
        }
      />
      <Alert>{template.error}</Alert>
      <Alert success>{notice}</Alert>
      {template.data.sections.length ? <label className="template-section-picker">Phần của mẫu phiếu
        <select value={currentSection?.section_id ?? ''} onChange={(event) => { setSelectedSection(Number(event.target.value)); setQuestionPage(1); }}>
          {template.data.sections.map((section) => <option key={section.section_id} value={section.section_id}>{String(section.order)}. {section.title} ({section.questions.length} câu hỏi)</option>)}
        </select>
      </label> : null}
      {template.error ? (
        <Button variant="secondary" onClick={template.reload}>
          Thử lại
        </Button>
      ) : template.loading ? (
        <div className="ops-state" role="status">
          Đang tải mẫu phiếu…
        </div>
      ) : template.data.sections.length ? (
        (currentSection ? [currentSection] : []).map((section) => (
          <Panel
            key={section.section_id}
            className="ops-resource"
            title={`${String(section.order)}. ${section.title}`}
            action={
              <div className="ops-actions">
                <Button permission={['PUT', `/templates/sections/${section.section_id}`]}
                  size="small"
                  variant="quiet"
                  onClick={() => setSectionEditor(section)}
                >
                  Sửa phần
                </Button>
                <Button permission={['DELETE', `/templates/sections/${section.section_id}`]}
                  size="small"
                  variant="danger"
                  onClick={() =>
                    setDeleting({
                      path: `/templates/sections/${section.section_id}`,
                      name: section.title,
                    })
                  }
                >
                  Xóa phần
                </Button>
                <Button permission={['POST', `/templates/sections/${section.section_id}/questions`]}
                  size="small"
                  onClick={() =>
                    setQuestionEditor({ sectionId: section.section_id })
                  }
                >
                  Thêm câu hỏi
                </Button>
              </div>
            }
          >
            <p className="ops-help ops-inset">
              Người điền:{' '}
              {section.filled_by === 'doctor'
                ? 'Bác sĩ'
                : section.filled_by === 'patdoc'
                  ? 'Cả hai'
                  : 'Bệnh nhân'}{' '}
              · {section.is_required === 1 ? 'Bắt buộc' : 'Không bắt buộc'}
            </p>
            {section.questions.length ? (
              <ol className="ops-questions">
                {section.questions.slice((currentQuestionPage - 1) * 4, currentQuestionPage * 4).map((question) => (
                  <li key={question.question_id}>
                    <div>
                      <strong>{question.question_text}</strong>
                      <small>
                        {question.question_id} ·{' '}
                        {
                          questionTypes.find(
                            (type) => type.value === question.type_question,
                          )?.label
                        }
                        {question.is_required === 1 ? ' · Bắt buộc' : ''}
                      </small>
                      {question.options.length ? (
                        <div className="ops-tags">
                          {question.options.map((option) => (
                            <span key={option.id} className="ops-pill">
                              {option.option_text}
                            </span>
                          ))}
                        </div>
                      ) : null}
                    </div>
                    <div className="ops-actions">
                      <Button permission={['PUT', `/templates/questions/${question.question_id}`]}
                        variant="quiet"
                        size="small"
                        onClick={() =>
                          setQuestionEditor({
                            sectionId: section.section_id,
                            row: question,
                          })
                        }
                      >
                        Sửa câu hỏi
                      </Button>
                      <Button permission={['DELETE', `/templates/questions/${question.question_id}`]}
                        variant="danger"
                        size="small"
                        onClick={() =>
                          setDeleting({
                            path: `/templates/questions/${encodeURIComponent(question.question_id)}`,
                            name: question.question_text,
                          })
                        }
                      >
                        Xóa câu hỏi
                      </Button>
                    </div>
                  </li>
                ))}
              </ol>
            ) : (
              <div className="ops-state">Phần này chưa có câu hỏi.</div>
            )}
            {questionPages > 1 ? <div className="template-question-pagination">
              <Button size="small" variant="quiet" disabled={currentQuestionPage === 1} onClick={() => setQuestionPage(currentQuestionPage - 1)}>Trước</Button>
              <span>Trang {currentQuestionPage} / {questionPages}</span>
              <Button size="small" variant="quiet" disabled={currentQuestionPage === questionPages} onClick={() => setQuestionPage(currentQuestionPage + 1)}>Sau</Button>
            </div> : null}
          </Panel>
        ))
      ) : (
        <div className="ops-state">
          Mẫu chưa có phần nào. Thêm phần để bắt đầu thiết kế.
        </div>
      )}
      {sectionEditor ? (
        <Editor
          title={sectionEditor === 'new' ? 'Thêm phần' : 'Cập nhật phần'}
          fields={sectionFields}
          row={sectionEditor === 'new' ? undefined : sectionEditor}
          onClose={() => setSectionEditor(null)}
          onSave={async (body) => {
            await api(
              sectionEditor === 'new'
                ? `/templates/${encodeURIComponent(templateId)}/sections`
                : `/templates/sections/${sectionEditor.section_id}`,
              sectionEditor === 'new' ? 'POST' : 'PUT',
              body,
            );
            saved();
          }}
        />
      ) : null}
      {questionEditor ? (
        <QuestionEditor
          {...questionEditor}
          questions={questions}
          onClose={() => setQuestionEditor(null)}
          onSaved={saved}
        />
      ) : null}
      {deleting ? (
        <Confirm
          title="Xóa khỏi mẫu phiếu"
          description={`Xóa “${deleting.name}” và các mục con?`}
          onClose={() => setDeleting(null)}
          onConfirm={async () => {
            await api(deleting.path, 'DELETE');
            saved();
          }}
        />
      ) : null}
    </div>
  );
}

export function TemplatesPage() {
  const [selected, setSelected] = useState('');
  const [active, setActive] = useState('');
  return selected ? (
    <TemplateBuilder templateId={selected} onBack={() => setSelected('')} />
  ) : (
    <div className="templates-page">
      <PageHeader
        eyebrow="BIỂU MẪU KHÁM BỆNH"
        title="Mẫu phiếu"
        description="Tạo mẫu khám và thiết kế các phần, câu hỏi, lựa chọn theo nhu cầu chuyên môn."
      />
      <ResourcePanel
        key={active}
        title="Danh sách mẫu phiếu"
        path="/templates"
        listPath={`/templates/all${active ? `?is_active=${active}` : ''}`}
        fields={templateFields}
        paginated
        pageSize={4}
        toolbar={<label className="template-status-filter"><span>Trạng thái</span>
          <select value={active} onChange={(event) => setActive(event.target.value)}>
            <option value="">Tất cả</option><option value="1">Hoạt động</option><option value="0">Ngừng sử dụng</option>
          </select>
        </label>}
        columns={[
          { key: 'code_template', label: 'MÃ MẪU' },
          { key: 'name', label: 'TÊN MẪU' },
          { key: 'version', label: 'PHIÊN BẢN' },
          {
            key: 'is_active',
            label: 'TRẠNG THÁI',
            render: (row) =>
              <span className={`template-status${String(row.is_active) === '1' ? ' is-active' : ''}`}>{String(row.is_active) === '1' ? 'Hoạt động' : 'Ngừng sử dụng'}</span>,
          },
        ]}
        actions={(row) => (
          <Button
            permission={['GET', `/templates/${row.code_template}`]}
            size="small"
            variant="quiet"
            onClick={() => setSelected(String(row.code_template))}
          >
            Thiết kế
          </Button>
        )}
      />
    </div>
  );
}
