-- Migration: Update project phases from old 8 to new 6
-- Old phases: "2D Layout + Look & Feel", "3D Design Development & Budgetary BOQ",
--   "Services & Working Drawings", "Material Selections",
--   "Detailed BOQ & Contractor Finalization", "Site Work",
--   "Vendor & Accessories", "Final Handover"
-- New phases: "2D Layout / Adaptation", "3D Layout / Adaptation",
--   "Production Files", "Section View", "Plumbing Section View", "Floor Plans"

BEGIN;

-- For each existing project, delete old phases and insert new ones
-- First, remove old phases that have no attachments
DELETE FROM project_phase
WHERE id NOT IN (
  SELECT DISTINCT phase_id FROM attachment WHERE phase_id IS NOT NULL
);

-- Rename remaining phases that might have attachments to closest matches
UPDATE project_phase SET name = '2D Layout / Adaptation', phase_order = 1
WHERE name = '2D Layout + Look & Feel';

UPDATE project_phase SET name = '3D Layout / Adaptation', phase_order = 2
WHERE name = '3D Design Development & Budgetary BOQ';

UPDATE project_phase SET name = 'Production Files', phase_order = 3
WHERE name = 'Services & Working Drawings';

UPDATE project_phase SET name = 'Section View', phase_order = 4
WHERE name = 'Material Selections';

UPDATE project_phase SET name = 'Plumbing Section View', phase_order = 5
WHERE name = 'Detailed BOQ & Contractor Finalization';

UPDATE project_phase SET name = 'Floor Plans', phase_order = 6
WHERE name = 'Site Work';

-- Delete remaining old phases that weren't renamed (Vendor & Accessories, Final Handover)
DELETE FROM project_phase
WHERE name IN ('Vendor & Accessories', 'Final Handover');

-- For projects that are missing any of the new 6 phases, insert them
-- This handles projects where phases were deleted because they had no attachments
INSERT INTO project_phase (project_id, name, phase_order, step_id)
SELECT p.id, phase.name, phase.phase_order, (
  SELECT ps.id FROM project_step ps
  WHERE ps.project_id = p.id AND ps.name = 'Design'
  LIMIT 1
)
FROM project p
CROSS JOIN (VALUES
  ('2D Layout / Adaptation', 1),
  ('3D Layout / Adaptation', 2),
  ('Production Files', 3),
  ('Section View', 4),
  ('Plumbing Section View', 5),
  ('Floor Plans', 6)
) AS phase(name, phase_order)
WHERE NOT EXISTS (
  SELECT 1 FROM project_phase pp
  WHERE pp.project_id = p.id AND pp.name = phase.name
);

COMMIT;
