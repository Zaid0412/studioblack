import { NextResponse } from "next/server";
import { z } from "zod";
import { verifyBoqOwnership } from "@/lib/queries";
import { parseBody } from "@/lib/validations";
import type { BoqItemPhase } from "@/lib/validations";
import { canFireBoqPhaseTransition } from "@/lib/boq/phasePermissions";

const CONFLICT_BODY = {
  error: "This item was updated by another user. Please refresh.",
  code: "OPTIMISTIC_LOCK_CONFLICT" as const,
};

const boqIdShape = z.string().uuid();

/**
 * Shared plumbing for BOQ mutation routes: validate JSON body, require a uuid
 * `boqId`, verify it belongs to the project, then parse the rest against the
 * route's own schema. Returns either the parsed payload or the NextResponse
 * the caller should return.
 */
export async function parseBoqRequest<T extends z.ZodType>(
  req: Request,
  projectId: string,
  schema: T
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

  return { ok: true, boqId: boqIdParsed.data, data: parsed.data };
}

/**
 * Server-side wrapper around the shared phase-transition permission matrix.
 * Derives `isCreator` from the actor id + BOQ creator id and delegates the
 * actual rule set to `canFireBoqPhaseTransition` — the only place that
 * knows which role can fire which transition.
 */
export function canFirePhaseTransition(opts: {
  target: BoqItemPhase;
  actorId: string;
  isPM: boolean;
  isClient: boolean;
  boqCreatorId: string | null;
}): boolean {
  return canFireBoqPhaseTransition({
    target: opts.target,
    isPM: opts.isPM,
    isClient: opts.isClient,
    isCreator: opts.boqCreatorId !== null && opts.actorId === opts.boqCreatorId,
  });
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

/** 404 response with a customised message for cross-project ownership failures. */
export function notFoundResponse(message: string): NextResponse {
  return NextResponse.json({ error: message }, { status: 404 });
}
