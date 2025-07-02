import os
import uvicorn
from pathlib import Path
from fastapi import FastAPI
from pydantic import BaseModel
from dotenv import load_dotenv
from fastapi.middleware.cors import CORSMiddleware
from utils.neo4j_funcs import Neo4jController
from utils.cars_licenses import read_whole_csv, change_lanes

load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))

DATA_PATH = Path(__file__).parent.parent / "data" / "placas_carros.csv"
                        # |-> .parent one directory level up, .parent.parent two directory levels up
NEO4J_URI = os.getenv("NEO4J_URI")
NEO4J_USER = os.getenv("NEO4J_USER")
NEO4J_PASSWORD = os.getenv("NEO4J_PASSWORD")

app = FastAPI()
neo4j_admin = Neo4jController()

origins = [
    "http://localhost:8082",
    "http://127.0.0.1:5500",
    "http://127.0.0.1:5500/"
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["POST", "GET"],
    allow_headers=["*"],
)

class LocationRequest(BaseModel):
    start_location: str
    end_location: str

@app.get("/whole-csv")
def read_whole_csv_endpoint():
    return read_whole_csv(DATA_PATH)

@app.post("/change-lanes")
def change_lanes_endpoint(data: dict):
    num_lanes = data.get("num_lanes", 2)
    cars_data = data.get("cars_data", [])

    processed_cars_data, driver_chosen = change_lanes(num_lanes, cars_data)
    
    return {"cars_in_front": processed_cars_data, "driver_chosen": driver_chosen}

@app.post("/find-similar-address")
def find_similar_address_neo4j(data: dict):
    similar_addresses = neo4j_admin.find_similar_address(data.get("address"))
    return { "similar_addresses": similar_addresses }

@app.post("/shortest-path")
def shortest_path_endpoint(data: LocationRequest):
    return neo4j_admin.find_shortest_path(
        data.start_location,
        data.end_location,
        bellman=True
    )

@app.post("/shortest-path-astar")
def shortest_path_astar_endpoint(data: LocationRequest):
    return neo4j_admin.find_shortest_path(
        data.start_location,
        data.end_location,
        bellman=False
    )

@app.post("/shortest-path-roads")
def shortest_path_just_roads(data: LocationRequest):
    result = neo4j_admin.find_shortest_path(
        data.start_location,
        data.end_location
    )

    # In case the name of the street is a list, we take the first element
    def get_street_name(road):
        name = road.get("nombreCalle")
        if isinstance(name, list) and name:  
            return name[0]
        return name

    roads = list({get_street_name(road) for road in result if get_street_name(road) is not None})
    return { "calles": roads }


if __name__ == "__main__":
    uvicorn.run("server:app", host="0.0.0.0", port=8082, reload=True)