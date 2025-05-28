import pandas as pd


def sort_licenses(path_document: str)-> list:
    df = pd.read_csv(path_document)
    required_columns = ['placa', 'clase', 'marca', 'modelo', 'dueño', 'nivel de conduccion']
    df = df[required_columns] 

    sampled_df = df.sample(n=4, random_state=None)
    result = sampled_df.to_dict(orient='records')
    return result
    

def change_lanes(num_lane: int, cars_in_front: list)-> tuple:
    max_index = -1
    max_score = -1
    max_driver = None

    def backtrack(index):
        nonlocal max_index, max_score, max_driver
        if index >= min(num_lane, len(cars_in_front)):
            return -1

        nivel = cars_in_front[index]['nivel de conduccion']

        if nivel > max_score:
            max_score = nivel
            max_index = index
            max_driver = cars_in_front[index]

        if nivel >= 70:
            return (index, cars_in_front[index]['placa'], cars_in_front[index]['dueño'], cars_in_front[index]['nivel de conduccion'])
        return backtrack(index + 1)

    result = backtrack(0)
    if result == -1:
        return (max_index, max_driver['placa'], max_driver['dueño'], max_driver['nivel de conduccion'])

    return result
