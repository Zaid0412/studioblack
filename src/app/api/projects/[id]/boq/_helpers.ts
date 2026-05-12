import { NextResponse } from "next/server";
import { z } from "zod";
import {
  getBoqStatus,
  getBoqStatusForItem,
  getBoqStatusForSection,
  verifyBoqOwnership,
} from "@/lib/queries";
import { parseBody } from "@/lib/validations";
import type { BoqItemPhase, BoqStatus } from "@/lib/validations";

const CONFLICT_BODY = {
  error: "This item was updated by another user. Please refresh.",
  code: "OPTIMISTIC_LOCK_CONFLICT" as const,
};

const boqIdShape = z.string().uuid();

const LOCKED_BODY = {
  error: "This BOQ is locked and can no longer be edited.",
  code: "BOQ_LOCKED" as const,
};

/** Writes are blocked when the BOQ is in one of these terminal states. */
function isFrozen(status: BoqStatus): boolean {
  return status === "locked" || status === "superseded";
}

function frozenResponse(): NextResponse {
  return NextResponse.json(LOCKED_BODY, { status: 423 });
}

/**
 * Shared plumbing for BOQ mutation routes: validate JSON body, require a uuid
 * `boqId`, verify it belongs to the project, enforce BOQ editability (unless
 * opted out), then parse the rest against the route's own schema. Returns
 * either the parsed payload or the NextResponse the caller should return.
 */
export async function parseBoqRequest<T extends z.ZodType>(
  req: Request,
  projectId: string,
  schema: T,
  options: { requireEditable?: boolean } = { requireEditable: true }
): Promise<
  | { ok: true; boqId: string; data: z.infer<T> }
  | { ok: false; response: NextResponse }
> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Invalid JSON body" },
        { status: 400 }
      ),
    };
  }

  if (!raw || typeof raw !== "object" || !("boqId" in raw)) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "boqId is required" },
        { status: 400 }
      ),
    };
  }

  const { boqId: rawBoqId, ...rest } = raw as { boqId: unknown } & Record<
    string,
    unknown
  >;
  const boqIdParsed = boqIdShape.safeParse(rawBoqId);
  if (!boqIdParsed.success) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "boqId is invalid" },
        { status: 400 }
      ),
    };
  }

  const parsed = parseBody(schema, rest);
  if (!parsed.success) {
    return {
      ok: false,
      response: NextResponse.json({ error: parsed.error }, { status: 400 }),
    };
  }

  if (options.requireEditable) {
    const status = await getBoqStatus(boqIdParsed.data, projectId);
    if (status === null) {
      return {
        ok: false,
        response: NextResponse.json(
          { error: "BOQ not found in this project" },
          { status: 404 }
        ),
      };
    }
    if (isFrozen(status)) {
      return { ok: false, response: frozenResponse() };
    }
  } else {
    const owned = await verifyBoqOwnership(boqIdParsed.data, projectId);
    if (!owned) {
      return {
        ok: false,
        response: NextResponse.json(
          { error: "BOQ not found in this project" },
          { status: 404 }
        ),
      };
    }
  }

  return { ok: true, boqId: boqIdParsed.data, data: parsed.data };
}

/**
 * Gate a mutation that targets a specific section. Returns null when the
 * caller can proceed; otherwise returns the response to send. Combines
 * ownership + editability into one round-trip via `getBoqStatusForSection`.
 */
export async function assertSectionEditable(
  sectionId: string,
  projectId: string
): Promise<NextResponse | null> {
  const status = await getBoqStatusForSection(sectionId, projectId);
  if (status === null) {
    return NextResponse.json(
      { error: "Section not found in this project" },
      { status: 404 }
    );
  }
  if (isFrozen(status)) return frozenResponse();
  return null;
}

/** Gate a mutation that targets a specific item. See `assertSectionEditable`. */
export async function assertItemEditable(
  itemId: string,
  projectId: string
): Promise<NextResponse | null> {
  const status = await getBoqStatusForItem(itemId, projectId);
  if (status === null) {
    return NextResponse.json(
      { error: "Item not found in this project" },
      { status: 404 }
    );
  }
  if (isFrozen(status)) return frozenResponse();
  return null;
}

/**
 * Decide whether the caller is allowed to fire a phase transition.
 *
 * Rules (per Pap's 2026-05-12 spec):
 * - `internal_review`         — creator or PM
 * - `internally_approved`     — PM, and NOT the creator (4-eyes)
 * - `submitted_to_client`     — PM
 * - `client_approved`         — client
 * - `change_requested`        — PM or client
 * - `draft`                   — creator or PM (escape hatch / re-do)
 */
export function canFirePhaseTransition(opts: {
  target: BoqItemPhase;
  actorId: string;
  isPM: boolean;
  isClient: boolean;
  boqCreatorId: string | null;
}): boolean {
  const { target, actorId, isPM, isClient, boqCreatorId } = opts;
  const isCreator = boqCreatorId !== null && actorId === boqCreatorId;
  switch (target) {
    case "internal_review":
      return isCreator || isPM;
    case "internally_approved":
      return isPM && !isCreator;
    case "submitted_to_client":
      return isPM;
    case "client_approved":
      return isClient;
    case "change_requested":
      return isPM || isClient;
    case "draft":
      return isCreator || isPM;
  }
}

/** Map an optimistic-lock failure reason to the right HTTP response. */
export function optimisticFailureResponse(
  reason: "not_found" | "conflict",
  notFoundMessage = "Item not found"
): NextResponse {
  if (reason === "conflict") {
    return NextResponse.json(CONFLICT_BODY, { status: 409 });
  }
  return NextResponse.json({ error: notFoundMessage }, { status: 404 });
}
