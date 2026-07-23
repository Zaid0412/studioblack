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
  representation?: string | null;
  location?: string | null;
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
  disciplineId: string | null;
  drawingType: string | null;
  representation: string | null;
  location: string | null;
}> {
  const hasDiscipline = !!params.disciplineId;
  const hasType = !!params.drawingType;
  // Classification is both-or-neither. Enforced here — the owner of the data —
  // so no caller can persist a half-classified drawing (the route's 400 is just
  // a friendlier surface for the same rule).
  if (hasDiscipline !== hasType) {
    throw new Error("Discipline and drawing type are required together");
  }
  const classified = hasDiscipline && hasType;
  const disciplineId = classified ? params.disciplineId! : null;
  const drawingType = classified ? params.drawingType! : null;

  let documentNumber: string | null = null;
  if (classified) {
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
      drawingType!
    );
  }

  // Representation + Location are independent classification metadata (PDS v2.0):
  // they don't gate numbering and are stored even when present alone.
  const representation = params.representation || null;
  const location = params.location?.trim() || null;

  const {
    rows: [drawing],
  } = await client.query<{ id: string; version_group: string }>(
    `INSERT INTO drawing
       (project_id, org_id, discipline_id, drawing_type, representation, location,
        document_number, title)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING id, version_group`,
    [
      params.projectId,
      params.orgId,
      disciplineId,
      drawingType,
      representation,
      location,
      documentNumber,
      params.title ?? null,
    ]
  );

  return {
    id: drawing.id,
    versionGroup: drawing.version_group,
    documentNumber,
    disciplineId,
    drawingType,
    representation,
    location,
  };
}
