import assert from "node:assert/strict";
import test from "node:test";
import {
  adaptationProposalCanBeApproved,
  adaptationProposalOutputSchema,
  assertAdaptationProposalConsistency,
  resolvedAdaptationContent,
} from "../src/academic/adaptation-policy.js";

const learningOutcomes = ["Analiza fundamentos.", "Aplica estrategias."];
const unitContents = ["Unidad 1. Fundamentos", "Unidad 2. Aplicación"];

function validProposal() {
  return adaptationProposalOutputSchema.parse({
    title: "Propuesta de adaptación del Plan Docente",
    overview: "La propuesta reorganiza los contenidos del documento anterior en ocho semanas lectivas, manteniendo su trazabilidad y alineación con la oferta vigente.",
    sourceWeeks: 16,
    targetWeeks: 8,
    weeklyStructure: Array.from({ length: 8 }, (_, index) => ({
      week: index + 1,
      learningOutcomes: [index < 4 ? learningOutcomes[0] : learningOutcomes[1]],
      contents: [index < 4 ? unitContents[0] : unitContents[1]],
      pedagogicalPurpose: `Propósito pedagógico verificable de la semana ${index + 1}, alineado con los resultados y contenidos institucionales.`,
      sourceWeeks: [index * 2 + 1, index * 2 + 2],
    })),
    changes: [{
      action: "GROUP",
      sourceWeeks: [1, 2],
      sourceContent: "Introducción y fundamentos distribuidos originalmente en dos semanas.",
      proposedWeeks: [1],
      proposedContent: "Unidad 1. Fundamentos",
      rationale: "Se agrupan contenidos introductorios complementarios para concentrar el aprendizaje sin eliminar los conceptos esenciales.",
      learningOutcomes: [learningOutcomes[0]],
      hoursImpact: "Las horas se redistribuyen entre ACD y AA sin alterar el total institucional.",
      evaluationImpact: "No modifica las actividades calificadas oficiales del sistema modular.",
      institutionalBasis: ["Lineamientos del Sistema Modular"],
    }],
  });
}

test("valida una propuesta trazable de adaptación de 16 a 8 semanas", () => {
  assert.doesNotThrow(() => assertAdaptationProposalConsistency(validProposal(), {
    sourceWeeks: 16,
    targetWeeks: 8,
    learningOutcomes,
    unitContents,
  }));
});

test("rechaza una propuesta que no contiene las ocho semanas completas", () => {
  const proposal = validProposal();
  proposal.weeklyStructure.pop();
  assert.throws(() => assertAdaptationProposalConsistency(proposal, {
    sourceWeeks: 16,
    targetWeeks: 8,
    learningOutcomes,
    unitContents,
  }), /semanas 1 a 8/);
});

test("rechaza resultados o contenidos inventados durante la adaptación", () => {
  const proposal = validProposal();
  proposal.weeklyStructure[0]!.contents = ["Unidad inventada"];
  assert.throws(() => assertAdaptationProposalConsistency(proposal, {
    sourceWeeks: 16,
    targetWeeks: 8,
    learningOutcomes,
    unitContents,
  }), /no pertenece a la oferta vigente/);
});

test("solo permite aprobar cambios aceptados o editados con contenido", () => {
  assert.equal(adaptationProposalCanBeApproved([
    { decision: "ACCEPTED" },
    {
      decision: "EDITED",
      teacherEditedContent: "Contenido revisado por el profesor.",
      teacherComment: "Se ajustó la redacción para conservar el alcance disciplinar.",
    },
  ]), true);
  assert.equal(adaptationProposalCanBeApproved([
    { decision: "ACCEPTED" },
    { decision: "REGENERATE", teacherEditedContent: null },
  ]), false);
  assert.equal(adaptationProposalCanBeApproved([
    { decision: "EDITED", teacherEditedContent: "   ", teacherComment: "Edición justificada." },
  ]), false);
  assert.equal(adaptationProposalCanBeApproved([
    { decision: "EDITED", teacherEditedContent: "Contenido final", teacherComment: "Corto" },
  ]), false);
});

test("resuelve el contenido final según la decisión del profesor", () => {
  assert.equal(resolvedAdaptationContent({
    decision: "ACCEPTED",
    sourceContent: "Origen",
    proposedContent: "Propuesta",
  }), "Propuesta");
  assert.equal(resolvedAdaptationContent({
    decision: "EDITED",
    sourceContent: "Origen",
    proposedContent: "Propuesta",
    teacherEditedContent: "Versión final del profesor",
  }), "Versión final del profesor");
  assert.equal(resolvedAdaptationContent({
    decision: "REJECTED",
    sourceContent: "Origen",
    proposedContent: "Propuesta",
  }), "");
});
