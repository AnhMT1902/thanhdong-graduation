CREATE TABLE classes (
  id uuid PRIMARY KEY,
  code text UNIQUE NOT NULL,
  name text NOT NULL,
  grade text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE subjects (
  id uuid PRIMARY KEY,
  code text UNIQUE NOT NULL,
  name text NOT NULL,
  grade_scope text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE class_subjects (
  class_id uuid REFERENCES classes(id) ON DELETE CASCADE,
  subject_id uuid REFERENCES subjects(id) ON DELETE RESTRICT,
  PRIMARY KEY (class_id, subject_id)
);
CREATE TABLE users (
  id uuid PRIMARY KEY,
  role text NOT NULL CHECK (role IN ('admin','student')),
  full_name text NOT NULL,
  email text UNIQUE NOT NULL,
  student_code text UNIQUE,
  password_hash text NOT NULL,
  class_id uuid REFERENCES classes(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive')),
  last_login_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (role != 'student' OR student_code IS NOT NULL),
  CHECK (role != 'admin' OR class_id IS NULL)
);
CREATE TABLE sessions (
  token_hash text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE quizzes (
  id uuid PRIMARY KEY,
  title text NOT NULL,
  subject_id uuid NOT NULL REFERENCES subjects(id) ON DELETE RESTRICT,
  description text NOT NULL DEFAULT '',
  duration_minutes integer NOT NULL CHECK (duration_minutes BETWEEN 1 AND 180),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','archived')),
  created_by uuid NOT NULL REFERENCES users(id),
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE questions (
  id uuid PRIMARY KEY,
  subject_id uuid NOT NULL REFERENCES subjects(id) ON DELETE RESTRICT,
  content text NOT NULL,
  type text NOT NULL CHECK (type IN ('single','multiple')),
  difficulty text NOT NULL DEFAULT 'medium' CHECK (difficulty IN ('easy','medium','hard')),
  explanation text NOT NULL DEFAULT '',
  created_by uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE answer_options (
  id uuid PRIMARY KEY,
  question_id uuid NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  content text NOT NULL,
  is_correct boolean NOT NULL,
  sort_order integer NOT NULL,
  UNIQUE(question_id, sort_order)
);
CREATE TABLE quiz_questions (
  quiz_id uuid REFERENCES quizzes(id) ON DELETE CASCADE,
  question_id uuid REFERENCES questions(id) ON DELETE RESTRICT,
  sort_order integer NOT NULL,
  points numeric(8,2) NOT NULL CHECK(points > 0),
  PRIMARY KEY (quiz_id, question_id),
  UNIQUE(quiz_id, sort_order)
);
CREATE TABLE assignments (
  id uuid PRIMARY KEY,
  quiz_id uuid NOT NULL REFERENCES quizzes(id) ON DELETE RESTRICT,
  target_type text NOT NULL CHECK(target_type IN ('class','student')),
  open_at timestamptz NOT NULL,
  due_at timestamptz NOT NULL,
  max_attempts integer NOT NULL CHECK(max_attempts BETWEEN 1 AND 10),
  show_answers_after_submit boolean NOT NULL DEFAULT true,
  status text NOT NULL DEFAULT 'active' CHECK(status IN ('active','cancelled')),
  created_by uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK(due_at > open_at)
);
CREATE TABLE assignment_classes (
  assignment_id uuid REFERENCES assignments(id) ON DELETE CASCADE,
  class_id uuid REFERENCES classes(id) ON DELETE RESTRICT,
  PRIMARY KEY(assignment_id,class_id)
);
CREATE TABLE assignment_students (
  assignment_id uuid REFERENCES assignments(id) ON DELETE CASCADE,
  student_id uuid REFERENCES users(id) ON DELETE RESTRICT,
  PRIMARY KEY(assignment_id,student_id)
);
CREATE TABLE attempts (
  id uuid PRIMARY KEY,
  assignment_id uuid NOT NULL REFERENCES assignments(id) ON DELETE RESTRICT,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  quiz_id uuid NOT NULL REFERENCES quizzes(id) ON DELETE RESTRICT,
  attempt_number integer NOT NULL,
  status text NOT NULL CHECK(status IN ('in_progress','submitted')),
  started_at timestamptz NOT NULL DEFAULT now(),
  submitted_at timestamptz,
  expires_at timestamptz NOT NULL,
  snapshot jsonb NOT NULL,
  score numeric(5,2),
  correct_count integer,
  wrong_count integer,
  unanswered_count integer,
  UNIQUE(assignment_id,user_id,attempt_number),
  CHECK((status='in_progress' AND submitted_at IS NULL AND score IS NULL) OR (status='submitted' AND submitted_at IS NOT NULL AND score IS NOT NULL))
);
CREATE UNIQUE INDEX one_active_attempt_per_student ON attempts(user_id) WHERE status='in_progress';
CREATE INDEX attempts_by_owner ON attempts(user_id,started_at DESC);
CREATE TABLE attempt_answers (
  attempt_id uuid REFERENCES attempts(id) ON DELETE CASCADE,
  question_id uuid NOT NULL,
  selected_option_ids uuid[] NOT NULL DEFAULT '{}',
  flagged boolean NOT NULL DEFAULT false,
  answered_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(attempt_id,question_id)
);
CREATE TABLE audit_logs (
  id uuid PRIMARY KEY,
  actor_id uuid NOT NULL REFERENCES users(id),
  target_type text NOT NULL,
  target_id uuid NOT NULL,
  action text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audit_by_time ON audit_logs(created_at DESC);
