"""
Business Rules & Validations Module
Server-side validation for trip conflicts, driver availability, vehicle capacity
"""
from datetime import datetime, timezone
from typing import List, Optional, Tuple
from models import TripStatus, VehicleType, DEFAULT_CAPACITIES

class ValidationResult:
    def __init__(self, is_valid: bool = True, errors: List[str] = None, warnings: List[str] = None):
        self.is_valid = is_valid
        self.errors = errors or []
        self.warnings = warnings or []
    
    def add_error(self, error: str):
        self.errors.append(error)
        self.is_valid = False
    
    def add_warning(self, warning: str):
        self.warnings.append(warning)
    
    def to_dict(self):
        return {
            "is_valid": self.is_valid,
            "errors": self.errors,
            "warnings": self.warnings
        }

async def validate_trip_assignment(db, trip_data: dict, driver_id: str = None, vehicle_id: str = None) -> ValidationResult:
    """
    Validate a trip assignment before confirming
    
    Checks:
    - Driver availability
    - Driver authorized for city
    - Vehicle capacity
    - Time conflicts
    - Duplicate passengers
    """
    result = ValidationResult()
    
    # Get trip details
    scheduled_datetime = trip_data.get("scheduled_datetime", "")
    scheduled_date = trip_data.get("scheduled_date", "")
    scheduled_time = trip_data.get("scheduled_time", "")
    passenger_count = trip_data.get("passenger_count", 0)
    city = trip_data.get("origin_city") or trip_data.get("destination_city", "")
    operator_id = trip_data.get("operator_id", "")
    
    # 1. Validate driver if specified
    if driver_id:
        driver = await db.drivers_v2.find_one({"id": driver_id}, {"_id": 0})
        
        if not driver:
            result.add_error(f"Motorista não encontrado")
        else:
            # Check driver status
            if driver.get("status") not in ["available", "on_trip"]:
                result.add_error(f"Motorista '{driver.get('name')}' não está disponível (status: {driver.get('status')})")
            
            # Check authorized cities
            authorized_cities = driver.get("authorized_cities", [])
            if city and authorized_cities and city.lower() not in [c.lower() for c in authorized_cities]:
                result.add_warning(f"Motorista '{driver.get('name')}' não está autorizado para a cidade '{city}'")
            
            # Check time conflicts with other trips
            if scheduled_date and scheduled_time:
                conflict_query = {
                    "driver_id": driver_id,
                    "scheduled_date": scheduled_date,
                    "status": {"$in": [TripStatus.SCHEDULED, TripStatus.CONFIRMED, TripStatus.IN_PROGRESS]},
                    "id": {"$ne": trip_data.get("id", "")}  # Exclude current trip if editing
                }
                conflicting_trips = await db.trips.find(conflict_query, {"_id": 0, "scheduled_time": 1}).to_list(100)
                
                # Check for trips within 1 hour window
                for ct in conflicting_trips:
                    ct_time = ct.get("scheduled_time", "")
                    if ct_time:
                        # Simple time comparison (within same hour)
                        if ct_time[:2] == scheduled_time[:2]:
                            result.add_error(f"Motorista '{driver.get('name')}' já tem viagem agendada para {scheduled_date} às {ct_time}")
                            break
    
    # 2. Validate vehicle if specified
    if vehicle_id:
        vehicle = await db.vehicles.find_one({"id": vehicle_id}, {"_id": 0})
        
        if not vehicle:
            result.add_error("Veículo não encontrado")
        else:
            # Check vehicle status
            if vehicle.get("status") not in ["available", "on_trip"]:
                result.add_error(f"Veículo {vehicle.get('plate')} não está disponível")
            
            # Check capacity
            capacity = vehicle.get("capacity", 4)
            if passenger_count > capacity:
                result.add_error(f"Veículo {vehicle.get('plate')} tem capacidade para {capacity} passageiros, mas foram designados {passenger_count}")
            elif passenger_count == capacity:
                result.add_warning(f"Veículo {vehicle.get('plate')} estará lotado ({passenger_count}/{capacity})")
    
    # 3. Check for duplicate passengers in other active trips
    passengers = trip_data.get("passengers", [])
    for p in passengers:
        if p.get("passenger_id"):
            dup_query = {
                "passengers.passenger_id": p["passenger_id"],
                "scheduled_date": scheduled_date,
                "status": {"$in": [TripStatus.SCHEDULED, TripStatus.CONFIRMED, TripStatus.IN_PROGRESS]},
                "id": {"$ne": trip_data.get("id", "")}
            }
            duplicate = await db.trips.find_one(dup_query, {"_id": 0, "id": 1})
            if duplicate:
                result.add_warning(f"Passageiro '{p.get('name')}' já está em outra viagem ativa para {scheduled_date}")
    
    return result

async def validate_driver_status_change(db, driver_id: str, new_status: str) -> ValidationResult:
    """Validate driver status change"""
    result = ValidationResult()
    
    driver = await db.drivers_v2.find_one({"id": driver_id}, {"_id": 0})
    if not driver:
        result.add_error("Motorista não encontrado")
        return result
    
    current_status = driver.get("status", "")
    
    # Check if driver has active trips when going unavailable
    if new_status in ["unavailable", "day_off", "vacation"]:
        active_trips = await db.trips.find({
            "driver_id": driver_id,
            "status": {"$in": [TripStatus.CONFIRMED, TripStatus.IN_PROGRESS]}
        }, {"_id": 0, "id": 1}).to_list(10)
        
        if active_trips:
            result.add_error(f"Motorista tem {len(active_trips)} viagem(s) ativa(s). Finalize antes de alterar o status.")
    
    return result

async def suggest_vehicle_type(passenger_count: int) -> Tuple[str, int]:
    """Suggest appropriate vehicle type based on passenger count"""
    if passenger_count <= 4:
        return VehicleType.CAR, 4
    elif passenger_count <= 6:
        return VehicleType.VAN, 6
    elif passenger_count <= 15:
        return VehicleType.MINIBUS, 15
    else:
        return VehicleType.BUS, 40

async def get_available_drivers_for_trip(db, operator_id: str, city: str = None, scheduled_date: str = None, scheduled_time: str = None) -> List[dict]:
    """Get list of available drivers for a trip"""
    query = {
        "operator_id": operator_id,
        "status": "available"
    }
    
    drivers = await db.drivers_v2.find(query, {"_id": 0}).to_list(100)
    
    # Filter by city authorization
    if city:
        drivers = [d for d in drivers if not d.get("authorized_cities") or city.lower() in [c.lower() for c in d.get("authorized_cities", [])]]
    
    # Filter by availability (check for conflicts)
    if scheduled_date and scheduled_time:
        available_drivers = []
        for driver in drivers:
            conflict_query = {
                "driver_id": driver["id"],
                "scheduled_date": scheduled_date,
                "status": {"$in": [TripStatus.SCHEDULED, TripStatus.CONFIRMED, TripStatus.IN_PROGRESS]}
            }
            conflicts = await db.trips.find(conflict_query, {"_id": 0, "scheduled_time": 1}).to_list(10)
            
            # Check for time conflicts
            has_conflict = False
            for c in conflicts:
                if c.get("scheduled_time", "")[:2] == scheduled_time[:2]:
                    has_conflict = True
                    break
            
            if not has_conflict:
                available_drivers.append(driver)
        
        drivers = available_drivers
    
    return drivers
