import { PrismaClient } from "@prisma/client";
import { randomBytes, scryptSync } from "node:crypto";
import { readFile } from "node:fs/promises";

const database = new PrismaClient();

async function main() {
  const adminRole = await database.role.upsert({
    where: { code: "ADMIN" },
    update: {},
    create: {
      code: "ADMIN",
      name: "Administrador",
      description: "Gestiona usuarios, instrucciones y conocimiento institucional.",
    },
  });
  await database.role.upsert({
    where: { code: "TEACHER" },
    update: {},
    create: {
      code: "TEACHER",
      name: "Profesor",
      description: "Crea, revisa y aprueba proyectos de guías didácticas.",
    },
  });
  for (const role of [
    { code: "REVIEWER", name: "Par revisor", description: "Revisa y solicita ajustes en las guías." },
    { code: "QUALITY", name: "Equipo de calidad", description: "Realiza la validación institucional." },
    { code: "DIRECTOR", name: "Director", description: "Consulta y aprueba guías de su carrera." },
    { code: "DIITEP", name: "DIITEP", description: "Realiza la validación tecnopedagógica institucional." },
  ]) {
    await database.role.upsert({
      where: { code: role.code },
      update: { name: role.name, description: role.description },
      create: role,
    });
  }
  const password = process.env.INITIAL_ADMIN_PASSWORD ?? "Cambiar123!";
  const salt = randomBytes(16).toString("hex");
  const admin = await database.user.upsert({
    where: { email: process.env.LOCAL_USER_EMAIL ?? "docente.local@utpl.edu.ec" },
    update: {
      firstName: "Administrador",
      lastName: "Local",
      displayName: "Administrador local",
      passwordHash: `${salt}:${scryptSync(password, salt, 64).toString("hex")}`,
      active: true,
    },
    create: {
      email: process.env.LOCAL_USER_EMAIL ?? "docente.local@utpl.edu.ec",
      firstName: "Administrador",
      lastName: "Local",
      displayName: "Administrador local",
      passwordHash: `${salt}:${scryptSync(password, salt, 64).toString("hex")}`,
    },
  });
  await database.userRole.upsert({
    where: { userId_roleId: { userId: admin.id, roleId: adminRole.id } },
    update: {},
    create: { userId: admin.id, roleId: adminRole.id },
  });
  const knowledgeDocuments = [
    { key: "especificacion-funcional", title: "Especificación funcional", file: "especificacion-funcional-v1.txt", priority: 10 },
    { key: "metodologias-activas", title: "Metodologías activas", file: "metodologias-activas.txt", priority: 40 },
    { key: "normas-apa", title: "Normas APA", file: "normas-apa.txt", priority: 50 },
    { key: "indicaciones-rea", title: "Indicaciones REA", file: "indicaciones-rea.txt", priority: 60 },
  ];
  await database.knowledgeDocument.updateMany({
    where: { key: "indicadores-generales" },
    data: { status: "ARCHIVED" },
  });
  for (const item of knowledgeDocuments) {
    const existing = await database.knowledgeDocument.findFirst({ where: { key: item.key } });
    const contentMarkdown = await readFile(new URL(`../knowledge/${item.file}`, import.meta.url), "utf8");
    if (!existing) {
      await database.knowledgeDocument.create({
        data: {
          key: item.key, title: item.title, version: 1, status: "ACTIVE",
          storagePath: `knowledge/${item.file}`, mimeType: "text/plain",
          originalName: item.file, contentMarkdown, priority: item.priority,
          activatedAt: new Date(), createdById: admin.id,
        },
      });
    } else if (!existing.contentMarkdown && ["text/plain", "text/markdown"].includes(existing.mimeType)) {
      await database.knowledgeDocument.update({
        where: { id: existing.id },
        data: { contentMarkdown, originalName: existing.originalName || item.file, priority: item.priority },
      });
    }
  }
  const indicatorCatalog = [
    ["PA-01", "Correspondencia curricular", "Verifica que contenidos, actividades, recursos y evaluaciones respondan a los resultados de aprendizaje y a la planificación microcurricular.", "PEER", 4],
    ["PA-02", "Rigor disciplinar", "Comprueba que los contenidos sean correctos, suficientes y conceptualmente sólidos.", "PEER", 4],
    ["PA-03", "Actualidad de los contenidos", "Valora que la información y las fuentes estén actualizadas según la naturaleza de la disciplina.", "PEER", 4],
    ["PA-04", "Contextualización del aprendizaje", "Explica qué aprenderá el estudiante, cómo lo logrará y en qué contextos podrá aplicar lo aprendido.", "PEER", 3],
    ["PA-05", "Profundidad y progresión", "Comprueba que los contenidos avancen gradualmente desde la comprensión hasta la aplicación o el análisis.", "PEER", 4],
    ["PA-06", "Relación entre teoría y práctica", "Verifica la inclusión de casos, ejemplos, problemas o aplicaciones relacionados con situaciones reales o profesionales.", "PEER", 4],
    ["PA-07", "Pertinencia de las actividades", "Evalúa si las actividades permiten desarrollar y evidenciar los resultados de aprendizaje.", "PEER", 4],
    ["PA-08", "Evaluación auténtica", "Comprueba que la evaluación demande aplicación, análisis, argumentación, toma de decisiones o producción propia.", "PEER", 3],
    ["PA-09", "Evaluación formativa y retroalimentación", "Verifica que las autoevaluaciones y retroalimentaciones ayuden a identificar errores y mejorar el aprendizaje.", "PEER", 2],
    ["PA-10", "Validez de las fuentes", "Comprueba que las fuentes sean académicas, confiables, pertinentes y adecuadas para la asignatura.", "PEER", 3],
    ["EC-01", "Correspondencia con la matriz", "Verifica que resultados, unidades, contenidos, semanas y metodología coincidan con la matriz aprobada.", "QUALITY", 3],
    ["EC-02", "Estructura institucional", "Comprueba que la guía incluya los componentes, denominaciones y organización establecidos institucionalmente.", "QUALITY", 3],
    ["EC-03", "Distribución semanal", "Valora que los contenidos y actividades estén distribuidos equilibradamente entre las semanas.", "QUALITY", 3],
    ["EC-04", "Consistencia interna", "Verifica que no existan contradicciones entre contenidos, actividades, recursos, tiempos y evaluaciones.", "QUALITY", 3],
    ["EC-05", "Claridad de las instrucciones", "Comprueba que las consignas expliquen qué hacer, cómo hacerlo, con qué recursos y qué resultado se espera.", "QUALITY", 3],
    ["EC-06", "Diálogo didáctico", "Valora una redacción orientadora, motivadora y adecuada para acompañar el aprendizaje autónomo.", "QUALITY", 3],
    ["EC-07", "Claridad y corrección lingüística", "Comprueba la claridad, cohesión, precisión, ortografía, gramática y puntuación del documento.", "QUALITY", 3],
    ["EC-08", "Citación y referencias", "Verifica el cumplimiento de APA 7 y la correspondencia entre citas y referencias.", "QUALITY", 3],
    ["EC-09", "Integridad de enlaces y elementos", "Comprueba que enlaces, tablas, figuras, títulos, numeración y remisiones estén completos e identificados.", "QUALITY", 3],
    ["EC-10", "Declaración del uso de IA", "Verifica que el empleo de IA esté declarado de acuerdo con las disposiciones institucionales.", "QUALITY", 3],
    ["DT-01", "Pertinencia de la metodología activa", "Verifica que la metodología responda a los resultados, contenidos y características de la modalidad en línea.", "DIITEP", 3],
    ["DT-02", "Implementación de la metodología", "Comprueba que la metodología se evidencie en actividades, recursos, interacción y evaluación.", "DIITEP", 3],
    ["DT-03", "Integración guía–aula virtual", "Valora que la guía oriente hacia los recursos, actividades y evaluaciones disponibles en el LMS.", "DIITEP", 3],
    ["DT-04", "Navegación y secuencia digital", "Comprueba que la ruta de aprendizaje sea clara, ordenada y fácil de seguir.", "DIITEP", 2],
    ["DT-05", "Interacción y presencia docente", "Verifica oportunidades de interacción con el contenido, los docentes y otros estudiantes.", "DIITEP", 3],
    ["DT-06", "Calidad de los recursos digitales y REA", "Evalúa la pertinencia, funcionalidad, actualidad, legalidad y finalidad pedagógica de los recursos.", "DIITEP", 3],
    ["DT-07", "Accesibilidad e inclusión", "Comprueba que contenidos y recursos consideren subtítulos, transcripciones, texto alternativo, contraste y legibilidad.", "DIITEP", 3],
    ["DT-08", "Diversidad de aprendizaje", "Verifica diferentes formas de acceder a la información, participar y demostrar el aprendizaje.", "DIITEP", 2],
    ["DT-09", "Carga de trabajo y factibilidad", "Valora que el tiempo requerido sea razonable y coherente con las horas y créditos de la asignatura.", "DIITEP", 2],
    ["DT-10", "Uso pedagógico de IA", "Comprueba que la IA tenga una finalidad formativa y favorezca el análisis y el pensamiento crítico.", "DIITEP", 3],
    ["DT-11", "Uso ético y transparente de IA", "Verifica que se definan los usos permitidos, la supervisión humana y la responsabilidad sobre los resultados.", "DIITEP", 2],
    ["DT-12", "Privacidad y protección de datos", "Comprueba que las actividades no exijan ingresar información sensible en herramientas no autorizadas.", "DIITEP", 2],
    ["DT-13", "Integridad académica ante la IA", "Verifica que las actividades permitan evidenciar autoría, razonamiento y proceso de elaboración.", "DIITEP", 2],
    ["DT-14", "Seguimiento mediante analíticas", "Valora el uso responsable de datos del LMS para acompañar al estudiante y mejorar la experiencia.", "DIITEP", 2],
  ] as const;
  const currentCatalog = await database.indicatorVersion.findFirst({
    where: { title: "Indicadores para la evaluación de guías en línea e IA" },
  });
  if (!currentCatalog) {
    const latest = await database.indicatorVersion.findFirst({ orderBy: { version: "desc" } });
    await database.indicatorVersion.updateMany({ where: { status: "ACTIVE" }, data: { status: "INACTIVE" } });
    await database.indicatorVersion.create({
      data: {
        version: (latest?.version ?? 0) + 1,
        title: "Indicadores para la evaluación de guías en línea e IA", status: "ACTIVE",
        activatedAt: new Date(), createdById: admin.id,
        indicators: {
          create: indicatorCatalog.map(([code, name, description, stage, score], sortOrder) => ({
            code, name, description, stage, score, active: true, required: true, sortOrder,
          })),
        },
      },
    });
  }
}

main()
  .finally(async () => {
    await database.$disconnect();
  });
