const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

let currentAnim = null;
let lastSegments = null;
let lastDrawMode = "grow"; // 'render' | 'grow'

// UI
const ui = {
  axiom: document.getElementById("axiom"),
  iters: document.getElementById("iters"),
  itersVal: document.getElementById("itersVal"),
  angle: document.getElementById("angle"),
  step: document.getElementById("step"),
  rules: document.getElementById("rules"),
  btnRender: document.getElementById("btnRender"),
  btnGrow: document.getElementById("btnGrow"),
  btnStop: document.getElementById("btnStop"),
  status: document.getElementById("status"),
  stats: document.getElementById("stats"),
};

function resize() {
  const dpr = window.devicePixelRatio || 1;

  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  console.log("RESIZED buffer ->", canvas.width, canvas.height);

  if (!w || !h) {
    console.warn("Canvas has zero size:", { w, h });
    return;
  }

  canvas.width = Math.floor(w * dpr);
  canvas.height = Math.floor(h * dpr);

  // scale to account for device pixel ratio
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  // fill background
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, w, h);

  //  redraw last segments if any
  if (lastSegments) {
    stopDrawingAnimation();
    drawSegments(ctx, lastSegments);
  }
}


console.log("L-System Visualizer loaded");
window.addEventListener("resize", resize);
resize(); // first paint

// ---------------------------
// L-System core
// ---------------------------

/**
 * Parse rules from lines like:
 * A=AB
 * B=A
 */
function parseRules(text) {
  const rules = new Map();
  const lines = text.split("\n").map(s => s.trim()).filter(Boolean);

  for (const line of lines) {
    if (line.startsWith("#")) continue;

    const eq = line.indexOf("=");
    if (eq === -1) throw new Error(`Bad rule line (expected X=...): "${line}"`);

    const lhs = line.slice(0, eq).trim();
    const rhs = line.slice(eq + 1).trim();

    if (lhs.length !== 1) throw new Error(`Rule LHS must be single character: "${lhs}"`);
    rules.set(lhs, rhs);
  }

  return rules;
}

/**
 * Expand an L-system string by applying rules for N iterations.
 */
function expand(axiom, rules, iterations) {
  let s = axiom;
  for (let i = 0; i < iterations; i++) {
    let out = "";
    for (const ch of s) out += (rules.get(ch) ?? ch);
    s = out;
  }
  return s;
}

// ---------------------------
// Canvas drawing
// ---------------------------

function drawSegments(ctx, segments) {
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;

  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, w, h);

  ctx.save();
  ctx.strokeStyle = "#7CFC00";
  ctx.lineWidth = 1;

  ctx.translate(w / 2, h * 0.95);

  ctx.beginPath();
  for (const s of segments) {
    ctx.moveTo(s.x1, s.y1);
    ctx.lineTo(s.x2, s.y2);
  }
  ctx.stroke();
  ctx.restore();
}


function drawSegmentsAnimated(ctx, segments, options = {}) {
  const { batch = 2, delayMs = 0 } = options;

  // cancel previous animation if any
  if (currentAnim) {
    currentAnim.cancelled = true;
    currentAnim = null;
  }
  currentAnim = { cancelled: false };

  const w = canvas.clientWidth;
  const h = canvas.clientHeight;

  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, w, h);

  ctx.save();
  ctx.strokeStyle = "#7CFC00";
  ctx.lineWidth = 1;
  ctx.translate(w / 2, h * 0.95);

  let i = 0;

  function frame() {
    if (!currentAnim || currentAnim.cancelled) {
      ctx.restore();
      return;
    }

    ctx.beginPath();
    for (let k = 0; k < batch && i < segments.length; k++, i++) {
      const s = segments[i];
      ctx.moveTo(s.x1, s.y1);
      ctx.lineTo(s.x2, s.y2);
    }
    ctx.stroke();

    if (i < segments.length) {
      if (delayMs > 0) setTimeout(() => requestAnimationFrame(frame), delayMs);
      else requestAnimationFrame(frame);
    } else {
      ctx.restore();
      currentAnim = null;
    }
  }

  frame();
}

function stopDrawingAnimation() {
  if (currentAnim) currentAnim.cancelled = true;
  currentAnim = null;
}

// ---------------------------
// UI -> Render pipeline
// ---------------------------

function setStatus(msg, isError = false) {
  if (!ui.status) return;
  ui.status.textContent = msg || "";
  ui.status.classList.toggle("error", !!isError);
}

function getConfig() {
  const axiom = (ui.axiom?.value ?? "").trim() || "F";
  const rulesText = (ui.rules?.value ?? "").trim();
  const iters = Number(ui.iters?.value ?? 0);
  const angleDeg = Number(ui.angle?.value ?? 25);
  const step = Number(ui.step?.value ?? 8);

  if (!Number.isFinite(iters) || iters < 0) throw new Error("Iterations must be >= 0");
  if (!Number.isFinite(angleDeg)) throw new Error("Angle must be a number");
  if (!Number.isFinite(step) || step <= 0) throw new Error("Step must be > 0");

  return { axiom, rulesText, iters, angleDeg, step };
}

function updateStats({ expandedLen, segmentCount }) {
  if (!ui.stats) return;
  ui.stats.innerHTML = `
    <div><strong>Stats</strong></div>
    <div>Expanded length: <code>${expandedLen.toLocaleString()}</code></div>
    <div>Segments: <code>${segmentCount.toLocaleString()}</code></div>
  `;
}

function computeSegments() {
  const { axiom, rulesText, iters, angleDeg, step } = getConfig();
  const rules = parseRules(rulesText);
  const expanded = expand(axiom, rules, iters);
  const segments = interpret(expanded, { step, angleDeg });

  updateStats({ expandedLen: expanded.length, segmentCount: segments.length });
  return segments;
}

function run(mode) {
  try {
    resize();
    setStatus("");
    stopDrawingAnimation();

    const segments = computeSegments();
    lastSegments = segments;
    lastDrawMode = mode;

    if (mode === "render") {
      drawSegments(ctx, segments);
      setStatus("Rendered.");
    } else {
      drawSegmentsAnimated(ctx, segments, { batch: 1, delayMs: 10 });
      setStatus("Growing…");
    }
  } catch (e) {
    setStatus(e?.message ?? String(e), true);
  }
}

function bindUI() {
  const syncIters = () => {
    if (ui.itersVal && ui.iters) ui.itersVal.textContent = ui.iters.value;
  };
  syncIters();
  ui.iters?.addEventListener("input", syncIters);

  ui.btnRender?.addEventListener("click", () => run("render"));
  ui.btnGrow?.addEventListener("click", () => run("grow"));
  ui.btnStop?.addEventListener("click", () => {
    stopDrawingAnimation();
    setStatus("Stopped.");
  });

  // Cmd/Ctrl+Enter to Grow from rules box
  ui.rules?.addEventListener("keydown", (ev) => {
    if ((ev.ctrlKey || ev.metaKey) && ev.key === "Enter") run("grow");
  });
}

// init
bindUI();
run("grow");

// ---------------------------
// Turtle interpreter (T5)
// ---------------------------

function interpret(lsys, options) {
  const { step = 10, angleDeg = 25 } = options;
  const angleRad = angleDeg * Math.PI / 180;

  let x = 0;
  let y = 0;
  let theta = -Math.PI / 2; // start pointing up
  const stack = [];
  const segments = [];

  for (const ch of lsys) {
    if (ch === "A" || ch === "B" || ch === "F") {
      const nx = x + step * Math.cos(theta);
      const ny = y + step * Math.sin(theta);
      segments.push({ x1: x, y1: y, x2: nx, y2: ny });
      x = nx;
      y = ny;
    } else if (ch === "+") {
      theta += angleRad;
    } else if (ch === "-") {
      theta -= angleRad;
    } else if (ch === "[") {
      stack.push({ x, y, theta });
    } else if (ch === "]") {
      const state = stack.pop();
      if (state) {
        x = state.x;
        y = state.y;
        theta = state.theta;
      }
    }
  }

  return segments;
}
