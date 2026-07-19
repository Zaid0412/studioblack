import type { PoolClient } from "pg";
import { nextDrawingNumber } from "./sequences";

/**
 * Drawing register (PRD "01.Design doc"), PR-2.
 *
 * A drawing is the header over a design-file lineage — one per `attachment`
 * `version_group`. The file/version/markup/review/freeze engine is unchanged;
 * this only owns the register metadata (discipline, drawing type, document
 * number) and its creation on upload.
 */

interface CreateDrawingParams {
  projectId: string;
  orgId: string;
  projectNumber: string | null;
  disciplineId?: string | null;
  drawingType?: string | null;
  title?: string | null;
}

/**
 * Create the drawing for a new upload — one per version_group. With a discipline
 * + type it is classified and gets a document number from the shared sequence
 * (`P2026-001-AR-PLAN-001`); without, it's an unclassified drawing (null
 * metadata), matching how legacy files were backfilled. Runs in the caller's
 * transaction so a rollback un-burns the number.
 */
export async function createDrawing(
  client: PoolClient,
  params: CreateDrawingParams
): Promise<{
  id: string;
  versionGroup: string;
  documentNumber: string | null;
}> {
  let disciplineId = params.disciplineId ?? null;
  let drawingType = params.drawingType ?? null;
  let documentNumber: string | null = null;

  // Partial classification isn't a valid state — a number needs both segments.
  if (disciplineId && drawingType) {
    const { rows } = await client.query<{ code: string }>(
      `SELECT code FROM design_discipline WHERE id = $1 AND org_id = $2`,
      [disciplineId, params.orgId]
    );
    const disciplineCode = rows[0]?.code;
    if (!disciplineCode) throw new Error("Discipline not found");
    if (!params.projectNumber) {
      throw new Error("Project has no project number");
    }
    documentNumber = await nextDrawingNumber(
      client,
      params.orgId,
      params.projectNumber,
      disciplineCode,
      drawingType
    );
  } else {
    disciplineId = null;
    drawingType = null;
  }

  const {
    rows: [drawing],
  } = await client.query<{
    id: string;
    version_group: string;
    document_number: string | null;
  }>(
    `INSERT INTO drawing
       (project_id, org_id, discipline_id, drawing_type, document_number, title)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id, version_group, document_number`,
    [
      params.projectId,
      params.orgId,
      disciplineId,
      drawingType,
      documentNumber,
      params.title ?? null,
    ]
  );

  return {
    id: drawing.id,
    versionGroup: drawing.version_group,
    documentNumber: drawing.document_number,
  };
}
