import { DateField } from "@/components/forms/date-field";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { appColors } from "@/constants/app-theme";

export type QuestionnaireOption = {
  id: number;
  option_text: string;
  option_value: string;
};
export type QuestionnaireQuestion = {
  question_id: string;
  question_text: string;
  type_question: string;
  placeholder: string | null;
  help_text: string | null;
  is_required: number;
  parent_question_id: string | null;
  show_if_answer: unknown;
  options: QuestionnaireOption[];
};
export type QuestionnaireSection = {
  section_id: number;
  title: string;
  is_required: number;
  filled_by: "patient" | "doctor" | "patdoc";
  questions: QuestionnaireQuestion[];
};
export type AnswerDraft = {
  question_id: string;
  question_option_id: number | null;
  answer_text: string | null;
  answer_value: unknown | null;
};

export function isQuestionVisible(
  question: QuestionnaireQuestion,
  answers: Record<string, AnswerDraft>,
  questionMap: Map<string, QuestionnaireQuestion>,
) {
  if (
    !question.parent_question_id ||
    !question.show_if_answer ||
    typeof question.show_if_answer !== "object" ||
    Array.isArray(question.show_if_answer)
  )
    return true;
  const expected = (question.show_if_answer as Record<string, unknown>)[
    question.parent_question_id
  ];
  if (!Array.isArray(expected)) return true;
  const answer = answers[question.parent_question_id];
  const parentQuestion = questionMap.get(question.parent_question_id);
  const selectedOption = parentQuestion?.options.find(
    (option) => option.id === answer?.question_option_id,
  );
  const actual =
    answer?.answer_value ?? answer?.answer_text ?? selectedOption?.option_value;
  return Array.isArray(actual)
    ? actual.some((value) => expected.includes(value))
    : expected.includes(actual);
}

export function MedicalRecordQuestionnaire({
  sections,
  role,
  answers,
  onChange,
  readOnly = false,
}: {
  sections: QuestionnaireSection[];
  role: "patient" | "doctor";
  answers: Record<string, AnswerDraft>;
  onChange: (questionId: string, value: AnswerDraft) => void;
  readOnly?: boolean;
}) {
  const questionMap = new Map(
    sections.flatMap((section) =>
      section.questions.map(
        (question) => [question.question_id, question] as const,
      ),
    ),
  );
  return (
    <View>
      {sections.map((section) => {
        const editable =
          !readOnly &&
          (section.filled_by === role || section.filled_by === "patdoc");
        return (
          <View key={section.section_id} style={styles.section}>
            <Text style={styles.sectionTitle}>
              {section.title}
              {section.is_required ? " *" : ""}
            </Text>
            {section.questions
              .filter((question) =>
                isQuestionVisible(question, answers, questionMap),
              )
              .map((question) => {
                const answer = answers[question.question_id] ?? {
                  question_id: question.question_id,
                  question_option_id: null,
                  answer_text: null,
                  answer_value: null,
                };
                const currentValues = Array.isArray(answer.answer_value)
                  ? answer.answer_value
                  : [];
                const supportedOptions = [
                  "radio",
                  "select",
                  "checkbox",
                ].includes(question.type_question);
                return (
                  <View key={question.question_id} style={styles.question}>
                    <Text style={styles.questionTitle}>
                      {question.question_text}
                      {question.is_required ? " *" : ""}
                    </Text>
                    {question.help_text ? (
                      <Text style={styles.help}>{question.help_text}</Text>
                    ) : null}
                    {supportedOptions ? (
                      question.options.map((option) => {
                        const checked =
                          question.type_question === "checkbox"
                            ? currentValues.includes(option.option_value)
                            : answer.question_option_id === option.id;
                        return (
                          <Pressable
                            key={option.id}
                            disabled={!editable}
                            accessibilityRole="checkbox"
                            accessibilityState={{ checked }}
                            onPress={() => {
                              if (question.type_question === "checkbox") {
                                const values = checked
                                  ? currentValues.filter(
                                      (value) => value !== option.option_value,
                                    )
                                  : [...currentValues, option.option_value];
                                onChange(question.question_id, {
                                  ...answer,
                                  question_option_id: null,
                                  answer_value: values,
                                });
                              } else {
                                onChange(question.question_id, {
                                  ...answer,
                                  question_option_id: option.id,
                                  answer_value: option.option_value,
                                });
                              }
                            }}
                            style={[
                              styles.option,
                              checked && styles.optionSelected,
                            ]}
                          >
                            <Text
                              style={[
                                styles.optionText,
                                checked && styles.optionTextSelected,
                              ]}
                            >
                              {checked ? "✓  " : "○  "}
                              {option.option_text}
                            </Text>
                          </Pressable>
                        );
                      })
                    ) : question.type_question === "date" ? (
                      <DateField
                        label={question.placeholder ?? "Chọn ngày"}
                        value={answer.answer_text ?? ""}
                        disabled={!editable}
                        onChange={(text) =>
                          onChange(question.question_id, {
                            ...answer,
                            question_option_id: null,
                            answer_text: text,
                            answer_value: null,
                          })
                        }
                      />
                    ) : ["text", "textarea", "number"].includes(
                        question.type_question,
                      ) ? (
                      <TextInput
                        editable={editable}
                        value={answer.answer_text ?? ""}
                        onChangeText={(text) =>
                          onChange(question.question_id, {
                            ...answer,
                            question_option_id: null,
                            answer_text: text,
                            answer_value: null,
                          })
                        }
                        placeholder={question.placeholder ?? "Nhập câu trả lời"}
                        keyboardType={
                          question.type_question === "number"
                            ? "decimal-pad"
                            : "default"
                        }
                        multiline={question.type_question === "textarea"}
                        style={[
                          styles.input,
                          question.type_question === "textarea" &&
                            styles.textArea,
                          !editable && styles.readOnly,
                        ]}
                      />
                    ) : (
                      <Text style={styles.unsupported}>
                        Loại câu hỏi hình ảnh chưa được hỗ trợ trên ứng dụng.
                      </Text>
                    )}
                  </View>
                );
              })}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginTop: 16,
    padding: 18,
    borderRadius: 18,
    backgroundColor: appColors.surface,
    borderWidth: 1,
    borderColor: appColors.border,
  },
  sectionTitle: { color: appColors.ink, fontSize: 17, fontWeight: "800" },
  question: { marginTop: 18 },
  questionTitle: {
    color: appColors.ink,
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 21,
  },
  help: { marginTop: 5, color: appColors.muted, fontSize: 12, lineHeight: 18 },
  option: {
    marginTop: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: appColors.border,
    borderRadius: 12,
  },
  optionSelected: {
    borderColor: appColors.primary,
    backgroundColor: appColors.primarySoft,
  },
  optionText: { color: appColors.ink, fontSize: 13 },
  optionTextSelected: { color: appColors.primaryDark, fontWeight: "700" },
  input: {
    minHeight: 46,
    marginTop: 9,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: appColors.border,
    borderRadius: 12,
    color: appColors.ink,
    backgroundColor: appColors.surface,
  },
  textArea: { minHeight: 100, textAlignVertical: "top" },
  readOnly: { backgroundColor: appColors.canvas },
  unsupported: { marginTop: 8, color: appColors.muted, fontSize: 12 },
});
