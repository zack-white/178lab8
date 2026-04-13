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

const PLOT = { width: 760, height: 620, margin: 40 };
svg.attr("viewBox", `0 0 ${PLOT.width} ${PLOT.height}`);

const palette = d3.schemeTableau10;

let state = {
  step: 0,
  points: [],
  centroids: [],
  assignments: [],
  xRange: [0, 1],
  yRange: [0, 1],
};

init();

function init() {
  wireEvents();
  refreshCentroidInputs();
  renderEmptyPlot();
  initSession();
}

function wireEvents() {
  datasetEl.addEventListener("change", async () => {
    await initSession();
  });

  nClustersEl.addEventListener("change", async () => {
    refreshCentroidInputs();
    await initSession();
  });

  randomizeBtn.addEventListener("click", async () => {
    const result = await callApi("/api/randomize", buildPayload(), "Centroids randomized.");
    applyApiState(result);
  });

  forwardBtn.addEventListener("click", async () => {
    const result = await callApi("/api/step", buildPayload(), "Advanced one step.");
    applyApiState(result);
  });

  backBtn.addEventListener("click", async () => {
    const result = await callApi("/api/back", buildPayload(), "Moved one step back.");
    applyApiState(result);
  });

  runBtn.addEventListener("click", async () => {
    const data = await callApi("/api/run", buildPayload(), "Converged");
    for (const stepData of data.steps) {
      await new Promise((resolve) => setTimeout(resolve, 300));
      applyApiState({ ...data, ...stepData })

    }
  });

  resetBtn.addEventListener("click", async () => {
    await callApi("/api/reset", buildPayload(), "Reset.");
    state = {
      step: 0,
      points: [],
      centroids: [],
      assignments: [],
      xRange: [0, 1],
      yRange: [0, 1],
    };
    stepEl.textContent = "0";
    refreshCentroidInputs();
    renderEmptyPlot();
  });
}

async function initSession() {
  const result = await callApi("/api/init", buildPayload(), "Initialized session.");
  applyApiState(result);
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

async function onCentroidInputChange() {
  // Only send when all centroid values are present.
  const centroids = extractCentroidsFromInputs();
  if (centroids.some((c) => c.x === null || c.y === null)) {
    return;
  }

  const result = await callApi("/api/centroids", buildPayload(), "Applied manual centroids.");
  applyApiState(result);
}

function extractCentroidsFromInputs() {
  const k = getClusterCount();
  const centroids = [];

  for (let i = 0; i < k; i += 1) {
    const xInput = centroidInputsContainer.querySelector(
      `input[data-centroid-index="${i}"][data-axis="x"]`
    );
    const yInput = centroidInputsContainer.querySelector(
      `input[data-centroid-index="${i}"][data-axis="y"]`
    );

    centroids.push({
      x: Number.isFinite(Number(xInput?.value)) ? Number(xInput.value) : null,
      y: Number.isFinite(Number(yInput?.value)) ? Number(yInput.value) : null,
    });
  }

  return centroids;
}

function syncCentroidInputsFromState() {
  for (let i = 0; i < getClusterCount(); i += 1) {
    const c = state.centroids[i];
    const xInput = centroidInputsContainer.querySelector(
      `input[data-centroid-index="${i}"][data-axis="x"]`
    );
    const yInput = centroidInputsContainer.querySelector(
      `input[data-centroid-index="${i}"][data-axis="y"]`
    );

    if (!xInput || !yInput) continue;

    xInput.value = c ? Number(c.x).toFixed(2) : "";
    yInput.value = c ? Number(c.y).toFixed(2) : "";
  }
}

function buildPayload() {
  return {
    dataset: datasetEl.value.replace(".csv", ""),
    n_clusters: getClusterCount(),
    centroids: extractCentroidsFromInputs(),
    step: state.step,
  };
}

function applyApiState(data) {
  if (!data || !data.ok) return;

  if (data.step !== undefined) {
    state.step = Number(data.step) || 0;
    stepEl.textContent = String(state.step);
  }

  if (Array.isArray(data.points)) {
    state.points = data.points.map((d) => [Number(d[0]), Number(d[1])]);
  }

  if (Array.isArray(data.centroids)) {
    state.centroids = data.centroids.map((d) => ({ x: Number(d[0]), y: Number(d[1]) }));
  }

  if (Array.isArray(data.assignments)) {
    state.assignments = data.assignments.map((x) => Number(x));
  }

  if (Array.isArray(data.x_range)) state.xRange = data.x_range;
  if (Array.isArray(data.y_range)) state.yRange = data.y_range;

  syncCentroidInputsFromState();
  drawScatterPlot();
}

function renderEmptyPlot() {
  svg.selectAll("*").remove();
  svg
    .append("text")
    .attr("x", PLOT.width / 2)
    .attr("y", PLOT.height / 2)
    .attr("text-anchor", "middle")
    .attr("fill", "#7a869a")
    .attr("font-size", 14)
    .text("No plot data yet.");
}

async function callApi(url, payload, successMessage) {
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data?.error || `HTTP ${response.status}`);
    }

    if (successMessage) setStatus(successMessage);
    return data;
  } catch (err) {
    setStatus(`Request failed: ${err.message}`);
    return null;
  }
}

function setStatus(text) {
  statusEl.textContent = text;
}

function drawScatterPlot() {
  if (!state.points.length) {
    renderEmptyPlot();
    return;
  }

  svg.selectAll("*").remove();

  const width = PLOT.width;
  const height = PLOT.height;
  const margin = { top: 24, right: 24, bottom: 48, left: 60 };

  const xScale = d3
    .scaleLinear()
    .domain(state.xRange)
    .range([margin.left, width - margin.right]);

  const yScale = d3
    .scaleLinear()
    .domain(state.yRange)
    .range([height - margin.bottom, margin.top]);

  svg
    .append("g")
    .attr("transform", `translate(0, ${height - margin.bottom})`)
    .call(d3.axisBottom(xScale));

  svg
    .append("g")
    .attr("transform", `translate(${margin.left}, 0)`)
    .call(d3.axisLeft(yScale));

  const pointData = state.points.map((p, i) => ({
    x: p[0],
    y: p[1],
    cluster: state.assignments[i] ?? -1,
  }));

  svg
    .append("g")
    .selectAll("circle")
    .data(pointData)
    .enter()
    .append("circle")
    .attr("cx", (d) => xScale(d.x))
    .attr("cy", (d) => yScale(d.y))
    .attr("r", 4)
    .attr("fill", (d) => (d.cluster >= 0 ? palette[d.cluster % palette.length] : "#64748b"))
    .attr("opacity", 0.85);

  svg
    .append("g")
    .selectAll("centroid")
    .data(state.centroids)
    .enter()
    .append("path")
    .attr("d", d3.symbol().type(d3.symbolCross).size(180))
    .attr("transform", (d) => `translate(${xScale(d.x)}, ${yScale(d.y)})`)
    .attr("fill", (d, i) => palette[i % palette.length])
    .attr("stroke", "#111")
    .attr("stroke-width", 0.7);
}
