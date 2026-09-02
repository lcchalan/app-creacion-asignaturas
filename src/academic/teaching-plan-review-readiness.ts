export type TeachingPlanQuestionnaireReadinessActivity = {
  code: string;
  week: number;
  activity: string;
  questionnaireQuestionCount: number;
  authorizedTopics: string[];
};

export type TeachingPlanQuestionBankReadinessRecord = {
  evaluatedCode: string;
  status: string;
  questionCount: number;
  minimumRequired: number;
  topicScope: string[];
};

export type TeachingPlanQuestionBankReadinessItem = {
  code: string;
  week: number;
  activity: string;
  ok: boolean;
  status: "APPROVED" | "MISSING" | "NOT_APPROVED" | "INCOMPLETE" | "NEEDS_REVIEW";
  questionCount: number;
  requiredMinimum: number;
  detail: string;
};

export type TeachingPlanQuestionBankReadinessCheck = {
  code: "QUESTION_BANKS";
  label: string;
  ok: boolean;
  blocking: true;
  state: "ok" | "error";
  detail: string;
  items: TeachingPlanQuestionBankReadinessItem[];
};

export function teachingPlanQuestionBankReadinessCheck(input: {
  questionnaires: TeachingPlanQuestionnaireReadinessActivity[];
  banks: TeachingPlanQuestionBankReadinessRecord[];
  institutionalMinimum: number;
}): TeachingPlanQuestionBankReadinessCheck | null {
  if (!input.questionnaires.length) return null;

  const banksByCode = new Map(input.banks.map((bank) => [bank.evaluatedCode, bank]));
  const items = input.questionnaires.map<TeachingPlanQuestionBankReadinessItem>((activity) => {
    const bank = banksByCode.get(activity.code);
    const requiredMinimum = Math.max(
      Number(bank?.minimumRequired || input.institutionalMinimum || 0),
      Number(activity.questionnaireQuestionCount || 0),
    );

    if (!bank) {
      return {
        code: activity.code,
        week: activity.week,
        activity: activity.activity,
        ok: false,
        status: "MISSING",
        questionCount: 0,
        requiredMinimum,
        detail: `${activity.code} utiliza un cuestionario, pero todavía no tiene un banco de preguntas.`,
      };
    }

    const staleTopics = bank.topicScope.some((topic) => !activity.authorizedTopics.includes(topic));
    if (staleTopics || bank.status === "NEEDS_REVIEW") {
      return {
        code: activity.code,
        week: activity.week,
        activity: activity.activity,
        ok: false,
        status: "NEEDS_REVIEW",
        questionCount: bank.questionCount,
        requiredMinimum,
        detail: `El banco de ${activity.code} requiere revisión porque cambió su alcance temático o fue modificado después de su aprobación.`,
      };
    }

    if (bank.questionCount < requiredMinimum) {
      return {
        code: activity.code,
        week: activity.week,
        activity: activity.activity,
        ok: false,
        status: "INCOMPLETE",
        questionCount: bank.questionCount,
        requiredMinimum,
        detail: `El banco de ${activity.code} contiene ${bank.questionCount} preguntas y requiere al menos ${requiredMinimum}.`,
      };
    }

    if (bank.status !== "APPROVED") {
      return {
        code: activity.code,
        week: activity.week,
        activity: activity.activity,
        ok: false,
        status: "NOT_APPROVED",
        questionCount: bank.questionCount,
        requiredMinimum,
        detail: `El banco de ${activity.code} está generado, pero todavía no ha sido aprobado por el profesor.`,
      };
    }

    return {
      code: activity.code,
      week: activity.week,
      activity: activity.activity,
      ok: true,
      status: "APPROVED",
      questionCount: bank.questionCount,
      requiredMinimum,
      detail: `Banco de ${activity.code} aprobado con ${bank.questionCount} preguntas.`,
    };
  });

  const pending = items.filter((item) => !item.ok);
  if (!pending.length) {
    return {
      code: "QUESTION_BANKS",
      label: "Bancos de preguntas",
      ok: true,
      blocking: true,
      state: "ok",
      detail: `${items.length} de ${items.length} bancos de cuestionarios aprobados y vigentes.`,
      items,
    };
  }

  return {
    code: "QUESTION_BANKS",
    label: "Bancos de preguntas",
    ok: false,
    blocking: true,
    state: "error",
    detail: pending.length === 1
      ? pending[0]!.detail
      : `${pending.length} bancos de cuestionarios requieren atención antes de confirmar el Plan Docente.`,
    items,
  };
}
