"""
Database Migration & Setup Script
Migrates existing ARC data into multi-tenant structure
"""
import asyncio
import os
import uuid
from datetime import datetime, timezone
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

from auth import hash_password, UserRole
from models import (
    Operator, ClientCompany, Passenger, Driver, Vehicle,
    Trip, TripStatus, PassengerInTrip, VehicleType
)

# Configuration
PLATFORM_OWNER_EMAIL = "devchagass@gmail.com"
PLATFORM_OWNER_PASSWORD = "ArcPlatform2024!"  # Will be shared securely
ARC_OPERATOR_ID = "arc-transporte-001"
ARC_CLIENT_COMPANY_ID = "arc-default-client-001"

async def run_migration():
    """Main migration function"""
    print("=" * 60)
    print("Starting Multi-Tenant Migration")
    print("=" * 60)
    
    client = AsyncIOMotorClient(os.environ['MONGO_URL'])
    db = client[os.environ['DB_NAME']]
    
    # Step 1: Create indexes for multi-tenant queries
    print("\n[1/7] Creating indexes...")
    await create_indexes(db)
    
    # Step 2: Initialize platform settings
    print("\n[2/7] Initializing platform...")
    await init_platform(db)
    
    # Step 3: Create platform owner account
    print("\n[3/7] Creating platform owner account...")
    await create_platform_owner(db)
    
    # Step 4: Create ARC Transporte as first operator
    print("\n[4/7] Creating ARC Transporte operator...")
    await create_arc_operator(db)
    
    # Step 5: Create default client company for ARC
    print("\n[5/7] Creating default client company...")
    await create_default_client_company(db)
    
    # Step 6: Migrate existing employees to passengers
    print("\n[6/7] Migrating employees to passengers...")
    await migrate_employees(db)
    
    # Step 7: Migrate existing drivers
    print("\n[7/7] Migrating drivers...")
    await migrate_drivers(db)
    
    # Step 8: Migrate existing taxi requests to trips
    print("\n[8/8] Migrating taxi requests to trips...")
    await migrate_taxi_requests(db)
    
    print("\n" + "=" * 60)
    print("Migration Complete!")
    print("=" * 60)
    print(f"\nPlatform Owner Login:")
    print(f"  Email: {PLATFORM_OWNER_EMAIL}")
    print(f"  Password: {PLATFORM_OWNER_PASSWORD}")
    print(f"\nARC Operator ID: {ARC_OPERATOR_ID}")
    print(f"Default Client Company ID: {ARC_CLIENT_COMPANY_ID}")
    
    client.close()

async def create_indexes(db):
    """Create indexes for efficient multi-tenant queries"""
    # Users
    await db.users.create_index("email", unique=True)
    await db.users.create_index("operator_id")
    await db.users.create_index("client_company_id")
    await db.users.create_index([("operator_id", 1), ("role", 1)])
    
    # Operators
    await db.operators.create_index("id", unique=True)
    await db.operators.create_index("status")
    
    # Client Companies
    await db.client_companies.create_index("id", unique=True)
    await db.client_companies.create_index("operator_id")
    await db.client_companies.create_index([("operator_id", 1), ("status", 1)])
    
    # Passengers
    await db.passengers.create_index("id", unique=True)
    await db.passengers.create_index([("operator_id", 1), ("client_company_id", 1)])
    await db.passengers.create_index([("operator_id", 1), ("matricula", 1)])
    await db.passengers.create_index("matricula")
    
    # Drivers (new collection)
    await db.drivers_v2.create_index("id", unique=True)
    await db.drivers_v2.create_index("operator_id")
    await db.drivers_v2.create_index([("operator_id", 1), ("status", 1)])
    await db.drivers_v2.create_index("user_id")
    
    # Vehicles
    await db.vehicles.create_index("id", unique=True)
    await db.vehicles.create_index("operator_id")
    await db.vehicles.create_index("plate", unique=True)
    await db.vehicles.create_index([("operator_id", 1), ("status", 1)])
    
    # Trips
    await db.trips.create_index("id", unique=True)
    await db.trips.create_index([("operator_id", 1), ("client_company_id", 1)])
    await db.trips.create_index([("operator_id", 1), ("status", 1)])
    await db.trips.create_index([("operator_id", 1), ("driver_id", 1)])
    await db.trips.create_index([("operator_id", 1), ("scheduled_datetime", 1)])
    await db.trips.create_index("created_at")
    
    print("  ✓ Indexes created")

async def init_platform(db):
    """Initialize platform settings"""
    existing = await db.platform.find_one({"id": "platform"})
    if not existing:
        await db.platform.insert_one({
            "id": "platform",
            "name": "Transportation Management Platform",
            "owner_email": PLATFORM_OWNER_EMAIL,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "settings": {
                "default_language": "pt-BR",
                "default_timezone": "America/Sao_Paulo"
            }
        })
        print("  ✓ Platform initialized")
    else:
        print("  ✓ Platform already exists")

async def create_platform_owner(db):
    """Create the platform owner account"""
    existing = await db.users.find_one({"email": PLATFORM_OWNER_EMAIL})
    if not existing:
        user = {
            "id": str(uuid.uuid4()),
            "email": PLATFORM_OWNER_EMAIL,
            "password_hash": hash_password(PLATFORM_OWNER_PASSWORD),
            "name": "Platform Owner",
            "role": UserRole.PLATFORM_OWNER,
            "operator_id": None,
            "client_company_id": None,
            "phone": "",
            "status": "active",
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat(),
            "last_login": None
        }
        await db.users.insert_one(user)
        print(f"  ✓ Platform owner created: {PLATFORM_OWNER_EMAIL}")
    else:
        print(f"  ✓ Platform owner already exists: {PLATFORM_OWNER_EMAIL}")

async def create_arc_operator(db):
    """Create ARC Transporte as the first operator"""
    existing = await db.operators.find_one({"id": ARC_OPERATOR_ID})
    if not existing:
        operator = {
            "id": ARC_OPERATOR_ID,
            "name": "ARC Transporte",
            "trade_name": "ARC Transporte",
            "tax_id": "",
            "email": "",
            "phone": "",
            "address": "",
            "city": "",
            "state": "",
            "branding": {
                "logo_url": None,
                "primary_color": "#1e3a5f",
                "secondary_color": "#ffffff",
                "favicon_url": None
            },
            "status": "active",
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
        await db.operators.insert_one(operator)
        print(f"  ✓ ARC Transporte operator created: {ARC_OPERATOR_ID}")
        
        # Create operator admin account
        admin_user = {
            "id": str(uuid.uuid4()),
            "email": "admin@arc-transporte.com",
            "password_hash": hash_password("ARC123"),  # Keep old password for compatibility
            "name": "ARC Admin",
            "role": UserRole.OPERATOR_ADMIN,
            "operator_id": ARC_OPERATOR_ID,
            "client_company_id": None,
            "phone": "",
            "status": "active",
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat(),
            "last_login": None
        }
        await db.users.insert_one(admin_user)
        print("  ✓ ARC Admin account created: admin@arc-transporte.com / ARC123")
    else:
        print(f"  ✓ ARC Transporte operator already exists")

async def create_default_client_company(db):
    """Create a default client company for ARC"""
    existing = await db.client_companies.find_one({"id": ARC_CLIENT_COMPANY_ID})
    if not existing:
        company = {
            "id": ARC_CLIENT_COMPANY_ID,
            "operator_id": ARC_OPERATOR_ID,
            "legal_name": "Empresa Padrão ARC",
            "trade_name": "Empresa Padrão",
            "tax_id": "",
            "contacts": [],
            "phone": "",
            "email": "",
            "address": "FIXAR",
            "city": "",
            "state": "",
            "neighborhood": "",
            "default_pickup_address": "FIXAR",
            "notes": "Empresa padrão criada durante migração",
            "status": "active",
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
        await db.client_companies.insert_one(company)
        print(f"  ✓ Default client company created: {ARC_CLIENT_COMPANY_ID}")
    else:
        print(f"  ✓ Default client company already exists")

async def migrate_employees(db):
    """Migrate existing employees to the passengers collection"""
    employees = await db.employees.find({}).to_list(1000)
    
    migrated = 0
    skipped = 0
    
    for emp in employees:
        # Check if already migrated
        existing = await db.passengers.find_one({
            "operator_id": ARC_OPERATOR_ID,
            "matricula": emp.get("matricula", "")
        })
        
        if existing:
            skipped += 1
            continue
        
        passenger = {
            "id": str(uuid.uuid4()),
            "operator_id": ARC_OPERATOR_ID,
            "client_company_id": ARC_CLIENT_COMPANY_ID,
            "matricula": emp.get("matricula", ""),
            "name": emp.get("full_name", emp.get("name", "")),
            "phone": emp.get("phone", ""),
            "email": "",
            "address": emp.get("default_address", emp.get("address", "")),
            "neighborhood": "",
            "city": "",
            "pickup_point": "",
            "notes": "Migrado da tabela employees",
            "status": "active",
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
        await db.passengers.insert_one(passenger)
        migrated += 1
    
    print(f"  ✓ Migrated {migrated} employees to passengers ({skipped} already existed)")

async def migrate_drivers(db):
    """Migrate existing drivers to the new drivers_v2 collection"""
    drivers = await db.drivers.find({}).to_list(100)
    
    migrated = 0
    skipped = 0
    
    for drv in drivers:
        # Check if already migrated
        existing = await db.drivers_v2.find_one({
            "operator_id": ARC_OPERATOR_ID,
            "phone": drv.get("phone", "")
        })
        
        if existing:
            skipped += 1
            continue
        
        driver = {
            "id": drv.get("id", str(uuid.uuid4())),
            "operator_id": ARC_OPERATOR_ID,
            "user_id": None,
            "name": drv.get("name", ""),
            "phone": drv.get("phone", ""),
            "email": "",
            "document": "",
            "license_number": "",
            "license_category": "",
            "license_expiry": "",
            "photo_url": None,
            "authorized_cities": [],
            "availability": {
                "monday": True,
                "tuesday": True,
                "wednesday": True,
                "thursday": True,
                "friday": True,
                "saturday": False,
                "sunday": False,
                "start_time": "06:00",
                "end_time": "22:00"
            },
            "default_vehicle_id": None,
            "status": "available" if drv.get("active", True) else "unavailable",
            "notes": "Migrado da tabela drivers",
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
        await db.drivers_v2.insert_one(driver)
        migrated += 1
    
    print(f"  ✓ Migrated {migrated} drivers to drivers_v2 ({skipped} already existed)")

async def migrate_taxi_requests(db):
    """Migrate existing taxi_requests to the trips collection"""
    requests = await db.taxi_requests.find({}).to_list(1000)
    
    migrated = 0
    skipped = 0
    
    # Status mapping
    status_map = {
        "aguardando": TripStatus.PENDING,
        "confirmado": TripStatus.CONFIRMED,
        "finalizado": TripStatus.COMPLETED,
        "cancelado": TripStatus.CANCELLED
    }
    
    for req in requests:
        # Check if already migrated
        existing = await db.trips.find_one({"id": req.get("id", "")})
        if existing:
            skipped += 1
            continue
        
        # Build passengers list
        passengers = []
        main_p = req.get("main_passenger", {})
        if main_p:
            passengers.append({
                "passenger_id": "",
                "matricula": main_p.get("matricula", ""),
                "name": main_p.get("full_name", ""),
                "phone": main_p.get("phone", ""),
                "address": main_p.get("address", ""),
                "neighborhood": "",
                "city": "",
                "pickup_point": "",
                "stop_order": 0
            })
        
        for idx, add_p in enumerate(req.get("additional_passengers", [])):
            passengers.append({
                "passenger_id": "",
                "matricula": add_p.get("matricula", ""),
                "name": add_p.get("full_name", ""),
                "phone": add_p.get("phone", ""),
                "address": add_p.get("address", ""),
                "neighborhood": "",
                "city": "",
                "pickup_point": "",
                "stop_order": idx + 1
            })
        
        trip = {
            "id": req.get("id", str(uuid.uuid4())),
            "operator_id": ARC_OPERATOR_ID,
            "client_company_id": ARC_CLIENT_COMPANY_ID,
            "requester_name": req.get("requester_name", ""),
            "requester_user_id": None,
            "trip_type": "on_demand",
            "is_scheduled": req.get("is_scheduled", False),
            "scheduled_date": req.get("scheduled_date", ""),
            "scheduled_time": req.get("scheduled_time", ""),
            "scheduled_datetime": req.get("scheduled_datetime", ""),
            "recurrence_pattern": None,
            "origin_type": req.get("origin_type", "fixed"),
            "origin_address": req.get("origin_address", "FIXAR"),
            "origin_neighborhood": "",
            "origin_city": "",
            "origin_lat": None,
            "origin_lng": None,
            "destination_type": req.get("destination_type", "registered"),
            "destination_address": req.get("destination_address", ""),
            "destination_neighborhood": "",
            "destination_city": "",
            "destination_lat": None,
            "destination_lng": None,
            "passengers": passengers,
            "passenger_count": len(passengers),
            "driver_id": req.get("driver_id", ""),
            "driver_name": req.get("driver_name", ""),
            "driver_phone": req.get("driver_phone", ""),
            "vehicle_id": None,
            "vehicle_plate": "",
            "vehicle_type": VehicleType.TAXI,
            "stops": [],
            "status": status_map.get(req.get("status", ""), TripStatus.PENDING),
            "status_history": req.get("status_logs", []),
            "cancellation_reason": req.get("cancellation_reason", ""),
            "created_at": req.get("created_at", datetime.now(timezone.utc).isoformat()),
            "updated_at": req.get("updated_at", datetime.now(timezone.utc).isoformat()),
            "started_at": None,
            "completed_at": req.get("updated_at") if req.get("status") == "finalizado" else None,
            "driver_notes": "",
            "incidents": [],
            "proof_photos": []
        }
        await db.trips.insert_one(trip)
        migrated += 1
    
    print(f"  ✓ Migrated {migrated} taxi requests to trips ({skipped} already existed)")

if __name__ == "__main__":
    asyncio.run(run_migration())
