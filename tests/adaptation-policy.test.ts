import assert from "node:assert/strict";
import test from "node:test";
import {
  AdaptationProposalConsistencyError,
  adaptationProposalCanBeApproved,
  adaptationProposalOutputSchema,
  assertAdaptationProposalConsistency,
  assertCurrentAdaptationWeeklyStructure,
  assertTeachingPlanRespectsApprovedAdaptation,
  normalizeAdaptationProposalWeekReferences,
  resolvedAdaptationContent,
} from "../src/academic/adaptation-policy.js";

const learningOutcomes = ["Analiza fundamentos.", "Aplica estrategias."];
const unitContents = [
  "UNIDAD: Fundamentos",
  "CONTENIDO: Conceptos básicos",
  "CONTENIDO: Bases integradas",
  "UNIDAD: Aplicación",
  "CONTENIDO: Estrategias",
];

function validProposal() {
  return adaptationProposalOutputSchema.parse({
    title: "Propuesta de adaptación del Plan Docente",
    overview: "La propuesta reorganiza los contenidos del documento anterior en ocho semanas lectivas, manteniendo su trazabilidad y alineación con la oferta vigente.",
    sourceWeeks: 16,
    targetWeeks: 8,
    weeklyStructure: Array.from({ length: 8 }, (_, index) => {
      const firstBlock = index < 4;
      const primaryLearningOutcome = firstBlock ? learningOutcomes[0] : learningOutcomes[1];
      const contents = firstBlock
        ? (index === 0 ? [unitContents[0], unitContents[1], unitContents[2]] : [unitContents[0], unitContents[2]])
        : [unitContents[3], unitContents[4]];
      return {
        week: index + 1,
        primaryLearningOutcome,
        learningOutcomes: [primaryLearningOutcome],
        integrative: false,
        contents,
        pedagogicalPurpose: `Propósito pedagógico verificable de la semana ${index + 1}, alineado con los resultados y contenidos institucionales.`,
        sourceWeeks: [index * 2 + 1, index * 2 + 2],
      };
    }),
    changes: [{
      action: "GROUP",
      sourceWeeks: [1, 2],
      sourceContent: "Introducción y fundamentos distribuidos originalmente en dos semanas.",
      proposedWeeks: [1],
      proposedContent: "UNIDAD: Fundamentos",
      rationale: "Se agrupan contenidos introductorios complementarios para concentrar el aprendizaje sin eliminar los conceptos esenciales.",
      learningOutcomes: [learningOutcomes[0]],
      hoursImpact: "Las horas se redistribuyen entre ACD y AA sin alterar el total institucional.",
      evaluationImpact: "No modifica las actividades calificadas oficiales del sistema modular.",
      institutionalBasis: ["Lineamientos del Sistema Modular"],
    }],
  });
}



test("rechaza propuestas antiguas que no contienen la progresión pedagógica vigente", () => {
  assert.throws(() => assertCurrentAdaptationWeeklyStructure([{
    week: 1,
    learningOutcomes: [learningOutcomes[0]],
    contents: [unitContents[0]],
    pedagogicalPurpose: "Propósito pedagógico suficientemente detallado para esta semana de prueba.",
    sourceWeeks: [1, 2],
  }]), /estructura de adaptación anterior/);
});

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

test("exige conservar la jerarquía unidad-tema dentro de cada semana", () => {
  const proposal = validProposal();
  proposal.weeklyStructure[1]!.contents = [unitContents[2]];
  assert.throws(() => assertAdaptationProposalConsistency(proposal, {
    sourceWeeks: 16,
    targetWeeks: 8,
    learningOutcomes,
    unitContents,
  }), /sin su unidad institucional/);
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

test("la validación estructural no fija en código la política de consecutividad de resultados", () => {
  const proposal = validProposal();
  proposal.weeklyStructure[1]!.primaryLearningOutcome = learningOutcomes[1];
  proposal.weeklyStructure[1]!.learningOutcomes = [learningOutcomes[1]];
  proposal.weeklyStructure[2]!.primaryLearningOutcome = learningOutcomes[0];
  proposal.weeklyStructure[2]!.learningOutcomes = [learningOutcomes[0]];
  assert.doesNotThrow(() => assertAdaptationProposalConsistency(proposal, {
    sourceWeeks: 16,
    targetWeeks: 8,
    learningOutcomes,
    unitContents,
  }));
});

test("la validación estructural permite marcar una semana integradora sin imponer en código su posición", () => {
  const proposal = validProposal();
  proposal.weeklyStructure[5]!.integrative = true;
  proposal.weeklyStructure[5]!.learningOutcomes = [learningOutcomes[1], learningOutcomes[0]];
  assert.doesNotThrow(() => assertAdaptationProposalConsistency(proposal, {
    sourceWeeks: 16,
    targetWeeks: 8,
    learningOutcomes,
    unitContents,
  }));
});

test("permite proponer la omisión explícita de un tema redundante conservando su cobertura", () => {
  const proposal = validProposal();
  proposal.weeklyStructure.forEach((week) => {
    week.contents = week.contents.filter((item) => item !== unitContents[1]);
  });
  proposal.changes.push({
    action: "DELETE",
    sourceWeeks: [1, 2],
    sourceContent: unitContents[1],
    proposedWeeks: [1],
    proposedContent: unitContents[2],
    rationale: "Se propone omitir este tema porque su alcance conceptual ya está contenido de forma explícita en el tema institucional que se conserva, sin afectar el resultado de aprendizaje.",
    learningOutcomes: [learningOutcomes[0]],
    hoursImpact: "Las horas se redistribuyen dentro del mismo bloque de resultado de aprendizaje.",
    evaluationImpact: "La evidencia del resultado se mantiene en la actividad prevista para el bloque.",
    institutionalBasis: ["Lineamientos del Sistema Modular"],
  });
  assert.doesNotThrow(() => assertAdaptationProposalConsistency(proposal, {
    sourceWeeks: 16,
    targetWeeks: 8,
    learningOutcomes,
    unitContents,
    allowInstitutionalContentOmissions: true,
  }));
});

test("rechaza omitir un tema institucional sin una omisión explícita para el profesor", () => {
  const proposal = validProposal();
  proposal.weeklyStructure.forEach((week) => {
    week.contents = week.contents.filter((item) => item !== unitContents[1]);
  });
  assert.throws(() => assertAdaptationProposalConsistency(proposal, {
    sourceWeeks: 16,
    targetWeeks: 8,
    learningOutcomes,
    unitContents,
    allowInstitutionalContentOmissions: true,
  }), /sin presentarlo como una decisión explícita/);
});

test("nunca permite omitir una unidad institucional", () => {
  const proposal = validProposal();
  proposal.weeklyStructure[0]!.contents = proposal.weeklyStructure[0]!.contents.filter((item) => item !== unitContents[0]);
  proposal.changes.push({
    action: "DELETE",
    sourceWeeks: [1],
    sourceContent: unitContents[0],
    proposedWeeks: [1],
    proposedContent: unitContents[2],
    rationale: "Se intentaría omitir una unidad completa por solapamiento, lo cual no está permitido por la política curricular.",
    learningOutcomes: [learningOutcomes[0]],
    hoursImpact: "No corresponde aplicar un impacto de horas por omisión de una unidad.",
    evaluationImpact: "No corresponde modificar la evaluación por esta vía.",
    institutionalBasis: ["Lineamientos del Sistema Modular"],
  });
  assert.throws(() => assertAdaptationProposalConsistency(proposal, {
    sourceWeeks: 16,
    targetWeeks: 8,
    learningOutcomes,
    unitContents,
    allowInstitutionalContentOmissions: true,
  }), /unidades de la oferta deben conservarse siempre|unidad institucional/);
});


test("corrige una semana de destino inválida usando la trazabilidad semanal propuesta", () => {
  const proposal = validProposal();
  proposal.changes[0]!.sourceWeeks = [15, 16];
  proposal.changes[0]!.proposedWeeks = [15];
  proposal.changes[0]!.learningOutcomes = [learningOutcomes[1]];
  const normalized = normalizeAdaptationProposalWeekReferences(proposal, 8);
  assert.equal(normalized.corrected, true);
  assert.deepEqual(normalized.proposal.changes[0]!.proposedWeeks, [8]);
  assert.doesNotThrow(() => assertAdaptationProposalConsistency(normalized.proposal, {
    sourceWeeks: 16,
    targetWeeks: 8,
    learningOutcomes,
    unitContents,
  }));
});

test("los errores de consistencia de adaptación son validaciones visibles para el usuario", () => {
  const proposal = validProposal();
  proposal.changes[0]!.proposedWeeks = [15];
  assert.throws(() => assertAdaptationProposalConsistency(proposal, {
    sourceWeeks: 16,
    targetWeeks: 8,
    learningOutcomes,
    unitContents,
  }), (error: unknown) => {
    if (!(error instanceof AdaptationProposalConsistencyError)) return false;
    assert.equal(error.statusCode, 422);
    assert.equal(error.code, "ADAPTATION_PROPOSAL_INVALID");
    assert.match(error.message, /semana de destino fuera del rango 1-8/);
    return true;
  });
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


test("una omisión aceptada no se convierte en contenido final", () => {
  assert.equal(resolvedAdaptationContent({
    action: "DELETE",
    decision: "ACCEPTED",
    sourceContent: unitContents[1],
    proposedContent: unitContents[2],
  }), "");
});

test("el Plan Docente adaptado debe respetar el resultado principal aprobado por semana", () => {
  const proposal = validProposal();
  const plan = {
    sequences: [
      {
        learningOutcome: learningOutcomes[0],
        weeks: proposal.weeklyStructure.slice(0, 4).map((week) => ({
          week: week.week,
          unitContents: week.contents,
        })),
      },
      {
        learningOutcome: learningOutcomes[1],
        weeks: proposal.weeklyStructure.slice(4).map((week) => ({
          week: week.week,
          unitContents: week.contents,
        })),
      },
    ],
  };
  assert.doesNotThrow(() => assertTeachingPlanRespectsApprovedAdaptation(
    plan,
    {
      weeklyStructure: proposal.weeklyStructure,
      changes: proposal.changes.map((change) => ({ ...change, decision: "ACCEPTED" })),
    },
    unitContents,
  ));

  plan.sequences[0]!.weeks = plan.sequences[0]!.weeks.filter((week) => week.week !== 2);
  plan.sequences[1]!.weeks.push({ week: 2, unitContents: [unitContents[4]] });
  assert.throws(() => assertTeachingPlanRespectsApprovedAdaptation(
    plan,
    {
      weeklyStructure: proposal.weeklyStructure,
      changes: proposal.changes.map((change) => ({ ...change, decision: "ACCEPTED" })),
    },
    unitContents,
  ), /resultado distinto del aprobado/);
});

test("el Plan Docente adaptado debe conservar exactamente los contenidos aprobados para cada semana", () => {
  const proposal = validProposal();
  const plan = {
    sequences: [
      {
        learningOutcome: learningOutcomes[0],
        weeks: proposal.weeklyStructure.slice(0, 4).map((week) => ({
          week: week.week,
          unitContents: [...week.contents],
        })),
      },
      {
        learningOutcome: learningOutcomes[1],
        weeks: proposal.weeklyStructure.slice(4).map((week) => ({
          week: week.week,
          unitContents: [...week.contents],
        })),
      },
    ],
  };
  plan.sequences[0]!.weeks[0]!.unitContents = [unitContents[0], unitContents[2]];
  assert.throws(() => assertTeachingPlanRespectsApprovedAdaptation(
    plan,
    {
      weeklyStructure: proposal.weeklyStructure,
      changes: proposal.changes.map((change) => ({ ...change, decision: "ACCEPTED" })),
    },
    unitContents,
  ), /no conserva exactamente los contenidos aprobados/);
});

test("el Plan Docente no puede reincorporar un tema cuya omisión fue aceptada", () => {
  const proposal = validProposal();
  proposal.weeklyStructure.forEach((week) => {
    week.contents = week.contents.filter((item) => item !== unitContents[1]);
  });
  proposal.changes.push({
    action: "DELETE",
    sourceWeeks: [1, 2],
    sourceContent: unitContents[1],
    proposedWeeks: [1],
    proposedContent: unitContents[2],
    rationale: "Se propone omitir este tema porque su alcance está cubierto por el contenido institucional retenido y la omisión fue sometida a decisión del profesor.",
    learningOutcomes: [learningOutcomes[0]],
    hoursImpact: "Las horas se mantienen dentro del bloque pedagógico aprobado.",
    evaluationImpact: "La evidencia prevista sigue evaluando el mismo resultado de aprendizaje.",
    institutionalBasis: ["Lineamientos del Sistema Modular"],
  });

  assert.doesNotThrow(() => assertAdaptationProposalConsistency(proposal, {
    sourceWeeks: 16,
    targetWeeks: 8,
    learningOutcomes,
    unitContents,
    allowInstitutionalContentOmissions: true,
  }));

  const plan = {
    sequences: [
      {
        learningOutcome: learningOutcomes[0],
        weeks: proposal.weeklyStructure.slice(0, 4).map((week) => ({
          week: week.week,
          unitContents: week.week === 1 ? [...week.contents, unitContents[1]] : week.contents,
        })),
      },
      {
        learningOutcome: learningOutcomes[1],
        weeks: proposal.weeklyStructure.slice(4).map((week) => ({
          week: week.week,
          unitContents: week.contents,
        })),
      },
    ],
  };

  assert.throws(() => assertTeachingPlanRespectsApprovedAdaptation(
    plan,
    {
      weeklyStructure: proposal.weeklyStructure,
      changes: proposal.changes.map((change) => ({ ...change, decision: "ACCEPTED" })),
    },
    unitContents,
  ), /no conserva exactamente|reincorporó/);
});

