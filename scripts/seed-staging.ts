/**
 * Re-seed the staging environment after a full org wipe.
 *
 * Creates:
 *   - 5 verified user accounts (zaid + 4 others), password = email
 *   - 1 organization (StudioBlack Studio, slug studioblack-studio)
 *     owned by zaid, with the other 4 as members in their roles
 *   - Catalogue: 4 element categories, 13 elements
 *   - 5 vendors. One ("Anatolia Tile Co.") has its primary contact
 *     linked to the teststb701@gmail.com user — the rest are
 *     standalone for filtering/listing tests.
 *   - 3 projects (created via `createProjectWithPhases` so each gets
 *     6 phases linked to the Design step + 7 workflow steps), with
 *     design-file stub attachments
 *   - 12 tasks across the architects/clients
 *   - 1 BOQ with 2 sections + 6 items, created by an architect so the
 *     4-eyes internal-review gate can be exercised end-to-end.
 *
 * Usage:
 *   npm run seed:staging
 */

import dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

import { generateBetterAuthId } from "../src/lib/queries/helpers";
import { createProjectWithPhases } from "../src/lib/queries/projects";

const USERS = [
  {
    email: "zaid@studioblack.com",
    name: "Zaid STB",
    password: "zaid@studioblack.com",
    appRole: "pm",
    initials: "ZS",
    orgRole: "owner" as const,
  },
  {
    email: "zaidahmed.0412@outlook.com",
    name: "Zaid Ahmed (Outlook)",
    password: "zaidahmed.0412@outlook.com",
    appRole: "architect",
    initials: "ZA",
    orgRole: "member" as const, // architect
  },
  {
    email: "test1@test.com",
    name: "Test One",
    password: "test1@test.com",
    appRole: "architect",
    initials: "T1",
    orgRole: "member" as const, // architect
  },
  {
    email: "zaidahmed0412@gmail.com",
    name: "Client Zaid",
    password: "zaidahmed0412@gmail.com",
    appRole: "client",
    initials: "CZ",
    orgRole: "client" as const,
  },
  {
    email: "teststb701@gmail.com",
    name: "Vendor Test",
    password: "teststb701@gmail.com",
    appRole: "vendor",
    initials: "VT",
    orgRole: "vendor" as const,
  },
];

const ORG_NAME = "StudioBlack Studio";
const ORG_SLUG = "studioblack-studio";

async function seed() {
  const { auth } = await import("../src/lib/auth");
  // pg is published as CommonJS — under tsx's ESM loader the named
  // import comes back undefined; the default export is the actual
  // module exports, so we read Pool off it.
  const pgMod = (await import("pg")) as unknown as {
    default: { Pool: typeof import("pg").Pool };
    Pool?: typeof import("pg").Pool;
  };
  const Pool = pgMod.Pool ?? pgMod.default.Pool;

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  try {
    console.log("🌱 Seeding staging...\n");

    // ── 1. Sign up users ────────────────────────────────────────────────────
    // Try the better-auth signup first (so the password hash + account
    // row get created properly); on collision, just continue. Always
    // resolve the actual user.id from the DB by email — better-auth's
    // returned `result.user.id` can be a freshly-minted id from a row
    // that wasn't actually persisted (silent email collision).
    for (const u of USERS) {
      try {
        await auth.api.signUpEmail({
          body: { name: u.name, email: u.email, password: u.password },
        });
        console.log(`✅ ${u.email}`);
      } catch (err) {
        const msg = (err as Error).message ?? String(err);
        if (msg.includes("already") || msg.includes("exists")) {
          console.log(`⏭️  ${u.email} — already exists`);
        } else {
          console.error(`❌ ${u.email} — ${msg}`);
          throw err;
        }
      }
    }

    // Resolve all ids from the DB regardless of signup outcome.
    const emails = USERS.map((u) => u.email);
    const { rows: userRows } = await pool.query<{ id: string; email: string }>(
      `SELECT id, email FROM "user" WHERE email = ANY($1::text[])`,
      [emails]
    );
    const byEmail = new Map(userRows.map((r) => [r.email, r.id]));
    const userIds: Record<string, string> = {};
    for (const u of USERS) {
      const id = byEmail.get(u.email);
      if (!id) {
        throw new Error(`User ${u.email} not in DB after signup attempt`);
      }
      userIds[u.email] = id;
    }

    // Verify all users + set role/initials.
    for (const u of USERS) {
      await pool.query(
        `UPDATE "user" SET "emailVerified" = true, role = $1, initials = $2 WHERE id = $3`,
        [u.appRole, u.initials, userIds[u.email]]
      );
    }
    console.log("✅ Verified + roles set\n");

    // ── 2. Organization + members ───────────────────────────────────────────
    const ownerId = userIds["zaid@studioblack.com"]!;

    // Idempotent: drop any pre-existing studioblack-studio org and all
    // its app data first. `organization` lacks ON DELETE CASCADE from
    // project / vendor / element / element_category / rate_contract —
    // clear those in dependency order before the org row. (audit_event
    // and task DO cascade — task via project — so they're skipped.)
    const { rows: existing } = await pool.query<{ id: string }>(
      `SELECT id FROM organization WHERE slug = $1`,
      [ORG_SLUG]
    );
    if (existing[0]) {
      const oldOrgId = existing[0].id;
      await pool.query(`DELETE FROM project           WHERE org_id = $1`, [
        oldOrgId,
      ]);
      await pool.query(`DELETE FROM rate_contract     WHERE org_id = $1`, [
        oldOrgId,
      ]);
      await pool.query(`DELETE FROM vendor            WHERE org_id = $1`, [
        oldOrgId,
      ]);
      await pool.query(`DELETE FROM element           WHERE org_id = $1`, [
        oldOrgId,
      ]);
      await pool.query(`DELETE FROM element_category  WHERE org_id = $1`, [
        oldOrgId,
      ]);
      await pool.query(`DELETE FROM organization      WHERE id = $1`, [
        oldOrgId,
      ]);
    }

    const orgId = generateBetterAuthId();
    await pool.query(
      `INSERT INTO organization (id, name, slug, "createdAt") VALUES ($1, $2, $3, now())`,
      [orgId, ORG_NAME, ORG_SLUG]
    );
    console.log(`✅ Org "${ORG_NAME}" (id ${orgId})`);

    for (const u of USERS) {
      const memberId = generateBetterAuthId();
      await pool.query(
        `INSERT INTO member (id, "organizationId", "userId", role, "createdAt") VALUES ($1, $2, $3, $4, now())`,
        [memberId, orgId, userIds[u.email], u.orgRole]
      );
      console.log(`   member: ${u.email} (${u.orgRole})`);
    }

    // Set zaid's active org.
    await pool.query(
      `UPDATE "session" SET "activeOrganizationId" = $1 WHERE "userId" = $2`,
      [orgId, ownerId]
    );
    console.log("✅ Members added\n");

    // ── 3. Element categories + elements ────────────────────────────────────
    const cat = async (name: string, codePrefix: string) => {
      const { rows } = await pool.query<{ id: string }>(
        `INSERT INTO element_category (org_id, name, level, code_prefix, sort_order)
         VALUES ($1, $2, 1, $3, 0) RETURNING id`,
        [orgId, name, codePrefix]
      );
      return rows[0]!.id;
    };
    const finishesId = await cat("Finishes", "FIN");
    const fittingsId = await cat("Fittings", "FIT");
    const furnitureId = await cat("Furniture", "FUR");
    const lightingId = await cat("Lighting", "LGT");
    console.log("✅ 4 element categories");

    const ELEMENTS: {
      code: string;
      name: string;
      unit: string;
      cost: number;
      cat: string;
      desc?: string;
    }[] = [
      {
        code: "FIN-001",
        name: "Glazed porcelain tile 600x600",
        unit: "m2",
        cost: 45,
        cat: finishesId,
        desc: "Anatolia Tile, matte finish",
      },
      {
        code: "FIN-002",
        name: "Travertine 600x600 honed",
        unit: "m2",
        cost: 78,
        cat: finishesId,
      },
      {
        code: "FIN-003",
        name: "Latex paint, premium grade",
        unit: "lm",
        cost: 12,
        cat: finishesId,
      },
      {
        code: "FIN-004",
        name: "Engineered oak flooring",
        unit: "m2",
        cost: 95,
        cat: finishesId,
      },
      {
        code: "FIT-001",
        name: "Single-lever basin mixer (chrome)",
        unit: "no",
        cost: 190,
        cat: fittingsId,
        desc: "Hansgrohe Logis 100",
      },
      {
        code: "FIT-002",
        name: "Wall-hung WC with concealed cistern",
        unit: "no",
        cost: 380,
        cat: fittingsId,
      },
      {
        code: "FIT-003",
        name: "Rain shower head + thermostat",
        unit: "no",
        cost: 420,
        cat: fittingsId,
      },
      {
        code: "FUR-001",
        name: "Built-in wardrobe (per linear m)",
        unit: "lm",
        cost: 650,
        cat: furnitureId,
      },
      {
        code: "FUR-002",
        name: "Solid-surface vanity counter",
        unit: "lm",
        cost: 480,
        cat: furnitureId,
      },
      {
        code: "FUR-003",
        name: "Custom dining table 2.4m",
        unit: "no",
        cost: 1850,
        cat: furnitureId,
      },
      {
        code: "LGT-001",
        name: "Recessed downlight, dimmable",
        unit: "no",
        cost: 65,
        cat: lightingId,
      },
      {
        code: "LGT-002",
        name: "Linear pendant 1.5m",
        unit: "no",
        cost: 320,
        cat: lightingId,
      },
      {
        code: "LGT-003",
        name: "Wall sconce, brushed brass",
        unit: "no",
        cost: 145,
        cat: lightingId,
      },
    ];
    for (const e of ELEMENTS) {
      await pool.query(
        `INSERT INTO element (org_id, code, name, description, category_id, unit, unit_cost, currency, margin_pct, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'USD', 15, $8)`,
        [orgId, e.code, e.name, e.desc ?? null, e.cat, e.unit, e.cost, ownerId]
      );
    }
    console.log(`✅ ${ELEMENTS.length} elements\n`);

    // ── 4. Vendors ──────────────────────────────────────────────────────────
    const VENDORS: {
      name: string;
      code: string;
      contact: {
        name: string;
        email: string;
        phone?: string;
        userEmail?: string;
      };
    }[] = [
      {
        name: "Anatolia Tile Co.",
        code: "V001",
        contact: {
          name: "Vendor Test",
          email: "teststb701@gmail.com",
          userEmail: "teststb701@gmail.com",
        },
      },
      {
        name: "Hansgrohe Türkiye",
        code: "V002",
        contact: {
          name: "Mehmet Demir",
          email: "mehmet@hansgrohe.tr",
          phone: "+90 555 010 1234",
        },
      },
      {
        name: "Bodrum Marble Works",
        code: "V003",
        contact: { name: "Ayşe Kaya", email: "ayse@bodrummarble.com" },
      },
      {
        name: "Aegean Lighting Ltd.",
        code: "V004",
        contact: { name: "Selim Öz", email: "selim@aegean-lighting.com" },
      },
      {
        name: "Coastal Joinery & Cabinets",
        code: "V005",
        contact: { name: "Demir Yılmaz", email: "demir@coastaljoinery.tr" },
      },
    ];
    for (const v of VENDORS) {
      const { rows: vRows } = await pool.query<{ id: string }>(
        `INSERT INTO vendor (org_id, company_name, vendor_code, status, currency, created_by)
         VALUES ($1, $2, $3, 'active', 'USD', $4) RETURNING id`,
        [orgId, v.name, v.code, ownerId]
      );
      const vendorId = vRows[0]!.id;
      const linkedUserId = v.contact.userEmail
        ? userIds[v.contact.userEmail]
        : null;
      await pool.query(
        `INSERT INTO vendor_contact (vendor_id, name, email, phone, is_primary, receives_rfq, user_id)
         VALUES ($1, $2, $3, $4, true, true, $5)`,
        [
          vendorId,
          v.contact.name,
          v.contact.email,
          v.contact.phone ?? null,
          linkedUserId,
        ]
      );
      console.log(`   vendor: ${v.name}`);
    }
    console.log(`✅ ${VENDORS.length} vendors\n`);

    // ── 5. Projects + phases ────────────────────────────────────────────────
    const PROJECTS = [
      {
        name: "Casa Belluno Villa",
        clientName: "Test Client",
        clientEmail: "zaidahmed0412@gmail.com",
        scope:
          "Coastal villa — 6 bedrooms, infinity pool, landscaped gardens, full FF&E package.",
        areaSqft: 8800,
        estimationInr: 65_000_000,
        address: "Via Belluno 14",
        city: "Bodrum",
        state: "Muğla",
        category: "residential",
      },
      {
        name: "Aegean Coast Apartment Refit",
        clientName: "Test Client",
        clientEmail: "zaidahmed0412@gmail.com",
        scope:
          "180 m² seaside apartment — full interior, kitchen and 2 bathrooms.",
        areaSqft: 1937,
        estimationInr: 12_500_000,
        address: "Çıkmaz Sokak 8",
        city: "Yalıkavak",
        state: "Muğla",
        category: "residential",
      },
      {
        name: "STB Studio HQ",
        clientName: "StudioBlack Internal",
        clientEmail: undefined as string | undefined,
        scope:
          "Office fit-out for the new HQ — open work area, 3 cabins, pantry.",
        areaSqft: 2200,
        estimationInr: 8_000_000,
        address: "Taksim Cad. 21",
        city: "Istanbul",
        state: "Istanbul",
        category: "commercial",
      },
    ];
    const ARCH_A_EMAIL = "zaidahmed.0412@outlook.com";
    const ARCH_B_EMAIL = "test1@test.com";
    const architectIds = [userIds[ARCH_A_EMAIL]!, userIds[ARCH_B_EMAIL]!];

    const projectIds: string[] = [];
    /** Per-project phase IDs, indexed by phase order (0..5 = PROJECT_PHASES order). */
    const projectPhaseIds: string[][] = [];

    for (const p of PROJECTS) {
      const project = (await createProjectWithPhases({
        name: p.name,
        clientName: p.clientName,
        clientEmail: p.clientEmail,
        category: p.category,
        scope: p.scope,
        areaSqft: p.areaSqft,
        estimationInr: p.estimationInr,
        address: p.address,
        city: p.city,
        state: p.state,
        orgId,
        createdBy: ownerId,
        architectIds,
      })) as { id: string };
      projectIds.push(project.id);

      // Capture phase IDs (in PROJECT_PHASES order) for downstream
      // task and attachment inserts so we don't re-query per row.
      const { rows: phaseRows } = await pool.query<{ id: string }>(
        `SELECT id FROM project_phase WHERE project_id = $1 ORDER BY phase_order`,
        [project.id]
      );
      const phaseIds = phaseRows.map((r) => r.id);
      projectPhaseIds.push(phaseIds);

      // createProjectWithPhases leaves phases at their default status;
      // mark the first two (2D + 3D Layout) as in-progress to mirror a
      // mid-project staging state.
      await pool.query(
        `UPDATE project_phase
         SET status = CASE WHEN phase_order <= 2 THEN 'in_progress' ELSE 'not_started' END
         WHERE project_id = $1`,
        [project.id]
      );

      // Mark the project active (createProjectWithPhases uses the
      // schema default, which is 'draft').
      await pool.query(`UPDATE project SET status = 'active' WHERE id = $1`, [
        project.id,
      ]);

      // 3 design-file stubs per project, uploaded by alternating users
      // so the file table reads like a real team has been working on it.
      const phase2DId = phaseIds[0]!;
      const phase3DId = phaseIds[1]!;
      const archA = userIds[ARCH_A_EMAIL]!;
      const archB = userIds[ARCH_B_EMAIL]!;
      for (const att of [
        {
          name: "ground_floor_v3.pdf",
          phaseId: phase2DId,
          url: stubFileUrl(p.name, "2D-ground-floor.pdf"),
          by: archA,
        },
        {
          name: "first_floor_v3.pdf",
          phaseId: phase2DId,
          url: stubFileUrl(p.name, "2D-first-floor.pdf"),
          by: archB,
        },
        {
          name: "exterior_render_dusk.png",
          phaseId: phase3DId,
          url: stubFileUrl(p.name, "3D-exterior.png"),
          by: archA,
        },
      ]) {
        await pool.query(
          `INSERT INTO attachment
           (project_id, phase_id, uploaded_by, file_url, file_name, description)
           VALUES ($1, $2, $3, $4, $5, '')`,
          [project.id, att.phaseId, att.by, att.url, att.name]
        );
      }

      console.log(`   project: ${p.name}`);
    }
    console.log(`✅ ${PROJECTS.length} projects\n`);

    // ── 6. Tasks ────────────────────────────────────────────────────────────
    // Mix of creators so the BOQ-internal-review style 4-eyes scenarios
    // can be tested across users. PMs (Zaid) create some tasks for
    // architects; architects open their own tasks; and architects open
    // some review-flavoured tasks for Zaid.
    const PM = "zaid@studioblack.com";
    const ARCH_A = ARCH_A_EMAIL;
    const ARCH_B = ARCH_B_EMAIL;
    const TASKS = [
      // Project 0 — Casa Belluno Villa
      {
        project: 0,
        phase: 0,
        title: "Finalise master bedroom layout",
        creator: PM,
        assigned: ARCH_A,
        priority: "high",
        category: "design",
      },
      {
        project: 0,
        phase: 0,
        title: "Pool deck setback approval",
        creator: PM,
        assigned: ARCH_B,
        priority: "medium",
        category: "design",
      },
      {
        project: 0,
        phase: 1,
        title: "3D walkthrough — review with client",
        creator: ARCH_A,
        assigned: PM,
        priority: "high",
        category: "review",
      },
      {
        project: 0,
        phase: 0,
        title: "Confirm tile selection vs supplier stock",
        creator: ARCH_B,
        assigned: ARCH_A,
        priority: "medium",
        category: "general",
      },
      // Project 1 — Aegean Coast Apartment
      {
        project: 1,
        phase: 0,
        title: "Kitchen island layout — final round",
        creator: PM,
        assigned: ARCH_A,
        priority: "high",
        category: "design",
      },
      {
        project: 1,
        phase: 0,
        title: "Bathroom plumbing diagram",
        creator: ARCH_A,
        assigned: ARCH_A,
        priority: "medium",
        category: "design",
      },
      {
        project: 1,
        phase: 1,
        title: "Living room mood board v2",
        creator: ARCH_A,
        assigned: PM,
        priority: "low",
        category: "review",
      },
      {
        project: 1,
        phase: 0,
        title: "Window joinery measurements",
        creator: ARCH_B,
        assigned: ARCH_B,
        priority: "medium",
        category: "production",
      },
      // Project 2 — STB Studio HQ
      {
        project: 2,
        phase: 0,
        title: "Open-plan workspace — desk grid",
        creator: PM,
        assigned: ARCH_A,
        priority: "medium",
        category: "design",
      },
      {
        project: 2,
        phase: 0,
        title: "Acoustic panel placement plan",
        creator: ARCH_B,
        assigned: ARCH_B,
        priority: "medium",
        category: "design",
      },
      {
        project: 2,
        phase: 1,
        title: "Pantry render review",
        creator: ARCH_A,
        assigned: PM,
        priority: "low",
        category: "review",
      },
      {
        project: 2,
        phase: 0,
        title: "Lighting circuit drawing",
        creator: ARCH_B,
        assigned: ARCH_A,
        priority: "medium",
        category: "production",
      },
    ];
    for (const t of TASKS) {
      const projectId = projectIds[t.project]!;
      const phaseId = projectPhaseIds[t.project]?.[t.phase] ?? null;
      await pool.query(
        `INSERT INTO task
         (org_id, project_id, phase_id, title, description, status, priority, category, created_by, assigned_to)
         VALUES ($1, $2, $3, $4, '', 'todo', $5, $6, $7, $8)`,
        [
          orgId,
          projectId,
          phaseId,
          t.title,
          t.priority,
          t.category,
          userIds[t.creator],
          userIds[t.assigned],
        ]
      );
    }
    console.log(`✅ ${TASKS.length} tasks\n`);

    // ── 7. BOQ on the first project ─────────────────────────────────────────
    // Created by an ARCHITECT (not the PM) so the BOQ internal-review
    // gate is testable both ways: the PM and the other architect can
    // both approve / request changes; the creator is locked out of
    // self-approval per the 4-eyes rule.
    const firstProjectId = projectIds[0]!;
    const boqCreatorId = userIds[ARCH_A]!;
    const { rows: boqRows } = await pool.query<{ id: string }>(
      `INSERT INTO boq
       (project_id, title, version, status, currency, exchange_rate,
        contingency_pct, vat_pct, minimum_margin_pct, created_by)
       VALUES ($1, $2, 1, 'draft', 'USD', 1, 5, 18, 10, $3)
       RETURNING id`,
      [firstProjectId, "Casa Belluno Villa — BOQ V1", boqCreatorId]
    );
    const boqId = boqRows[0]!.id;

    const sec = async (title: string, sortOrder: number) => {
      const { rows } = await pool.query<{ id: string }>(
        `INSERT INTO boq_section (boq_id, title, sort_order)
         VALUES ($1, $2, $3) RETURNING id`,
        [boqId, title, sortOrder]
      );
      return rows[0]!.id;
    };
    const wetAreasId = await sec("Wet Areas", 0);
    const livingId = await sec("Living + Bath Finishes", 1);

    const ITEMS: {
      section: string;
      code: string;
      desc: string;
      unit: string;
      qty: number;
      cost: number;
      margin: number;
    }[] = [
      {
        section: wetAreasId,
        code: "WET-001",
        desc: "Glazed porcelain tile 600x600",
        unit: "m2",
        qty: 35,
        cost: 45,
        margin: 15,
      },
      {
        section: wetAreasId,
        code: "WET-002",
        desc: "Single-lever basin mixer (chrome)",
        unit: "no",
        qty: 6,
        cost: 190,
        margin: 15,
      },
      {
        section: wetAreasId,
        code: "WET-003",
        desc: "Wall-hung WC with concealed cistern",
        unit: "no",
        qty: 4,
        cost: 380,
        margin: 15,
      },
      {
        section: livingId,
        code: "LIV-001",
        desc: "Engineered oak flooring",
        unit: "m2",
        qty: 120,
        cost: 95,
        margin: 12,
      },
      {
        section: livingId,
        code: "LIV-002",
        desc: "Built-in wardrobe (per linear m)",
        unit: "lm",
        qty: 18,
        cost: 650,
        margin: 10,
      },
      {
        section: livingId,
        code: "LIV-003",
        desc: "Recessed downlight, dimmable",
        unit: "no",
        qty: 36,
        cost: 65,
        margin: 15,
      },
    ];
    for (let i = 0; i < ITEMS.length; i++) {
      const it = ITEMS[i]!;
      await pool.query(
        `INSERT INTO boq_item
         (boq_id, section_id, item_code, description, unit, quantity, unit_cost, margin_pct, sort_order, source)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'custom')`,
        [
          boqId,
          it.section,
          it.code,
          it.desc,
          it.unit,
          it.qty,
          it.cost,
          it.margin,
          i,
        ]
      );
    }
    console.log(`✅ 1 BOQ with ${ITEMS.length} items\n`);

    console.log("✨ Staging seed complete!\n");
    console.log(`   Sign in as: zaid@studioblack.com / zaid@studioblack.com`);
  } finally {
    await pool.end();
  }
}

function stubFileUrl(projectName: string, fileName: string): string {
  // Public-bucket URL shape — won't actually open, but lists in the UI.
  const slug = projectName.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  return `https://stub.supabase.co/storage/v1/object/public/staging-seed/${slug}/${fileName}`;
}

seed().then(
  () => process.exit(0),
  (err) => {
    console.error("Seed failed:", err);
    process.exit(1);
  }
);
