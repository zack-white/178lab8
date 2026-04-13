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
svg.attr("width", 700).attr("height", 500);

let state = {
  step: 0,
  centroids: [],
  points: [],
  xRange: [0, 1],
  yRange: [0, 1]
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
    state.step = 0;
    stepEl.textContent = String(state.step);
    refreshCentroidInputs();
    await initSession();
  });

  nClustersEl.addEventListener("change", async () => {
    state.step = 0;
    stepEl.textContent = String(state.step);
    refreshCentroidInputs();
    await initSession();
  });

  randomizeBtn.addEventListener("click", async () => {
    const payload = buildPayload();
    await callApi("/api/randomize", payload, "Randomize request sent.");
  });

  forwardBtn.addEventListener("click", async () => {
    const payload = buildPayload();
    const result = await callApi("/api/step", payload, "Step request sent.");
    if (result?.step !== undefined) {
      state.step = Number(result.step) || state.step + 1;
    } else {
      state.step += 1;
    }
    stepEl.textContent = String(state.step);
  });

  backBtn.addEventListener("click", async () => {
    const payload = buildPayload();
    const result = await callApi("/api/back", payload, "Back request sent.");
    if (result?.step !== undefined) {
      state.step = Math.max(0, Number(result.step) || 0);
    } else {
      state.step = Math.max(0, state.step - 1);
    }
    stepEl.textContent = String(state.step);
  });

  runBtn.addEventListener("click", async () => {
    const payload = buildPayload();
    const result = await callApi("/api/run", payload, "Run request sent.");
    if (result?.step !== undefined) {
      state.step = Number(result.step) || state.step;
      stepEl.textContent = String(state.step);
    }
  });

  resetBtn.addEventListener("click", async () => {
    const payload = buildPayload();
    await callApi("/api/reset", payload, "Reset request sent.");
    state.step = 0;
    stepEl.textContent = "0";
    state.centroids = [];
    refreshCentroidInputs();
    renderEmptyPlot();
  });
}

async function initSession() {
  const datasetRaw = document.getElementById("dataset").value;
  const dataset = datasetRaw.endsWith(".csv")
    ? datasetRaw.replace(".csv", "")
    : datasetRaw;
  const response = await fetch("/api/init", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ dataset: dataset})
  });
  const data = await response.json();
  if (!data.ok) {
    console.error(data.error);
    return;
  }
  drawScatterPlot(data.points, data.x_range, data.y_range);
  //state.centroids = extractCentroidsFromInputs();
  //const payload = buildPayload();
  //await callApi("/api/init", payload, "Initialized session.");
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
  if (!Number.isFinite(value)) return;

  if (!state.centroids[i]) {
    state.centroids[i] = {x: null, y: null};
  }
  state.centroids[i][axis] = value;

  callApi(
    "/api/centroids",
    buildPayload(),
    "Centroid override sent.",
  ).catch(() => {});
}

function extractCentroidsFromInputs() {
  const k = getClusterCount();
  const centroids = [];
  for (let i = 0; i < k; i += 1) {
    const xInput = centroidInputsContainer.querySelector(
      `input[data-centroid-index="${i}"][data-axis="x"]`,
    );
    const yInput = centroidInputsContainer.querySelector(
      `input[data-centroid-index="${i}"][data-axis="y"]`,
    );
    centroids.push({
      x: Number.isFinite(Number(xInput?.value)) ? Number(xInput.value) : null,
      y: Number.isFinite(Number(yInput?.value)) ? Number(yInput.value) : null,
    });
  }
  return centroids;
}

function buildPayload() {
  return {
    dataset: datasetEl.value.replace(".csv", ""),
    n_clusters: getClusterCount(),
    step: state.step,
    centroids: extractCentroidsFromInputs(),
  };
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
    .text("No mock plot data rendered. Waiting for backend outputs.");
}

async function callApi(url, payload, successMessage) {
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const data = await response.json();
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

function drawScatterPlot(points, xRange, yRange) {
  svg.selectAll("*").remove();
  const width = 700;
  const height = 500;
  const margin = { top: 20, right: 20, bottom: 50, left: 60 };
  const plotWidth = width - margin.left - margin.right;
  const plotHeight = height - margin.top - margin.bottom;
  const xScale = d3.scaleLinear()
    .domain(xRange)
    .range([margin.left, margin.left + plotWidth]);

  const yScale = d3.scaleLinear()
    .domain(yRange)
    .range([margin.top + plotHeight, margin.top]);

  svg.append("g")
    .attr("transform", `translate(0, ${margin.top + plotHeight})`)
    .call(d3.axisBottom(xScale));

  svg.append("g")
    .attr("transform", `translate(${margin.left}, 0)`)
    .call(d3.axisLeft(yScale));

  svg.append("g")
    .selectAll("circle")
    .data(points)
    .enter()
    .append("circle")
    .attr("cx", d => xScale(d[0]))
    .attr("cy", d => yScale(d[1]))
    .attr("r", 4);

}
