/**
 * MSAT · shared/data.js
 * -------------------------------------------------------------------
 * 모든 과목이 공통으로 사용하는 마스터 데이터:
 *   - 5개 뇌 영역(REGIONS)
 *   - 100개 사고력 단어(WORDS) — 각 영역당 20개
 *   - 복합 사고 TOP 10(COMPOUND_WORDS) — 2개 이상 뇌 영역 융합
 *   - 등급 컷(GRADE_CUTS)
 *   - 점수 가중치(CORE_W, AUX_W)
 *
 * 이 파일은 정답지/문제지 외부에 있는 "시스템 고정값"만 담는다.
 * 과목별 문제 데이터는 english/questions.js 등 각 과목 폴더에 있다.
 * -------------------------------------------------------------------
 */

// ============================================================
// 강남구 6학년 대상 1000명 시뮬레이션 기반 상위 10% 기준 (각 과목/섹션별 정답률 %)
// ============================================================
export const GANGNAM_TOP10 = {
  "english": { "A": 96, "B": 95, "C": 98, "D": 95, "E": 97, "F": 92, "G": 89 },
  "korean": { "A": 80, "B": 80, "C": 100, "D": 100, "E": 100, "F": 80 },
  "math": { "A": 80, "B": 80, "C": 90 }
};

// ============================================================
// 뇌 영역 5개 (공통)
// ------------------------------------------------------------
// 영역 이름은 최신 docx 표준을 따름:
//   변연계 → "감성 머리", 측두엽 → "언어 머리", 후두엽 → "상상 머리"
// ============================================================
export const REGIONS = {
  limbic: {
    key: "limbic",
    kr: "감성 머리",
    en: "Limbic (Emotion)",
    area: "변연계",
    color: "var(--region-limbic)",
    hex: "#c4456b",
    desc: "감정·동기·공감 등 '내가 누구인가'와 정서를 다루는 영역입니다.",
    tagline: "느낌·공감·정서적 반응",
  },
  frontal: {
    key: "frontal",
    kr: "실행 머리",
    en: "Frontal (Execution)",
    area: "전두엽",
    color: "var(--region-frontal)",
    hex: "#3b6ea3",
    desc: "계획·판단·점검 등 '무엇을 할 것인가'를 결정하는 실행 영역입니다.",
    tagline: "계획·선택·판단·점검·최적화",
  },
  temporal: {
    key: "temporal",
    kr: "언어 머리",
    en: "Temporal (Language)",
    area: "측두엽",
    color: "var(--region-temporal)",
    hex: "#b5812a",
    desc: "정의·의미·주장·근거 등 '설명과 해석'을 다루는 언어 영역입니다.",
    tagline: "설명·정의·논리·서술·의미",
  },
  parietal: {
    key: "parietal",
    kr: "정리 머리",
    en: "Parietal (Organizing)",
    area: "두정엽",
    color: "var(--region-parietal)",
    hex: "#5e7a3e",
    desc: "비교·분해·결합·변환 등 '정보를 정리하고 조작'하는 영역입니다.",
    tagline: "공간·위치·배치·전체-부분 관계",
  },
  occipital: {
    key: "occipital",
    kr: "상상 머리",
    en: "Occipital (Perception)",
    area: "후두엽",
    color: "var(--region-occipital)",
    hex: "#6b4aa0",
    desc: "패턴·흐름·감각·짐작 등 '보고 느끼는' 지각적 영역입니다.",
    tagline: "시각·형태·감각 인식·직관",
  },
};

export const REGION_KEYS = Object.keys(REGIONS);

// ============================================================
// 100개 사고력 단어 (각 영역 20개씩)
// ------------------------------------------------------------
// 출처: 100개_사고력_단어_정리_20260119
// ============================================================
export const WORDS = {
  // === 감성 머리 (변연계) — 20개 ===
  "동기": "limbic", "가치": "limbic", "책임": "limbic", "주체": "limbic", "감정": "limbic",
  "표현": "limbic", "마음": "limbic", "공감": "limbic", "감명": "limbic", "공감각": "limbic",
  "성찰": "limbic", "인정": "limbic", "수용": "limbic", "관용": "limbic", "관습": "limbic",
  "분위기": "limbic", "감사": "limbic", "취향": "limbic", "존중": "limbic", "감상": "limbic",

  // === 실행 머리 (전두엽) — 20개 ===
  "계획": "frontal", "구조": "frontal", "선택": "frontal", "점검": "frontal", "우회": "frontal",
  "기준": "frontal", "중요도": "frontal", "목적": "frontal", "고려": "frontal", "수정": "frontal",
  "가정": "frontal", "핵심": "frontal", "관점": "frontal", "전제": "frontal", "조건": "frontal",
  "규칙": "frontal", "적용": "frontal", "활용": "frontal", "체계": "frontal", "위계": "frontal",

  // === 언어 머리 (측두엽) — 20개 ===
  "정의": "temporal", "의미": "temporal", "본질": "temporal", "주장": "temporal", "근거": "temporal",
  "타당": "temporal", "단정": "temporal", "반론": "temporal", "선언": "temporal", "요약": "temporal",
  "주제": "temporal", "긍정": "temporal", "부정": "temporal", "다의": "temporal", "토의": "temporal",
  "까닭": "temporal", "해석": "temporal", "연관": "temporal", "질문": "temporal", "비유": "temporal",

  // === 정리 머리 (두정엽) — 20개 ===
  "구간": "parietal", "경계": "parietal", "확대": "parietal", "비율": "parietal", "비례": "parietal",
  "집합": "parietal", "공통": "parietal", "결합": "parietal", "분해": "parietal", "동등": "parietal",
  "연쇄": "parietal", "역순": "parietal", "치환": "parietal", "변환": "parietal", "비교": "parietal",
  "대응": "parietal", "대입": "parietal", "배치": "parietal", "변수": "parietal", "단위": "parietal",

  // === 상상 머리 (후두엽) — 20개 ===
  "시각화": "occipital", "이미지": "occipital", "상징": "occipital", "감각": "occipital", "패턴": "occipital",
  "근사": "occipital", "정밀": "occipital", "순환": "occipital", "짐작": "occipital", "모호": "occipital",
  "명확": "occipital", "연속": "occipital", "불연속": "occipital", "표": "occipital", "도표": "occipital",
  "자리": "occipital", "입체": "occipital", "흐름": "occipital", "무한": "occipital", "미지": "occipital",
};

// ============================================================
// 복합 사고 TOP 10 (2개 이상 뇌 영역이 협력하는 고차원 사고)
// ------------------------------------------------------------
// 현재는 레퍼런스 용도이며, 향후 통합 사고력 리포트에서 활용 예정.
// 기본 5영역 매핑과는 독립적.
// ============================================================
export const COMPOUND_WORDS = [
  { rank: 1, word: "구조화", fusion: ["frontal", "parietal"], note: "실행+정리" },
  { rank: 2, word: "추론", fusion: ["temporal", "occipital"], note: "언어+상상" },
  { rank: 3, word: "맥락", fusion: ["limbic", "temporal"], note: "감성+언어" },
  { rank: 4, word: "원리", fusion: ["parietal", "temporal"], note: "정리+언어" },
  { rank: 5, word: "의도", fusion: ["frontal", "limbic"], note: "실행+감성" },
  { rank: 6, word: "최적화", fusion: ["frontal", "parietal"], note: "실행+정리" },
  { rank: 7, word: "분석", fusion: ["frontal", "parietal"], note: "실행+정리" },
  { rank: 8, word: "예측", fusion: ["frontal", "occipital"], note: "실행+상상" },
  { rank: 9, word: "비판", fusion: ["frontal", "temporal"], note: "실행+언어" },
  { rank: 10, word: "파악", fusion: ["temporal", "occipital"], note: "언어+상상" },
];

// ============================================================
// 가중치
// ------------------------------------------------------------
// 각 문항은 "핵심 사고력(core)"과 "보조 사고력(aux)"을 가짐.
// 정답 시 해당 단어가 속한 뇌 영역에 아래 가중치 × 문제 크레딧만큼 점수 누적.
// ============================================================
export const CORE_W = 2;
export const AUX_W = 1;

// ============================================================
// 등급 컷 (100점 만점, S/A/B/C/D)
// ============================================================
export const GRADE_CUTS = [
  { key: "S", label: "S", min: 95, color: "#8b2a1f", desc: "Exceptional" },
  { key: "A", label: "A", min: 85, color: "#b5812a", desc: "Strong" },
  { key: "B", label: "B", min: 70, color: "#5e7a3e", desc: "Developing" },
  { key: "C", label: "C", min: 40, color: "#3b6ea3", desc: "Emerging" },
  { key: "D", label: "D", min: 0, color: "#6b5d52", desc: "Foundational" },
];

export function gradeOf(score) {
  for (const cut of GRADE_CUTS) {
    if (score >= cut.min) return cut;
  }
  return GRADE_CUTS[GRADE_CUTS.length - 1];
}

// ============================================================
// 배점 규칙 (확정)
// ------------------------------------------------------------
// 모든 과목 공통으로 30문항, 100점 만점:
//   Q1–Q22         : 3점 (Section A/B/C/D, 22문항 × 3 = 66점)
//   Q23–Q28        : 4점 (Section E/F,      6문항 × 4 = 24점)
//   Q29–Q30        : 5점 (Section G 서술형, 2문항 × 5 = 10점, AI 채점)
// ============================================================
export const MC_COUNT = 28;         // 객관식 문항 수
export const WRITING_COUNT = 2;     // 서술형 문항 수
export const WRITING_POINTS_EACH = 5;
export const WRITING_POINTS_TOTAL = WRITING_COUNT * WRITING_POINTS_EACH; // 10
export const MC_POINTS_TOTAL = 90;  // 66 + 24
export const TOTAL_POINTS = 100;

/** 특정 문항 번호의 객관식 배점을 반환 */
export function getMcPoints(n) {
  // Section E (23-25) + Section F (26-28) = 4점
  if (n >= 23 && n <= 28) return 4;
  // 나머지 객관식: 3점
  return 3;
}

// ============================================================
// Worker URL (모든 과목 공통)
// ------------------------------------------------------------
// 하나의 Worker가 `?type=` 쿼리로 분기 처리:
//   POST /?type=subject&subject=english  → 영어 과목별 리포트 + 서술형 채점
//   POST /?type=subject&subject=korean   → 국어 (미래)
//   POST /?type=subject&subject=math     → 수학 (미래)
//   POST /?type=brain                    → 3과목 통합 사고력 리포트 (미래)
//   GET  /                               → 헬스체크
// ============================================================
export const WORKER_URL = "https://msat-english.kimsoosuk1.workers.dev";

// ============================================================
// 학생 식별자 (DB 이행 대비)
// ------------------------------------------------------------
// 로그인 없이도 '학교 + 학년 + 이름 + 생년월일6자리'를 해시해
// 안정적인 student_id를 만든다. 나중에 Cloudflare D1에 올릴 때
// 같은 키로 바로 조회 가능.
// ============================================================
export async function makeStudentId({ school, grade, name, dob6 }) {
  const key = [school, grade, name, dob6].map(s => String(s || "").trim()).join("|");
  const buf = new TextEncoder().encode(key);
  const hashBuf = await crypto.subtle.digest("SHA-256", buf);
  const bytes = Array.from(new Uint8Array(hashBuf));
  return bytes.map(b => b.toString(16).padStart(2, "0")).join("").slice(0, 16);
}

// ============================================================
// 학생 세션 저장소
// ------------------------------------------------------------
// 랜딩 페이지에서 학생 정보를 입력 → sessionStorage에 저장.
// 각 과목 페이지가 이 정보를 꺼내서 씀. 브라우저 탭을 닫으면 초기화됨.
// 과목 결과는 별도로 localStorage에 누적 저장하여 통합 리포트에서 활용.
// ============================================================
const SESSION_KEY = "msat.session";   // 현재 학생 정보
const RESULTS_KEY = "msat.results";   // { studentId: { english: resultObj, korean: ..., math: ... } }

export function saveSession(info) {
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(info));
  } catch (e) {
    console.warn("sessionStorage unavailable:", e);
  }
}

export function loadSession() {
  try {
    const s = sessionStorage.getItem(SESSION_KEY);
    return s ? JSON.parse(s) : null;
  } catch (e) {
    return null;
  }
}

export function clearSession() {
  try { sessionStorage.removeItem(SESSION_KEY); } catch (e) { /* ignore */ }
}

/** 한 과목의 결과를 localStorage에 저장 (통합 리포트에서 꺼내 쓸 용도) */
export function saveSubjectResult(studentId, subject, resultSnapshot) {
  if (!studentId) return;
  try {
    const all = JSON.parse(localStorage.getItem(RESULTS_KEY) || "{}");
    if (!all[studentId]) all[studentId] = {};
    all[studentId][subject] = {
      savedAt: new Date().toISOString(),
      ...resultSnapshot,
    };
    localStorage.setItem(RESULTS_KEY, JSON.stringify(all));
  } catch (e) {
    console.warn("localStorage save failed:", e);
  }
}

export function loadAllResults(studentId) {
  if (!studentId) return {};
  try {
    const all = JSON.parse(localStorage.getItem(RESULTS_KEY) || "{}");
    return all[studentId] || {};
  } catch (e) {
    return {};
  }
}

// ==========================================================
// DB API 스텁 (D1 연결 전까지는 localStorage 폴백)
// DB 연결 후에는 아래 함수들이 Worker API를 호출하도록 변경 예정
// ==========================================================

export const DB_ENABLED = true; // D1 DB 연결 시 true로 변경
export const ADMIN_KEY = "msat2026";

/**
 * 학생 등록/조회 — DB 연결 전에는 로컬에서 처리
 * @param {{ school: string, grade: string, name: string, dob: string }} info
 * @returns {Promise<{ studentId: string, isNew: boolean }>}
 */
export async function registerOrLoginStudent(info) {
  if (DB_ENABLED) {
    // DB가 켜져 있어도 studentId 생성 로직은 동일하게 유지 (SHA-256)
    // Worker 측 /save-result 에서 students 테이블에 자동 업서트되므로 별도 호출 불필요할 수 있으나,
    // 로그인 여부만 체크하는 용도로는 유지 가능.
  }
  const studentId = await makeStudentId(info);
  return { studentId, isNew: false };
}

/**
 * 시험 결과를 DB에 저장 — DB 연결 전에는 localStorage
 * @param {string} studentId
 * @param {string} subject
 * @param {object} resultSnapshot
 */
export async function saveResultToDB(student, resultSnapshot) {
  if (DB_ENABLED) {
    try {
      const resp = await fetch(`${WORKER_URL}/save-result`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ student, result: resultSnapshot }),
      });
      if (!resp.ok) throw new Error("DB save failed");
    } catch (e) {
      console.warn("DB save failed, falling back to local:", e);
    }
  }
  // localStorage 폴백은 항상 수행 (오프라인 대비)
  saveSubjectResult(student.studentId, resultSnapshot.subject, resultSnapshot);
}

/**
 * DB에서 결과 조회 — DB 연결 전에는 localStorage
 * @param {string} studentId
 * @returns {Promise<object>}
 */
export async function loadResultsFromDB(studentId) {
  if (DB_ENABLED) {
    try {
      const resp = await fetch(`${WORKER_URL}/admin/student/${studentId}`, {
        headers: { "X-Admin-Key": ADMIN_KEY }
      });
      if (resp.ok) {
        const data = await resp.json();
        return data.subjects; // { english: {...}, math: {...} }
      }
    } catch (e) {
      console.warn("DB load failed:", e);
    }
  }
  return loadAllResults(studentId);
}
