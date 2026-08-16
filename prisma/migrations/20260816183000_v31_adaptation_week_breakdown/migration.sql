-- v31.4.4.1 - corrige la migracion faltante del desglose semanal de adaptacion
ALTER TABLE "AdaptationChange"
  ADD COLUMN IF NOT EXISTS "sourceWeekBreakdown" JSONB,
  ADD COLUMN IF NOT EXISTS "proposedWeekBreakdown" JSONB;
