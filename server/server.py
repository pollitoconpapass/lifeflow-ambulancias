import os
import uvicorn
from pathlib import Path
from fastapi import FastAPI
from pydantic import BaseModel
from dotenv import load_dotenv
from utils.neo4j_funcs import Neo4jController
from utils.cars_licenses import sort_licenses, change_lanes

load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))

DATA_PATH = Path(__file__).parent.parent / "data" / "placas_carros.csv"
                        # |-> .parent one directory level up, .parent.parent two directory levels up
NEO4J_URI = os.getenv("NEO4J_URI")
NEO4J_USER = os.getenv("NEO4J_USER")
NEO4J_PASSWORD = os.getenv("NEO4J_PASSWORD")

app = FastAPI()
neo4j_admin = Neo4jController()

class LocationRequest(BaseModel):
    start_location: str
    end_location: str


@app.get("/change-lanes")
def change_lanes_endpoint(data: dict):
    num_lanes = data.get("num_lanes", 2)
    cars_in_front = sort_licenses(DATA_PATH)
    driver_chosen = change_lanes(num_lanes, cars_in_front)
    
    list_cars_in_front = [cars_in_front[i] for i in range(num_lanes)]
    list_driver_chosen = [{"index": driver_chosen[0], "placa": driver_chosen[1], "dueño": driver_chosen[2], "nivel de conduccion": driver_chosen[3]}]

    if driver_chosen == -1:
        return { "cars_in_front": list_cars_in_front, "driver_chosen": [] }

    return { "cars_in_front": list_cars_in_front, "driver_chosen": list_driver_chosen }

@app.get("/find-similar-address")
def find_similar_address_neo4j(data: dict):
    similar_addresses = neo4j_admin.find_similar_address(data.get("address"))
    return { "similar_addresses": similar_addresses }

@app.post("/shortest-path")
def shortest_path_endpoint(data: LocationRequest):
    return neo4j_admin.find_shortest_path(
        data.start_location,
        data.end_location
    )

@app.post("/shortest-path-roads")
def shortest_path_just_roads(data: LocationRequest):
    result = neo4j_admin.find_shortest_path(
        data.start_location,
        data.end_location
    )

    roads = list(dict.fromkeys([road["nombreCalle"] for road in result]))
    return { "calles": roads }


if __name__ == "__main__":
    uvicorn.run("server:app", host="0.0.0.0", port=8082, reload=True)