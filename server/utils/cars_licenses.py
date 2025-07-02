import pandas as pd

def read_whole_csv(path_document: str) -> list:
    df = pd.read_csv(path_document)
    return df.to_dict(orient='records')

def sort_licenses(path_document: str)-> list:
    df = pd.read_csv(path_document)
    required_columns = ['placa', 'clase', 'marca', 'modelo', 'dueño', 'nivel de conduccion']
    df = df[required_columns] 

    sampled_df = df.sample(n=4, random_state=None)
    result = sampled_df.to_dict(orient='records')
    return result
    

def change_lanes(num_lanes: int, cars_data: list)-> tuple:
    if not cars_data:
        return {"error": "No cars data provided"}, 400
        
    best_driver = None
    best_score = -1
    
    def backtrack(index):
        nonlocal best_driver, best_score
        
        if index >= min(num_lanes, len(cars_data)):
            return
            
        driver = cars_data[index]
        score = driver.get("nivel de conduccion", 0)
        
        if score > best_score:
            best_score = score
            best_driver = {
                "index": index,
                "placa": driver["placa"],
                "dueño": driver["dueño"],
                "nivel de conduccion": score,
                "lane": driver["lane"]
            }
        
        backtrack(index + 1)
    
    backtrack(0)
    
    return cars_data[:num_lanes], [best_driver] if best_driver else []
