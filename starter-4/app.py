import time

import os
import numpy as np
import pandas as pd
from flask import Flask, render_template, request
from flask import Flask, jsonify, render_template, request

app = Flask(__name__)
datasets = ["blobs", "circles", "lines", "moons", "uniform"]

# get the points as a numpy array 
def load_dataset(name):
    path = os.path.join("static","datasets", f"{name}.csv")
    df = pd.read_csv(path)
    return df.to_numpy()

def assign_clusters(points, centroids):
    # calculate distances of each point from eahc centroid
    distances = np.linalg.norm(points[:, np.newaxis] - centroids, axis=2)
    # return the centroid that minimizes distance for each point
    return np.argmin(distances, axis=1)

def update_centroids(points, old_centroids, n, assignments):
    new_centroids = []
    #for i in range(n):




# what we will need to pass to front end:
# points
# centroids
# assignment
# iteration 
# dataset
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
