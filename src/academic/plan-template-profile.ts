import JSZip from "jszip";

export type PlanTemplateProfile = {
  identificationColumns: number;
  scheduleColumns: number;
  scheduleIncludesInstrument: boolean;
  scheduleIncludesGrade: boolean;
  evaluationColumns: number;
  evaluationIncludesWorkStrategies: boolean;
  profile: "CURRENT_MODULAR" | "LEGACY_MODULAR" | "UNKNOWN";
};

function decodeXmlText(value: string) {
  return value
    .replace(/&amp;/gu, "&")
    .replace(/&lt;/gu, "<")
    .replace(/&gt;/gu, ">")
    .replace(/&quot;/gu, '"')
    .replace(/&apos;/gu, "'")
    .replace(/&#(\d+);/gu, (_match, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/giu, (_match, code) => String.fromCodePoint(Number.parseInt(code, 16)));
}

function tableText(xml: string) {
  return decodeXmlText([...xml.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/gu)].map((match) => match[1] ?? "").join(" "))
    .replace(/\s+/gu, " ")
    .trim();
}

function tableColumns(xml: string) {
  const grid = xml.match(/<w:tblGrid>([\s\S]*?)<\/w:tblGrid>/u)?.[1] ?? "";
  return [...grid.matchAll(/<w:gridCol\b/gu)].length;
}

export async function inspectPlanTemplateProfile(bytes: Uint8Array): Promise<PlanTemplateProfile> {
  const zip = await JSZip.loadAsync(bytes);
  const documentXml = await zip.file("word/document.xml")?.async("string");
  if (!documentXml) throw new Error("El formato del Plan Docente no contiene word/document.xml.");
  const tables = [...documentXml.matchAll(/<w:tbl\b[\s\S]*?<\/w:tbl>/gu)].map((match) => match[0]);
  const identification = tables.find((table) => {
    const text = tableText(table);
    return text.includes("Facultad") && text.includes("Carrera") && text.includes("Asignatura") && text.includes("Número de créditos");
  });
  const schedule = tables.find((table) => {
    const text = tableText(table);
    return text.includes("Semana") && text.includes("Contenidos") && text.includes("ACD") && text.includes("APE") && text.includes("AA") && text.includes("Actividades de aprendizaje") && text.includes("Recursos de aprendizaje");
  });
  const evaluation = tables.find((table) => {
    const text = tableText(table);
    return text.includes("Componente") && text.includes("Actividad") && text.includes("Semana ejecución") && text.includes("Calificación") && text.includes("Peso");
  });
  const identificationText = identification ? tableText(identification) : "";
  const scheduleText = schedule ? tableText(schedule) : "";
  const evaluationText = evaluation ? tableText(evaluation) : "";
  const profile: PlanTemplateProfile = {
    identificationColumns: identification ? tableColumns(identification) : 0,
    scheduleColumns: schedule ? tableColumns(schedule) : 0,
    scheduleIncludesInstrument: /Instrumentos? de evaluación/iu.test(scheduleText),
    scheduleIncludesGrade: /Calificación/iu.test(scheduleText),
    evaluationColumns: evaluation ? tableColumns(evaluation) : 0,
    evaluationIncludesWorkStrategies: /Estrategias de trabajo/iu.test(evaluationText),
    profile: "UNKNOWN",
  };
  if (profile.identificationColumns === 4 && profile.scheduleColumns === 7 && !profile.scheduleIncludesInstrument && !profile.scheduleIncludesGrade && profile.evaluationColumns === 7 && profile.evaluationIncludesWorkStrategies) {
    profile.profile = "CURRENT_MODULAR";
  } else if (profile.scheduleColumns === 9 && profile.scheduleIncludesInstrument && profile.scheduleIncludesGrade && profile.evaluationColumns === 6) {
    profile.profile = "LEGACY_MODULAR";
  }
  // Keep a small signal from the identification table in case a malformed file matched only generic words.
  if (!identificationText) profile.identificationColumns = 0;
  return profile;
}
