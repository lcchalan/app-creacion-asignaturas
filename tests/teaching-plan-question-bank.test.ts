import assert from "node:assert/strict";
import test from "node:test";
import {
  defaultQuestionTypeConfiguration,
  questionConfigurationTotal,
  requiredQuestionBankSize,
  validateQuestionBankConfiguration,
  validateQuestionBankQuestions,
  validateStructuredQuestion,
} from "../src/academic/question-bank.js";

const topic = "1.2. Modelo entidad-relación";

function singleQuestion(prompt = "¿Cuál es la finalidad principal de una clave primaria?") {
  return {
    type: "MULTIPLE_CHOICE_SINGLE" as const,
    topic,
    prompt,
    options: [
      { id: "A", text: "Identificar de forma única cada registro", matchText: "" },
      { id: "B", text: "Duplicar los registros", matchText: "" },
      { id: "C", text: "Eliminar todas las relaciones", matchText: "" },
    ],
    answerKey: ["A"],
    feedbackCorrect: "Correcto. La clave primaria garantiza identificación única.",
    feedbackIncorrect: "Revise la propiedad de unicidad de la clave primaria.",
  };
}

test("el mínimo del banco nunca es menor que el número de preguntas del cuestionario", () => {
  assert.equal(requiredQuestionBankSize(20, 10), 20);
  assert.equal(requiredQuestionBankSize(20, 25), 25);
});

test("la configuración docente distribuye tipos y respeta el mínimo institucional", () => {
  const configuration = defaultQuestionTypeConfiguration(20);
  assert.equal(questionConfigurationTotal(configuration), 20);
  assert.equal(validateQuestionBankConfiguration({ configuration, minimumRequired: 20, questionnaireQuestionCount: 10 }).total, 20);
  assert.throws(() => validateQuestionBankConfiguration({
    configuration: [{ type: "TRUE_FALSE", quantity: 10 }], minimumRequired: 20, questionnaireQuestionCount: 10,
  }), /al menos 20 preguntas/);
});

test("cada tipo de pregunta exige una clave y estructura coherentes", () => {
  assert.equal(validateStructuredQuestion(singleQuestion(), [topic]).answerKey[0], "A");
  assert.throws(() => validateStructuredQuestion({ ...singleQuestion(), answerKey: ["A", "B"] }, [topic]), /exactamente una clave/);
  assert.throws(() => validateStructuredQuestion({ ...singleQuestion(), topic: "Tema ajeno" }, [topic]), /tema no autorizado/);
});

test("el banco completo rechaza preguntas duplicadas y cantidades distintas a la configuración", () => {
  const configuration = [{ type: "MULTIPLE_CHOICE_SINGLE" as const, quantity: 2 }];
  assert.throws(() => validateQuestionBankQuestions({
    questions: [singleQuestion(), singleQuestion()], configuration, allowedTopics: [topic], minimumRequired: 2, questionnaireQuestionCount: 2,
  }), /preguntas duplicadas/);
  const questions = [singleQuestion("¿Qué propiedad caracteriza a una clave primaria?"), singleQuestion("¿Qué permite distinguir registros de una tabla?")];
  assert.equal(validateQuestionBankQuestions({
    questions, configuration, allowedTopics: [topic], minimumRequired: 2, questionnaireQuestionCount: 2,
  }).length, 2);
});

test("valida opción múltiple de varias respuestas, verdadero/falso y completar", () => {
  assert.equal(validateStructuredQuestion({
    type: "MULTIPLE_CHOICE_MULTIPLE", topic, prompt: "Seleccione propiedades válidas de una clave primaria.",
    options: [
      { id: "A", text: "Es única", matchText: "" },
      { id: "B", text: "Puede repetirse", matchText: "" },
      { id: "C", text: "Identifica registros", matchText: "" },
    ],
    answerKey: ["A", "C"], feedbackCorrect: "Correcto. Identificó las propiedades pertinentes.", feedbackIncorrect: "Revise unicidad e identificación de registros.",
  }, [topic]).answerKey.length, 2);
  assert.equal(validateStructuredQuestion({
    type: "TRUE_FALSE", topic, prompt: "Una clave primaria debe identificar de forma única un registro.",
    options: [{ id: "V", text: "Verdadero", matchText: "" }, { id: "F", text: "Falso", matchText: "" }],
    answerKey: ["V"], feedbackCorrect: "Correcto. La clave primaria garantiza unicidad.", feedbackIncorrect: "Revise la propiedad de unicidad de la clave primaria.",
  }, [topic]).answerKey[0], "V");
  assert.deepEqual(validateStructuredQuestion({
    type: "FILL_BLANK", topic, prompt: "Complete: La ______ identifica de forma única cada registro.", options: [],
    answerKey: ["clave primaria", "llave primaria"], feedbackCorrect: "Correcto. El concepto esperado es clave primaria.", feedbackIncorrect: "Revise el identificador único de una tabla.",
  }, [topic]).answerKey, ["clave primaria", "llave primaria"]);
});

test("valida preguntas de relacionar y ordenar con clave estructurada", () => {
  const matching = validateStructuredQuestion({
    type: "MATCHING", topic, prompt: "Relacione cada concepto con su definición correspondiente.",
    options: [
      { id: "A", text: "Clave primaria", matchText: "Identifica un registro de forma única" },
      { id: "B", text: "Clave foránea", matchText: "Relaciona registros entre tablas" },
    ],
    answerKey: ["A", "B"], feedbackCorrect: "Correcto. Las relaciones conceptuales son adecuadas.", feedbackIncorrect: "Revise la función de las claves primaria y foránea.",
  }, [topic]);
  assert.equal(matching.options[1]?.matchText, "Relaciona registros entre tablas");
  const ordering = validateStructuredQuestion({
    type: "ORDERING", topic, prompt: "Ordene las etapas básicas del diseño de una base de datos.",
    options: [
      { id: "A", text: "Identificar requisitos", matchText: "" },
      { id: "B", text: "Diseñar el modelo conceptual", matchText: "" },
      { id: "C", text: "Transformar al modelo lógico", matchText: "" },
    ],
    answerKey: ["A", "B", "C"], feedbackCorrect: "Correcto. La secuencia corresponde al proceso de diseño.", feedbackIncorrect: "Revise el orden entre requisitos, modelo conceptual y modelo lógico.",
  }, [topic]);
  assert.deepEqual(ordering.answerKey, ["A", "B", "C"]);
});
