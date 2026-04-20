-- MSAT Database Schema (Cloudflare D1)
-- 학생 정보 및 과목별 시험 결과 저장

-- 학생 테이블 (익명 식별)
CREATE TABLE IF NOT EXISTS students (
  student_id     TEXT PRIMARY KEY,        -- SHA-256 hash 앞 16자
  name           TEXT NOT NULL,
  school         TEXT,
  grade          TEXT,
  dob            TEXT,                    -- 6자리 (생년월일)
  first_seen_at  TEXT DEFAULT (datetime('now')),
  last_seen_at   TEXT DEFAULT (datetime('now'))
);

-- 시험 결과 테이블
CREATE TABLE IF NOT EXISTS exam_results (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id     TEXT NOT NULL,
  subject        TEXT NOT NULL,            -- 'english' | 'korean' | 'math'
  version        TEXT NOT NULL DEFAULT '2026.04',
  submitted_at   TEXT DEFAULT (datetime('now')),

  -- 점수 데이터
  total_points   REAL NOT NULL,
  grade_label    TEXT NOT NULL,            -- 'S' | 'A' | 'B' | 'C' | 'D'
  mc_correct     INTEGER,
  mc_points      REAL,
  writing_points REAL,

  -- 상세 데이터 (JSON 문자열)
  answers_json         TEXT,               -- 전체 답안
  writing_grades_json  TEXT,               -- 서술형 채점 결과
  region_abs_json      TEXT,               -- 뇌 영역 점수 {"limbic":72.5, ...}
  word_intensity_json  TEXT,               -- 단어별 강도
  per_section_json     TEXT,               -- 섹션별 점수/해설

  -- AI 리포트 캐시 (필요시 바로 조회 가능)
  subject_report_md    TEXT,

  FOREIGN KEY (student_id) REFERENCES students(student_id)
);

-- 성능 최적화를 위한 인덱스
CREATE INDEX IF NOT EXISTS idx_exam_student_subject
  ON exam_results(student_id, subject, submitted_at DESC);
