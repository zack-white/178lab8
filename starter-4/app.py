import time

import os
import numpy as np
import pandas as pd
from flask import Flask, render_template, request

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


# example POST request handle
@app.route("/your_route", methods=["POST"])
def your_route_func():
    # parse request sent from the front end
    request_data = request.get_json()
    print("request_data", request_data)

    # return data to front end
    return dict(msg="a", data={"a": 1, "b": 2})


if __name__ == "__main__":
    app.run(debug=True)
