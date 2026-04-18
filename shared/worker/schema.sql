-- MSAT Database Schema for Cloudflare D1
-- 학생 정보 및 시험 결과를 저장하는 DB

CREATE TABLE IF NOT EXISTS students (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  school TEXT NOT NULL,
  grade TEXT NOT NULL,
  name TEXT NOT NULL,
  dob TEXT NOT NULL,       -- 생년월일 6자리 (예: 120415)
  student_hash TEXT NOT NULL UNIQUE,  -- school+name+dob 해시 (식별 키)
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS results (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER NOT NULL,
  subject TEXT NOT NULL,        -- 'english', 'math', 'korean' 등
  result_json TEXT NOT NULL,    -- 시험 결과 스냅샷 (JSON)
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (student_id) REFERENCES students(id)
);

-- 같은 학생이 같은 과목을 여러 번 치를 수 있으므로 UNIQUE 제약 없음
-- 조회 성능을 위한 인덱스
CREATE INDEX IF NOT EXISTS idx_results_student ON results(student_id);
CREATE INDEX IF NOT EXISTS idx_results_subject ON results(subject);
CREATE INDEX IF NOT EXISTS idx_students_hash ON students(student_hash);
