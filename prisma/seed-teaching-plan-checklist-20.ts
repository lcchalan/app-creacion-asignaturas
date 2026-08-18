import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const database = new PrismaClient();

const TITLE = "Lista de cotejo institucional del Plan Docente 2026-2027 · 20 criterios";

const indicators = [
  {
    code: "A01",
    name: "Identificación institucional",
    description:
      "Los datos de identificación del Plan Docente están completos y coinciden con la oferta académica vigente: facultad, carrera, asignatura, código, docente responsable, modalidad, período académico, nivel/semestre, créditos, horas ACD/APE/AA, categoría del plan y duración en semanas.",
    stage: "PEER",
  },
  {
    code: "B01",
    name: "Presentación y contextualización",
    description:
      "La presentación y contextualización explican con claridad la importancia, el propósito y la ubicación microcurricular de la asignatura, en coherencia con la descripción institucional y su aporte formativo.",
    stage: "PEER",
  },
  {
    code: "B02",
    name: "Prerrequisitos y adaptaciones curriculares",
    description:
      "Los prerrequisitos corresponden a la información institucional vigente y las adaptaciones curriculares, cuando aplican, son pertinentes y coherentes con el proceso de aprendizaje previsto.",
    stage: "PEER",
  },
  {
    code: "C01",
    name: "Resultados de aprendizaje y contribución al perfil",
    description:
      "Los resultados de aprendizaje corresponden a los aprobados institucionalmente y su nivel de contribución (Inicial, Medio o Final) y relación con el perfil profesional, perfil de egreso y competencias institucionales son coherentes y trazables.",
    stage: "PEER",
  },
  {
    code: "D01",
    name: "Contenidos institucionales",
    description:
      "Las unidades, contenidos y subcontenidos provienen de la fuente curricular institucional y no incorporan temas ajenos, omisiones injustificadas o alteraciones que cambien el alcance académico aprobado.",
    stage: "PEER",
  },
  {
    code: "D02",
    name: "Secuencia y distribución semanal",
    description:
      "Los contenidos se distribuyen en las semanas vigentes mediante una secuencia pedagógica progresiva y coherente con los resultados de aprendizaje de la asignatura.",
    stage: "PEER",
  },
  {
    code: "D03",
    name: "Actividades y componentes de aprendizaje",
    description:
      "Las actividades están correctamente asociadas a los componentes ACD, APE o AA, son significativas y variadas, y las horas asignadas contribuyen de manera observable al logro de los resultados de aprendizaje.",
    stage: "PEER",
  },
  {
    code: "D04",
    name: "Metodología, TAC y recursos",
    description:
      "La metodología activa, las TAC y los recursos de aprendizaje son pertinentes, factibles y coherentes entre sí, con los contenidos, las actividades y los resultados de aprendizaje previstos.",
    stage: "PEER",
  },
  {
    code: "D05",
    name: "Consistencia de horas académicas",
    description:
      "La distribución semanal y el resumen de horas de trabajo académico mantienen coherencia con los totales institucionales de ACD, APE y AA definidos para la asignatura.",
    stage: "PEER",
  },
  {
    code: "E01",
    name: "Configuración de actividades calificadas",
    description:
      "Las actividades calificadas respetan la configuración institucional vigente para la asignatura en código, componente, semana, calificación y peso; la suma total corresponde a 10 puntos y 100 %. Cuando corresponda, Prácticum 4.2 Examen Complexivo aplica su configuración específica vigente.",
    stage: "PEER",
  },
  {
    code: "E02",
    name: "Coherencia de evaluación e instrumentos",
    description:
      "Las actividades evaluadas mantienen consistencia entre la programación semanal y la sección de evaluación en actividad, resultado de aprendizaje, estrategia, instrumento, semana/fecha, calificación y peso; los criterios del instrumento corresponden a la actividad evaluada.",
    stage: "PEER",
  },
  {
    code: "F01",
    name: "Datos del docente responsable",
    description:
      "Los datos del docente responsable están completos y actualizados de acuerdo con la estructura institucional del Plan Docente, incluyendo información académica y profesional requerida.",
    stage: "PEER",
  },
  {
    code: "G01",
    name: "Bibliografía básica y complementaria",
    description:
      "La bibliografía básica y complementaria es real, verificable, pertinente y didácticamente congruente con los resultados de aprendizaje y contenidos; explicita su aporte, cumple la vigencia institucional o justifica fuentes anteriores y utiliza las normas APA vigentes.",
    stage: "PEER",
  },
  {
    code: "G02",
    name: "Recursos Educativos Abiertos",
    description:
      "Los REA cumplen la cantidad mínima definida por la política institucional aplicable, apoyan los resultados de aprendizaje, disponen de enlaces accesibles y evidencian licenciamiento abierto.",
    stage: "PEER",
  },
  {
    code: "Q01",
    name: "Consistencia y completitud institucional",
    description:
      "El Plan Docente supera las validaciones automáticas aplicables y no presenta contradicciones entre datos institucionales, resultados de aprendizaje, contenidos, horas, semanas, actividades, evaluación o asignación docente.",
    stage: "QUALITY",
  },
  {
    code: "Q02",
    name: "Integridad documental y atención de observaciones",
    description:
      "El documento está completo y legible, sin campos obligatorios vacíos, marcadores pendientes, duplicaciones o problemas de estructura, y las observaciones de etapas anteriores han sido atendidas de manera trazable cuando corresponda.",
    stage: "QUALITY",
  },
  {
    code: "DI01",
    name: "Pertinencia de TAC y recursos digitales",
    description:
      "Las TAC, herramientas y recursos digitales previstos son pedagógicamente pertinentes, accesibles y factibles de utilizar en el entorno institucional para las actividades planificadas.",
    stage: "DIITEP",
  },
  {
    code: "DI02",
    name: "Instrumentos para EVA",
    description:
      "Los instrumentos previstos para EVA están correctamente estructurados según su tipo, se relacionan con la actividad y el resultado de aprendizaje, y aplican la escala o configuración de calificación institucional correspondiente.",
    stage: "DIITEP",
  },
  {
    code: "DIR01",
    name: "Coherencia con la planificación de carrera",
    description:
      "El Plan Docente mantiene coherencia global con la planificación académica y curricular de la carrera y con las condiciones institucionales definidas para el período académico.",
    stage: "DIRECTOR",
  },
  {
    code: "DIR02",
    name: "Condición para aprobación final",
    description:
      "Las etapas de revisión activas que anteceden a Dirección se encuentran completadas, no existen correcciones pendientes y el Plan Docente está en condiciones académicas y formales de recibir la aprobación final.",
    stage: "DIRECTOR",
  },
];

async function main() {
  const existing = await database.teachingPlanIndicatorVersion.findFirst({
    where: { title: TITLE },
    include: { indicators: true },
    orderBy: { version: "desc" },
  });

  if (existing) {
    console.log(
      `La lista ya existe: ${existing.title} · v${existing.version} · ${existing.status} · ${existing.indicators.length} criterios. No se realizaron cambios.`,
    );
    return;
  }

  const latest = await database.teachingPlanIndicatorVersion.findFirst({
    orderBy: { version: "desc" },
  });

  const created = await database.$transaction(async (transaction) => {
    await transaction.teachingPlanIndicatorVersion.updateMany({
      where: { status: "ACTIVE" },
      data: { status: "INACTIVE" },
    });

    const version = await transaction.teachingPlanIndicatorVersion.create({
      data: {
        version: (latest?.version ?? 0) + 1,
        title: TITLE,
        status: "ACTIVE",
        activatedAt: new Date(),
        indicators: {
          create: indicators.map((indicator, index) => ({
            ...indicator,
            active: true,
            required: true,
            sortOrder: index + 1,
          })),
        },
      },
      include: {
        indicators: { orderBy: { sortOrder: "asc" } },
      },
    });

    await transaction.auditLog.create({
      data: {
        userId: null,
        action: "TEACHING_PLAN_CHECKLIST_SEEDED",
        entityType: "TeachingPlanIndicatorVersion",
        entityId: version.id,
        details: {
          title: version.title,
          version: version.version,
          indicatorCount: version.indicators.length,
          source: "seed-teaching-plan-checklist-20.ts",
        },
      },
    });

    return version;
  });

  const byStage = created.indicators.reduce((acc, indicator) => {
    acc[indicator.stage] = (acc[indicator.stage] ?? 0) + 1;
    return acc;
  }, {});

  console.log(`Lista creada y activada: ${created.title}`);
  console.log(`Versión: ${created.version}`);
  console.log(`Total de criterios: ${created.indicators.length}`);
  console.log("Criterios por etapa:", byStage);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await database.$disconnect();
  });
