-- StudioBlack project schema
-- Run: psql $DATABASE_URL -f scripts/migrate.sql

-- Projects
CREATE TABLE IF NOT EXISTS project (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  client_name TEXT,
  client_email TEXT,
  category TEXT NOT NULL DEFAULT 'residential',
  status TEXT NOT NULL DEFAULT 'active',
  description TEXT DEFAULT '',
  deadline DATE,
  org_id TEXT NOT NULL REFERENCES organization(id),
  created_by TEXT REFERENCES "user"(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Architect/team assignment to projects
CREATE TABLE IF NOT EXISTS project_member (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES project(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'architect',
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(project_id, user_id)
);

-- Fixed phases per project (8 auto-created on project insert)
CREATE TABLE IF NOT EXISTS project_phase (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES project(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phase_order INT NOT NULL,
  status TEXT NOT NULL DEFAULT 'not_started',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Sub-tasks within phases (assignable + client-reviewable)
CREATE TABLE IF NOT EXISTS phase_task (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phase_id UUID NOT NULL REFERENCES project_phase(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending',
  assigned_to TEXT REFERENCES "user"(id) ON DELETE SET NULL,
  requires_client_review BOOLEAN DEFAULT false,
  review_status TEXT,
  due_date DATE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Attachments (on project, phase, or task level)
CREATE TABLE IF NOT EXISTS attachment (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES project(id) ON DELETE CASCADE,
  phase_id UUID REFERENCES project_phase(id) ON DELETE CASCADE,
  task_id UUID REFERENCES phase_task(id) ON DELETE CASCADE,
  uploaded_by TEXT REFERENCES "user"(id) ON DELETE SET NULL,
  file_url TEXT NOT NULL,
  file_name TEXT NOT NULL,
  description TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Comments (on project, phase, or task level)
CREATE TABLE IF NOT EXISTS comment (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES project(id) ON DELETE CASCADE,
  phase_id UUID REFERENCES project_phase(id) ON DELETE CASCADE,
  task_id UUID REFERENCES phase_task(id) ON DELETE CASCADE,
  user_id TEXT REFERENCES "user"(id) ON DELETE SET NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
