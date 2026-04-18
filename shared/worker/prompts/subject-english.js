/**
 * MSAT · shared/worker/prompts/subject-english.js
 * -------------------------------------------------------------------
 * 영어 과목별 리포트 프롬프트 빌더.
 *
 * 과목별 리포트는 "사고력(뇌 영역)" 대신 "시험 결과(점수, 등급, 섹션별,
 * 유형별, 오답)" 중심으로 구성. 학생이 시험 직후 받는 첫 번째 피드백.
 *
 * 나중에 통합 사고력 리포트(brain-report.js)가 뇌 영역 관점을 다룸.
 * -------------------------------------------------------------------
 */

export function buildEnglishSubjectPrompt(payload) {
  const {
    student,
    preliminary,
    sectionSummary,
    perQuestionBrief,
    writingSubmissions,
  } = payload;

  const studentName = student?.name || "학생";

  // 섹션별 요약 테이블
  const sectionLines = sectionSummary.map(s => {
    return `- Section ${s.section}: ${s.correctQ}/${s.totalQ} 문항 · ${s.pointsEarned}/${s.pointsMax}점 (${s.pct}%)`;
  }).join("\n");

  // 유형별 정답률 (type_code 기준으로 그룹핑)
  const typeGroups = {};
  perQuestionBrief.forEach(q => {
    if (!q.type_code) return;
    if (!typeGroups[q.type_code]) {
      typeGroups[q.type_code] = { label: q.type_label, items: [] };
    }
    typeGroups[q.type_code].items.push(q);
  });
  const typeLines = Object.entries(typeGroups).map(([code, g]) => {
    const correctCount = g.items.filter(i => i.correct).length;
    return `- [${code}] ${g.label}: ${correctCount}/${g.items.length} 문항 정답 (문항 번호: ${g.items.map(i => `Q${i.n}`).join(", ")})`;
  }).join("\n");

  // 오답 문항 상세
  const wrongOnes = perQuestionBrief.filter(q => q.correct === false);
  const wrongDetail = wrongOnes.length > 0
    ? wrongOnes.map(q => {
        if (q.userAnswer === null) {
          return `- Q${q.n} [${q.type_code} · ${q.type_label}] 서술형, 점수: ${q.score}/5`;
        }
        return `- Q${q.n} [${q.type_code} · ${q.type_label}] 학생 답: ${q.userAnswer || "(미응답)"} / 정답: ${q.correctAnswer}`;
      }).join("\n")
    : "(오답 없음 — 모두 정답)";

  // 서술형 답안
  const writingBlock = writingSubmissions.map(w => {
    const fieldsText = Object.entries(w.fields)
      .map(([k, v]) => `  [${k}]\n  ${(v || "(미작성)").trim()}`)
      .join("\n");
    return `Q${w.n} (${w.type_label}):\n문제: ${w.question}\n학생 답안:\n${fieldsText}`;
  }).join("\n\n");

  return `당신은 한국 예비중1 학생의 영어 시험 결과를 진단하는 전문 교육 코치입니다.
다음 학생의 시험 결과를 분석하고, 과목별 성적표 해설을 작성하세요.

이 리포트는 **영어 과목 한정 성적 해설**입니다.
뇌 영역·사고력 단어 같은 "사고력" 관점의 해설은 이 리포트에서 언급하지 마세요.
(그 내용은 나중에 3과목을 모두 치른 뒤 별도 사고력 리포트에서 다룹니다.)

=============================================================
【 학생 정보 】
이름: ${studentName}
학교: ${student?.school || "(미기입)"}
학년: ${student?.grade || "(미기입)"}

【 객관식 점수 】
${preliminary.mcCorrect} / ${preliminary.mcTotal} 문항 정답
객관식 점수: ${preliminary.mcPoints} / ${preliminary.mcPointsMax}점

【 섹션별 성취 】
${sectionLines}

【 유형별 정답률 (type_code는 내부 식별자) 】
${typeLines}

【 오답 문항 상세 】
${wrongDetail}

=============================================================
【 서술형 답안 】
${writingBlock}

=============================================================

【 서술형 채점 기준 】

Q29 (비교·대조, writing_comparison, 5점 만점):
- 5점: 공통점·차이점 각 5개씩 제시, 모두 완전한 영어 문장, 기준이 일관되고 관점이 명확함
- 4점: 각 5개씩 제시, 문장이 대부분 완전, 일부 비교 기준이 느슨함
- 3점: 합쳐 7~8개, 문장 일부 미완성 또는 반복적 기준
- 2점: 4~6개 정도, 짧은 구/단어 위주
- 1점: 1~3개, 문장이 매우 짧거나 의미 불분명
- 0점: 미작성 또는 영어가 아닌 답변

Q30 (정의+예시, writing_definition, 5점 만점):
- 5점: 'concept(개념)'에 대한 자기만의 명확한 정의 + 적절한 예시 1개 이상 + 3~5 영어 문장
- 4점: 정의는 있으나 일반적, 예시 있음
- 3점: 정의가 모호하거나 예시가 약함
- 2점: 정의 또는 예시 중 하나만 있음
- 1점: 단편적 문구
- 0점: 미작성 또는 영어가 아닌 답변

=============================================================

【 출력 스키마 】

아래와 같이 **세 가지 블록**으로 나누어서 응답하세요.

1. JSON 블록: 서술형 채점 결과
2. SECTION_DETAIL 블록: 섹션별 성취도 해석 (01 섹션별 상세 진단 카드에 들어갈 내용)
3. REPORT 블록: 최종 영어 레포트 (03 영어 레포트에 표시될 내용)

===JSON_START===
{
  "writingGrades": {
    "29": { "score": 0~5, "feedback": "여기에 관련된 서술형 피드백을 작성" },
    "30": { "score": 0~5, "feedback": "피드백 작성" }
  }
}
===JSON_END===

===SECTION_DETAIL_START===
각 섹션(A~G)에 대해 아래처럼 구분하여 작성:

[SECTION_A]
(Section A · Reading Comprehension에서 ${studentName}이(가) 보여준 성취도에 대한 해석을 2~3문장으로. 어떤 유형을 잘했고 어떤 유형에서 막혔는지. type_label을 사용해 구체적으로.)

[SECTION_B]
(Section B · Quantitative Reasoning에 대한 같은 형식의 해석)

[SECTION_C]
(Section C에 대한 해석)

[SECTION_D]
(Section D에 대한 해석)

[SECTION_E]
(Section E에 대한 해석)

[SECTION_F]
(Section F에 대한 해석)

[SECTION_G]
(Section G에 대한 해석)
===SECTION_DETAIL_END===

===REPORT_START===
## 총평

> (한 문단의 인용 블록 "> "으로 시작. 이 학생이 영어 시험에서 보인 전반적인 강약점을 3-4문장으로 요약)

(2문단 정도로 학생의 영어 시험 결과를 해석. 점수/등급 이야기와 섹션별 경향을 간결하게.)

## 중학교 미리보기

(이 학생의 시험 결과를 바탕으로, 중학교 영어에서 만나게 될 모습을 자연스러운 글 형태로 서술. 단순히 섹션별로 나열하지 말고, 하나의 이어지는 에세이처럼 자연스럽게 연결. 이 학생의 강점이 중학교에서 어떤 도움이 될지, 보완이 필요한 부분은 중학교 어떤 단원/시험에서 다시 만나게 되는지를 차분히 예고. 3~5문단.)

## 특히 주의 깊게 볼 지점

오답 중 가장 중요한 3~5개 문제를 짚어서 각각 아래 형식으로:

#### Q{n} · {type_label}

**무엇을 놓쳤나:** (학생이 왜 그 오답을 골랐을지 가능한 추측 + 지문/문제가 요구한 것)

**왜 중요한가:** (이 유형이 실전 영어에서 왜 빠지면 안 되는 기본기인지)

**다음에 만났을 때 붙잡는 법:** (구체적인 접근 방법, 한 가지만)

## 서술형 채점 코멘트

Q29와 Q30 각각에 대해 한 문단씩. 점수와 함께 좋은 점·아쉬운 점을 구체적으로.

## 맞춤 학습 제안

영어 과목에 한정한 실천 가능한 학습 방법 2~3개. 각각:

#### [제안] {짧은 제목}

- **왜 필요한가:** (한 문장)
- **어떻게:** (2-3문장, 빈도와 방법 명시)

## 마지막으로

${studentName} 학생을 향한 격려 메시지 (2-3문장). 
===REPORT_END===

---

【 작성 원칙 】
1. 반드시 ===JSON_START===, ===SECTION_DETAIL_START===, ===REPORT_START=== 세 가지 태그 구조를 모두 지켜서 출력하세요.
2. 서술형 피드백은 JSON 블록 안에, 섹션별 성취도 해석은 SECTION_DETAIL 블록에, 리포트 본문은 REPORT 블록에 작성합니다.
3. SECTION_DETAIL 블록에는 각 섹션의 [SECTION_X] 태그로 구분합니다.
4. 본 리포트는 "영어 과목 성적 해설"만 다룸. 뇌 영역, 사고력 단어 언급 금지.
5. 중학교 미리보기는 "지금 약하면 망한다" 같은 협박 금지. 사실 기반 차분한 톤. 자연스러운 글 형태로.
6. 학생 이름을 자연스럽게 호명.
7. 점수대별 톤:
   - 95+ (S): 성취 인정 + 더 깊이 있는 도전 제안
   - 85-94 (A): 강점 구체화 + 놓친 유형 보완
   - 70-84 (B): 가능성 강조 + 구체적 방법
   - 40-69 (C): 기초 다지기 + 격려
   - 40 미만 (D): 부담 덜기 + 꾸준함 제안
8. 전체 분량 한글 기준 약 1500~2000자.
9. 마크다운 문법을 정확하게 사용하세요: ## 제목, #### 소제목, **강조**, > 인용, - 리스트 등.`;
}
