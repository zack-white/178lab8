const svg = d3.select("#scatterplot");
const statusEl = document.getElementById("status");
const stepEl = document.getElementById("step");
const datasetEl = document.getElementById("dataset");
const nClustersEl = document.getElementById("n_clusters");
const centroidInputsContainer = document.getElementById("centroid-inputs");

const backBtn = document.getElementById("back");
const forwardBtn = document.getElementById("forward");
const runBtn = document.getElementById("run");
const resetBtn = document.getElementById("reset");
const randomizeBtn = document.getElementById("randomize");

const PLOT = {width: 760, height: 620, margin: 40};
svg.attr("viewBox", `0 0 ${PLOT.width} ${PLOT.height}`);

const colorScale = d3.scaleOrdinal(d3.schemeTableau10);

let mockState = {
  step: 0,
  data: [],
  assignments: [],
  centroids: [],
  running: false,
  runTimer: null,
};

init();

function init() {
  wireEvents();
  refreshCentroidInputs();
  loadAndRender();
}

function wireEvents() {
  datasetEl.addEventListener("change", () => {
    mockState.step = 0;
    stepEl.textContent = String(mockState.step);
    refreshCentroidInputs();
    loadAndRender();
  });

  nClustersEl.addEventListener("change", () => {
    mockState.step = 0;
    stepEl.textContent = String(mockState.step);
    refreshCentroidInputs();
    assignLabelsRoundRobin();
    renderPlot();
  });

  randomizeBtn.addEventListener("click", () => {
    randomizeCentroids();
    pullCentroidsIntoInputs();
    renderPlot();
    setStatus("Centroids randomized (mock).");
  });

  forwardBtn.addEventListener("click", () => {
    stepMockForward();
  });

  backBtn.addEventListener("click", () => {
    if (mockState.step > 0) {
      mockState.step -= 1;
      stepEl.textContent = String(mockState.step);
      assignLabelsRoundRobin();
      renderPlot();
      setStatus("Moved back one step (mock).");
    }
  });

  runBtn.addEventListener("click", () => {
    if (mockState.running) {
      stopRunLoop("Paused run.");
      return;
    }
    startRunLoop();
  });

  resetBtn.addEventListener("click", () => {
    stopRunLoop();
    mockState.step = 0;
    stepEl.textContent = "0";
    refreshCentroidInputs();
    loadAndRender();
    setStatus("Reset to step 0.");
  });
}

function loadAndRender() {
  const filename = datasetEl.value;
  d3.csv(`static/datasets/${filename}`, d3.autoType).then((data) => {
    mockState.data = data.map((d) => ({x: Number(d.x), y: Number(d.y)}));
    randomizeCentroids();
    assignLabelsRoundRobin();
    pullCentroidsIntoInputs();
    renderPlot();
    setStatus(`Loaded ${filename}.`);
  });
}

function getClusterCount() {
  return Math.max(2, Number(nClustersEl.value) || 2);
}

function refreshCentroidInputs() {
  const k = getClusterCount();
  centroidInputsContainer.innerHTML = "";

  for (let i = 0; i < k; i += 1) {
    const row = document.createElement("div");
    row.className = "centroid-row";

    const label = document.createElement("span");
    label.textContent = `C${i}`;

    const xInput = document.createElement("input");
    xInput.type = "number";
    xInput.step = "0.1";
    xInput.dataset.centroidIndex = String(i);
    xInput.dataset.axis = "x";

    const yInput = document.createElement("input");
    yInput.type = "number";
    yInput.step = "0.1";
    yInput.dataset.centroidIndex = String(i);
    yInput.dataset.axis = "y";

    xInput.addEventListener("input", onCentroidInputChange);
    yInput.addEventListener("input", onCentroidInputChange);

    row.append(label, xInput, yInput);
    centroidInputsContainer.appendChild(row);
  }
}

function onCentroidInputChange(event) {
  const input = event.target;
  const i = Number(input.dataset.centroidIndex);
  const axis = input.dataset.axis;
  const value = Number(input.value);
  if (!Number.isFinite(value) || !mockState.centroids[i]) return;

  mockState.centroids[i][axis] = value;
  renderPlot();
  setStatus("Centroid manually updated (mock override).");
}

function pullCentroidsIntoInputs() {
  const inputs = centroidInputsContainer.querySelectorAll("input");
  inputs.forEach((input) => {
    const i = Number(input.dataset.centroidIndex);
    const axis = input.dataset.axis;
    const value = mockState.centroids[i]?.[axis];
    input.value = Number.isFinite(value) ? value.toFixed(2) : "";
  });
}

function randomizeCentroids() {
  const k = getClusterCount();
  if (mockState.data.length === 0) return;

  const xExtent = d3.extent(mockState.data, (d) => d.x);
  const yExtent = d3.extent(mockState.data, (d) => d.y);

  mockState.centroids = d3.range(k).map(() => ({
    x: randInRange(xExtent[0], xExtent[1]),
    y: randInRange(yExtent[0], yExtent[1]),
  }));
}

function randInRange(min, max) {
  return min + Math.random() * (max - min);
}

function assignLabelsRoundRobin() {
  const k = getClusterCount();
  mockState.assignments = mockState.data.map((_, i) => (i + mockState.step) % k);
}

function stepMockForward() {
  mockState.step += 1;
  stepEl.textContent = String(mockState.step);
  assignLabelsRoundRobin();

  // Tiny centroid drift gives visible change between mock steps.
  mockState.centroids = mockState.centroids.map((c, i) => ({
    x: c.x + Math.cos(mockState.step + i) * 0.15,
    y: c.y + Math.sin(mockState.step + i) * 0.15,
  }));
  pullCentroidsIntoInputs();
  renderPlot();
  setStatus("Advanced one step (mock k-means iteration).");
}

function startRunLoop() {
  mockState.running = true;
  runBtn.textContent = "Pause";
  setStatus("Running mock iterations...");

  let ticks = 0;
  mockState.runTimer = window.setInterval(() => {
    stepMockForward();
    ticks += 1;
    if (ticks >= 10) {
      stopRunLoop("Reached mock convergence.");
    }
  }, 450);
}

function stopRunLoop(msg = "") {
  if (mockState.runTimer) {
    window.clearInterval(mockState.runTimer);
    mockState.runTimer = null;
  }
  mockState.running = false;
  runBtn.textContent = "Run";
  if (msg) setStatus(msg);
}

function renderPlot() {
  svg.selectAll("*").remove();

  if (mockState.data.length === 0) return;

  const x = d3
    .scaleLinear()
    .domain(d3.extent(mockState.data, (d) => d.x))
    .nice()
    .range([PLOT.margin, PLOT.width - PLOT.margin]);

  const y = d3
    .scaleLinear()
    .domain(d3.extent(mockState.data, (d) => d.y))
    .nice()
    .range([PLOT.height - PLOT.margin, PLOT.margin]);

  svg
    .append("g")
    .attr("transform", `translate(0, ${PLOT.height - PLOT.margin})`)
    .call(d3.axisBottom(x));

  svg
    .append("g")
    .attr("transform", `translate(${PLOT.margin}, 0)`)
    .call(d3.axisLeft(y));

  svg
    .append("g")
    .selectAll("circle")
    .data(mockState.data)
    .join("circle")
    .attr("cx", (d) => x(d.x))
    .attr("cy", (d) => y(d.y))
    .attr("r", 4.5)
    .attr("fill", (_, i) => colorScale(mockState.assignments[i]))
    .attr("opacity", 0.85);

  svg
    .append("g")
    .selectAll("path")
    .data(mockState.centroids)
    .join("path")
    .attr("d", d3.symbol().type(d3.symbolCross).size(180))
    .attr("transform", (d) => `translate(${x(d.x)}, ${y(d.y)})`)
    .attr("fill", "none")
    .attr("stroke", (_, i) => colorScale(i))
    .attr("stroke-width", 2.2);
}

function setStatus(text) {
  statusEl.textContent = text;
}
