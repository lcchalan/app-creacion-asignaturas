import { z } from "zod";

export const QUESTION_BANK_MINIMUM_SETTING_KEY = "TEACHING_PLAN_QUESTION_BANK_MINIMUM_QUESTIONS";
export const DEFAULT_QUESTION_BANK_MINIMUM = 20;
export const MAX_QUESTION_BANK_SIZE = 200;

export const questionTypeSchema = z.enum([
  "MULTIPLE_CHOICE_SINGLE",
  "MULTIPLE_CHOICE_MULTIPLE",
  "TRUE_FALSE",
  "FILL_BLANK",
  "MATCHING",
  "ORDERING",
]);

export const questionSourceSchema = z.enum(["AI", "AI_REGENERATED", "TEACHER_EDITED"]);
export const questionBankStatusSchema = z.enum(["DRAFT", "GENERATED", "APPROVED", "NEEDS_REVIEW"]);

export const questionOptionSchema = z.object({
  id: z.string().trim().min(1).max(40),
  text: z.string().trim().min(1).max(2000),
  matchText: z.string().trim().max(2000),
});

export const questionTypeConfigurationItemSchema = z.object({
  type: questionTypeSchema,
  quantity: z.number().int().min(1).max(MAX_QUESTION_BANK_SIZE),
});

export const questionTypeConfigurationSchema = z.array(questionTypeConfigurationItemSchema).min(1).max(6).superRefine((items, context) => {
  const types = items.map((item) => item.type);
  if (new Set(types).size !== types.length) {
    context.addIssue({ code: "custom", message: "Cada tipo de pregunta puede configurarse una sola vez." });
  }
  const total = items.reduce((sum, item) => sum + item.quantity, 0);
  if (total > MAX_QUESTION_BANK_SIZE) {
    context.addIssue({ code: "custom", message: `El banco no puede superar ${MAX_QUESTION_BANK_SIZE} preguntas.` });
  }
});

export const structuredQuestionSchema = z.object({
  type: questionTypeSchema,
  topic: z.string().trim().min(1).max(4000),
  prompt: z.string().trim().min(5).max(6000),
  options: z.array(questionOptionSchema).max(20).default([]),
  answerKey: z.array(z.string().trim().min(1).max(2000)).min(1).max(20),
  feedbackCorrect: z.string().trim().min(5).max(4000),
  feedbackIncorrect: z.string().trim().min(5).max(4000),
});

export type StructuredQuestion = z.infer<typeof structuredQuestionSchema>;
export type QuestionType = z.infer<typeof questionTypeSchema>;
export type QuestionTypeConfiguration = z.infer<typeof questionTypeConfigurationSchema>;

function optionIds(question: StructuredQuestion) {
  return question.options.map((option) => option.id);
}

export function validateStructuredQuestion(questionInput: unknown, allowedTopics?: string[]) {
  const question = structuredQuestionSchema.parse(questionInput);
  if (allowedTopics && !allowedTopics.includes(question.topic)) {
    throw new Error(`La pregunta utiliza un tema no autorizado: ${question.topic}.`);
  }
  const ids = optionIds(question);
  if (new Set(ids).size !== ids.length) throw new Error("Las opciones de respuesta no pueden repetir identificadores.");

  if (question.type === "MULTIPLE_CHOICE_SINGLE") {
    if (question.options.length < 2) throw new Error("Opción múltiple de una respuesta requiere al menos dos opciones.");
    if (question.answerKey.length !== 1 || !ids.includes(question.answerKey[0]!)) {
      throw new Error("Opción múltiple de una respuesta debe tener exactamente una clave válida.");
    }
  }
  if (question.type === "MULTIPLE_CHOICE_MULTIPLE") {
    if (question.options.length < 3) throw new Error("Opción múltiple de varias respuestas requiere al menos tres opciones.");
    if (question.answerKey.length < 2 || question.answerKey.some((key) => !ids.includes(key))) {
      throw new Error("Opción múltiple de varias respuestas debe tener al menos dos claves válidas.");
    }
  }
  if (question.type === "TRUE_FALSE") {
    if (question.options.length !== 2) throw new Error("Verdadero/Falso debe contener exactamente dos opciones.");
    if (question.answerKey.length !== 1 || !ids.includes(question.answerKey[0]!)) {
      throw new Error("Verdadero/Falso debe tener exactamente una clave válida.");
    }
  }
  if (question.type === "FILL_BLANK") {
    if (question.options.length !== 0) throw new Error("Completar no utiliza opciones de respuesta.");
    if (!question.answerKey.length) throw new Error("Completar debe registrar al menos una respuesta aceptada.");
  }
  if (question.type === "MATCHING") {
    if (question.options.length < 2 || question.options.some((option) => !option.matchText)) {
      throw new Error("Relacionar requiere al menos dos pares completos.");
    }
    if (question.answerKey.length !== question.options.length || question.answerKey.some((key) => !ids.includes(key))) {
      throw new Error("Relacionar debe conservar una clave para cada par.");
    }
  }
  if (question.type === "ORDERING") {
    if (question.options.length < 2) throw new Error("Ordenar requiere al menos dos elementos.");
    if (question.answerKey.length !== question.options.length || new Set(question.answerKey).size !== ids.length || question.answerKey.some((key) => !ids.includes(key))) {
      throw new Error("Ordenar debe indicar el orden correcto utilizando todos los elementos una sola vez.");
    }
  }
  return question;
}

export function normalizeQuestionBankMinimum(value: unknown, fallback = DEFAULT_QUESTION_BANK_MINIMUM) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > MAX_QUESTION_BANK_SIZE) return fallback;
  return parsed;
}

export function requiredQuestionBankSize(adminMinimum: number, questionnaireQuestionCount: number) {
  return Math.max(normalizeQuestionBankMinimum(adminMinimum), Math.max(1, Math.trunc(questionnaireQuestionCount || 0)));
}

export function questionConfigurationTotal(configuration: QuestionTypeConfiguration) {
  return configuration.reduce((sum, item) => sum + item.quantity, 0);
}

export function validateQuestionBankConfiguration(input: {
  configuration: unknown;
  minimumRequired: number;
  questionnaireQuestionCount: number;
}) {
  const configuration = questionTypeConfigurationSchema.parse(input.configuration);
  const required = requiredQuestionBankSize(input.minimumRequired, input.questionnaireQuestionCount);
  const total = questionConfigurationTotal(configuration);
  if (total < required) {
    throw new Error(`El banco debe contener al menos ${required} preguntas; la configuración actual genera ${total}.`);
  }
  return { configuration, required, total };
}

export function validateQuestionBankQuestions(input: {
  questions: unknown[];
  configuration: QuestionTypeConfiguration;
  allowedTopics: string[];
  minimumRequired: number;
  questionnaireQuestionCount: number;
}) {
  const required = requiredQuestionBankSize(input.minimumRequired, input.questionnaireQuestionCount);
  if (input.questions.length < required) {
    throw new Error(`El banco debe contener al menos ${required} preguntas; actualmente contiene ${input.questions.length}.`);
  }
  const parsed = input.questions.map((question) => validateStructuredQuestion(question, input.allowedTopics));
  const normalizedPrompts = parsed.map((question) => question.prompt.trim().toLocaleLowerCase("es"));
  if (new Set(normalizedPrompts).size !== normalizedPrompts.length) throw new Error("El banco contiene preguntas duplicadas.");
  const expected = new Map(input.configuration.map((item) => [item.type, item.quantity]));
  const actual = new Map<QuestionType, number>();
  for (const question of parsed) actual.set(question.type, (actual.get(question.type) ?? 0) + 1);
  for (const [type, quantity] of expected) {
    if ((actual.get(type) ?? 0) !== quantity) throw new Error(`El banco debe contener exactamente ${quantity} preguntas del tipo ${type}.`);
  }
  for (const [type, quantity] of actual) {
    if (!expected.has(type) && quantity > 0) throw new Error(`El banco contiene preguntas del tipo ${type}, que no fue seleccionado por el profesor.`);
  }
  return parsed;
}

export function defaultQuestionTypeConfiguration(totalRequested: number): QuestionTypeConfiguration {
  const total = Math.max(4, Math.min(MAX_QUESTION_BANK_SIZE, Math.trunc(totalRequested || DEFAULT_QUESTION_BANK_MINIMUM)));
  const single = Math.max(1, Math.round(total * 0.5));
  const multiple = Math.max(1, Math.round(total * 0.2));
  const trueFalse = Math.max(1, Math.round(total * 0.15));
  const fillBlank = Math.max(1, total - single - multiple - trueFalse);
  const items: QuestionTypeConfiguration = [
    { type: "MULTIPLE_CHOICE_SINGLE", quantity: single },
    { type: "MULTIPLE_CHOICE_MULTIPLE", quantity: multiple },
    { type: "TRUE_FALSE", quantity: trueFalse },
    { type: "FILL_BLANK", quantity: fillBlank },
  ];
  const current = questionConfigurationTotal(items);
  if (current !== total) items[0]!.quantity += total - current;
  return items;
}
