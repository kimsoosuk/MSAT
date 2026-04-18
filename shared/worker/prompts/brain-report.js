/**
 * MSAT · shared/worker/prompts/brain-report.js
 * -------------------------------------------------------------------
 * 3과목(영어/국어/수학) 결과를 통합하여 '사고력(뇌 5영역) 기반' 종합 리포트를
 * 생성하는 프롬프트 빌더.
 *
 * 특징:
 *   - 과목별 리포트와 달리 점수·등급이 아닌 "사고력"이 핵심
 *   - 5개 뇌 영역의 절대/상대 활성도 → 상위 % 추정
 *   - 중학교 가서 벌어질 일을 사고력 관점으로 예측
 *   - 학생의 프로필에 맞는 학원·과외 유형 추천
 *
 * 이 리포트는 관리자 전용 페이지에서만 생성됨.
 * -------------------------------------------------------------------
 */

export function buildBrainReportPrompt(payload) {
  const {
    student,
    subjects,           // { english: {...}, korean: {...}, math: {...} } — 각 과목의 결과 스냅샷
    aggregated,         // 3과목 합친 영역별 활성도/등급 등
    availableSubjects,  // ["english"] 등 실제 치른 과목 목록
  } = payload;

  const studentName = student?.name || "학생";

  // 과목별 점수 요약
  const subjectLines = availableSubjects.map(id => {
    const s = subjects[id];
    if (!s) return `- ${id}: (미응시)`;
    const kr = { english: "영어", korean: "국어", math: "수학" }[id] || id;
    return `- ${kr} (${id}): ${s.totalPoints}/100점 · 등급 ${s.grade_label}`;
  }).join("\n");

  // 3과목 통합 영역 활성도
  const regionLines = Object.entries(aggregated.regionAbs).map(([k, abs]) => {
    const percentile = aggregated.regionPercentile[k];
    const labels = {
      limbic: "감성 머리 (변연계)",
      frontal: "실행 머리 (전두엽)",
      temporal: "언어 머리 (측두엽)",
      parietal: "정리 머리 (두정엽)",
      occipital: "상상 머리 (후두엽)",
    };
    return `- ${labels[k]}: 활성도 ${Math.round(abs)}% · 추정 상위 ${percentile}%`;
  }).join("\n");

  const overallPercentile = aggregated.overallPercentile;

  // 단어별 상위/하위
  const topWordsLine = aggregated.topWords.slice(0, 10)
    .map(w => `${w.word}(${w.region}·${Math.round(w.intensity * 100)}%)`)
    .join(", ");
  const bottomWordsLine = aggregated.bottomWords.slice(0, 10)
    .map(w => `${w.word}(${w.region}·${Math.round(w.intensity * 100)}%)`)
    .join(", ");

  // 섹션별 성취도 (과목별 나열)
  const sectionLines = [];
  availableSubjects.forEach(subId => {
    const s = subjects[subId];
    if (!s || !s.perSection) return;
    const subKr = { english: "영어", korean: "국어", math: "수학" }[subId] || subId;
    Object.values(s.perSection).forEach(sec => {
      sectionLines.push(`- [${subKr}] Section ${sec.section}: ${sec.correctQ}/${sec.totalQ} (${sec.pct}%)`);
    });
  });
  const sectionBlock = sectionLines.join("\n");

  return `당신은 예비 중학생의 사고력을 종합 진단하는 전문 교육 상담가입니다.
다음 학생이 MSAT의 ${availableSubjects.length}개 과목(${availableSubjects.join(", ")})을 치른 결과를 바탕으로,
뇌 5개 영역 사고력 기반의 **통합 리포트**를 작성하세요.

반드시 JSON 하나만 출력하세요. JSON 앞뒤에 설명, 마크다운 코드펜스 금지.

=============================================================
【 학생 정보 】
이름: ${studentName}
학교: ${student?.school || "(미기입)"}
학년: ${student?.grade || "(미기입)"}

【 응시한 과목과 점수 】
${subjectLines}

【 3과목 통합 사고력 활성도 (5개 뇌 영역) 】
${regionLines}

종합 사고력 상위 추정: 상위 ${overallPercentile}%
균형도(표준편차): ${aggregated.regionStdev.toFixed(1)} (작을수록 균형적)

【 가장 강한 사고력 단어 Top 10 】
${topWordsLine}

【 약한 사고력 단어 10 】
${bottomWordsLine}

【 과목·섹션별 성취 】
${sectionBlock}

=============================================================

【 상위 % 해석 가이드 (percentile은 현재 데이터 기반의 추정치) 】
- 상위 5% 이내: 최상위권 사고력
- 상위 5-15%: 상위권 사고력
- 상위 15-35%: 평균 이상
- 상위 35-65%: 평균
- 상위 65% 이하: 기초 다지기 단계

【 뇌 영역 이름 규칙 — 반드시 이대로 표기 】
- 감성 머리 (변연계)
- 실행 머리 (전두엽)
- 언어 머리 (측두엽)
- 정리 머리 (두정엽)
- 상상 머리 (후두엽)

=============================================================

【 출력 스키마 】

{
  "report": "<아래 구조의 한국어 마크다운 리포트>"
}

【 report 구조 — 반드시 이 순서와 헤더 사용 】

## 종합 사고력 프로필

> (한 문단, "> "로 시작하는 인용 블록. 학생의 사고력 프로필을 한눈에 보여주는 인상적인 요약. 3-4문장)

(2-3문단으로 학생의 고유한 사고 스타일 해석. 5개 뇌 영역의 균형/편향, 3과목에 걸쳐 공통적으로 드러난 강약점, 복합 사고 경향 등.)

## 뇌 5개 영역별 상세

각 영역에 대해 아래 형식 — 반드시 5개 영역 모두 다뤄야 함:

#### 감성 머리 (변연계) — 상위 X%

**현재 상태:** (활성도 수치와 그 의미 2-3문장)

**이 영역의 의미:** (이 뇌 영역이 학습/삶에서 하는 역할을 간결하게)

**${studentName}의 경우:** (3과목 응답에서 이 영역이 어떻게 드러났는지 구체적으로)

(나머지 4개 영역도 같은 형식으로 계속)

## 중학교에서 벌어질 일

예비중1 학생이 중학교에 올라가서 지금의 사고력 프로필로 겪을 상황을 예측.
각 뇌 영역 기반으로 **구체적**으로. "중학교 가서 어려움" 같은 막연한 표현은 금지.

#### 국어/독해 측면
(언어 머리 중심 해석. 현재 수준으로 중1 국어 교과서, 비문학 독해, 서술형 평가에서 무슨 일이 생길지)

#### 수학/논리 측면
(정리 머리 + 실행 머리 중심. 중1 함수, 도형, 정수와 유리수 단원에서 어떤 특징이 나올지)

#### 영어/표현 측면
(언어 + 감성 머리 중심. 긴 지문, 분위기·어조 문제, 서술형 영작에서의 예상)

#### 학습 태도·자기조절 측면
(실행 머리 중심. 중학교 시험 기간 계획 세우기, 자습 시간 집중력 등에서 예상되는 양상)

## 추천 학습 유형

학생의 뇌 영역 프로필에 맞는 구체적인 학원·과외·자습 유형을 제안.
한 가지가 아니라 **우선순위대로 2-3개 유형**을 제시.

#### 1순위: (학원/과외/자습 중 하나 + 구체 유형)

- **왜 이 유형이 맞는가:** (이 학생의 사고력 프로필과 어떻게 맞아떨어지는지)
- **이런 수업을 찾으세요:** (수업 스타일, 진도 속도, 교재 종류 등 구체 기준)
- **주의할 점:** (이 유형에서도 피해야 할 것)

#### 2순위: (...)
(동일 형식)

#### 3순위: (...)
(동일 형식)

## 종합 조언

${studentName} 학생과 보호자를 위한 종합 메시지 (4-5문장).
- 현재 사고력 프로필의 가장 중요한 특징
- 앞으로 1년간 중점적으로 길러야 할 부분
- 격려와 구체적인 첫 걸음 제안

---

【 작성 원칙 】
1. 출력은 오직 JSON 하나. 그 외 텍스트·코드펜스 금지.
2. **반드시 뇌 5개 영역 관점을 유지**. 개별 문제·과목 점수 나열보다 영역 해석에 집중.
3. 상위 %는 주어진 추정치를 그대로 사용하되, 그 의미를 풀어서 설명.
4. 학원 유형 추천은 구체적으로: "논리형 소그룹 수업", "서술형 첨삭 과외", "자기주도형 자습실" 등.
5. 과잉 겁주기 금지. "지금 안 하면 망한다" 같은 협박조 금지.
6. "${studentName} 학생"으로 자연스럽게 호명.
7. 전체 분량 한글 기준 약 1800~2500자.`;
}
