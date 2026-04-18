/**
 * MSAT · english/questions.js
 * -------------------------------------------------------------------
 * 영어 과목 전용 데이터:
 *   - PASSAGE_1, PASSAGE_2 (Section A 지문)
 *   - SECTIONS (섹션 메타)
 *   - PAGES (페이지 분할: 시험지가 8페이지로 나뉨)
 *   - QUESTIONS (30문항, 각 문항에 type_code/type_label 추가)
 *   - SUBJECT_META (과목 식별용)
 *
 * 학생 화면에는 Section(A~G) 단위로만 노출.
 * type_code는 AI 리포트 프롬프트에 전달되어, 설명 단계에서만 구체적인
 * 유형명(문맥 속 어휘 추론, 분수 비례식 등)으로 언급된다.
 * -------------------------------------------------------------------
 */

// ============================================================
// 과목 메타 (portal/통합 리포트에서 과목을 구별하는 용도)
// ============================================================
export const SUBJECT_META = {
  id: "english",
  kr: "영어",
  en: "English",
  timeMinutes: 70,
};

// ============================================================
// 지문
// ============================================================
export const PASSAGE_1 = {
  paragraphs: [
    `When Maria stepped onto the stage for the first time, her hands were shaking and her heart was pounding. She had spent months preparing for this moment — learning every note, every pause, every breath. Her violin teacher, Mr. Ito, had told her that performing was not just about playing the right notes. "You must feel the music," he said. "Let the audience see your emotions through the sound."`,
    `As the spotlight hit her face, Maria closed her eyes and took a deep breath. She thought about the piece she was about to play — a melody written by a composer who had lost his hearing late in life. The composer had once written in his diary, "I can no longer hear the world, but I can still feel it. My music is my voice when words fail me." Maria found strength in those words. She understood that music was more than technique; it was a way to share something deeply personal with strangers.`,
    `When she finally drew her bow across the strings, the sound that emerged was not merely beautiful — it was alive. The audience sat in complete silence, not because they were told to, but because the music demanded it. Some wiped tears from their eyes. When the last note faded, there was a moment of stillness before the hall erupted in applause. Maria opened her eyes and smiled. She had not just played the music. She had become it.`
  ],
  footnotes: [
    { term: "transformative", mean: "삶을 변화시키는, 획기적인" },
    { term: "genuine", mean: "진실된, 거짓 없는" }
  ]
};

export const PASSAGE_2 = {
  paragraphs: [
    `The Amazon rainforest covers an area larger than the entire country of India. Scientists often call it "the lungs of the Earth" because its trees absorb enormous amounts of carbon dioxide and release oxygen back into the atmosphere. However, this comparison is somewhat misleading. While the Amazon does produce roughly 20 percent of the world's oxygen, its plants and animals also consume nearly the same amount through respiration. The net contribution to global oxygen is therefore quite small.`,
    `What makes the Amazon truly vital is its role in regulating the global water cycle. The forest generates about half of its own rainfall through a process called transpiration, in which trees pull water from the soil and release it as vapor through their leaves. This moisture travels westward, carried by winds, and eventually falls as rain over the Andes Mountains and across South America. Without the forest, this cycle would collapse, turning vast regions into dry grasslands.`,
    `Despite its importance, the Amazon has lost approximately 17 percent of its forest cover in the last fifty years. Deforestation driven by farming, logging, and road construction continues to threaten this ecosystem. Scientists warn that if destruction reaches 20 to 25 percent of the original forest, the entire system could cross a tipping point from which recovery would be extremely difficult.`
  ],
  footnotes: [
    { term: "respiration", mean: "호흡" },
    { term: "transpiration", mean: "증산 작용" },
    { term: "deforestation", mean: "삼림 벌채, 숲 파괴" },
    { term: "tipping point", mean: "임계점 (돌이킬 수 없는 큰 변화가 일어나는 시점)" },
  ]
};

// ============================================================
// 섹션
// ============================================================
export const SECTIONS = [
  {
    id: "A", en: "Reading Comprehension", kr: "독해력",
    desc: "Read each passage carefully and answer the questions that follow.",
    abilities: "글의 목적·요지 파악, 세부 정보 추출, 문맥 속 어휘 추론, 핵심 주제 도출, 근거 기반 추론",
    lowGuide: "지문을 꼼꼼히 다시 읽으며 핵심 문장에 밑줄 치는 연습이 도움이 됩니다. 문단별 중심 내용을 한 줄로 정리하는 습관을 들여보세요.",
    highGuide: "독해의 기본기가 탄탄합니다. 더 긴 지문이나 다양한 장르(에세이, 기사 등)에 도전하면 실력이 한층 성장합니다.",
  },
  {
    id: "B", en: "Quantitative Reasoning", kr: "수리적 사고",
    desc: "Read each question carefully and select the best answer.",
    abilities: "비례·비율 문제, 도표·그래프 해석, 속력·거리 계산, 규칙·수열 찾기, 도형 넓이 계산",
    lowGuide: "문제 속 숫자 관계를 그림이나 표로 정리하면 풀이가 쉬워집니다. 기본 연산과 비율 개념을 복습해보세요.",
    highGuide: "수리적 사고가 우수합니다. 복합 조건이 붙는 심화 문제에 도전해 보면 좋겠습니다.",
  },
  {
    id: "C", en: "Sentence Completion", kr: "문장 완성",
    desc: "Select the phrase that best completes the sentence.",
    abilities: "원인·결과의 논리적 연결, 목표·행동의 자연스러운 귀결, 조건·조치의 타당성, 진단·대응 행동의 적절성",
    lowGuide: "문장 앞뒤 맥락을 파악하고, '왜?', '그래서?'를 자문하며 논리적 연결고리를 찾는 연습이 필요합니다.",
    highGuide: "문맥 파악력이 좋습니다. 접속사와 논리 연결어를 더 다양하게 활용하는 영작 연습을 해보세요.",
  },
  {
    id: "D", en: "Sentence Ordering", kr: "문장 배열",
    desc: "Arrange sentences in the most logical order.",
    abilities: "시간순 배열, 원인-결과 흐름 파악, 첫 문장/마지막 문장 고정 배열, 완전 재구성",
    lowGuide: "각 문장의 접속사(However, Later, As a result 등)에 주목하면 순서를 잡는 실마리가 됩니다.",
    highGuide: "글의 흐름을 잘 파악하고 있습니다. 더 복잡한 논설문 구조에도 도전해보세요.",
  },
  {
    id: "E", en: "Mood and Tone", kr: "분위기·감정 파악",
    desc: "Answer questions about the speaker's feelings or mood.",
    abilities: "인물 감정 식별, 상황의 전반적 분위기 파악, 감정 변화 서사 추적",
    lowGuide: "인물의 행동과 표현에서 감정 단서를 찾는 연습이 필요합니다. 영어 감정 어휘(frustrated, grateful 등)를 늘려보세요.",
    highGuide: "감정 표현을 잘 읽어냅니다. 문학 작품을 읽으며 미묘한 심리 변화를 포착하는 훈련을 이어가세요.",
  },
  {
    id: "F", en: "Inference", kr: "추론",
    desc: "Choose the best answer based strictly on what can be inferred.",
    abilities: "근거 기반 추론, 과잉 추론(NOT) 판별, 원인·동기 추론",
    lowGuide: "추론은 '글에 쓰인 근거'에서만 출발해야 합니다. 선택지마다 '이 내용이 글에 있는가?'를 확인하는 습관을 들이세요.",
    highGuide: "추론 능력이 뛰어납니다. 다양한 비문학 지문에서 필자의 숨은 의도를 읽어내는 연습을 해보세요.",
  },
  {
    id: "G", en: "Short Writing", kr: "서술형 영작",
    desc: "Answer in complete sentences. Write in English.",
    abilities: "비교·대조 서술, 정의·예시 기반 서술, 완전한 영어 문장 작성, 기준의 일관성",
    lowGuide: "짧은 문장이라도 주어+동사를 갖춘 완전한 문장을 쓰는 연습부터 시작하세요. 하루 3문장 영작이 효과적입니다.",
    highGuide: "영작 표현력이 우수합니다. 다양한 문장 구조와 접속사를 활용해 글의 깊이를 더해보세요.",
  },
];

// ============================================================
// 페이지 (시험지는 8페이지로 분할)
//   Section A는 지문별로 2페이지, 나머지는 섹션당 1페이지
// ============================================================
export const PAGES = [
  { key: "A1", sectionId: "A", title: "Section A · Reading Comprehension", subtitle: "Passage 1 of 2",   questionNums: [1, 2, 3, 4, 5] },
  { key: "A2", sectionId: "A", title: "Section A · Reading Comprehension", subtitle: "Passage 2 of 2",   questionNums: [6, 7, 8, 9, 10] },
  { key: "B",  sectionId: "B", title: "Section B · Quantitative Reasoning", subtitle: "",                 questionNums: [11, 12, 13, 14, 15] },
  { key: "C",  sectionId: "C", title: "Section C · Sentence Completion",   subtitle: "",                  questionNums: [16, 17, 18, 19] },
  { key: "D",  sectionId: "D", title: "Section D · Sentence Ordering",     subtitle: "",                  questionNums: [20, 21, 22] },
  { key: "E",  sectionId: "E", title: "Section E · Mood and Tone",         subtitle: "",                  questionNums: [23, 24, 25] },
  { key: "F",  sectionId: "F", title: "Section F · Inference",             subtitle: "",                  questionNums: [26, 27, 28] },
  { key: "G",  sectionId: "G", title: "Section G · Short Writing",         subtitle: "",                  questionNums: [29, 30] },
];

// ============================================================
// 30문항
// ------------------------------------------------------------
// 필드 안내:
//   n, section       — 식별자
//   type_code        — AI 프롬프트에만 전달되는 유형 코드
//   type_label       — AI 해설에 쓰일 유형명 (한국어)
//   unit_hint        — AI가 중학교 단원/장르와 연결지을 힌트
//   question/options — 표시되는 문제
//   answer           — 정답 (객관식)
//   type             — "mc" | "writing"
//   core/aux         — 사고력 단어 매핑 (뇌 영역 활성도 계산)
//   passageRef       — Section A 전용, 어느 지문인지 (1|2)
//   chart            — Section B Q12 전용 (막대그래프 데이터)
//   fields           — Section G 전용 (서술형 입력 필드들)
//   prompt           — 선택적 인용문(Section D/E/F)
//   footnotes        — 선택적 각주
// ============================================================
export const QUESTIONS = [
  // ================ Section A · Reading Comprehension ================
  {
    n: 1, section: "A", passageRef: 1, type: "mc",
    type_code: "main_purpose",
    type_label: "글의 목적·요지 파악",
    unit_hint: "주제·요지를 파악하는 독해 (중학교 모의고사의 단골 유형)",
    question: "What is the main purpose of this passage?",
    options: [
      "To explain how to learn to play the violin",
      "To argue that music is more important than other art forms",
      "To provide a biography of a deaf composer",
      "To describe a musician's transformative experience performing on stage",
      "To compare Maria's talent with that of professional violinists"
    ],
    answer: "D",
    core: ["요약", "주제"], aux: ["해석"]
  },
  {
    n: 2, section: "A", passageRef: 1, type: "mc",
    type_code: "vocab_in_context",
    type_label: "문맥 속 어휘 의미 추론",
    unit_hint: "어휘의 맥락적 의미를 추론 (중학교 내신 서술형에도 자주 등장)",
    question: 'In line 4, the phrase "feel the music" most nearly means',
    options: [
      "connect with the emotions the music expresses",
      "touch the instrument carefully",
      "memorize the notes perfectly",
      "play the music very loudly",
      "listen closely to the rhythm of the melody"
    ],
    answer: "A",
    core: ["정의", "의미"], aux: ["해석", "감정", "감각"]
  },
  {
    n: 3, section: "A", passageRef: 1, type: "mc",
    type_code: "detail_retrieval",
    type_label: "세부 정보 찾기",
    unit_hint: "지문의 구체 내용과 일치하는 근거를 찾는 유형",
    question: "According to the passage, why did the audience sit in silence?",
    options: [
      "They were told to be quiet by the concert staff.",
      "They were disappointed by Maria's performance.",
      "They could not hear the music from their seats.",
      "They were waiting for the next performer to appear.",
      "They were so moved by the music that they listened with deep attention."
    ],
    answer: "E",
    core: ["근거", "까닭"], aux: ["공감"]
  },
  {
    n: 4, section: "A", passageRef: 1, type: "mc",
    type_code: "main_theme",
    type_label: "중심 주제 파악",
    unit_hint: "글 전체의 핵심 주장/주제 도출 (수능형 독해 핵심)",
    question: "Which of the following best describes the main theme of the passage?",
    options: [
      "Hard work always leads to success.",
      "Playing the violin is the most difficult instrument to master.",
      "True art comes from expressing genuine emotion, not just technical skill.",
      "Famous composers are always misunderstood by the public.",
      "Stage performances should be judged by how quickly they end."
    ],
    answer: "C",
    core: ["핵심", "주장"], aux: ["표현", "가치"]
  },
  {
    n: 5, section: "A", passageRef: 1, type: "mc",
    type_code: "inference_reading",
    type_label: "글에 근거한 추론",
    unit_hint: "명시되지 않은 내용을 지문 근거로 추론",
    question: "It can be inferred from the passage that Maria's performance was powerful because she",
    options: [
      "played louder than any other performer that night.",
      "connected personally with the meaning behind the music.",
      "used a very expensive violin.",
      "had more experience than the other musicians.",
      "avoided making any eye contact with the audience."
    ],
    answer: "B",
    core: ["해석", "감상"], aux: ["공감", "동기"]
  },
  {
    n: 6, section: "A", passageRef: 2, type: "mc",
    type_code: "main_purpose",
    type_label: "글의 목적·요지 파악",
    unit_hint: "정보 전달문의 목적을 파악 (설명문 독해)",
    question: "The main purpose of this passage is to",
    options: [
      "explain why the Amazon rainforest is important and why it is threatened.",
      "compare the Amazon rainforest to forests in other parts of the world.",
      "argue that deforestation has no real impact on the environment.",
      "describe the animals that live in the Amazon rainforest.",
      "criticize scientists who study the Amazon rainforest."
    ],
    answer: "A",
    core: ["주제", "요약"], aux: ["목적"]
  },
  {
    n: 7, section: "A", passageRef: 2, type: "mc",
    type_code: "vocab_in_context",
    type_label: "문맥 속 어휘 의미 추론",
    unit_hint: "부정적 뉘앙스 형용사의 문맥 의미 (misleading 등)",
    question: 'In line 3, the word "misleading" most nearly means',
    options: [
      "completely false",
      "extremely useful",
      "perfectly accurate",
      "giving a wrong impression",
      "very surprising"
    ],
    answer: "D",
    core: ["정의", "명확"], aux: ["모호"]
  },
  {
    n: 8, section: "A", passageRef: 2, type: "mc",
    type_code: "detail_retrieval",
    type_label: "세부 정보 찾기",
    unit_hint: "원문 근거를 들어 비교·대조를 해석",
    question: 'According to the passage, why is the "lungs of the Earth" comparison not entirely accurate?',
    options: [
      "The Amazon does not contain any trees.",
      "Other forests produce more oxygen than the Amazon.",
      "Lungs do not produce oxygen.",
      "The Amazon is too small to affect the atmosphere.",
      "The Amazon actually produces very little oxygen overall because its organisms also consume most of it."
    ],
    answer: "E",
    core: ["근거", "비교"], aux: ["분해"]
  },
  {
    n: 9, section: "A", passageRef: 2, type: "mc",
    type_code: "main_theme",
    type_label: "중심 주제 파악",
    unit_hint: "여러 역할 중 '핵심'을 식별 (과학 설명문 주제 파악)",
    question: "What is the most important role of the Amazon according to the passage?",
    options: [
      "Providing wood for construction",
      "Producing oxygen for the entire planet",
      "Regulating the global water cycle through transpiration",
      "Serving as a home for endangered species",
      "Preventing earthquakes in South America"
    ],
    answer: "C",
    core: ["핵심", "목적"], aux: ["순환"]
  },
  {
    n: 10, section: "A", passageRef: 2, type: "mc",
    type_code: "inference_reading",
    type_label: "글에 근거한 추론",
    unit_hint: "정량·정성 개념(임계점)의 함의를 추론",
    question: 'Based on the passage, what can be inferred about the "tipping point" mentioned in line 18?',
    options: [
      "It is a point after which the forest could recover quickly.",
      "It is a level of destruction beyond which the forest system could permanently collapse.",
      "It has already been reached and the Amazon is gone.",
      "It only affects the oxygen production of the forest.",
      "It will make the forest grow back faster than before."
    ],
    answer: "B",
    core: ["해석", "근사"], aux: ["모호", "변환", "짐작"]
  },

  // ================ Section B · Quantitative Reasoning ================
  {
    n: 11, section: "B", type: "mc",
    type_code: "ratio_proportion",
    type_label: "비례·비율 문제",
    unit_hint: "비와 비율 (중1 수학 1학기 핵심 단원)",
    question: "A recipe calls for 3 cups of flour to make 24 cookies. If Sarah wants to make 60 cookies, how many cups of flour does she need?",
    options: ["7.5", "5.0", "6.5", "8.0", "9.0"],
    answer: "A",
    core: ["비율"], aux: ["대응", "변수"]
  },
  {
    n: 12, section: "B", type: "mc",
    type_code: "data_chart",
    type_label: "도표·그래프 해석",
    unit_hint: "자료의 정리와 대푯값 (평균/중앙값 단원)",
    question: "The bar graph below shows the number of books read by four students in one month. What is the average (mean) number of books read by the four students?",
    chart: { title: "Number of Books Read", data: [
      { label: "Alex", v: 6 }, { label: "Bella", v: 12 }, { label: "Carlos", v: 8 }, { label: "Dana", v: 10 }
    ]},
    options: ["7", "8", "10", "9", "11"],
    answer: "D",
    core: ["도표", "단위"], aux: ["결합", "비교"]
  },
  {
    n: 13, section: "B", type: "mc",
    type_code: "rate_distance",
    type_label: "속력·시간·거리 (일차함수 응용)",
    unit_hint: "일차함수의 활용, 정비례 관계",
    question: "A train travels at a constant speed. It covers 150 miles in 3 hours. If the train continues at the same speed, how far will it travel in 5 hours?",
    options: ["200 miles", "250 miles", "225 miles", "275 miles", "300 miles"],
    answer: "B",
    core: ["대응", "변환"], aux: ["비율"]
  },
  {
    n: 14, section: "B", type: "mc",
    type_code: "pattern_sequence",
    type_label: "규칙·수열 찾기",
    unit_hint: "등비 수열의 기본 개념 (수열 단원의 도입)",
    question: "Look at the pattern below: &nbsp; <span class='mono'>2, 6, 18, 54, ___</span> &nbsp; What number comes next in the pattern?",
    options: ["108", "126", "216", "270", "162"],
    answer: "E",
    core: ["패턴", "연속"], aux: ["흐름"]
  },
  {
    n: 15, section: "B", type: "mc",
    type_code: "geometry_area",
    type_label: "도형의 넓이 계산",
    unit_hint: "평면도형의 넓이 (전체-부분 차감)",
    question: "A rectangular garden has a length of 12 meters and a width of 8 meters. A path that is 1 meter wide surrounds the garden on all sides. What is the area of the path alone?",
    options: ["36 square meters", "48 square meters", "44 square meters", "96 square meters", "140 square meters"],
    answer: "C",
    core: ["분해", "결합", "배치"], aux: ["구간"]
  },

  // ================ Section C · Sentence Completion ================
  {
    n: 16, section: "C", type: "mc",
    type_code: "cause_effect",
    type_label: "원인·결과의 논리적 연결",
    unit_hint: "담화 논리 (접속 부사/종속절)",
    question: "Even though the weather forecast predicted a sunny day, Marco decided to bring an umbrella because he _______.",
    options: [
      "enjoyed getting wet in the rain",
      "had learned from past experience that forecasts are not always reliable",
      "wanted to use it as a walking stick on the trail",
      "did not own any other accessories to carry",
      "had just bought a new raincoat the day before"
    ],
    answer: "B",
    core: ["고려", "기준"], aux: ["성찰", "관점"]
  },
  {
    n: 17, section: "C", type: "mc",
    type_code: "goal_action",
    type_label: "목표·행동의 자연스러운 귀결",
    unit_hint: "목적 달성 서사의 구조",
    question: "After months of saving her allowance, Priya finally had enough money to buy the telescope, so she _______.",
    options: [
      "decided she no longer wanted it",
      "asked her parents to save more money for her",
      "gave all her savings to her younger brother instead",
      "went to the store and purchased it with great excitement",
      "forgot where she had placed her savings jar"
    ],
    answer: "D",
    core: ["계획", "적용"], aux: ["동기", "목적"]
  },
  {
    n: 18, section: "C", type: "mc",
    type_code: "condition_action",
    type_label: "조건·조치의 타당성",
    unit_hint: "위기 대응 담화 / 사회 현안 읽기",
    question: "Because the river had risen dangerously after three days of rain, the town officials _______.",
    options: [
      "organized a swimming competition for the residents",
      "decided to ignore the problem until next week",
      "built a new bridge to celebrate the high water levels",
      "planned a festival to welcome the rainy weather",
      "issued a flood warning and asked families near the river to evacuate"
    ],
    answer: "E",
    core: ["조건", "선택"], aux: ["기준", "수용"]
  },
  {
    n: 19, section: "C", type: "mc",
    type_code: "diagnostic_action",
    type_label: "진단·대응 행동의 적절성",
    unit_hint: "학습·업무 상황에서의 문제해결 흐름",
    question: "The teacher noticed that several students were struggling with fractions, so she _______.",
    options: [
      "created additional practice problems and reviewed the concept again",
      "moved on to a more advanced topic the next day",
      "cancelled all math classes for the rest of the week",
      "told the students that fractions were not important",
      "gave everyone a perfect score to avoid complaints"
    ],
    answer: "A",
    core: ["점검", "적용"], aux: ["관점", "까닭"]
  },

  // ================ Section D · Sentence Ordering ================
  {
    n: 20, section: "D", type: "mc",
    type_code: "order_first_given",
    type_label: "첫 문장 고정 — 문단 재구성",
    unit_hint: "글의 흐름 파악 (수능 배열 유형)",
    question: "<strong>The first sentence of a paragraph is given below.</strong> Choose the best order for the remaining three sentences (i, ii, iii) to complete the paragraph.",
    prompt: "<em>First sentence:</em> Long ago, people used to tell time by looking at the position of the sun in the sky.<br>(i) However, sundials did not work on cloudy days or at night, which caused many problems.<br>(ii) To solve this, inventors developed water clocks, sand clocks, and eventually mechanical clocks.<br>(iii) Later, they built sundials, which used the shadow of a stick to show the hour more accurately.",
    options: [
      "(i) → (ii) → (iii)",
      "(i) → (iii) → (ii)",
      "(iii) → (i) → (ii)",
      "(iii) → (ii) → (i)",
      "(ii) → (iii) → (i)"
    ],
    answer: "C",
    core: ["흐름", "연속"], aux: ["배치", "순환"]
  },
  {
    n: 21, section: "D", type: "mc",
    type_code: "order_last_given",
    type_label: "마지막 문장 고정 — 역배열",
    unit_hint: "결론으로부터 역추적하는 배열",
    question: "<strong>The last sentence of a paragraph is given below.</strong> Choose the best order for the three sentences (i, ii, iii) that come before it.",
    prompt: "(i) Within a few weeks, tiny green shoots began to appear above the soil.<br>(ii) Every morning, Daniel watered the garden and removed any weeds he could find.<br>(iii) In early spring, Daniel planted several tomato seeds in the backyard.<br><em>Last sentence:</em> By the end of the summer, the garden was full of bright red tomatoes ready to be picked.",
    options: [
      "(i) → (ii) → (iii)",
      "(iii) → (i) → (ii)",
      "(i) → (iii) → (ii)",
      "(ii) → (iii) → (i)",
      "(iii) → (ii) → (i)"
    ],
    answer: "B",
    core: ["구간", "배치"], aux: ["변환", "계획"]
  },
  {
    n: 22, section: "D", type: "mc",
    type_code: "order_free",
    type_label: "자유 배열 — 완전 재구성",
    unit_hint: "과거-현재-미래 시간축 담화 구성",
    question: "<strong>The sentences below form a paragraph, but they are not in the correct order.</strong> Choose the option that shows the best order for all four sentences.",
    prompt: "(i) As a result, many species that once thrived in the area have begun to disappear.<br>(ii) The wetlands near Lake Moro have been an important habitat for birds and fish for centuries.<br>(iii) However, in recent decades, pollution from nearby factories has severely damaged the water quality.<br>(iv) Conservation groups are now working to clean the water and restore the ecosystem.",
    footnotes: [
      { term: "thrive", mean: "번성하다, 잘 자라다" },
      { term: "habitat", mean: "서식지" },
      { term: "conservation", mean: "(자연) 보호, 보존" },
    ],
    options: [
      "(ii) → (iii) → (i) → (iv)",
      "(iii) → (ii) → (iv) → (i)",
      "(i) → (iv) → (ii) → (iii)",
      "(iv) → (i) → (iii) → (ii)",
      "(ii) → (i) → (iii) → (iv)"
    ],
    answer: "A",
    core: ["흐름", "변환", "배치"], aux: ["연속", "까닭"]
  },

  // ================ Section E · Mood and Tone ================
  {
    n: 23, section: "E", type: "mc",
    type_code: "emotion_id",
    type_label: "인물의 감정 식별",
    unit_hint: "문학적 공감과 감정 어휘",
    question: "How does Tom most likely feel?",
    prompt: `"I can't believe it," whispered Tom, staring at the letter in his hands. He read it once, then twice, then a third time. His name was printed clearly at the top: "Congratulations! You have been selected for the National Science Fair." He had entered his project without much hope, thinking that hundreds of better projects would overshadow his own. Now, standing in the kitchen with the morning sun streaming through the window, he felt as though the entire world had suddenly become brighter.`,
    footnotes: [ { term: "overshadow", mean: "무색하게 만들다, 빛을 잃게 하다" } ],
    options: [
      "Angry and frustrated",
      "Bored and uninterested",
      "Confused and worried",
      "Embarrassed and ashamed",
      "Surprised and joyful"
    ],
    answer: "E",
    core: ["감정", "표현"], aux: ["동기", "분위기", "감각"]
  },
  {
    n: 24, section: "E", type: "mc",
    type_code: "feelings_overall",
    type_label: "상황의 전반적 분위기·감정",
    unit_hint: "분위기·정조(情調)의 이해",
    question: "Which of the following best describes Sara's feelings in this passage?",
    prompt: `Sara stared out the car window as the moving truck pulled away from the house where she had grown up. Every room held a memory — the kitchen where her mother taught her to bake, the backyard where she and her brother built a treehouse, the porch where her grandfather used to sit and tell stories. She pressed her palm against the cold glass. The new city was supposed to be exciting, but right now all she could feel was the weight of everything she was leaving behind.`,
    footnotes: [ { term: "nostalgic", mean: "향수 어린, 옛날을 그리워하는" } ],
    options: [
      "Excited and eager to start a new adventure",
      "Relieved to finally leave her old home",
      "Angry at her family for making her move",
      "Sad and nostalgic about leaving her childhood home",
      "Proud of the house she is leaving behind"
    ],
    answer: "D",
    core: ["공감", "분위기", "감상"], aux: ["감정", "성찰", "감각"]
  },
  {
    n: 25, section: "E", type: "mc",
    type_code: "feeling_change",
    type_label: "감정의 변화 서사",
    unit_hint: "심리 변화의 구조를 포착",
    question: "How do Jake's feelings change over the course of this passage?",
    prompt: `When Jake first arrived at summer camp, he refused to talk to anyone. He sat alone at meals and avoided group activities. But on the third day, a boy named Lucas sat next to him and asked if he wanted to help build a raft. Jake shrugged and said okay. By the end of the week, Jake and Lucas were inseparable. On the last day of camp, Jake hugged Lucas goodbye and said, 'I almost didn't come here. I'm so glad I did.'`,
    footnotes: [ { term: "withdrawn", mean: "내성적인, 고립된" } ],
    options: [
      "From excited to disappointed",
      "From withdrawn to happy and grateful",
      "From confident to nervous",
      "From angry to even more angry",
      "From proud to humble"
    ],
    answer: "B",
    core: ["감정", "성찰"], aux: ["존중", "표현", "수용", "감각"]
  },

  // ================ Section F · Inference ================
  {
    n: 26, section: "F", type: "mc",
    type_code: "inference_support",
    type_label: "근거 기반 추론 (지지 선택)",
    unit_hint: "표현된 정보로부터 타당한 추론만 고르기",
    question: "Which of the following can be most reasonably inferred from the passage?",
    prompt: `Mina has been learning to play the cello for three years. Her younger brother Jun started piano lessons last month. Every Saturday, their grandmother comes over to listen to them practice. She always brings homemade cookies, and she says she enjoys Jun's playing more than she did when Mina first started. Mina's teacher recently told their mother that Mina should begin preparing for a city-wide competition next year.`,
    options: [
      "Jun is a more talented musician than Mina.",
      "The grandmother thinks Mina has become worse at the cello over time.",
      "Mina has likely improved at the cello since she first started learning.",
      "The grandmother's favorite instrument is the piano.",
      "Mina will definitely win the city-wide competition next year."
    ],
    answer: "C",
    core: ["주장", "근거", "질문"], aux: ["까닭", "해석", "짐작"]
  },
  {
    n: 27, section: "F", type: "mc",
    type_code: "inference_negative",
    type_label: "추론 불가(NOT) 유형",
    unit_hint: "과잉 추론·확대 해석 골라내기",
    question: "Which of the following is <strong>NOT</strong> a correct inference from the passage?",
    prompt: `The small bookstore on Maple Street has been owned by the Patel family for over forty years. Last year, a large chain bookstore opened just two blocks away, offering discounts on all bestsellers. Since then, fewer customers have visited the Patel bookstore on weekdays, but the shop has gained many regular visitors who come specifically for the family's personal book recommendations and the quiet reading corner. Mrs. Patel says she has no plans to close the shop.`,
    footnotes: [ { term: "foreseeable future", mean: "당분간, 예측 가능한 가까운 미래" } ],
    options: [
      "The arrival of the chain bookstore has affected the Patel bookstore's weekday business.",
      "The Patel family should lower their prices to compete with the chain bookstore.",
      "Some customers value personal service over lower prices.",
      "The Patel bookstore offers something that the chain bookstore does not.",
      "Mrs. Patel intends to continue running the bookstore for the foreseeable future."
    ],
    answer: "B",
    core: ["주장", "근거", "질문"], aux: ["비교", "의미", "짐작"]
  },
  {
    n: 28, section: "F", type: "mc",
    type_code: "inference_reason",
    type_label: "원인·동기 추론",
    unit_hint: "성과의 배경 요인 추론",
    question: "Which of the following can be most reasonably inferred from the passage?",
    prompt: `When Daniel moved to a new school in September, he joined the school's robotics club on the first day. By November, he was chosen as one of three students to represent the club at a regional competition. Some of the older club members, who had been in the club for two years, were not selected. Daniel's robotics teacher told his parents that Daniel spends most of his free time at the club's workshop, often staying late after other students have gone home. At the competition, Daniel's team won second place.`,
    options: [
      "Daniel is naturally more talented at robotics than the older club members.",
      "Daniel was selected for the competition because of the effort he put into the club.",
      "The robotics teacher dislikes the older club members.",
      "Daniel has decided that robotics will be his future career.",
      "Students who have been in the club longer are usually better at robotics."
    ],
    answer: "B",
    core: ["근거", "해석", "질문"], aux: ["비유", "분위기", "짐작"]
  },

  // ================ Section G · Short Writing ================
  {
    n: 29, section: "G", type: "writing",
    type_code: "writing_comparison",
    type_label: "비교·대조 서술형",
    unit_hint: "기준 일관성과 대응 관계를 지키며 서술",
    question: "Compare a frog and a dog. Write down five similarities and five differences between them. Use complete sentences.",
    fields: [
      { key: "similarities", label: "Five Similarities" },
      { key: "differences",  label: "Five Differences" }
    ],
    core: ["비교", "대응", "관점"], aux: ["기준", "표현"]
  },
  {
    n: 30, section: "G", type: "writing",
    type_code: "writing_definition",
    type_label: "정의·예시 기반 서술형",
    unit_hint: "추상 개념을 자기 말로 정의 + 구체적 예시",
    question: `Have you ever heard the word "concept"? What do you think the word "concept" means? Write 3 to 5 sentences explaining your own understanding of this word. Give at least one example to support your explanation.`,
    fields: [
      { key: "answer", label: "Your answer (3–5 sentences, with at least one example)" }
    ],
    core: ["정의", "의미", "비유"], aux: ["주장", "표현"]
  }
];
