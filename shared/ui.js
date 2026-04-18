/**
 * MSAT · shared/ui.js
 * -------------------------------------------------------------------
 * 모든 UI 렌더러를 하나의 ES Module로 통합.
 *
 * 외부 사용법:
 *   import { createApp } from "../shared/ui.js";
 *   createApp({
 *     subject: "english",
 *     QUESTIONS, PASSAGES, SECTIONS, PAGES, SUBJECT_META,
 *     coverTitle: "English",
 *   });
 *
 * 내부 구성:
 *   - 유틸(el, $, escapeHtml, miniMarkdown)
 *   - Cover (이름/학교/학년 입력)
 *   - Test (페이지별 문제 렌더링, 지문, 차트, 서술형)
 *   - Result (점수 요약, 뇌 영역 카드, 레이다차트, 단어 그리드)
 *   - Report (AI 리포트 렌더링, 에러 핸들링)
 *   - PDF (html2pdf 래퍼)
 * -------------------------------------------------------------------
 */

import {
  REGIONS, REGION_KEYS, WORDS,
  GRADE_CUTS, gradeOf,
  WRITING_POINTS_EACH,
  WORKER_URL,
  makeStudentId,
  loadSession, saveSession,
  saveSubjectResult,
} from "./data.js";

import { computeResult, computeMaxScores } from "./scoring.js";

// ============================================================
// DOM 헬퍼
// ============================================================
const $ = sel => document.querySelector(sel);
const $$ = sel => Array.from(document.querySelectorAll(sel));

function el(tag, attrs = {}, ...children) {
  const e = document.createElement(tag);
  Object.entries(attrs).forEach(([k, v]) => {
    if (v === null || v === undefined) return;
    if (k === "class") e.className = v;
    else if (k === "html") e.innerHTML = v;
    else if (k.startsWith("on")) e.addEventListener(k.slice(2).toLowerCase(), v);
    else e.setAttribute(k, v);
  });
  children.flat().forEach(c => {
    if (c == null) return;
    if (typeof c === "string") e.appendChild(document.createTextNode(c));
    else e.appendChild(c);
  });
  return e;
}

function showView(id) {
  $$(".view").forEach(v => v.classList.remove("active"));
  const v = document.getElementById(id);
  v.classList.add("active");
  window.scrollTo({ top: 0, behavior: "instant" });
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
}

// ============================================================
// App factory
// ============================================================

/**
 * 과목별 앱 인스턴스를 초기화. english/index.html 같은 엔트리에서 호출.
 *
 * @param {Object} config
 * @param {string} config.subject           - "english" | "korean" | "math"
 * @param {Array}  config.QUESTIONS
 * @param {Array}  config.SECTIONS
 * @param {Array}  config.PAGES
 * @param {Object} [config.PASSAGES]        - { 1: passageObj, 2: passageObj } — Section A가 있는 과목만
 * @param {Object} config.SUBJECT_META      - { id, kr, en, timeMinutes }
 * @param {string} config.coverTitle        - 커버 페이지에 크게 표시될 과목명 (e.g. "English")
 */
export function createApp(config) {
  const {
    subject, QUESTIONS, SECTIONS, PAGES,
    PASSAGES = {},
    SUBJECT_META,
    coverTitle,
  } = config;

  // 앱 전역 상태
  const state = {
    subject,
    studentName: "",
    school: "",
    grade: "",
    dob: "",
    studentId: null,
    currentPage: 0,
    answers: {},
    submitted: false,
    writingPending: false,
    writingGrades: null,
    result: null,
  };

  // 채점 만점 (한 번 계산해서 재사용)
  const MAX = computeMaxScores(QUESTIONS);

  // Helper: question lookup
  const getQ = n => QUESTIONS.find(q => q.n === n);
  const getSection = id => SECTIONS.find(s => s.id === id);

  // ==========================================================
  // Cover (intro) — 학생 정보는 루트 랜딩에서 이미 입력됨.
  // sessionStorage에서 꺼내 쓰고, 없으면 루트로 돌려보냄.
  // ==========================================================
  function renderCover() {
    const root = $("#view-intro");
    root.innerHTML = "";

    // 세션에서 학생 정보 불러오기
    const session = loadSession();
    if (!session || !session.studentName) {
      // 랜딩을 거치지 않고 직접 과목 페이지에 온 경우
      root.append(
        el("div", { class: "intro cover" },
          el("div", { class: "cover-top" },
            el("div", { class: "cover-eyebrow" }, "Middle school Scholastic Ability Test"),
            el("div", { class: "cover-brackets" }, "[ MSAT ]"),
            el("h1", { class: "cover-title" }, coverTitle),
            el("div", { class: "cover-korean" }, `중학수학능력진단 — ${SUBJECT_META.kr}`),
            el("div", { class: "cover-rule" }),
            el("div", { class: "cover-meta" }, "학생 정보 입력이 필요합니다")
          ),
          el("div", { class: "cover-bottom" },
            el("a", { href: "../", class: "btn btn-primary" },
              el("span", {}, "시작 페이지로 이동"),
              el("span", { class: "arrow" }, "→")
            )
          )
        )
      );
      return;
    }

    // 세션 정보를 앱 상태에 주입
    state.studentName = session.studentName || "";
    state.school = session.school || "";
    state.grade = session.grade || "";
    state.dob = session.dob || "";
    state.studentId = session.studentId || null;

    const timeText = `${QUESTIONS.length} Questions  •  Total Time: ${SUBJECT_META.timeMinutes} minutes`;

    const wrap = el("div", { class: "intro cover" });
    wrap.append(
      el("div", { class: "cover-top" },
        el("div", { class: "cover-eyebrow" }, "Middle school Scholastic Ability Test"),
        el("div", { class: "cover-brackets" }, "[ MSAT ]"),
        el("h1", { class: "cover-title" }, coverTitle),
        el("div", { class: "cover-korean" }, `중학수학능력진단 — ${SUBJECT_META.kr}`),
        el("div", { class: "cover-rule" }),
        el("div", { class: "cover-meta" }, timeText)
      ),

      // 학생 정보 요약 (재확인용)
      el("div", { class: "cover-student-card" },
        el("div", { class: "cover-student-row" },
          el("span", { class: "cover-student-k" }, "이름"),
          el("span", { class: "cover-student-v" }, state.studentName)
        ),
        (state.school ? el("div", { class: "cover-student-row" },
          el("span", { class: "cover-student-k" }, "학교"),
          el("span", { class: "cover-student-v" }, state.school)
        ) : null),
        (state.grade ? el("div", { class: "cover-student-row" },
          el("span", { class: "cover-student-k" }, "학년"),
          el("span", { class: "cover-student-v" }, state.grade)
        ) : null)
      ),

      el("div", { class: "cover-bottom", style: "display:flex; gap:10px; justify-content:center; flex-wrap:wrap;" },
        el("a", { href: "../", class: "btn btn-ghost" }, "← 뒤로"),
        el("button", { class: "btn btn-primary", id: "start-btn" },
          el("span", {}, "Start"),
          el("span", { class: "arrow" }, "→")
        )
      )
    );

    root.append(wrap);

    const startBtn = $("#start-btn");
    startBtn.addEventListener("click", () => {
      renderTest();
      showView("view-test");
    });
  }

  // ==========================================================
  // Passage (Section A용)
  // ==========================================================
  function renderPassage(ref) {
    const p = PASSAGES[ref];
    if (!p) return document.createTextNode("");
    const box = el("div", { class: "passage" });
    p.paragraphs.forEach(para => box.append(el("p", { html: para })));
    if (p.footnotes && p.footnotes.length) {
      const fn = el("div", { class: "footnote" });
      p.footnotes.forEach(f => {
        fn.append(el("div", { html: `<span>${f.term}</span> — ${f.mean}` }));
      });
      box.append(fn);
    }
    return box;
  }

  // ==========================================================
  // Chart (Section B Q12용 간단한 막대그래프)
  // ==========================================================
  function renderChart(data, title) {
    const wrap = el("div", { class: "passage" });
    wrap.append(el("div", {
      style: "font-family:var(--mono); font-size:.72rem; color:var(--ink-3); letter-spacing:.14em; text-transform:uppercase; margin-bottom:6px;"
    }, title));
    const chartBox = el("div", { class: "passage-chart" });
    const maxV = Math.max(...data.map(d => d.v));
    data.forEach(d => {
      const bar = el("div", { class: "bar", "data-val": d.v, style: `height: ${(d.v/maxV)*85}%;` });
      chartBox.append(
        el("div", { class: "bar-group" },
          el("div", { style: "flex:1; display:flex; align-items:flex-end; width:100%; justify-content:center;" }, bar),
          el("div", { class: "bar-label" }, d.label)
        )
      );
    });
    wrap.append(chartBox);
    return wrap;
  }

  // ==========================================================
  // Question
  // ==========================================================
  function renderQuestion(q) {
    const qEl = el("div", { class: "question", id: `q-${q.n}` });
    const head = el("div", { class: "question-head" },
      el("div", { class: "question-num" }, `${q.n}.`),
      el("div", { class: "question-text", html: q.question })
    );
    qEl.append(head);

    if (q.chart) {
      qEl.append(renderChart(q.chart.data, q.chart.title));
    }

    if (q.prompt) {
      const qt = el("div", { class: "question-sub quote", html: q.prompt });
      if (q.footnotes && q.footnotes.length) {
        const fn = el("div", { class: "footnote" });
        q.footnotes.forEach(f => fn.append(el("div", { html: `<span>${f.term}</span> — ${f.mean}` })));
        qt.append(fn);
      }
      qEl.append(qt);
    }

    if (q.type === "mc") {
      const opts = el("div", { class: "options" });
      const letters = ["A", "B", "C", "D", "E"];
      q.options.forEach((opt, i) => {
        const letter = letters[i];
        const lbl = el("label", { class: "option", "data-q": q.n, "data-val": letter });
        lbl.append(
          el("input", { type: "radio", name: `q${q.n}`, value: letter }),
          el("span", { class: "letter" }, `(${letter})`),
          el("span", { class: "text", html: opt })
        );
        lbl.addEventListener("click", () => selectOption(q.n, letter, lbl));
        opts.append(lbl);
      });
      qEl.append(opts);
    } else if (q.type === "writing") {
      const wbox = el("div", { class: "writing-box" });
      q.fields.forEach(f => {
        wbox.append(el("div", { class: "writing-label" }, f.label));
        const ta = el("textarea", {
          class: "writing-textarea",
          "data-q": q.n,
          "data-key": f.key,
          placeholder: "Write your answer in English...",
        });
        ta.addEventListener("input", () => {
          if (!state.answers[q.n]) state.answers[q.n] = {};
          state.answers[q.n][f.key] = ta.value;
          updateProgress();
        });
        wbox.append(ta);
      });
      qEl.append(wbox);
    }
    return qEl;
  }

  function selectOption(qn, letter, labelEl) {
    state.answers[qn] = letter;
    const container = labelEl.parentElement;
    container.querySelectorAll(".option").forEach(o => o.classList.remove("selected"));
    labelEl.classList.add("selected");
    updateProgress();
  }

  function answeredCount() {
    let count = 0;
    QUESTIONS.forEach(q => {
      const ans = state.answers[q.n];
      if (q.type === "mc") { if (ans) count++; }
      else if (q.type === "writing") {
        if (ans && Object.values(ans).some(v => v && v.trim().length > 0)) count++;
      }
    });
    return count;
  }

  function updateProgress() {
    const n = answeredCount();
    const total = QUESTIONS.length;
    const pct = (n/total) * 100;
    const fill = $("#progress-fill");
    const text = $("#progress-text");
    if (fill) fill.style.width = `${pct}%`;
    if (text) text.textContent = `${n}/${total}`;

    if (typeof state.currentPage === "number" && $("#nav-bar")) {
      renderNav(state.currentPage);
    }
  }

  // ==========================================================
  // Test view (paged)
  // ==========================================================
  function renderTest() {
    const root = $("#view-test");
    root.innerHTML = "";

    const header = el("div", { class: "test-header" },
      el("div", { class: "test-header-inner" },
        el("div", { class: "test-logo", html: `MSAT <em>${coverTitle}</em>` }),
        el("div", { class: "progress-wrap" },
          el("div", { class: "progress-track" },
            el("div", { class: "progress-fill", id: "progress-fill" })
          )
        ),
        el("div", { class: "progress-text", id: "progress-text" }, `0/${QUESTIONS.length}`)
      )
    );
    root.append(header);

    const body = el("div", { class: "test-body", id: "test-body" });
    root.append(body);

    const nav = el("div", { class: "submit-bar", id: "nav-bar" });
    root.append(nav);

    state.currentPage = 0;
    renderPage(0);
    updateProgress();
  }

  function renderPage(pageIdx) {
    state.currentPage = pageIdx;
    const page = PAGES[pageIdx];
    const body = $("#test-body");
    body.innerHTML = "";

    const sec = getSection(page.sectionId);
    const sectionHeading = el("div", { class: "page-heading" },
      el("div", { class: "page-eyebrow" },
        el("span", { class: "page-dot" }),
        el("span", {}, `Page ${pageIdx + 1} of ${PAGES.length}`)
      ),
      el("h2", { class: "page-title" }, page.title),
      page.subtitle ? el("div", { class: "page-subtitle" }, page.subtitle) : null,
      el("p", { class: "page-desc" }, sec ? sec.desc : "")
    );
    body.append(sectionHeading);

    // Passage for Section A
    if (page.key === "A1") body.append(renderPassage(1));
    if (page.key === "A2") body.append(renderPassage(2));

    page.questionNums.forEach(n => {
      const q = getQ(n);
      if (q) {
        body.append(renderQuestion(q));
        // Restore previously selected answer (if student went back/forward)
        restoreAnswer(q);
      }
    });

    renderNav(pageIdx);
    window.scrollTo({ top: 0, behavior: "instant" });
  }

  function restoreAnswer(q) {
    const prev = state.answers[q.n];
    if (prev == null) return;
    if (q.type === "mc") {
      const lbl = document.querySelector(`.option[data-q='${q.n}'][data-val='${prev}']`);
      if (lbl) {
        lbl.classList.add("selected");
        const input = lbl.querySelector("input");
        if (input) input.checked = true;
      }
    } else if (q.type === "writing" && typeof prev === "object") {
      q.fields.forEach(f => {
        const ta = document.querySelector(`textarea[data-q='${q.n}'][data-key='${f.key}']`);
        if (ta && prev[f.key] != null) ta.value = prev[f.key];
      });
    }
  }

  function renderNav(pageIdx) {
    const nav = $("#nav-bar");
    nav.innerHTML = "";
    const inner = el("div", { class: "submit-bar-inner" });

    const page = PAGES[pageIdx];
    const pageAnswered = page.questionNums.filter(n => {
      const q = getQ(n);
      const ans = state.answers[n];
      if (!q) return false;
      if (q.type === "mc") return !!ans;
      if (q.type === "writing") return ans && Object.values(ans).some(v => v && v.trim().length > 0);
      return false;
    }).length;

    inner.append(
      el("div", { class: "submit-status" },
        `Page ${pageIdx + 1}/${PAGES.length}  ·  `,
        el("strong", {}, `${pageAnswered}/${page.questionNums.length}`),
        " answered"
      )
    );

    const btnGroup = el("div", { style: "display:flex; gap:10px; align-items:center; flex-wrap:wrap;" });

    if (pageIdx > 0) {
      btnGroup.append(
        el("button", { class: "btn btn-ghost", onclick: () => renderPage(pageIdx - 1) }, "← Previous")
      );
    }

    if (pageIdx < PAGES.length - 1) {
      btnGroup.append(
        el("button", { class: "btn btn-primary", onclick: () => renderPage(pageIdx + 1) },
          el("span", {}, "Next"),
          el("span", { class: "arrow" }, "→")
        )
      );
    } else {
      const submitBtn = el("button", {
        class: "btn btn-primary",
        id: "submit-btn",
        disabled: answeredCount() === 0 ? "true" : null
      },
        el("span", {}, "Submit · View Report"),
        el("span", { class: "arrow" }, "→")
      );
      submitBtn.addEventListener("click", handleSubmit);
      btnGroup.append(submitBtn);
    }

    inner.append(btnGroup);
    nav.append(inner);
  }

  // ==========================================================
  // Submit & Results
  // ==========================================================
  async function handleSubmit() {
    if (state.submitted) return;
    state.submitted = true;

    // Preliminary (MC only, writing pending)
    state.writingPending = true;
    state.result = computeResult({
      questions: QUESTIONS,
      answers: state.answers,
      writingScores: null,
      max: MAX,
    });

    renderResult();
    showView("view-result");

    // Kick off AI grading + report
    fetchAIReport();
  }

  function renderResult() {
    const r = state.result;
    const root = $("#view-result");
    root.innerHTML = "";

    const body = el("div", { class: "result-body" });

    body.append(
      el("div", { class: "result-header" },
        el("div", { class: "mark" }, `MSAT ${SUBJECT_META.en} · Score Report`),
        el("h1", { html: `<em>${escapeHtml(state.studentName)}</em> 학생의 ${SUBJECT_META.kr} 성적표` }),
        el("div", { class: "student" }, new Date().toLocaleDateString("ko-KR", { year: 'numeric', month: 'long', day: 'numeric' }))
      )
    );

    const summary = el("div", { class: "score-summary", id: "score-summary" });
    body.append(summary);
    renderScoreSummary(summary);

    // === Section 1: 섹션별 상세 진단 ===
    const sectionDetailBlock = el("div", { class: "brain-section" },
      el("div", { class: "section-heading" },
        el("span", { class: "num" }, "01"),
        el("h2", {}, "섹션별 상세 진단"),
        el("span", { class: "sub" }, "Section-by-Section"),
        el("div", { class: "line" })
      ),
      el("div", { class: "section-detail-grid", id: "section-detail-grid" })
    );
    body.append(sectionDetailBlock);
    renderSectionDetail($("#section-detail-grid"));

    // === Section 2: 문항별 결과표 ===
    const perQBlock = el("div", { class: "brain-section" },
      el("div", { class: "section-heading" },
        el("span", { class: "num" }, "02"),
        el("h2", {}, "문항별 결과"),
        el("span", { class: "sub" }, "Answer Sheet"),
        el("div", { class: "line" })
      ),
      el("div", { id: "per-question-table" })
    );
    body.append(perQBlock);
    renderPerQuestionTable($("#per-question-table"));

    // === Section 3: AI 리포트 ===
    const reportSection = el("div", { class: "brain-section" },
      el("div", { class: "section-heading" },
        el("span", { class: "num" }, "03"),
        el("h2", {}, `AI ${SUBJECT_META.kr} 리포트`),
        el("span", { class: "sub" }, "Personalized Feedback"),
        el("div", { class: "line" })
      ),
      el("div", { class: "ai-report", id: "ai-report" },
        el("div", { class: "ai-loading", id: "ai-loading" },
          el("div", { class: "pulse" }),
          el("div", { class: "msg" }, "AI가 성적을 분석하고 리포트를 작성하고 있습니다..."),
          el("div", { class: "hint" }, "Analyzing · 10–20 seconds")
        )
      )
    );
    body.append(reportSection);

    body.append(
      el("div", { class: "report-actions" },
        el("a", { href: "../", class: "btn btn-ghost" }, "← 과목 선택으로"),
        el("button", { class: "btn btn-ghost", onclick: generatePDF }, "📄  PDF 저장"),
        el("button", { class: "btn btn-ghost", onclick: () => location.reload() }, "↻  다시 풀기")
      )
    );

    root.append(body);
  }

  function renderScoreSummary(container) {
    const r = state.result;
    const pending = state.writingPending;
    container.innerHTML = "";

    const totalCell = el("div", { class: "score-cell" },
      el("div", { class: "label" }, "총점"),
      el("div", {},
        el("span", { class: "val" }, pending ? "—" : String(r.totalPoints)),
        el("span", { class: "unit" }, " / 100")
      ),
      pending
        ? el("div", { class: "cell-note" }, "서술형 채점 중...")
        : el("div", { class: "cell-note" }, "100점 만점")
    );

    // 등급 — 가장 크게 표시
    const gradeCell = el("div", { class: "score-cell score-cell--grade" },
      el("div", { class: "label" }, "등급"),
      el("div", {
        class: "grade-badge",
        style: pending ? "" : `color: ${r.grade.color}; border-color: ${r.grade.color};`
      }, pending ? "—" : r.grade.label),
      el("div", { class: "cell-note" }, pending ? "채점 대기" : r.grade.desc)
    );

    const mcCell = el("div", { class: "score-cell" },
      el("div", { class: "label" }, "객관식"),
      el("div", {},
        el("span", { class: "val" }, `${r.mcCorrect}`),
        el("span", { class: "unit" }, ` / ${r.mcTotal}`)
      ),
      el("div", { class: "cell-note" }, `${r.mcPoints} / ${r.mcPointsMax} pts`)
    );

    const writingCell = el("div", { class: "score-cell" },
      el("div", { class: "label" }, "서술형"),
      el("div", {},
        el("span", { class: "val" }, pending ? "—" : String(r.writingPoints)),
        el("span", { class: "unit" }, ` / ${r.writingPointsMax}`)
      ),
      el("div", { class: "cell-note" }, pending ? "AI 채점 대기" : "AI 채점 완료")
    );

    container.append(totalCell, gradeCell, mcCell, writingCell);
  }

  // 섹션별 상세 진단 — 과목별 리포트의 메인 콘텐츠
  function renderSectionDetail(container) {
    const r = state.result;
    container.innerHTML = "";

    // 섹션 메타 매핑
    const sectionMeta = {};
    SECTIONS.forEach(s => { sectionMeta[s.id] = s; });

    Object.values(r.perSection).forEach(s => {
      const meta = sectionMeta[s.section];
      const enName = meta?.en || s.section;

      // 레벨 (bar 시각화용)
      const pct = s.pct;
      let levelClass = "";
      if (pct >= 85) levelClass = "level-high";
      else if (pct >= 60) levelClass = "level-mid";
      else levelClass = "level-low";

      const card = el("div", { class: `section-detail-card ${levelClass}` },
        el("div", { class: "section-detail-head" },
          el("div", { class: "section-detail-id" }, `Section ${s.section}`),
          el("div", { class: "section-detail-pct" }, `${pct}%`)
        ),
        el("div", { class: "section-detail-name" }, enName),
        el("div", { class: "section-detail-bar" },
          el("div", { class: "section-detail-bar-fill", style: `width: ${pct}%;` })
        ),
        el("div", { class: "section-detail-stats" },
          el("span", {}, `정답 ${s.correctQ}/${s.totalQ}`),
          el("span", {}, " · "),
          el("span", {}, `${s.pointsEarned}/${s.pointsMax}점`)
        )
      );
      container.append(card);
    });
  }

  // 문항별 결과표
  function renderPerQuestionTable(container) {
    const r = state.result;
    container.innerHTML = "";

    const table = el("div", { class: "per-q-table" });

    // 섹션별 그룹핑
    const sections = {};
    Object.values(r.perQuestion).forEach(q => {
      if (!sections[q.section]) sections[q.section] = [];
      sections[q.section].push(q);
    });

    Object.keys(sections).sort().forEach(secId => {
      const secRow = el("div", { class: "per-q-section" },
        el("div", { class: "per-q-section-label" }, `Section ${secId}`),
        el("div", { class: "per-q-items" })
      );
      const itemsBox = secRow.querySelector(".per-q-items");

      sections[secId].forEach(q => {
        let status = "skip";   // 미응답
        let display = "-";
        let title = `Q${q.n}`;

        if (q.type === "mc") {
          if (q.userAnswer == null) { status = "skip"; display = "—"; }
          else if (q.correct) { status = "correct"; display = "✓"; }
          else { status = "wrong"; display = "✗"; }
          title += ` · ${q.type_label || ''} · 정답 ${q.correctAnswer}`;
          if (q.userAnswer) title += ` · 학생답 ${q.userAnswer}`;
        } else if (q.type === "writing") {
          const sc = q.score || 0;
          if (state.writingPending) { status = "pending"; display = "…"; }
          else if (sc >= 4) { status = "correct"; display = `${sc}/5`; }
          else if (sc >= 2) { status = "partial"; display = `${sc}/5`; }
          else { status = "wrong"; display = `${sc}/5`; }
          title += ` · ${q.type_label || ''} · 서술형 ${sc}/5점`;
        }

        itemsBox.append(
          el("div", { class: `per-q-cell per-q-${status}`, title },
            el("div", { class: "per-q-n" }, `Q${q.n}`),
            el("div", { class: "per-q-mark" }, display)
          )
        );
      });

      table.append(secRow);
    });

    container.append(table);
  }

  function renderRegionCards(container) {
    const r = state.result;
    container.innerHTML = "";

    const sortedKeys = Object.entries(r.regionHybrid)
      .sort((a, b) => b[1] - a[1])
      .map(([k]) => k);

    sortedKeys.forEach((k, idx) => {
      const reg = REGIONS[k];
      const pct = r.regionPct[k];
      const z = r.regionRel[k];

      let badge = "";
      if (idx === 0)      badge = "★ Top";
      else if (idx === 1) badge = "#2";
      else if (idx === 3) badge = "#4";
      else if (idx === 4) badge = "Lowest";

      let relLabel = "";
      if (z > 0.8)        relLabel = "↑ Above profile avg";
      else if (z < -0.8)  relLabel = "↓ Below profile avg";
      else                relLabel = "≈ Near profile avg";

      const card = el("div", { class: "region-card", style: `--region-color: ${reg.color};` },
        el("div", { class: "top" },
          el("div", { class: "name", html: `${reg.kr} <span class="en">${reg.en}</span>` }),
          el("div", { class: "pct" }, `${pct}%`)
        ),
        el("div", { class: "region-bar-track" },
          el("div", { class: "region-bar-fill", style: `--region-color: ${reg.color}; width: ${pct}%;` })
        ),
        el("div", { class: "region-meta" },
          badge ? el("span", { class: "region-badge" }, badge) : null,
          el("span", { class: "region-rel" }, relLabel)
        ),
        el("div", { class: "area" }, reg.desc)
      );
      container.append(card);
    });
  }

  function renderBalanceNote(container) {
    const r = state.result;
    container.innerHTML = "";
    if (r.isBalanced) {
      container.append(
        el("div", { class: "balance-msg" },
          "5개 영역의 편차가 작아 프로필이 전반적으로 균형적입니다. 아래에서는 이 학생의 상대적 경향만 참고로 제시합니다."
        )
      );
    }
  }

  function renderWordsGrid(container) {
    const r = state.result;
    container.innerHTML = "";

    container.style.display = "flex";
    container.style.flexDirection = "column";
    container.style.gap = "32px";

    // 사용된 단어만 (영어 과목에서는 50개, 수학·국어도 합쳐 100개 이하)
    const usedWords = Object.keys(WORDS).filter(w => MAX.maxWord[w] > 0);
    const sortedByIntensity = usedWords.sort((a, b) => r.wordIntensity[b] - r.wordIntensity[a]);
    const top10 = sortedByIntensity.slice(0, 10);
    const bottom10 = sortedByIntensity.slice(-10);

    function sortAndRender(wordsArr, titleText) {
      const group = el("div", { class: "words-group", style: "page-break-inside: avoid;" });
      const title = el("div", {
        style: "font-family:var(--sans); font-size:.95rem; font-weight:600; color:var(--ink-2); margin-bottom:14px; letter-spacing:0.04em;"
      }, titleText);
      const grid = el("div", {
        style: "display:grid; grid-template-columns:repeat(auto-fill, minmax(180px, 1fr)); gap:10px;"
      });

      const displayWords = Array.from(new Set(wordsArr));
      displayWords.sort((a, b) => {
        const ra = WORDS[a], rb = WORDS[b];
        if (ra !== rb) return REGION_KEYS.indexOf(ra) - REGION_KEYS.indexOf(rb);
        return r.wordIntensity[b] - r.wordIntensity[a];
      });

      displayWords.forEach(w => {
        const regKey = WORDS[w];
        const reg = REGIONS[regKey];
        const intensity = r.wordIntensity[w];
        const bgAlpha = intensity * 0.22 + (intensity > 0 ? 0.04 : 0);
        const chip = el("div", {
          class: "word-chip",
          style: `--region-color: ${reg.hex}; --intensity: ${bgAlpha};`,
        },
          el("span", { style: "display:inline-flex; align-items:center; gap:8px;" },
            el("span", { class: "dot", style: `background:${reg.hex};` }),
            el("span", { class: "word" }, w)
          ),
          el("span", { class: "val" }, `${Math.round(intensity * 100)}%`)
        );
        grid.append(chip);
      });
      group.append(title, grid);
      return group;
    }

    container.append(sortAndRender(top10, "강한 사고력 10"));
    container.append(sortAndRender(bottom10, "약한 사고력 10"));
  }

  function drawRadar(r) {
    const canvas = document.getElementById("radar-chart");
    if (!canvas) return;
    const keys = REGION_KEYS;
    const labels = keys.map(k => REGIONS[k].area);
    const data = keys.map(k => r.regionPct[k]);

    if (window._radarChart) window._radarChart.destroy();
    if (typeof Chart === "undefined") {
      console.warn("Chart.js not loaded; radar skipped");
      return;
    }

    window._radarChart = new Chart(canvas, {
      type: "radar",
      data: {
        labels,
        datasets: [{
          label: "활성도",
          data,
          backgroundColor: "rgba(139, 42, 31, 0.12)",
          borderColor: "rgba(139, 42, 31, 0.85)",
          borderWidth: 2,
          pointBackgroundColor: keys.map(k => REGIONS[k].hex),
          pointBorderColor: "#fff",
          pointBorderWidth: 2,
          pointRadius: 5,
          pointHoverRadius: 7,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: "rgba(26, 22, 18, 0.92)",
            titleFont: { family: "'Fraunces', serif", size: 13 },
            bodyFont: { family: "'JetBrains Mono', monospace", size: 12 },
            padding: 10,
            callbacks: { label: (ctx) => `활성도 ${ctx.raw}%` }
          }
        },
        scales: {
          r: {
            min: 0, max: 100,
            ticks: {
              stepSize: 25,
              font: { family: "'JetBrains Mono', monospace", size: 10 },
              color: "#9a8d80",
              backdropColor: "transparent"
            },
            grid: { color: "rgba(107, 93, 82, 0.2)" },
            angleLines: { color: "rgba(107, 93, 82, 0.25)" },
            pointLabels: {
              font: { family: "'Fraunces', serif", size: 13, weight: "500" },
              color: "#3d342c"
            }
          }
        },
        animation: { duration: 900, easing: "easeOutCubic" }
      }
    });
  }

  // ==========================================================
  // AI Report (Worker call)
  // ==========================================================
  async function fetchAIReport() {
    const r = state.result;

    // Writing submissions
    const writingQs = QUESTIONS.filter(q => q.type === "writing");
    const writingSubmissions = writingQs.map(q => ({
      n: q.n,
      question: q.question,
      type_code: q.type_code,
      type_label: q.type_label,
      fields: Object.fromEntries(
        (q.fields || []).map(f => [
          f.key,
          (state.answers[q.n]?.[f.key] || "").slice(0, 1500)
        ])
      ),
      maxScore: WRITING_POINTS_EACH,
    }));

    // Per-question summary (AI가 유형별 해설에 쓸 근거)
    const perQuestionBrief = Object.values(r.perQuestion).map(pq => ({
      n: pq.n,
      section: pq.section,
      type_code: pq.type_code,
      type_label: pq.type_label,
      correct: pq.type === "mc" ? pq.correct : (pq.score >= 3),
      userAnswer: pq.type === "mc" ? pq.userAnswer : null,
      correctAnswer: pq.type === "mc" ? pq.correctAnswer : null,
      score: pq.type === "writing" ? pq.score : null,
    }));

    // Section summary
    const sectionSummary = Object.values(r.perSection).map(s => ({
      section: s.section,
      totalQ: s.totalQ,
      correctQ: s.correctQ,
      pointsEarned: s.pointsEarned,
      pointsMax: s.pointsMax,
      pct: s.pct,
    }));

    // Region snapshot (preliminary — writing 아직 미반영)
    const regionSummary = REGION_KEYS.map(k => ({
      key: k,
      area: REGIONS[k].area,
      kr: REGIONS[k].kr,
      absolute: Math.round(r.regionAbs[k] * 10) / 10,
      relativeZ: Math.round(r.regionRel[k] * 100) / 100,
    }));

    const payload = {
      type: "subject",
      subject: SUBJECT_META.id,

      student: {
        name: state.studentName,
        school: state.school || "",
        grade: state.grade || "",
        studentId: state.studentId,
      },
      subjectMeta: { id: SUBJECT_META.id, kr: SUBJECT_META.kr, en: SUBJECT_META.en },

      // Preliminary scores (writing not yet graded)
      preliminary: {
        mcCorrect: r.mcCorrect, mcTotal: r.mcTotal,
        mcPoints: r.mcPoints, mcPointsMax: r.mcPointsMax,
      },

      regions: regionSummary,
      regionMean: Math.round(r.regionMean * 10) / 10,
      regionStdev: Math.round(r.regionStdev * 10) / 10,
      isBalanced: r.isBalanced,

      sectionSummary,
      perQuestionBrief,
      writingSubmissions,
    };

    try {
      // Worker endpoint: /?type=subject&subject=english
      const url = `${WORKER_URL}?type=subject&subject=${SUBJECT_META.id}`;
      const resp = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!resp.ok) {
        const errText = await resp.text().catch(() => "");
        throw new Error(`Worker returned ${resp.status}${errText ? ": " + errText.slice(0, 200) : ""}`);
      }

      const data = await resp.json();
      const reportMarkdown = data.report || "";
      const writingGrades = data.writingGrades || {};

      if (!reportMarkdown.trim()) {
        throw new Error("Empty report from Worker");
      }

      // Re-compute with writing scores
      const writingScores = {};
      Object.keys(writingGrades).forEach(k => {
        const g = writingGrades[k];
        if (g && typeof g.score === "number") writingScores[Number(k)] = g.score;
      });
      state.writingGrades = writingGrades;
      state.writingPending = false;
      state.result = computeResult({
        questions: QUESTIONS,
        answers: state.answers,
        writingScores,
        max: MAX,
      });

      // 결과를 localStorage에 저장 — 나중에 brain-report가 꺼내 쓸 용도
      try {
        saveSubjectResult(state.studentId, SUBJECT_META.id, {
          studentName: state.studentName,
          school: state.school,
          grade: state.grade,
          // 사고력(brain) 리포트 생성에 필요한 최소 스냅샷
          totalPoints: state.result.totalPoints,
          grade_label: state.result.grade.label,
          regionAbs: state.result.regionAbs,
          regionPct: state.result.regionPct,
          wordIntensity: state.result.wordIntensity,
          perSection: state.result.perSection,
        });
      } catch (e) {
        console.warn("Failed to save subject result:", e);
      }

      // Re-render result top (score summary, regions, words, radar)
      renderResult();

      // Render AI report
      renderAIReport(reportMarkdown, data.model);
    } catch (err) {
      console.error("AI report error:", err);
      renderAIError(err);
    }
  }

  function renderAIError(err) {
    let container = $("#ai-report");
    if (!container) container = $(".result-body") || $("#view-result");
    container.innerHTML = "";
    container.append(
      el("div", { class: "ai-error" },
        el("div", { style: "font-size:1.1rem; margin-bottom:8px;" }, "AI 리포트 생성에 실패했습니다"),
        el("div", { style: "font-family:var(--mono); font-size:.78rem; color:var(--ink-4);" }, String(err?.message || err)),
        el("div", { style: "margin-top:16px;" },
          el("button", {
            class: "btn btn-ghost",
            onclick: () => {
              const c = $("#ai-report");
              if (c) c.innerHTML = '<div class="ai-loading"><div class="pulse"></div><div class="msg">재시도 중...</div></div>';
              fetchAIReport();
            }
          }, "다시 시도")
        )
      )
    );
  }

  // ==========================================================
  // Markdown → HTML (lightweight)
  // ==========================================================
  function miniMarkdown(md) {
    md = md.replace(/\r\n/g, "\n");
    md = md.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

    const blocks = md.split(/\n{2,}/);
    return blocks.map(block => {
      block = block.trim();
      if (!block) return "";

      if (/^###\s+/.test(block))  return `<h4>${inline(block.replace(/^###\s+/, ""))}</h4>`;
      if (/^##\s+/.test(block))   return `<h3>${inline(block.replace(/^##\s+/, ""))}</h3>`;
      if (/^#\s+/.test(block))    return `<h3>${inline(block.replace(/^#\s+/, ""))}</h3>`;

      if (/^(\-|\*)\s+/m.test(block) && block.split("\n").every(l => /^(\-|\*)\s+|^\s*$/.test(l))) {
        const items = block.split("\n").filter(l => l.trim())
          .map(l => `<li>${inline(l.replace(/^(\-|\*)\s+/, ""))}</li>`).join("");
        return `<ul>${items}</ul>`;
      }

      if (/^\d+\.\s+/m.test(block) && block.split("\n").every(l => /^\d+\.\s+|^\s*$/.test(l))) {
        const items = block.split("\n").filter(l => l.trim())
          .map(l => `<li>${inline(l.replace(/^\d+\.\s+/, ""))}</li>`).join("");
        return `<ol>${items}</ol>`;
      }

      if (/^&gt;\s+/.test(block)) {
        return `<p class="intro-para">${inline(block.replace(/^&gt;\s+/, ""))}</p>`;
      }

      return `<p>${inline(block.replace(/\n/g, "<br>"))}</p>`;
    }).join("\n");

    function inline(s) {
      s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
      s = s.replace(/(^|[^*])\*([^*]+)\*(?!\*)/g, "$1<em>$2</em>");
      return s;
    }
  }

  function renderAIReport(markdown, modelUsed) {
    const container = $("#ai-report");
    if (!container) return;
    container.innerHTML = "";
    const content = el("div", { class: "report-content" });
    content.innerHTML = miniMarkdown(markdown);
    container.append(content);

    if (modelUsed) {
      container.append(
        el("div", {
          style: "margin-top:20px; padding-top:14px; border-top:1px dashed var(--line); font-family:var(--mono); font-size:.7rem; color:var(--ink-4); letter-spacing:.08em; text-align:right;"
        }, `Generated by ${modelUsed}`)
      );
    }
  }

  // ==========================================================
  // PDF export
  // ==========================================================
  function generatePDF() {
    if (typeof html2pdf === "undefined") {
      alert("PDF 라이브러리를 불러오는 데 실패했습니다. 페이지를 새로고침한 후 다시 시도해주세요.");
      return;
    }
    const element = document.getElementById('view-result');
    const actions = element.querySelector('.report-actions');
    if (actions) actions.style.display = 'none';

    const opt = {
      margin: [10, 0, 15, 0],
      filename: `${state.studentName || '학생'}_${SUBJECT_META.kr}_리포트.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: {
        scale: 2,
        useCORS: true,
        scrollY: 0,
        backgroundColor: '#faf6ef',
        onclone: function (clonedDoc) {
          const s = clonedDoc.createElement('style');
          s.textContent = [
            'body::before { display:none !important; }',
            '#view-result, .app { opacity:1 !important; animation:none !important; }',
            '* { -webkit-text-stroke: 0.3px currentColor; }'
          ].join('\n');
          clonedDoc.head.appendChild(s);
        }
      },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
      pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
    };

    html2pdf().set(opt).from(element).save().then(() => {
      if (actions) actions.style.display = '';
    });
  }

  // ==========================================================
  // Boot
  // ==========================================================
  renderCover();

  // 외부에서 검사 등 하고 싶을 때
  return {
    state,
    MAX,
    // 수동 조작용 (테스트)
    _internal: { computeResult: writingScores => computeResult({
      questions: QUESTIONS,
      answers: state.answers,
      writingScores,
      max: MAX,
    }) }
  };
}
