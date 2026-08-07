import { z } from "zod";

export const CANONICAL_GUIDE_SCHEMA_VERSION = "1.0.0" as const;
export const CANONICAL_GUIDE_SCHEMA_PATH = "/schemas/guide-canonical-v1.schema.json" as const;

const isoDateTimeSchema = z.string().datetime({ offset: true });

const canonicalMatrixRowSchema = z.strictObject({
  id: z.string().min(1),
  order: z.number().int().positive(),
  weekNumber: z.number().int().positive(),
  learningOutcome: z.string().min(1),
  unitContentLiteral: z.string().min(1),
  methodology: z.string().min(1),
});

const canonicalWeekSchema = z.strictObject({
  weekNumber: z.number().int().positive(),
  status: z.enum(["pending", "generated", "in_review", "approved", "requires_review"]),
  sourceMatrixRowIds: z.array(z.string().min(1)),
  content: z.strictObject({
    format: z.literal("markdown"),
    draft: z.string(),
    approved: z.string().nullable(),
  }),
  currentVersion: z.number().int().nonnegative(),
  approvedAt: isoDateTimeSchema.nullable(),
});

const canonicalImageAssetSchema = z.strictObject({
  id: z.string().uuid(),
  kind: z.literal("image"),
  weekNumber: z.number().int().positive(),
  figureNumber: z.number().int().positive(),
  title: z.string().min(1),
  altText: z.string().min(1),
  source: z.string().min(1),
  prompt: z.string().min(1),
  style: z.string().min(1),
  mimeType: z.string().regex(/^image\//),
  fileName: z.string().min(1),
  storage: z.strictObject({
    type: z.literal("endpoint"),
    href: z.string().startsWith("/api/generated-images/"),
  }),
});

export const canonicalGuideSchema = z.strictObject({
  $schema: z.literal(CANONICAL_GUIDE_SCHEMA_PATH),
  schemaVersion: z.literal(CANONICAL_GUIDE_SCHEMA_VERSION),
  documentType: z.literal("didactic-guide"),
  documentId: z.string().uuid(),
  language: z.literal("es"),
  status: z.enum(["draft", "in_progress", "completed", "archived"]),
  metadata: z.strictObject({
    projectName: z.string().min(1),
    academicLevel: z.string().min(1),
    faculty: z.string().min(1),
    career: z.string().min(1),
    professorName: z.string(),
    subject: z.strictObject({
      code: z.string(),
      name: z.string().min(1),
      type: z.string().min(1),
    }),
    modality: z.string().min(1),
    academicPeriod: z.string().min(1),
    totalWeeks: z.number().int().positive(),
  }),
  planning: z.strictObject({
    sourceMatrix: z.strictObject({
      fileName: z.string().nullable(),
      rows: z.array(canonicalMatrixRowSchema).min(1),
    }),
  }),
  bibliography: z.strictObject({
    format: z.literal("markdown"),
    basic: z.string().min(1),
    complementary: z.string().min(1),
    openEducationalResources: z.string(),
  }),
  weeks: z.array(canonicalWeekSchema).min(1),
  assets: z.array(canonicalImageAssetSchema),
  traceability: z.strictObject({
    sourceSystem: z.literal("app-creacion-asignaturas"),
    createdAt: isoDateTimeSchema,
    updatedAt: isoDateTimeSchema,
  }),
}).superRefine((guide, context) => {
  if (guide.weeks.length !== guide.metadata.totalWeeks) {
    context.addIssue({
      code: "custom",
      path: ["weeks"],
      message: "El número de semanas debe coincidir con metadata.totalWeeks.",
    });
  }

  guide.weeks.forEach((week, index) => {
    if (week.weekNumber !== index + 1) {
      context.addIssue({
        code: "custom",
        path: ["weeks", index, "weekNumber"],
        message: "Las semanas deben estar ordenadas y formar una secuencia desde 1.",
      });
    }
  });

  const matrixRows = new Map(guide.planning.sourceMatrix.rows.map((row) => [row.id, row]));
  if (matrixRows.size !== guide.planning.sourceMatrix.rows.length) {
    context.addIssue({
      code: "custom",
      path: ["planning", "sourceMatrix", "rows"],
      message: "Los identificadores de las filas de matriz deben ser únicos.",
    });
  }
  guide.planning.sourceMatrix.rows.forEach((row, index) => {
    if (row.order !== index + 1 || row.weekNumber > guide.metadata.totalWeeks) {
      context.addIssue({
        code: "custom",
        path: ["planning", "sourceMatrix", "rows", index],
        message: "Las filas deben conservar su orden y pertenecer a una semana del proyecto.",
      });
    }
  });
  for (const [weekIndex, week] of guide.weeks.entries()) {
    if (!week.sourceMatrixRowIds.length) {
      context.addIssue({
        code: "custom",
        path: ["weeks", weekIndex, "sourceMatrixRowIds"],
        message: "Cada semana debe estar vinculada al menos a una fila de la matriz.",
      });
    }
    for (const [referenceIndex, rowId] of week.sourceMatrixRowIds.entries()) {
      const row = matrixRows.get(rowId);
      if (!row || row.weekNumber !== week.weekNumber) {
        context.addIssue({
          code: "custom",
          path: ["weeks", weekIndex, "sourceMatrixRowIds", referenceIndex],
          message: "La fila de matriz referenciada debe existir y pertenecer a la misma semana.",
        });
      }
    }
  }

  guide.assets.forEach((asset, index) => {
    if (asset.weekNumber > guide.metadata.totalWeeks) {
      context.addIssue({
        code: "custom",
        path: ["assets", index, "weekNumber"],
        message: "El activo no puede referirse a una semana fuera del proyecto.",
      });
    }
  });
});

export type CanonicalGuide = z.infer<typeof canonicalGuideSchema>;

export interface CanonicalGuideSource {
  project: {
    id: string;
    name: string;
    level: string;
    faculty: string;
    career: string;
    professorName: string;
    subjectCode: string;
    subjectName: string;
    subjectType: string;
    modality: string;
    academicPeriod: string;
    totalWeeks: number;
    basicBib: string;
    complementaryBib: string;
    reaBib: string | null;
    status: string;
    createdAt: Date;
    updatedAt: Date;
  };
  matrix: {
    originalName: string | null;
    rows: Array<{
      id: string;
      rowOrder: number;
      weekNumber: number;
      learningOutcome: string;
      unitContent: string;
      methodology: string;
    }>;
  } | null;
  weeks: Array<{
    weekNumber: number;
    status: string;
    draftContent: string | null;
    approvedContent: string | null;
    approvedAt: Date | null;
    currentVersion: number;
  }>;
  generatedImages: Array<{
    id: string;
    weekNumber: number;
    figureNumber: number;
    title: string;
    altText: string;
    source: string;
    prompt: string;
    style: string;
    mimeType: string;
  }>;
}

function canonicalProjectStatus(status: string): CanonicalGuide["status"] {
  if (status === "COMPLETED") return "completed";
  if (status === "IN_PROGRESS") return "in_progress";
  if (status === "ARCHIVED") return "archived";
  return "draft";
}

function canonicalWeekStatus(status: string): CanonicalGuide["weeks"][number]["status"] {
  if (status === "APPROVED") return "approved";
  if (status === "REQUIRES_REVIEW") return "requires_review";
  if (status === "IN_REVIEW") return "in_review";
  if (status === "GENERATED") return "generated";
  return "pending";
}

function imageExtension(mimeType: string) {
  if (mimeType === "image/jpeg") return "jpg";
  if (mimeType === "image/webp") return "webp";
  if (mimeType === "image/gif") return "gif";
  return "png";
}

export function buildCanonicalGuide(source: CanonicalGuideSource): CanonicalGuide {
  if (!source.matrix?.rows.length) {
    throw new Error("No se puede crear el JSON canónico sin filas de la matriz.");
  }

  const rows = [...source.matrix.rows]
    .sort((left, right) => left.rowOrder - right.rowOrder)
    .map((row) => ({
      id: `matrix-row-${row.rowOrder}`,
      order: row.rowOrder,
      weekNumber: row.weekNumber,
      learningOutcome: row.learningOutcome,
      unitContentLiteral: row.unitContent,
      methodology: row.methodology,
    }));

  const weeksByNumber = new Map(source.weeks.map((week) => [week.weekNumber, week]));
  const weeks: CanonicalGuide["weeks"] = Array.from(
    { length: source.project.totalWeeks },
    (_, index) => {
      const weekNumber = index + 1;
      const week = weeksByNumber.get(weekNumber);
      return {
        weekNumber,
        status: canonicalWeekStatus(week?.status ?? "PENDING"),
        sourceMatrixRowIds: rows.filter((row) => row.weekNumber === weekNumber).map((row) => row.id),
        content: {
          format: "markdown" as const,
          draft: week?.draftContent ?? "",
          approved: week?.approvedContent || null,
        },
        currentVersion: week?.currentVersion ?? 0,
        approvedAt: week?.approvedAt?.toISOString() ?? null,
      };
    },
  );

  return canonicalGuideSchema.parse({
    $schema: CANONICAL_GUIDE_SCHEMA_PATH,
    schemaVersion: CANONICAL_GUIDE_SCHEMA_VERSION,
    documentType: "didactic-guide",
    documentId: source.project.id,
    language: "es",
    status: canonicalProjectStatus(source.project.status),
    metadata: {
      projectName: source.project.name,
      academicLevel: source.project.level,
      faculty: source.project.faculty,
      career: source.project.career,
      professorName: source.project.professorName,
      subject: {
        code: source.project.subjectCode,
        name: source.project.subjectName,
        type: source.project.subjectType,
      },
      modality: source.project.modality,
      academicPeriod: source.project.academicPeriod,
      totalWeeks: source.project.totalWeeks,
    },
    planning: {
      sourceMatrix: {
        fileName: source.matrix.originalName,
        rows,
      },
    },
    bibliography: {
      format: "markdown",
      basic: source.project.basicBib,
      complementary: source.project.complementaryBib,
      openEducationalResources: source.project.reaBib ?? "",
    },
    weeks,
    assets: [...source.generatedImages]
      .filter((image) => image.weekNumber >= 1 && image.weekNumber <= source.project.totalWeeks)
      .sort((left, right) => left.weekNumber - right.weekNumber || left.figureNumber - right.figureNumber)
      .map((image) => ({
        id: image.id,
        kind: "image" as const,
        weekNumber: image.weekNumber,
        figureNumber: image.figureNumber,
        title: image.title,
        altText: image.altText,
        source: image.source,
        prompt: image.prompt,
        style: image.style,
        mimeType: image.mimeType,
        fileName: `assets/images/${image.id}.${imageExtension(image.mimeType)}`,
        storage: {
          type: "endpoint" as const,
          href: `/api/generated-images/${image.id}`,
        },
      })),
    traceability: {
      sourceSystem: "app-creacion-asignaturas",
      createdAt: source.project.createdAt.toISOString(),
      updatedAt: source.project.updatedAt.toISOString(),
    },
  });
}
