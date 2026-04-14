import os
import numpy as np
import pandas as pd
from flask import Flask, jsonify, render_template, request

app = Flask(__name__)
datasets = ["blobs", "circles", "lines", "moons", "uniform"]

# In-memory single-session state (sufficient for lab demo).
kmeans_state = {
    "dataset": None,
    "n_clusters": None,
    "points": None,
    "history": [],  # each: {step, centroids(np.ndarray), assignments(np.ndarray)}
}


def load_dataset(name):
    base_dir = os.path.dirname(os.path.abspath(__file__))
    path = os.path.join(base_dir, "static", "datasets", f"{name}.csv")
    df = pd.read_csv(path)
    return df[["x", "y"]].to_numpy(dtype=float)


def initialize_centroids(points, n_clusters):
    indices = np.random.choice(len(points), size=n_clusters, replace=False)
    return points[indices]


def assign_clusters(points, centroids):
    distances = np.linalg.norm(points[:, np.newaxis] - centroids, axis=2)
    return np.argmin(distances, axis=1)


def recompute_centroids(points, old_centroids, n_clusters, assignments):
    new_centroids = np.zeros_like(old_centroids)
    for i in range(n_clusters):
        cluster_points = points[assignments == i]
        if len(cluster_points) == 0:
            # Keep previous centroid if cluster becomes empty.
            new_centroids[i] = old_centroids[i]
        else:
            new_centroids[i] = cluster_points.mean(axis=0)
    return new_centroids


def parse_centroids(raw_centroids, n_clusters):
    if not isinstance(raw_centroids, list) or len(raw_centroids) != n_clusters:
        return None

    parsed = []
    for c in raw_centroids:
        if not isinstance(c, dict):
            return None
        x = c.get("x")
        y = c.get("y")
        if x is None or y is None:
            return None
        try:
            parsed.append([float(x), float(y)])
        except (TypeError, ValueError):
            return None

    return np.array(parsed, dtype=float)


def x_y_ranges(points):
    return [float(points[:, 0].min()), float(points[:, 0].max())], [float(points[:, 1].min()), float(points[:, 1].max())]


def history_response():
    points = kmeans_state["points"]
    latest = kmeans_state["history"][-1]
    x_range, y_range = x_y_ranges(points)
    return jsonify(
        ok=True,
        step=latest["step"],
        points=points.tolist(),
        centroids=latest["centroids"].tolist(),
        assignments=latest["assignments"].tolist(),
        x_range=x_range,
        y_range=y_range,
    )


def ensure_session(dataset, n_clusters):
    if kmeans_state["points"] is not None and dataset == kmeans_state["dataset"] and n_clusters == kmeans_state["n_clusters"]:
        return

    points = load_dataset(dataset)
    if n_clusters < 2 or n_clusters > len(points):
        raise ValueError("Invalid n_clusters")

    centroids = initialize_centroids(points, n_clusters)
    assignments = assign_clusters(points, centroids)
    kmeans_state["dataset"] = dataset
    kmeans_state["n_clusters"] = n_clusters
    kmeans_state["points"] = points
    kmeans_state["history"] = [{"step": 0, "centroids": centroids, "assignments": assignments}]


def run_one_iteration():
    points = kmeans_state["points"]
    n_clusters = kmeans_state["n_clusters"]
    current = kmeans_state["history"][-1]

    current_centroids = current["centroids"]
    assignments_before = assign_clusters(points, current_centroids)
    next_centroids = recompute_centroids(points, current_centroids, n_clusters, assignments_before)
    assignments_after = assign_clusters(points, next_centroids)

    next_entry = {
        "step": current["step"] + 1,
        "centroids": next_centroids,
        "assignments": assignments_after,
    }
    kmeans_state["history"].append(next_entry)

    converged = np.array_equal(assignments_before, assignments_after)
    return next_entry, converged


@app.route("/")
def index():
    return render_template("index.html", datasets=datasets)


@app.route("/api/init", methods=["POST"])
def init_kmeans():
    payload = request.get_json(silent=True) or {}
    dataset = payload.get("dataset")
    n_clusters = int(payload.get("n_clusters", 2))

    if dataset not in datasets:
        return jsonify(ok=False, error="Invalid dataset"), 400

    points = load_dataset(dataset)
    if n_clusters < 2 or n_clusters > len(points):
        return jsonify(ok=False, error="Invalid n_clusters"), 400

    parsed = parse_centroids(payload.get("centroids"), n_clusters)
    centroids = parsed if parsed is not None else initialize_centroids(points, n_clusters)
    assignments = assign_clusters(points, centroids)

    kmeans_state["dataset"] = dataset
    kmeans_state["n_clusters"] = n_clusters
    kmeans_state["points"] = points
    kmeans_state["history"] = [{"step": 0, "centroids": centroids, "assignments": assignments}]

    return history_response()


@app.route("/api/randomize", methods=["POST"])
def randomize_centroids():
    payload = request.get_json(silent=True) or {}
    dataset = payload.get("dataset")
    n_clusters = int(payload.get("n_clusters", 2))

    points = kmeans_state["points"]
    if points is None or dataset != kmeans_state["dataset"] or n_clusters != kmeans_state["n_clusters"]:
        if dataset not in datasets:
            return jsonify(ok=False, error="Invalid dataset"), 400
        points = load_dataset(dataset)
        kmeans_state["dataset"] = dataset
        kmeans_state["n_clusters"] = n_clusters
        kmeans_state["points"] = points

    centroids = initialize_centroids(points, n_clusters)
    assignments = assign_clusters(points, centroids)
    kmeans_state["history"] = [{"step": 0, "centroids": centroids, "assignments": assignments}]

    return history_response()


@app.route("/api/centroids", methods=["POST"])
def update_centroids_manual():
    payload = request.get_json(silent=True) or {}
    dataset = payload.get("dataset")
    n_clusters = int(payload.get("n_clusters", 2))

    points = kmeans_state["points"]
    if points is None or dataset != kmeans_state["dataset"] or n_clusters != kmeans_state["n_clusters"]:
        if dataset not in datasets:
            return jsonify(ok=False, error="Invalid dataset"), 400
        points = load_dataset(dataset)
        kmeans_state["dataset"] = dataset
        kmeans_state["n_clusters"] = n_clusters
        kmeans_state["points"] = points

    parsed = parse_centroids(payload.get("centroids"), n_clusters)
    if parsed is None:
        return jsonify(ok=False, error="Please provide all centroid x/y values"), 400

    assignments = assign_clusters(points, parsed)
    kmeans_state["history"] = [{"step": 0, "centroids": parsed, "assignments": assignments}]

    return history_response()


@app.route("/api/step", methods=["POST"])
def step_forward():
    payload = request.get_json(silent=True) or {}
    dataset = payload.get("dataset")
    n_clusters = int(payload.get("n_clusters", 2))

    if dataset not in datasets:
        return jsonify(ok=False, error="Invalid dataset"), 400

    try:
        ensure_session(dataset, n_clusters)
    except ValueError as e:
        return jsonify(ok=False, error=str(e)), 400

    _, converged = run_one_iteration()

    base = history_response().get_json()
    base["converged"] = converged
    return jsonify(base)


@app.route("/api/back", methods=["POST"])
def step_back():
    payload = request.get_json(silent=True) or {}
    dataset = payload.get("dataset")

    if kmeans_state["points"] is None or dataset != kmeans_state["dataset"]:
        return jsonify(ok=False, error="No initialized session"), 400

    if len(kmeans_state["history"]) > 1:
        kmeans_state["history"].pop()

    return history_response()


@app.route("/api/run", methods=["POST"])
def run_until_converged():
    payload = request.get_json(silent=True) or {}
    dataset = payload.get("dataset")
    n_clusters = int(payload.get("n_clusters", 2))

    if dataset not in datasets:
        return jsonify(ok=False, error="Invalid dataset"), 400

    try:
        ensure_session(dataset, n_clusters)
    except ValueError as e:
        return jsonify(ok=False, error=str(e)), 400

    max_steps = 100
    steps = []
    converged = False

    for _ in range(max_steps):
        entry, converged = run_one_iteration()
        steps.append(
            {
                "step": entry["step"],
                "centroids": entry["centroids"].tolist(),
                "assignments": entry["assignments"].tolist(),
            }
        )
        if converged:
            break

    base = history_response().get_json()
    base["converged"] = converged
    base["steps"] = steps

    return jsonify(base)


@app.route("/api/reset", methods=["POST"])
def reset_kmeans():
    kmeans_state["dataset"] = None
    kmeans_state["n_clusters"] = None
    kmeans_state["points"] = None
    kmeans_state["history"] = []
    return jsonify(ok=True, action="reset", step=0)


if __name__ == "__main__":
    app.run(debug=True)
