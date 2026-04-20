const SECTIONS = {
  english: { A: 10, B: 5, C: 4, D: 3, E: 3, F: 3, G: 2 },
  korean: { A: 5, B: 5, C: 5, D: 5, E: 5, F: 5 },
  math: { A: 10, B: 10, C: 10 }
};

// Generate questions
const questions = {};
for (const subj of Object.keys(SECTIONS)) {
  questions[subj] = {};
  for (const [sec, count] of Object.entries(SECTIONS[subj])) {
    questions[subj][sec] = [];
    for (let i=0; i<count; i++) {
      // Difficulty between -1.0 (easy) and 2.0 (hard)
      questions[subj][sec].push(Math.random() * 3.0 - 1.0);
    }
  }
}

function randn_bm() {
    let u = 0, v = 0;
    while(u === 0) u = Math.random(); //Converting [0,1) to (0,1)
    while(v === 0) v = Math.random();
    return Math.sqrt( -2.0 * Math.log( u ) ) * Math.cos( 2.0 * Math.PI * v );
}

function simulate1000(subject) {
  const students = [];
  for (let i=0; i<1000; i++) {
    // Gangnam 6th grader ability: mean 0.8, std 0.8 (above average)
    const ability = randn_bm() * 0.8 + 0.8; 
    const result = {};
    for (const [sec, diffs] of Object.entries(questions[subject])) {
      let correct = 0;
      for (const diff of diffs) {
        const prob = 1 / (1 + Math.exp(-(ability - diff)));
        if (Math.random() < prob) correct++;
      }
      result[sec] = correct / diffs.length;
    }
    students.push(result);
  }
  return students;
}

const TOP10_THRESHOLDS = {};
for (const subj of Object.keys(SECTIONS)) {
  const students = simulate1000(subj);
  TOP10_THRESHOLDS[subj] = {};
  for (const sec of Object.keys(SECTIONS[subj])) {
    const scores = students.map(s => s[sec]).sort((a, b) => b - a);
    const top10 = scores[99]; // 100th student = 90th percentile
    TOP10_THRESHOLDS[subj][sec] = Math.round(top10 * 100);
  }
}

console.log("export const GANGNAM_TOP10 = " + JSON.stringify(TOP10_THRESHOLDS, null, 2) + ";");
