import os
import requests
from dotenv import load_dotenv
from datetime import datetime, timezone
from typing import Dict, Optional, Union, List, Tuple

load_dotenv(os.path.join(os.path.dirname(__file__), '..', '..', '.env'))

HERE_API_KEY = os.getenv('HERE_API_KEY')
HERE_API_BASE_URL = 'https://router.hereapi.com/v8/routes'

TRAFFIC_PATTERNS = {
    'weekday': {
        'morning_rush': [7, 8, 9],     
        'evening_rush': [17, 18, 19],  
        'midday': [10, 11, 12, 13, 14, 15, 16],  
        'low_traffic': [0, 1, 2, 3, 4, 5, 6, 20, 21, 22, 23]  
    },
    'weekend': {
        'moderate': [10, 11, 12, 13, 14, 15, 16],  
        'low_traffic': [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 17, 18, 19, 20, 21, 22, 23]  
    }
}

ROAD_TYPE_TRAFFIC = {
    'primary': 2.0,      
    'secondary': 1.5,    
    'residential': 0.8,  
    'tertiary': 1.2      
}

TRAFFIC_MULTIPLIERS = {
    'morning_rush': 1.8,
    'evening_rush': 2.0,
    'midday': 1.2,
    'low_traffic': 0.9,
    'moderate': 1.3,
    'weekend_low_traffic': 0.8
}

def get_route_details(origin: str, destination:str, departure_time: Optional[datetime] = None, transport_mode: str = "car", return_fields: list = ['polyline', 'incidents', 'summary'], spans: list = ['incidents']):
    if not HERE_API_KEY:
        raise ValueError("API KEY not provided or found")

    if departure_time is None:
        departure_time = datetime.now(timezone.utc)
    elif departure_time.tzinfo is None:
        departure_time = departure_time.replace(tzinfo=timezone.utc)

    departure_time_iso = departure_time.isoformat(timespec='seconds')

    params = {
        'origin': origin,
        'destination': destination,
        'transportMode': transport_mode,
        'return': ','.join(return_fields),
        'spans': ','.join(spans),
        'departureTime': departure_time_iso,
        'apiKey': HERE_API_KEY
    }

    try:
        response = requests.get(HERE_API_BASE_URL, params=params, timeout=6000)
        response.raise_for_status() 
        return response.json()
    except requests.exceptions.RequestException as e:
        raise Exception(f"Error making request to HERE API: {str(e)}")
    except ValueError as e:
        raise Exception(f"Error parsing response from HERE API: {str(e)}")

def extract_real_time_traffic_factor(here_response: Dict) -> float:
    try:
        routes = here_response.get('routes', [])
        if not routes or not routes[0].get('sections'):
            return 1.0
        
        section = routes[0]['sections'][0]
        summary = section.get('summary', {})
        
        actual_duration = summary.get('duration', 0)
        base_duration = summary.get('baseDuration', 0)
        
        if base_duration > 0:
            traffic_factor = actual_duration / base_duration
            return traffic_factor
        else:
            return 1.0
            
    except (KeyError, IndexError, ZeroDivisionError):
        return 1.0

def get_route_coordinates_from_records(records: List[Dict]) -> Tuple[str, str]:
    if not records:
        return None, None
    
    first_record = records[0]
    last_record = records[-1]
    
    if 'fromLat' in first_record and 'fromLng' in first_record:
        origin = f"{first_record['fromLat']},{first_record['fromLng']}"
        destination = f"{last_record['toLat']},{last_record['toLng']}"
        return origin, destination
    
    return None, None

def get_traffic_index(target_datetime=None):
    if target_datetime is None:
        target_datetime = datetime.now()
    
    hour = target_datetime.hour
    is_weekend = target_datetime.weekday() >= 5
    
    if is_weekend:
        if hour in TRAFFIC_PATTERNS['weekend']['moderate']:
            return TRAFFIC_MULTIPLIERS['moderate']
        else:
            return TRAFFIC_MULTIPLIERS['weekend_low_traffic']
    else:
        if hour in TRAFFIC_PATTERNS['weekday']['morning_rush']:
            return TRAFFIC_MULTIPLIERS['morning_rush']
        elif hour in TRAFFIC_PATTERNS['weekday']['evening_rush']:
            return TRAFFIC_MULTIPLIERS['evening_rush']
        elif hour in TRAFFIC_PATTERNS['weekday']['midday']:
            return TRAFFIC_MULTIPLIERS['midday']
        else:
            return TRAFFIC_MULTIPLIERS['low_traffic']


def get_road_type_multiplier(road_type):
    return ROAD_TYPE_TRAFFIC.get(road_type, 1.0)

def calculate_approx_time(records, target_datetime=None, use_realtime=True):
    if not records: 
        return "Tiempo no disponible"

    fallback_traffic_multiplier = get_traffic_index(target_datetime)
    realtime_multiplier = 1.0

    if use_realtime:
        try:
            origin, destination = get_route_coordinates_from_records(records)
            if origin and destination:
                here_response = get_route_details(origin, destination, target_datetime)
                realtime_multiplier = extract_real_time_traffic_factor(here_response)
                print(f"Realtime multiplier: {realtime_multiplier}")
            
        except Exception as e:
            print(f"Error al obtener el tiempo real: {str(e)}")

    if realtime_multiplier != 1.0:
        traffic_factor = realtime_multiplier 
    else:
        traffic_factor = fallback_traffic_multiplier
            
    tiempos = []
    for record in records:
        distancia = record.get("distancia_metros", 0)
        velocidad = record.get("velocidadMaxima_kmh", "20")
        tipo_calle = record.get("tipoCalle", "secondary")

        road_multiplier = get_road_type_multiplier(tipo_calle)

        # Distintos tipos de datos en los valores de velocidad :)
        if isinstance(velocidad, list):
            try:
                velocidad = int(str(velocidad[:-1]))
            except (IndexError, ValueError, TypeError):
                velocidad = 20
        elif isinstance(velocidad, str):
            try:
                velocidad = int(velocidad)
            except (ValueError, TypeError):
                velocidad = 20
        elif velocidad is None:
            velocidad = 20

        velocidad_promedio = velocidad * 0.8 if distancia > 5000 else velocidad * 0.6
        tiempo_base = ((distancia/1000) / velocidad_promedio) * 1.15
        
        tiempo_ajustado = tiempo_base * traffic_factor * road_multiplier
        tiempos.append(tiempo_ajustado)

    total_horas = sum(tiempos)
    horas = int(total_horas)
    minutos = int((total_horas - horas) * 60)

    if horas > 0:
        if minutos > 0:
            return f"{horas} hora{'s' if horas > 1 else ''} y {minutos} minuto{'s' if minutos > 1 else ''}"
        return f"{horas} hora{'s' if horas > 1 else ''}"
    elif minutos > 0:
        return f"{minutos} minuto{'s' if minutos > 1 else ''}"
    return "Menos de un minuto"
