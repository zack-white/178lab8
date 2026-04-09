from flask import Flask, jsonify, render_template, request

app = Flask(__name__)
datasets = ["blobs", "circles", "lines", "moons", "uniform"]


@app.route("/")
def index():
    return render_template("index.html", datasets=datasets)


@app.route("/api/init", methods=["POST"])
def init_kmeans():
    payload = request.get_json(silent=True) or {}
    return jsonify(ok=True, action="init", received=payload, step=0)


@app.route("/api/randomize", methods=["POST"])
def randomize_centroids():
    payload = request.get_json(silent=True) or {}
    return jsonify(ok=True, action="randomize", received=payload)


@app.route("/api/centroids", methods=["POST"])
def update_centroids():
    payload = request.get_json(silent=True) or {}
    return jsonify(ok=True, action="centroids_updated", received=payload)


@app.route("/api/step", methods=["POST"])
def step_forward():
    payload = request.get_json(silent=True) or {}
    return jsonify(ok=True, action="step", received=payload)


@app.route("/api/back", methods=["POST"])
def step_back():
    payload = request.get_json(silent=True) or {}
    return jsonify(ok=True, action="back", received=payload)


@app.route("/api/run", methods=["POST"])
def run_until_converged():
    payload = request.get_json(silent=True) or {}
    return jsonify(ok=True, action="run", received=payload)


@app.route("/api/reset", methods=["POST"])
def reset_kmeans():
    payload = request.get_json(silent=True) or {}
    return jsonify(ok=True, action="reset", received=payload, step=0)


if __name__ == "__main__":
    app.run(debug=True)
