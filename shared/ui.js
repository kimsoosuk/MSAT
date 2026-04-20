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
  saveResultToDB,
  loadAllResults,
  GANGNAM_TOP10,
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
  // 관리자 뷰어 모드 (URL 쿼리 기반)
  // ==========================================================
  const urlParams = new URLSearchParams(window.location.search);
  const isAdminView = urlParams.get("admin_view") === "1";
  const adminStudentId = urlParams.get("student_id");

  if (isAdminView && adminStudentId) {
    fetchAdminDataAndRender(adminStudentId);
    return; // 일반 흐름 중단
  }

  async function fetchAdminDataAndRender(sid) {
    showView("view-result");
    const root = $("#view-result");
    root.innerHTML = `<div class="ai-loading" style="padding:60px 20px;"><div class="pulse"></div><div class="msg">학생 데이터를 불러오는 중...</div></div>`;

    try {
      const resp = await fetch(`${WORKER_URL}/admin/student/${sid}`, {
        headers: { "X-Admin-Key": "msat2026" } // 하드코딩된 어드민 키 사용 (차후 환경변수로 개선)
      });
      if (!resp.ok) throw new Error("데이터를 불러오지 못했습니다.");
      const data = await resp.json();
      const sData = data.subjects && data.subjects[SUBJECT_META.id];
      if (!sData) throw new Error("해당 과목의 응시 기록이 없습니다.");

      // 상태 강제 주입
      state.studentId = sid;
      state.studentName = urlParams.get("student_name") || "학생";
      state.result = {
        totalPoints: sData.total_points,
        grade: { label: sData.grade_label, desc: "", bg: "", fg: "" }, // 색상 등은 gradeOf로 재계산 가능
        mcCorrect: sData.mc_correct || 0,
        mcPoints: sData.mc_points || 0,
        writingPoints: sData.writing_points || 0,
        mcTotal: QUESTIONS.filter(q => q.type === "mc").length,
        mcPointsMax: MAX.mc,
        writingPointsMax: MAX.writing,
        perQuestion: {}, // 디테일은 생략하거나 answers에서 재계산
        perSection: sData.perSection || {},
        regionAbs: sData.regionAbs || {},
        wordIntensity: sData.wordIntensity || {}
      };

      // 등급 라벨 재계산
      state.result.grade = gradeOf(state.result.totalPoints);

      // 문항별 디테일 (perQuestionTable 렌더링용)
      const answers = sData.answers || {};
      state.answers = answers;
      QUESTIONS.forEach(q => {
        const ua = answers[q.n];
        let correct = false;
        // mc: 정답 비교 (문자열 vs 문자열 강제 비교) - english/questions.js의 속성명은 'answer'임
        if (q.type === 'mc' && ua !== undefined && ua !== null && String(ua) === String(q.answer)) correct = true;
        state.result.perQuestion[q.n] = {
          n: q.n, section: q.section, type: q.type, type_label: q.type_label,
          userAnswer: ua, correctAnswer: q.answer, correct
        };
      });

      state.writingGrades = sData.writingGrades || {};

      // UI 렌더링
      renderResult();
      // 저장된 sectionNotes를 DB에서 파싱하여 섹션 카드에 주입
      let savedSectionNotes = null;
      if (sData.subject_report_md) {
        const sectionMatch = sData.subject_report_md.match(/===SECTION_DETAIL_START===([\s\S]*?)===SECTION_DETAIL_END===/);
        if (sectionMatch) {
          savedSectionNotes = {};
          const sectionRegex = /\[SECTION_([A-G])\]([\s\S]*?)(?=\[SECTION_[A-G]\]|$)/g;
          let m;
          while ((m = sectionRegex.exec(sectionMatch[1])) !== null) {
            savedSectionNotes[m[1]] = m[2].trim();
          }
        }
      }
      renderAIReport(sData.subject_report_md || "", "DB Saved", savedSectionNotes);

      // 관리자 뷰어에서는 하단에 닫기 버튼 추가
      const actions = $(".report-actions");
      if (actions) {
        const closeBtn = el("button", { class: "btn btn-ghost", onclick: () => window.close() }, "창 닫기");
        actions.insertBefore(closeBtn, actions.firstChild);
      }

    } catch (e) {
      root.innerHTML = `<div class="empty-state">오류: ${e.message}</div>`;
    }
  }

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

    // 이미 응시 여부 플래그 (1차 로컬, 2차 DB에서 업데이트)
    let isAlreadyTaken = false;

    // ── 1차: localStorage 즉시 확인 (빠른 UI 응답) ──────────────
    const existingResults = loadAllResults(state.studentId);
    const localRecord = existingResults && existingResults[SUBJECT_META.id];

    function lockStartButton(localResult) {
      isAlreadyTaken = true;
      startBtn.disabled = true;
      startBtn.innerHTML = "✓ 이미 응시 완료";
      startBtn.style.cssText = "background: var(--success); cursor: not-allowed; opacity: 0.75;";
      // 결과 보기 버튼 추가 (중복 방지)
      if (!document.getElementById("view-result-btn")) {
        const viewResultBtn = el("button", { class: "btn btn-primary", id: "view-result-btn", style: "background: var(--accent);" },
          el("span", {}, "결과 보기"),
          el("span", { class: "arrow" }, "→")
        );
        viewResultBtn.addEventListener("click", () => {
          if (localResult) {
            state.result = localResult;
            renderResult();
          }
          showView("view-result");
        });
        startBtn.parentElement.append(viewResultBtn);
      }
    }

    if (localRecord) {
      // localStorage에 기록 있음 → 즉시 차단
      lockStartButton(localRecord);
    }

    // Start 버튼 클릭: 플래그 재확인 후 실행 (1차 + 2차 DB 체크 완료 후 안전)
    startBtn.addEventListener("click", () => {
      if (isAlreadyTaken) return; // 이미 응시 완료 → 무시
      renderTest();
      showView("view-test");
    });

    // ── 2차: DB 비동기 확인 (더 강한 차단) ─────────────────────
    if (state.studentId && WORKER_URL) {
      fetch(`${WORKER_URL}/admin/student/${state.studentId}`, {
        headers: { "X-Admin-Key": "msat2026" }
      })
        .then(res => res.ok ? res.json() : null)
        .catch(() => null)
        .then(data => {
          const dbRecord = data?.subjects?.[SUBJECT_META.id];
          if (dbRecord && !isAlreadyTaken) {
            // DB에는 있는데 아직 차단 안 된 경우 → 차단
            lockStartButton(null);
          }
        });
    }
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
      const bar = el("div", { class: "bar", "data-val": d.v, style: `height: ${(d.v / maxV) * 85}%;` });
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
    const pct = (n / total) * 100;
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

    const root = $("#view-result");
    root.innerHTML = `
      <div class="result-body" style="display:flex; flex-direction:column; align-items:center; justify-content:center; min-height:80vh; text-align:center;">
        <div class="ai-loading" style="margin-top:0;">
          <div class="pulse"></div>
          <div style="font-family: var(--serif); font-size: 1.5rem; margin-bottom: 8px; color: var(--ink);">채점 및 성적표 작성 중...</div>
          <div class="hint" style="color: var(--ink-3);">서술형 문항 채점과 AI 분석이 진행되고 있습니다 (약 10-20초)</div>
        </div>
      </div>
    `;
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
        el("h1", { html: `<em>${escapeHtml(state.studentName)}</em> 학생의 ${SUBJECT_META.kr} 능력 진단 레포트`, style: "font-size: 1.6rem;" }),
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
    const sectionDetailGrid = sectionDetailBlock.querySelector(".section-detail-grid");
    body.append(sectionDetailBlock);
    renderSectionDetail(sectionDetailGrid);

    // === Section 2: 문항별 결과표 ===
    body.append(el("div", { class: "html2pdf__page-break" }));
    const perQBlock = el("div", { class: "brain-section" },
      el("div", { class: "section-heading" },
        el("span", { class: "num" }, "02"),
        el("h2", {}, "문항별 결과"),
        el("span", { class: "sub" }, "Answer Sheet"),
        el("div", { class: "line" })
      ),
      el("div", { id: "per-question-table" })
    );
    const perQTable = perQBlock.querySelector("#per-question-table");
    body.append(perQBlock);
    renderPerQuestionTable(perQTable);

    // === Section 3: 영어 레포트 ===
    body.append(el("div", { class: "html2pdf__page-break" }));
    const reportSection = el("div", { class: "brain-section" },
      el("div", { class: "section-heading" },
        el("span", { class: "num" }, "03"),
        el("h2", {}, "진단 레포트"),
        el("span", { class: "sub" }, "Personalized Feedback"),
        el("div", { class: "line" })
      ),
      el("div", { class: "ai-report", id: "ai-report" },
        el("div", { class: "ai-loading", id: "ai-loading" },
          el("div", { class: "pulse" }),
          el("div", { class: "msg" }, "AI가 성적을 분석하고 레포트를 작성하고 있습니다..."),
          el("div", { class: "hint" }, "Analyzing · 10–20 seconds")
        )
      )
    );
    body.append(reportSection);

    body.append(
      el("div", { class: "report-actions" },
        el("a", { href: "../", class: "btn btn-ghost" }, "← 과목 선택으로"),
        el("button", { class: "btn btn-ghost", onclick: generatePDF }, "PDF 저장")
      )
    );

    // Footer
    body.append(
      el("div", { class: "global-footer" }, "©지혜의산실")
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

    // 등급 — 가장 크게 표시 (desc 텍스트는 제거)
    const gradeCell = el("div", { class: "score-cell score-cell--grade" },
      el("div", { class: "label" }, "등급"),
      el("div", {
        class: "grade-badge",
        style: pending ? "" : `color: ${r.grade.color}; border-color: ${r.grade.color};`
      }, pending ? "—" : r.grade.label)
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
  function renderSectionDetail(container, aiSectionNotes) {
    const r = state.result;
    container.innerHTML = "";

    // ─────────────────────────────────────────────
    // 통계 유틸 (정규분포)
    // 평균 82점, 표준편차 9.5점 (강남 시뮬레이션 기반)
    // ─────────────────────────────────────────────
    const DIST_MEAN = 82;
    const DIST_SD   = 9.5;

    function normalPdf(x, mu, sigma) {
      return Math.exp(-0.5 * ((x - mu) / sigma) ** 2) / (sigma * Math.sqrt(2 * Math.PI));
    }
    function normalCdf(z) {
      const t = 1 / (1 + 0.2316419 * Math.abs(z));
      const d = 0.3989422804 * Math.exp(-z * z / 2);
      const prob = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
      return z > 0 ? 1 - prob : prob;
    }
    function percentileRank(score) {
      const z = (score - DIST_MEAN) / DIST_SD;
      const p = 1 - normalCdf(z);
      return Math.max(1, Math.min(99, Math.round(p * 100)));
    }

    const totalScore = r.totalPoints;
    const pctRank = percentileRank(totalScore);

    // ─────────────────────────────────────────────
    // 차트 컨테이너 래퍼 (위/아래 두 개)
    // ─────────────────────────────────────────────
    const chartsWrap = el("div", { class: "comparison-charts-wrap" });

    // ── 1) 정규분포 곡선 차트 ──
    const bellWrap = el("div", { class: "comparison-chart-box" });
    const bellTitle = el("div", { class: "comparison-chart-title" }, "내 성적");
    const bellSubtitle = el("div", { class: "comparison-chart-subtitle" }, `서울 강남 기준 · 상위 ${pctRank}%`);
    const bellCanvas = el("canvas", { id: "chart-bell" });
    bellWrap.append(bellTitle, bellSubtitle, bellCanvas);

    // ── 2) 레이더(육각형) 차트 ──
    const radarWrap = el("div", { class: "comparison-chart-box" });
    const radarTitle = el("div", { class: "comparison-chart-title" }, "섹션별 능력 비교");
    const radarSubtitle = el("div", { class: "comparison-chart-subtitle" }, "강남 상위 10% 기준 대비");
    const radarCanvas = el("canvas", { id: "chart-radar" });
    radarWrap.append(radarTitle, radarSubtitle, radarCanvas);

    chartsWrap.append(bellWrap, radarWrap);
    container.append(chartsWrap);

    // ── Chart.js 렌더링 ──
    if (typeof Chart !== "undefined") {
      // 1) Bell Curve (Line Chart)
      const xs = [];
      const ys = [];
      for (let x = 40; x <= 100; x += 0.5) {
        xs.push(Math.round(x * 10) / 10);
        ys.push(normalPdf(x, DIST_MEAN, DIST_SD));
      }

      // 학생 점수 수직선용 annotation 대신, 학생 점수에 해당하는 PDF 값 포인트 배열 생성
      const studentYs = xs.map(x => (Math.abs(x - totalScore) < 0.3 ? normalPdf(x, DIST_MEAN, DIST_SD) : null));

      new Chart(bellCanvas, {
        type: "line",
        data: {
          labels: xs,
          datasets: [
            {
              label: "전체 분포",
              data: ys,
              borderColor: "rgba(107, 93, 82, 0.5)",
              backgroundColor: "rgba(107, 93, 82, 0.08)",
              borderWidth: 1.5,
              pointRadius: 0,
              fill: true,
              tension: 0.4,
            },
            {
              label: `내 성적 (${totalScore}점 · 상위 ${pctRank}%)`,
              data: studentYs,
              borderColor: "#c4711f",
              backgroundColor: "#c4711f",
              pointRadius: xs.map(x => Math.abs(x - totalScore) < 0.3 ? 7 : 0),
              pointStyle: "circle",
              showLine: false,
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            x: {
              type: "linear",
              min: 40, max: 100,
              ticks: {
                stepSize: 10,
                font: { family: "'Inter', sans-serif", size: 12 },
                color: "rgba(107, 93, 82, 0.7)"
              },
              grid: { color: "rgba(107, 93, 82, 0.08)" },
              title: { display: true, text: "총점", font: { family: "'Noto Sans KR', sans-serif", size: 15, weight: "600" }, color: "rgba(107, 93, 82, 0.8)" }
            },
            y: {
              display: false,
            }
          },
          plugins: {
            legend: {
              position: "bottom",
              labels: { font: { family: "'Noto Sans KR', sans-serif", size: 14 }, boxWidth: 14, usePointStyle: true, padding: 20 }
            },
            tooltip: {
              callbacks: {
                label: ctx => ctx.datasetIndex === 1 ? `상위 ${pctRank}%` : null,
                title: ctx => `${ctx[0].label}점`
              }
            }
          }
        }
      });

      // 2) Radar Chart (Section A~F, G 제외)
      const top10Data = GANGNAM_TOP10[SUBJECT_META.id] || {};
      const radarSections = ["A", "B", "C", "D", "E", "F"];
      const radarLabels = radarSections.map(id => {
        const sec = SECTIONS.find(s => s.id === id);
        return sec ? `${id}: ${sec.kr || sec.en}` : id;
      });
      const studentRadar = radarSections.map(id => {
        const s = Object.values(r.perSection).find(s => s.section === id);
        return s ? s.pct : 0;
      });
      const top10Radar = radarSections.map(id => top10Data[id] || 90);

      new Chart(radarCanvas, {
        type: "radar",
        data: {
          labels: radarLabels,
          datasets: [
            {
              label: "서울 강남 상위 10%",
              data: top10Radar,
              borderColor: "rgba(107, 93, 82, 0.5)",
              backgroundColor: "rgba(107, 93, 82, 0.12)",
              borderWidth: 1.5,
              pointRadius: 3,
              pointBackgroundColor: "rgba(107, 93, 82, 0.5)",
            },
            {
              label: "나의 점수",
              data: studentRadar,
              borderColor: "#c4711f",
              backgroundColor: "rgba(196, 113, 31, 0.18)",
              borderWidth: 2,
              pointRadius: 4,
              pointBackgroundColor: "#c4711f",
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            r: {
              min: 0, max: 100,
              ticks: { stepSize: 25, font: { size: 11 }, color: "rgba(107, 93, 82, 0.5)", backdropColor: "transparent" },
              grid: { color: "rgba(107, 93, 82, 0.12)" },
              angleLines: { color: "rgba(107, 93, 82, 0.15)" },
              pointLabels: { font: { family: "'Noto Sans KR', sans-serif", size: 15, weight: "700" }, color: "rgba(26, 22, 18, 0.9)" }
            }
          },
          plugins: {
            legend: {
              position: "bottom",
              labels: { font: { family: "'Noto Sans KR', sans-serif", size: 13 }, boxWidth: 12, usePointStyle: true, padding: 16 }
            }
          }
        }
      });
    }

    // ─────────────────────────────────────────────
    // 2) 개별 섹션 카드 렌더링
    // ─────────────────────────────────────────────
    const sectionMeta = {};
    SECTIONS.forEach(s => { sectionMeta[s.id] = s; });

    Object.values(r.perSection).forEach(s => {
      const meta = sectionMeta[s.section];
      const enName = meta?.en || s.section;
      const krName = meta?.kr || "";

      // 레벨
      const pct = s.pct;
      let levelClass = "";
      if (pct >= 85) levelClass = "level-high";
      else if (pct >= 60) levelClass = "level-mid";
      else levelClass = "level-low";

      const guide = pct >= 70 ? (meta?.highGuide || "") : (meta?.lowGuide || "");

      // 조각난 막대그래프 생성
      const segments = [];
      for (let i = 0; i < s.totalQ; i++) {
        const isFilled = i < s.correctQ;
        segments.push(el("div", { class: `segment-block ${isFilled ? 'filled' : 'empty'}` }));
      }
      const segmentTrack = el("div", { class: "segment-track" }, ...segments);

      const card = el("div", { class: `section-detail-card ${levelClass}` },
        el("div", { class: "section-detail-head" },
          el("div", { class: "section-detail-id" }, `Section ${s.section}`),
          el("div", { class: "section-detail-pct" }, `${s.correctQ} / ${s.totalQ}`)
        ),
        el("div", { class: "section-detail-name" }, `${enName}${krName ? " · " + krName : ""}`),
        el("div", { class: "section-detail-bar" }, segmentTrack),
        el("div", { class: "section-detail-stats" },
          el("span", {}, `${s.pointsEarned}/${s.pointsMax}점`)
        )
      );

      // 요구 능력
      if (meta?.abilities) {
        card.append(el("div", { class: "section-detail-abilities" },
          el("span", { class: "section-detail-abilities-label" }, "요구 능력"),
          el("span", {}, meta.abilities)
        ));
      }

      // 점수 기반 가이드
      if (guide) {
        card.append(el("div", { class: "section-detail-guide" }, guide));
      }

      // AI가 생성한 섹션별 성취도 노트 (있으면 주입)
      if (aiSectionNotes && aiSectionNotes[s.section]) {
        const noteDiv = el("div", { class: "section-detail-ai-note" });
        noteDiv.innerHTML = miniMarkdown(aiSectionNotes[s.section]);
        card.append(noteDiv);
      }

      if (s.section === 'B' || s.section === 'E') {
        card.classList.add("page-break-before");
      }
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
      if (idx === 0) badge = "★ Top";
      else if (idx === 1) badge = "#2";
      else if (idx === 3) badge = "#4";
      else if (idx === 4) badge = "Lowest";

      let relLabel = "";
      if (z > 0.8) relLabel = "↑ Above profile avg";
      else if (z < -0.8) relLabel = "↓ Below profile avg";
      else relLabel = "≈ Near profile avg";

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

      // 결과를 DB 및 localStorage에 저장
      try {
        const sectionNotes = data.sectionNotes || {};
        // Admin 뷰어에서 파싱할 수 있도록 SECTION_DETAIL 블록을 markdown 하단에 첨부하여 저장
        let fullReportMd = reportMarkdown;
        if (Object.keys(sectionNotes).length > 0) {
          let sectionBlock = "\n\n===SECTION_DETAIL_START===\n";
          Object.entries(sectionNotes).forEach(([id, note]) => {
            sectionBlock += `[SECTION_${id}]\n${note}\n`;
          });
          sectionBlock += "===SECTION_DETAIL_END===";
          fullReportMd += sectionBlock;
        }

        saveResultToDB(
          {
            studentId: state.studentId,
            name: state.studentName,
            school: state.school,
            grade: state.grade,
            dob: state.dob,
          },
          {
            subject: SUBJECT_META.id,
            version: "2026.04",
            totalPoints: state.result.totalPoints,
            gradeLabel: state.result.grade.label,
            mcCorrect: state.result.mcCorrect,
            mcPoints: state.result.mcPoints,
            writingPoints: state.result.writingPoints,
            answers: state.answers,
            writingGrades: state.writingGrades,
            regionAbs: state.result.regionAbs,
            wordIntensity: state.result.wordIntensity,
            perSection: state.result.perSection,
            subjectReportMd: fullReportMd,
          }
        );
      } catch (e) {
        console.warn("Failed to save subject result to DB/local:", e);
      }

      // Re-render result top (score summary, regions, words, radar)
      renderResult();

      // Render AI report — sectionNotes가 있으면 01 섹션 카드에 주입
      const sectionNotes = data.sectionNotes || null;
      renderAIReport(reportMarkdown, data.model, sectionNotes);
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
              const root = $("#view-result");
              if (root) {
                root.innerHTML = `
                  <div class="result-body" style="display:flex; flex-direction:column; align-items:center; justify-content:center; min-height:80vh; text-align:center;">
                    <div class="ai-loading" style="margin-top:0;">
                      <div class="pulse"></div>
                      <div style="font-family: var(--serif); font-size: 1.5rem; margin-bottom: 8px; color: var(--ink);">채점 및 분석 재시도 중...</div>
                      <div class="hint" style="color: var(--ink-3);">서술형 문항 채점과 AI 분석을 다시 시도하고 있습니다.</div>
                    </div>
                  </div>
                `;
              }
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

    // 줄 단위로 처리: 각 줄에서 # 기호 제거 후 블록 분할
    const lines = md.split("\n");
    const processed = [];
    for (const line of lines) {
      if (/^####\s+/.test(line)) {
        processed.push(`\n\n__H5__${line.replace(/^####\s+/, "")}__H5END__\n\n`);
      } else if (/^###\s+/.test(line)) {
        processed.push(`\n\n__H4__${line.replace(/^###\s+/, "")}__H4END__\n\n`);
      } else if (/^##\s+/.test(line)) {
        processed.push(`\n\n__H3__${line.replace(/^##\s+/, "")}__H3END__\n\n`);
      } else if (/^#\s+/.test(line)) {
        processed.push(`\n\n__H3__${line.replace(/^#\s+/, "")}__H3END__\n\n`);
      } else {
        processed.push(line);
      }
    }
    md = processed.join("\n");

    const blocks = md.split(/\n{2,}/);
    return blocks.map(block => {
      block = block.trim();
      if (!block) return "";

      if (block.startsWith("__H3__")) return `<h3>${inline(block.replace(/__H3__|__H3END__/g, ""))}</h3>`;
      if (block.startsWith("__H4__")) return `<h4>${inline(block.replace(/__H4__|__H4END__/g, ""))}</h4>`;
      if (block.startsWith("__H5__")) return `<h5>${inline(block.replace(/__H5__|__H5END__/g, ""))}</h5>`;

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

  function renderAIReport(markdown, modelUsed, sectionNotes) {
    if (sectionNotes) {
      const sectionDetailGrid = $("#section-detail-grid");
      if (sectionDetailGrid) {
        renderSectionDetail(sectionDetailGrid, sectionNotes);
      }
    }

    const container = $("#ai-report");
    if (!container) return;
    container.innerHTML = "";

    // Normalize ## to ### to handle both cases
    const md = markdown.replace(/^##\s+/gm, "### ");
    const sections = md.split(/^###\s+/m);

    sections.forEach(sec => {
      const trimmed = sec.trim();
      if (!trimmed) return;

      const lines = trimmed.split("\n");
      // 첫 줄이 소제목, 나머지가 내용
      const title = lines.shift().trim();
      const bodyMd = lines.join("\n").trim();

      const wrap = el("div", { class: "ai-report-section-wrap" });
      // 제목이 없으면 (예: 문서 맨 앞에 텍스트만 있는 경우) 그냥 카드만 렌더링
      if (title && !bodyMd && lines.length === 0) {
        // 본문 없이 제목만 있는 경우 (비정상 케이스 처리)
        const card = el("div", { class: "ai-report-card" });
        card.innerHTML = miniMarkdown(title);
        wrap.append(card);
      } else {
        const h3 = el("h3", { class: "card-title-outside" }, title);
        const card = el("div", { class: "ai-report-card" });
        card.innerHTML = miniMarkdown(bodyMd);
        wrap.append(h3, card);
      }
      container.append(wrap);
    });
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

    document.body.classList.add('pdf-capture');

    const opt = {
      margin: [10, 8, 18, 8],
      filename: `${state.studentName || '학생'}_${SUBJECT_META.kr}_레포트.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: {
        scale: 2,
        useCORS: true,
        scrollY: 0,
        backgroundColor: '#ffffff',
        onclone: function (clonedDoc) {
          const s = clonedDoc.createElement('style');
          s.textContent = [
            'body::before { display:none !important; }',
            'body, .app, #view-result, .result-body { background: #ffffff !important; opacity:1 !important; animation:none !important; }',
            '* { -webkit-text-stroke: 0.2px currentColor; }',
            '.score-summary { border: 1px solid #d9cfbe; border-radius: 8px; overflow: hidden; }',
            '.score-cell { background: #fdfbf6; }',
            '.page-break-before { page-break-before: always !important; break-before: page !important; }',
            '.section-heading { page-break-after: avoid !important; break-after: avoid !important; }',
            '.section-heading + * { page-break-before: avoid !important; break-before: avoid !important; }',
            '.section-detail-card { background: #fdfbf6; border: 1px solid #d9cfbe; page-break-inside: avoid !important; break-inside: avoid !important; }',
            '.section-detail-guide { background: #f2ecdf; }',
            '.section-detail-ai-note { background: rgba(139, 42, 31, 0.03); }',
            '.per-q-table { page-break-inside: auto; }',
            '.per-q-row, .per-q-cell { page-break-inside: avoid !important; break-inside: avoid !important; }',
            '.ai-report-section-wrap { page-break-inside: avoid !important; break-inside: avoid !important; }',
            '.ai-report-card { page-break-inside: avoid !important; break-inside: avoid !important; }',
            '.ai-report-card h3, .ai-report-card h4, .ai-report-card h5 { page-break-after: avoid !important; break-after: avoid !important; }',
            '.ai-report-card p, .ai-report-card ul, .ai-report-card ol { page-break-inside: avoid !important; break-inside: avoid !important; }',
            '.brain-section { page-break-inside: auto; }',
            '.global-footer { display: none !important; }',
          ].join('\n');
          clonedDoc.head.appendChild(s);

          const clonedActions = clonedDoc.querySelector('.report-actions');
          if (clonedActions) clonedActions.style.display = 'none';
        }
      },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
      pagebreak: { mode: ['css', 'legacy'] }
    };

    html2pdf().set(opt).from(element).toPdf().get('pdf').then(function (pdf) {
      const totalPages = pdf.internal.getNumberOfPages();
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();

      const canvas = document.createElement('canvas');
      canvas.width = 400;
      canvas.height = 40;
      const ctx = canvas.getContext('2d');
      ctx.font = '16px sans-serif';
      ctx.fillStyle = '#9a8d80';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('ⓒ지혜의산실', 200, 20);
      const footerImg = canvas.toDataURL('image/png');

      for (let i = 1; i <= totalPages; i++) {
        pdf.setPage(i);
        pdf.addImage(footerImg, 'PNG', pageWidth / 2 - 20, pageHeight - 10, 40, 4);
      }
    }).save().then(() => {
      if (actions) actions.style.display = '';
      document.body.classList.remove('pdf-capture');
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
    _internal: {
      computeResult: writingScores => computeResult({
        questions: QUESTIONS,
        answers: state.answers,
        writingScores,
        max: MAX,
      })
    }
  };
}
