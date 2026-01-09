const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

function resize() {
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width = Math.max(10, Math.floor(rect.width * dpr));
  canvas.height = Math.max(10, Math.floor(rect.height * dpr));
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  // placeholder clear
  ctx.clearRect(0, 0, rect.width, rect.height);
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, rect.width, rect.height);
}

window.addEventListener("resize", resize);
resize();

console.log("L-System Visualizer scaffold loaded");
