"""
ARC Transportation Platform - Multi-Tenant Backend
Phase 1: Authentication, Multi-tenant structure, Core APIs
"""
from fastapi import FastAPI, APIRouter, HTTPException, Query, UploadFile, File, Depends, Body
from fastapi.responses import StreamingResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional
import uuid
from datetime import datetime, timezone
import asyncio
import json
import csv
import io

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# Import auth and models
from auth import (
    hash_password, verify_password, create_access_token, decode_token,
    get_current_user, get_current_user_optional, require_roles,
    UserRole, UserCreate, UserLogin, UserResponse, filter_by_tenant,
    can_access_operator, can_access_client_company
)
from models import (
    Operator, OperatorCreate, OperatorBranding,
    ClientCompany, ClientCompanyCreate, ClientCompanyContact,
    Passenger, PassengerCreate, PassengerInTrip,
    Driver, DriverCreate, DriverAvailability,
    Vehicle, VehicleCreate, VehicleType, DEFAULT_CAPACITIES,
    Trip, TripCreate, TripStatus, TripStop
)

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app
app = FastAPI(title="ARC Transportation Platform", version="2.0.0")

# Create routers
api_router = APIRouter(prefix="/api")
auth_router = APIRouter(prefix="/api/auth", tags=["Authentication"])
operators_router = APIRouter(prefix="/api/operators", tags=["Operators"])
companies_router = APIRouter(prefix="/api/companies", tags=["Client Companies"])
passengers_router = APIRouter(prefix="/api/passengers", tags=["Passengers"])
drivers_router = APIRouter(prefix="/api/drivers", tags=["Drivers"])
vehicles_router = APIRouter(prefix="/api/vehicles", tags=["Vehicles"])
trips_router = APIRouter(prefix="/api/trips", tags=["Trips"])
legacy_router = APIRouter(prefix="/api", tags=["Legacy Compatibility"])

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Constants
ARC_OPERATOR_ID = "arc-transporte-001"
ARC_CLIENT_COMPANY_ID = "arc-default-client-001"

# ==================== SSE EVENT TRACKING ====================

request_events = asyncio.Queue()

async def notify_clients(event_type: str, data: dict):
    """Push event to SSE queue"""
    await request_events.put({"type": event_type, "data": data})

# ==================== AUTHENTICATION ROUTES ====================

@auth_router.post("/register")
async def register_user(user_data: UserCreate, current_user: dict = Depends(get_current_user)):
    """Register a new user (requires appropriate permissions)"""
    # Only platform owner can create operator admins
    # Only platform owner or operator admin can create client users
    if user_data.role == UserRole.PLATFORM_OWNER:
        raise HTTPException(status_code=403, detail="Não é possível criar outro proprietário da plataforma")
    
    if user_data.role == UserRole.OPERATOR_ADMIN and current_user["role"] != UserRole.PLATFORM_OWNER:
        raise HTTPException(status_code=403, detail="Apenas o proprietário da plataforma pode criar admins de operadores")
    
    if user_data.role in [UserRole.CLIENT_ADMIN, UserRole.CLIENT_USER]:
        if current_user["role"] not in [UserRole.PLATFORM_OWNER, UserRole.OPERATOR_ADMIN]:
            raise HTTPException(status_code=403, detail="Permissão insuficiente")
        # Ensure operator_id matches for operator admins
        if current_user["role"] == UserRole.OPERATOR_ADMIN:
            if user_data.operator_id != current_user["operator_id"]:
                raise HTTPException(status_code=403, detail="Não pode criar usuários para outro operador")
    
    # Check if email already exists
    existing = await db.users.find_one({"email": user_data.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email já cadastrado")
    
    # Create user
    user = {
        "id": str(uuid.uuid4()),
        "email": user_data.email,
        "password_hash": hash_password(user_data.password),
        "name": user_data.name,
        "role": user_data.role,
        "operator_id": user_data.operator_id,
        "client_company_id": user_data.client_company_id,
        "phone": user_data.phone or "",
        "status": "active",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "last_login": None
    }
    await db.users.insert_one(user)
    
    return {"message": "Usuário criado com sucesso", "user_id": user["id"]}

@auth_router.post("/login")
async def login(credentials: UserLogin):
    """Login and get JWT token"""
    user = await db.users.find_one({"email": credentials.email})
    if not user:
        raise HTTPException(status_code=401, detail="Credenciais inválidas")
    
    if not verify_password(credentials.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Credenciais inválidas")
    
    if user.get("status") != "active":
        raise HTTPException(status_code=403, detail="Conta inativa ou suspensa")
    
    # Update last login
    await db.users.update_one(
        {"id": user["id"]},
        {"$set": {"last_login": datetime.now(timezone.utc).isoformat()}}
    )
    
    # Get operator and client company names
    operator_name = None
    client_company_name = None
    
    if user.get("operator_id"):
        operator = await db.operators.find_one({"id": user["operator_id"]})
        operator_name = operator.get("name") if operator else None
    
    if user.get("client_company_id"):
        company = await db.client_companies.find_one({"id": user["client_company_id"]})
        client_company_name = company.get("legal_name") if company else None
    
    token = create_access_token(user)
    
    return {
        "token": token,
        "user": {
            "id": user["id"],
            "email": user["email"],
            "name": user["name"],
            "role": user["role"],
            "operator_id": user.get("operator_id"),
            "client_company_id": user.get("client_company_id"),
            "operator_name": operator_name,
            "client_company_name": client_company_name
        }
    }

@auth_router.get("/me")
async def get_current_user_info(current_user: dict = Depends(get_current_user)):
    """Get current user information"""
    user = await db.users.find_one({"id": current_user["user_id"]}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")
    
    # Get operator and client company names
    if user.get("operator_id"):
        operator = await db.operators.find_one({"id": user["operator_id"]})
        user["operator_name"] = operator.get("name") if operator else None
    
    if user.get("client_company_id"):
        company = await db.client_companies.find_one({"id": user["client_company_id"]})
        user["client_company_name"] = company.get("legal_name") if company else None
    
    return user

@auth_router.post("/change-password")
async def change_password(
    old_password: str = Body(...),
    new_password: str = Body(...),
    current_user: dict = Depends(get_current_user)
):
    """Change user password"""
    user = await db.users.find_one({"id": current_user["user_id"]})
    if not user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")
    
    if not verify_password(old_password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Senha atual incorreta")
    
    await db.users.update_one(
        {"id": current_user["user_id"]},
        {"$set": {
            "password_hash": hash_password(new_password),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    return {"message": "Senha alterada com sucesso"}

# ==================== OPERATORS ROUTES ====================

@operators_router.get("")
async def list_operators(current_user: dict = Depends(get_current_user)):
    """List operators (platform owner sees all, others see their own)"""
    if current_user["role"] == UserRole.PLATFORM_OWNER:
        operators = await db.operators.find({}, {"_id": 0}).to_list(100)
    else:
        operators = await db.operators.find(
            {"id": current_user.get("operator_id")}, {"_id": 0}
        ).to_list(1)
    return operators

@operators_router.post("")
async def create_operator(
    data: OperatorCreate,
    current_user: dict = Depends(require_roles([UserRole.PLATFORM_OWNER]))
):
    """Create a new operator (platform owner only)"""
    operator = Operator(
        name=data.name,
        trade_name=data.trade_name,
        tax_id=data.tax_id,
        email=data.email,
        phone=data.phone,
        address=data.address,
        city=data.city,
        state=data.state,
        branding=data.branding or OperatorBranding()
    )
    await db.operators.insert_one(operator.model_dump())
    return operator

@operators_router.get("/{operator_id}")
async def get_operator(operator_id: str, current_user: dict = Depends(get_current_user)):
    """Get operator details"""
    if not can_access_operator(current_user, operator_id):
        raise HTTPException(status_code=403, detail="Acesso negado")
    
    operator = await db.operators.find_one({"id": operator_id}, {"_id": 0})
    if not operator:
        raise HTTPException(status_code=404, detail="Operador não encontrado")
    return operator

@operators_router.put("/{operator_id}")
async def update_operator(
    operator_id: str,
    data: OperatorCreate,
    current_user: dict = Depends(get_current_user)
):
    """Update operator"""
    if current_user["role"] not in [UserRole.PLATFORM_OWNER, UserRole.OPERATOR_ADMIN]:
        raise HTTPException(status_code=403, detail="Permissão insuficiente")
    
    if current_user["role"] == UserRole.OPERATOR_ADMIN and current_user.get("operator_id") != operator_id:
        raise HTTPException(status_code=403, detail="Não pode editar outro operador")
    
    update_data = data.model_dump(exclude_unset=True)
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    result = await db.operators.update_one({"id": operator_id}, {"$set": update_data})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Operador não encontrado")
    
    return {"message": "Operador atualizado"}

# ==================== CLIENT COMPANIES ROUTES ====================

@companies_router.get("")
async def list_client_companies(
    current_user: dict = Depends(get_current_user),
    operator_id: Optional[str] = None
):
    """List client companies with tenant filtering"""
    query = filter_by_tenant(current_user, {})
    
    if operator_id and current_user["role"] == UserRole.PLATFORM_OWNER:
        query["operator_id"] = operator_id
    
    companies = await db.client_companies.find(query, {"_id": 0}).to_list(500)
    return companies

@companies_router.post("")
async def create_client_company(
    data: ClientCompanyCreate,
    current_user: dict = Depends(require_roles([UserRole.PLATFORM_OWNER, UserRole.OPERATOR_ADMIN]))
):
    """Create a new client company"""
    # Operator admins can only create for their operator
    if current_user["role"] == UserRole.OPERATOR_ADMIN:
        if data.operator_id != current_user.get("operator_id"):
            raise HTTPException(status_code=403, detail="Não pode criar empresa para outro operador")
    
    company = ClientCompany(
        operator_id=data.operator_id,
        legal_name=data.legal_name,
        trade_name=data.trade_name,
        tax_id=data.tax_id,
        contacts=[ClientCompanyContact(**c.model_dump()) for c in data.contacts] if data.contacts else [],
        phone=data.phone,
        email=data.email,
        address=data.address,
        city=data.city,
        state=data.state,
        neighborhood=data.neighborhood,
        default_pickup_address=data.default_pickup_address,
        notes=data.notes
    )
    await db.client_companies.insert_one(company.model_dump())
    return company

@companies_router.get("/{company_id}")
async def get_client_company(company_id: str, current_user: dict = Depends(get_current_user)):
    """Get client company details"""
    company = await db.client_companies.find_one({"id": company_id}, {"_id": 0})
    if not company:
        raise HTTPException(status_code=404, detail="Empresa não encontrada")
    
    if not can_access_client_company(current_user, company_id):
        # Check if operator admin can access
        if current_user["role"] == UserRole.OPERATOR_ADMIN:
            if company.get("operator_id") != current_user.get("operator_id"):
                raise HTTPException(status_code=403, detail="Acesso negado")
        else:
            raise HTTPException(status_code=403, detail="Acesso negado")
    
    return company

@companies_router.put("/{company_id}")
async def update_client_company(
    company_id: str,
    data: ClientCompanyCreate,
    current_user: dict = Depends(require_roles([UserRole.PLATFORM_OWNER, UserRole.OPERATOR_ADMIN, UserRole.CLIENT_ADMIN]))
):
    """Update client company"""
    company = await db.client_companies.find_one({"id": company_id})
    if not company:
        raise HTTPException(status_code=404, detail="Empresa não encontrada")
    
    # Check permissions
    if current_user["role"] == UserRole.OPERATOR_ADMIN:
        if company.get("operator_id") != current_user.get("operator_id"):
            raise HTTPException(status_code=403, detail="Não pode editar empresa de outro operador")
    elif current_user["role"] == UserRole.CLIENT_ADMIN:
        if current_user.get("client_company_id") != company_id:
            raise HTTPException(status_code=403, detail="Não pode editar outra empresa")
    
    update_data = data.model_dump(exclude_unset=True)
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.client_companies.update_one({"id": company_id}, {"$set": update_data})
    return {"message": "Empresa atualizada"}

# ==================== PASSENGERS ROUTES ====================

@passengers_router.get("")
async def list_passengers(
    current_user: dict = Depends(get_current_user),
    client_company_id: Optional[str] = None,
    search: Optional[str] = None
):
    """List passengers with tenant filtering"""
    query = filter_by_tenant(current_user, {})
    
    if client_company_id:
        query["client_company_id"] = client_company_id
    
    if search:
        query["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"matricula": {"$regex": search, "$options": "i"}},
            {"phone": {"$regex": search, "$options": "i"}}
        ]
    
    passengers = await db.passengers.find(query, {"_id": 0}).to_list(1000)
    return passengers

@passengers_router.get("/search")
async def search_passenger(
    matricula: str = Query(...),
    current_user: dict = Depends(get_current_user_optional)
):
    """Search passenger by matricula (public for legacy compatibility)"""
    query = {"matricula": matricula}
    
    # If authenticated, filter by tenant
    if current_user:
        query = filter_by_tenant(current_user, query)
    else:
        # Legacy: default to ARC operator
        query["operator_id"] = ARC_OPERATOR_ID
    
    passenger = await db.passengers.find_one(query, {"_id": 0})
    if not passenger:
        raise HTTPException(status_code=404, detail="Funcionário não encontrado")
    
    # Return legacy format for compatibility
    return {
        "matricula": passenger.get("matricula", ""),
        "full_name": passenger.get("name", ""),
        "default_address": passenger.get("address", ""),
        "phone": passenger.get("phone", ""),
        "id": passenger.get("id", "")
    }

@passengers_router.post("")
async def create_passenger(
    data: PassengerCreate,
    current_user: dict = Depends(require_roles([UserRole.PLATFORM_OWNER, UserRole.OPERATOR_ADMIN, UserRole.CLIENT_ADMIN]))
):
    """Create a new passenger"""
    # Get client company to determine operator_id
    company = await db.client_companies.find_one({"id": data.client_company_id})
    if not company:
        raise HTTPException(status_code=404, detail="Empresa não encontrada")
    
    # Check permissions
    if current_user["role"] == UserRole.OPERATOR_ADMIN:
        if company.get("operator_id") != current_user.get("operator_id"):
            raise HTTPException(status_code=403, detail="Empresa pertence a outro operador")
    elif current_user["role"] == UserRole.CLIENT_ADMIN:
        if current_user.get("client_company_id") != data.client_company_id:
            raise HTTPException(status_code=403, detail="Não pode criar passageiro para outra empresa")
    
    passenger = Passenger(
        operator_id=company["operator_id"],
        client_company_id=data.client_company_id,
        matricula=data.matricula,
        name=data.name,
        phone=data.phone,
        email=data.email,
        address=data.address,
        neighborhood=data.neighborhood,
        city=data.city,
        pickup_point=data.pickup_point,
        notes=data.notes
    )
    await db.passengers.insert_one(passenger.model_dump())
    return passenger

@passengers_router.put("/{passenger_id}")
async def update_passenger(
    passenger_id: str,
    data: PassengerCreate,
    current_user: dict = Depends(require_roles([UserRole.PLATFORM_OWNER, UserRole.OPERATOR_ADMIN, UserRole.CLIENT_ADMIN]))
):
    """Update passenger"""
    passenger = await db.passengers.find_one({"id": passenger_id})
    if not passenger:
        raise HTTPException(status_code=404, detail="Passageiro não encontrado")
    
    # Check permissions
    if current_user["role"] == UserRole.OPERATOR_ADMIN:
        if passenger.get("operator_id") != current_user.get("operator_id"):
            raise HTTPException(status_code=403, detail="Passageiro pertence a outro operador")
    elif current_user["role"] == UserRole.CLIENT_ADMIN:
        if current_user.get("client_company_id") != passenger.get("client_company_id"):
            raise HTTPException(status_code=403, detail="Não pode editar passageiro de outra empresa")
    
    update_data = data.model_dump(exclude_unset=True)
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.passengers.update_one({"id": passenger_id}, {"$set": update_data})
    return {"message": "Passageiro atualizado"}

@passengers_router.post("/upload-csv")
async def upload_passengers_csv(
    file: UploadFile = File(...),
    client_company_id: str = Query(...),
    replace: bool = False,
    current_user: dict = Depends(require_roles([UserRole.PLATFORM_OWNER, UserRole.OPERATOR_ADMIN, UserRole.CLIENT_ADMIN]))
):
    """Upload CSV to import passengers"""
    # Get company
    company = await db.client_companies.find_one({"id": client_company_id})
    if not company:
        raise HTTPException(status_code=404, detail="Empresa não encontrada")
    
    # Check permissions
    if current_user["role"] == UserRole.OPERATOR_ADMIN:
        if company.get("operator_id") != current_user.get("operator_id"):
            raise HTTPException(status_code=403, detail="Empresa pertence a outro operador")
    elif current_user["role"] == UserRole.CLIENT_ADMIN:
        if current_user.get("client_company_id") != client_company_id:
            raise HTTPException(status_code=403, detail="Não pode importar para outra empresa")
    
    if not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="Arquivo deve ser CSV")
    
    try:
        contents = await file.read()
        try:
            decoded = contents.decode('utf-8')
        except UnicodeDecodeError:
            decoded = contents.decode('latin-1')
        
        reader = csv.DictReader(io.StringIO(decoded))
        passengers = []
        errors = []
        row_num = 1
        
        for row in reader:
            row_num += 1
            normalized = {k.lower().strip(): v.strip() if v else "" for k, v in row.items() if k}
            
            matricula = normalized.get('matricula') or normalized.get('matrícula') or normalized.get('id') or ""
            name = normalized.get('name') or normalized.get('nome') or normalized.get('full_name') or ""
            phone = normalized.get('phone') or normalized.get('telefone') or normalized.get('tel') or ""
            address = normalized.get('address') or normalized.get('endereco') or normalized.get('endereço') or ""
            neighborhood = normalized.get('neighborhood') or normalized.get('bairro') or ""
            city = normalized.get('city') or normalized.get('cidade') or ""
            
            if not name:
                errors.append(f"Linha {row_num}: Nome não encontrado")
                continue
            
            passengers.append({
                "id": str(uuid.uuid4()),
                "operator_id": company["operator_id"],
                "client_company_id": client_company_id,
                "matricula": matricula,
                "name": name,
                "phone": phone,
                "email": "",
                "address": address,
                "neighborhood": neighborhood,
                "city": city,
                "pickup_point": "",
                "notes": "",
                "status": "active",
                "created_at": datetime.now(timezone.utc).isoformat(),
                "updated_at": datetime.now(timezone.utc).isoformat()
            })
        
        if not passengers:
            raise HTTPException(status_code=400, detail=f"Nenhum passageiro válido. Erros: {'; '.join(errors)}")
        
        if replace:
            await db.passengers.delete_many({"client_company_id": client_company_id})
            await db.passengers.insert_many(passengers)
            action = "substituídos"
        else:
            for p in passengers:
                await db.passengers.update_one(
                    {"client_company_id": client_company_id, "matricula": p["matricula"]},
                    {"$set": p},
                    upsert=True
                )
            action = "importados/atualizados"
        
        return {
            "success": True,
            "message": f"{len(passengers)} passageiros {action}",
            "imported_count": len(passengers),
            "errors": errors if errors else None
        }
    except Exception as e:
        logger.error(f"CSV upload error: {e}")
        raise HTTPException(status_code=400, detail=f"Erro ao processar CSV: {str(e)}")

# ==================== DRIVERS ROUTES ====================

@drivers_router.get("")
async def list_drivers(
    current_user: dict = Depends(get_current_user),
    status: Optional[str] = None,
    active_only: bool = True
):
    """List drivers with tenant filtering"""
    query = filter_by_tenant(current_user, {})
    
    # Remove client_company_id from query since drivers belong to operators, not companies
    query.pop("client_company_id", None)
    
    if status:
        query["status"] = status
    elif active_only:
        query["status"] = {"$in": ["available", "on_trip"]}
    
    drivers = await db.drivers_v2.find(query, {"_id": 0}).to_list(200)
    return drivers

@drivers_router.post("")
async def create_driver(
    data: DriverCreate,
    current_user: dict = Depends(require_roles([UserRole.PLATFORM_OWNER, UserRole.OPERATOR_ADMIN]))
):
    """Create a new driver"""
    operator_id = current_user.get("operator_id")
    if current_user["role"] == UserRole.PLATFORM_OWNER:
        # Platform owner must specify operator_id in request body or query
        if not operator_id:
            raise HTTPException(status_code=400, detail="operator_id é obrigatório")
    
    driver = Driver(
        operator_id=operator_id,
        name=data.name,
        phone=data.phone,
        email=data.email,
        document=data.document,
        license_number=data.license_number,
        license_category=data.license_category,
        license_expiry=data.license_expiry,
        authorized_cities=data.authorized_cities,
        availability=data.availability or DriverAvailability(),
        default_vehicle_id=data.default_vehicle_id,
        notes=data.notes
    )
    await db.drivers_v2.insert_one(driver.model_dump())
    return driver

@drivers_router.get("/{driver_id}")
async def get_driver(driver_id: str, current_user: dict = Depends(get_current_user)):
    """Get driver details"""
    driver = await db.drivers_v2.find_one({"id": driver_id}, {"_id": 0})
    if not driver:
        raise HTTPException(status_code=404, detail="Motorista não encontrado")
    
    if not can_access_operator(current_user, driver.get("operator_id", "")):
        raise HTTPException(status_code=403, detail="Acesso negado")
    
    return driver

@drivers_router.put("/{driver_id}")
async def update_driver(
    driver_id: str,
    data: DriverCreate,
    current_user: dict = Depends(require_roles([UserRole.PLATFORM_OWNER, UserRole.OPERATOR_ADMIN]))
):
    """Update driver"""
    driver = await db.drivers_v2.find_one({"id": driver_id})
    if not driver:
        raise HTTPException(status_code=404, detail="Motorista não encontrado")
    
    if current_user["role"] == UserRole.OPERATOR_ADMIN:
        if driver.get("operator_id") != current_user.get("operator_id"):
            raise HTTPException(status_code=403, detail="Motorista pertence a outro operador")
    
    update_data = data.model_dump(exclude_unset=True)
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.drivers_v2.update_one({"id": driver_id}, {"$set": update_data})
    return {"message": "Motorista atualizado"}

@drivers_router.put("/{driver_id}/status")
async def update_driver_status(
    driver_id: str,
    status: str = Body(..., embed=True),
    current_user: dict = Depends(require_roles([UserRole.PLATFORM_OWNER, UserRole.OPERATOR_ADMIN, UserRole.DRIVER]))
):
    """Update driver status"""
    driver = await db.drivers_v2.find_one({"id": driver_id})
    if not driver:
        raise HTTPException(status_code=404, detail="Motorista não encontrado")
    
    # Drivers can only update their own status
    if current_user["role"] == UserRole.DRIVER:
        if driver.get("user_id") != current_user["user_id"]:
            raise HTTPException(status_code=403, detail="Só pode atualizar seu próprio status")
    elif current_user["role"] == UserRole.OPERATOR_ADMIN:
        if driver.get("operator_id") != current_user.get("operator_id"):
            raise HTTPException(status_code=403, detail="Motorista pertence a outro operador")
    
    valid_statuses = ["available", "on_trip", "unavailable", "day_off", "vacation"]
    if status not in valid_statuses:
        raise HTTPException(status_code=400, detail=f"Status inválido. Use: {', '.join(valid_statuses)}")
    
    await db.drivers_v2.update_one(
        {"id": driver_id},
        {"$set": {"status": status, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    return {"message": "Status atualizado"}

@drivers_router.post("/upload-csv")
async def upload_drivers_csv(
    file: UploadFile = File(...),
    replace: bool = False,
    current_user: dict = Depends(require_roles([UserRole.PLATFORM_OWNER, UserRole.OPERATOR_ADMIN]))
):
    """Upload CSV to import drivers"""
    operator_id = current_user.get("operator_id")
    if current_user["role"] == UserRole.PLATFORM_OWNER and not operator_id:
        raise HTTPException(status_code=400, detail="operator_id é obrigatório para importar motoristas")
    
    if not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="Arquivo deve ser CSV")
    
    try:
        contents = await file.read()
        try:
            decoded = contents.decode('utf-8')
        except UnicodeDecodeError:
            decoded = contents.decode('latin-1')
        
        reader = csv.DictReader(io.StringIO(decoded))
        drivers = []
        errors = []
        row_num = 1
        
        for row in reader:
            row_num += 1
            normalized = {k.lower().strip(): v.strip() if v else "" for k, v in row.items() if k}
            
            name = normalized.get('name') or normalized.get('nome') or normalized.get('motorista') or ""
            phone = normalized.get('phone') or normalized.get('telefone') or normalized.get('tel') or ""
            
            if not name:
                errors.append(f"Linha {row_num}: Nome não encontrado")
                continue
            
            drivers.append({
                "id": str(uuid.uuid4()),
                "operator_id": operator_id,
                "user_id": None,
                "name": name,
                "phone": phone,
                "email": "",
                "document": "",
                "license_number": "",
                "license_category": "",
                "license_expiry": "",
                "photo_url": None,
                "authorized_cities": [],
                "availability": {
                    "monday": True, "tuesday": True, "wednesday": True,
                    "thursday": True, "friday": True, "saturday": False, "sunday": False,
                    "start_time": "06:00", "end_time": "22:00"
                },
                "default_vehicle_id": None,
                "status": "available",
                "notes": "",
                "created_at": datetime.now(timezone.utc).isoformat(),
                "updated_at": datetime.now(timezone.utc).isoformat()
            })
        
        if not drivers:
            raise HTTPException(status_code=400, detail=f"Nenhum motorista válido. Erros: {'; '.join(errors)}")
        
        if replace:
            await db.drivers_v2.delete_many({"operator_id": operator_id})
        
        await db.drivers_v2.insert_many(drivers)
        
        return {
            "success": True,
            "message": f"{len(drivers)} motoristas importados",
            "imported_count": len(drivers),
            "errors": errors if errors else None
        }
    except Exception as e:
        logger.error(f"Drivers CSV upload error: {e}")
        raise HTTPException(status_code=400, detail=f"Erro ao processar CSV: {str(e)}")

# ==================== VEHICLES ROUTES ====================

@vehicles_router.get("")
async def list_vehicles(
    current_user: dict = Depends(get_current_user),
    status: Optional[str] = None
):
    """List vehicles with tenant filtering"""
    query = filter_by_tenant(current_user, {})
    query.pop("client_company_id", None)  # Vehicles belong to operators
    
    if status:
        query["status"] = status
    
    vehicles = await db.vehicles.find(query, {"_id": 0}).to_list(200)
    return vehicles

@vehicles_router.post("")
async def create_vehicle(
    data: VehicleCreate,
    current_user: dict = Depends(require_roles([UserRole.PLATFORM_OWNER, UserRole.OPERATOR_ADMIN]))
):
    """Create a new vehicle"""
    operator_id = current_user.get("operator_id")
    if current_user["role"] == UserRole.PLATFORM_OWNER and not operator_id:
        raise HTTPException(status_code=400, detail="operator_id é obrigatório")
    
    # Check for duplicate plate
    existing = await db.vehicles.find_one({"plate": data.plate.upper()})
    if existing:
        raise HTTPException(status_code=400, detail="Placa já cadastrada")
    
    # Set default capacity if not provided
    capacity = data.capacity
    if capacity is None:
        capacity = DEFAULT_CAPACITIES.get(data.vehicle_type, 4)
    
    vehicle = Vehicle(
        operator_id=operator_id,
        brand=data.brand,
        model=data.model,
        plate=data.plate.upper(),
        vehicle_type=data.vehicle_type,
        capacity=capacity,
        color=data.color,
        year=data.year,
        primary_driver_id=data.primary_driver_id,
        notes=data.notes
    )
    await db.vehicles.insert_one(vehicle.model_dump())
    return vehicle

@vehicles_router.get("/{vehicle_id}")
async def get_vehicle(vehicle_id: str, current_user: dict = Depends(get_current_user)):
    """Get vehicle details"""
    vehicle = await db.vehicles.find_one({"id": vehicle_id}, {"_id": 0})
    if not vehicle:
        raise HTTPException(status_code=404, detail="Veículo não encontrado")
    
    if not can_access_operator(current_user, vehicle.get("operator_id", "")):
        raise HTTPException(status_code=403, detail="Acesso negado")
    
    return vehicle

@vehicles_router.put("/{vehicle_id}")
async def update_vehicle(
    vehicle_id: str,
    data: VehicleCreate,
    current_user: dict = Depends(require_roles([UserRole.PLATFORM_OWNER, UserRole.OPERATOR_ADMIN]))
):
    """Update vehicle"""
    vehicle = await db.vehicles.find_one({"id": vehicle_id})
    if not vehicle:
        raise HTTPException(status_code=404, detail="Veículo não encontrado")
    
    if current_user["role"] == UserRole.OPERATOR_ADMIN:
        if vehicle.get("operator_id") != current_user.get("operator_id"):
            raise HTTPException(status_code=403, detail="Veículo pertence a outro operador")
    
    update_data = data.model_dump(exclude_unset=True)
    if "plate" in update_data:
        update_data["plate"] = update_data["plate"].upper()
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.vehicles.update_one({"id": vehicle_id}, {"$set": update_data})
    return {"message": "Veículo atualizado"}

# ==================== TRIPS ROUTES ====================

@trips_router.get("")
async def list_trips(
    current_user: dict = Depends(get_current_user),
    status: Optional[str] = None,
    client_company_id: Optional[str] = None,
    driver_id: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    scheduled: Optional[bool] = None
):
    """List trips with tenant filtering"""
    query = filter_by_tenant(current_user, {})
    
    if status:
        query["status"] = status
    if client_company_id:
        query["client_company_id"] = client_company_id
    if driver_id:
        query["driver_id"] = driver_id
    if scheduled is not None:
        query["is_scheduled"] = scheduled
    if start_date:
        query["created_at"] = {"$gte": start_date + "T00:00:00"}
    if end_date:
        if "created_at" in query:
            query["created_at"]["$lte"] = end_date + "T23:59:59"
        else:
            query["created_at"] = {"$lte": end_date + "T23:59:59"}
    
    trips = await db.trips.find(query, {"_id": 0}).sort("created_at", -1).to_list(500)
    return trips

@trips_router.get("/active")
async def list_active_trips(current_user: dict = Depends(get_current_user_optional)):
    """List active trips (for tracking page)"""
    query = {"status": {"$in": [TripStatus.PENDING, TripStatus.SCHEDULED, TripStatus.CONFIRMED, TripStatus.IN_PROGRESS]}}
    
    if current_user:
        query = filter_by_tenant(current_user, query)
    else:
        # Legacy: default to ARC
        query["operator_id"] = ARC_OPERATOR_ID
    
    trips = await db.trips.find(query, {"_id": 0}).sort("created_at", -1).to_list(100)
    return trips

@trips_router.post("")
async def create_trip(
    data: TripCreate,
    current_user: dict = Depends(get_current_user_optional)
):
    """Create a new trip"""
    # Get client company
    company = await db.client_companies.find_one({"id": data.client_company_id})
    if not company:
        # Legacy: use default ARC company
        company = await db.client_companies.find_one({"id": ARC_CLIENT_COMPANY_ID})
        if not company:
            raise HTTPException(status_code=404, detail="Empresa não encontrada")
    
    scheduled_datetime = ""
    if data.is_scheduled and data.scheduled_date and data.scheduled_time:
        scheduled_datetime = f"{data.scheduled_date}T{data.scheduled_time}:00"
    
    trip = Trip(
        operator_id=company["operator_id"],
        client_company_id=company["id"],
        requester_name=data.requester_name,
        requester_user_id=current_user["user_id"] if current_user else None,
        trip_type=data.trip_type,
        is_scheduled=data.is_scheduled,
        scheduled_date=data.scheduled_date,
        scheduled_time=data.scheduled_time,
        scheduled_datetime=scheduled_datetime,
        origin_type=data.origin_type,
        origin_address=data.origin_address or company.get("default_pickup_address", ""),
        origin_city=data.origin_city,
        destination_type=data.destination_type,
        destination_address=data.destination_address,
        destination_city=data.destination_city,
        passengers=data.passengers,
        passenger_count=len(data.passengers),
        status=TripStatus.PENDING,
        status_history=[{
            "status": TripStatus.PENDING,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "changed_by": "system",
            "notes": "Viagem criada"
        }]
    )
    
    await db.trips.insert_one(trip.model_dump())
    await notify_clients("new_trip", trip.model_dump())
    
    return trip

@trips_router.get("/{trip_id}")
async def get_trip(trip_id: str, current_user: dict = Depends(get_current_user_optional)):
    """Get trip details"""
    trip = await db.trips.find_one({"id": trip_id}, {"_id": 0})
    if not trip:
        raise HTTPException(status_code=404, detail="Viagem não encontrada")
    
    # Access control
    if current_user:
        if not can_access_client_company(current_user, trip.get("client_company_id", "")):
            if current_user["role"] == UserRole.OPERATOR_ADMIN:
                if trip.get("operator_id") != current_user.get("operator_id"):
                    raise HTTPException(status_code=403, detail="Acesso negado")
            elif current_user["role"] == UserRole.DRIVER:
                if trip.get("driver_id") != current_user["user_id"]:
                    raise HTTPException(status_code=403, detail="Acesso negado")
            else:
                raise HTTPException(status_code=403, detail="Acesso negado")
    
    return trip

@trips_router.put("/{trip_id}/status")
async def update_trip_status(
    trip_id: str,
    status: str = Body(..., embed=True),
    current_user: dict = Depends(get_current_user)
):
    """Update trip status"""
    trip = await db.trips.find_one({"id": trip_id})
    if not trip:
        raise HTTPException(status_code=404, detail="Viagem não encontrada")
    
    # Permission check
    if current_user["role"] == UserRole.OPERATOR_ADMIN:
        if trip.get("operator_id") != current_user.get("operator_id"):
            raise HTTPException(status_code=403, detail="Viagem pertence a outro operador")
    elif current_user["role"] == UserRole.DRIVER:
        if trip.get("driver_id") != current_user["user_id"]:
            raise HTTPException(status_code=403, detail="Não pode atualizar viagem de outro motorista")
    
    valid_statuses = [TripStatus.PENDING, TripStatus.SCHEDULED, TripStatus.CONFIRMED, 
                      TripStatus.IN_PROGRESS, TripStatus.COMPLETED, TripStatus.CANCELLED]
    if status not in valid_statuses:
        raise HTTPException(status_code=400, detail=f"Status inválido")
    
    status_log = {
        "status": status,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "changed_by": current_user["role"],
        "notes": ""
    }
    
    update_data = {
        "status": status,
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    if status == TripStatus.IN_PROGRESS:
        update_data["started_at"] = datetime.now(timezone.utc).isoformat()
    elif status == TripStatus.COMPLETED:
        update_data["completed_at"] = datetime.now(timezone.utc).isoformat()
    
    result = await db.trips.find_one_and_update(
        {"id": trip_id},
        {"$set": update_data, "$push": {"status_history": status_log}},
        return_document=True
    )
    result.pop("_id", None)
    
    await notify_clients("trip_status_update", result)
    return result

@trips_router.put("/{trip_id}/assign-driver")
async def assign_driver_to_trip(
    trip_id: str,
    driver_id: str = Body(""),
    driver_name: str = Body(...),
    driver_phone: str = Body(""),
    vehicle_id: Optional[str] = Body(None),
    current_user: dict = Depends(require_roles([UserRole.PLATFORM_OWNER, UserRole.OPERATOR_ADMIN]))
):
    """Assign a driver to a trip"""
    trip = await db.trips.find_one({"id": trip_id})
    if not trip:
        raise HTTPException(status_code=404, detail="Viagem não encontrada")
    
    if current_user["role"] == UserRole.OPERATOR_ADMIN:
        if trip.get("operator_id") != current_user.get("operator_id"):
            raise HTTPException(status_code=403, detail="Viagem pertence a outro operador")
    
    update_data = {
        "driver_id": driver_id,
        "driver_name": driver_name,
        "driver_phone": driver_phone,
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    if vehicle_id:
        vehicle = await db.vehicles.find_one({"id": vehicle_id})
        if vehicle:
            update_data["vehicle_id"] = vehicle_id
            update_data["vehicle_plate"] = vehicle.get("plate", "")
            update_data["vehicle_type"] = vehicle.get("vehicle_type", "")
    
    status_log = {
        "status": "driver_assigned",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "changed_by": "admin",
        "notes": f"Motorista designado: {driver_name}"
    }
    
    result = await db.trips.find_one_and_update(
        {"id": trip_id},
        {"$set": update_data, "$push": {"status_history": status_log}},
        return_document=True
    )
    result.pop("_id", None)
    
    await notify_clients("driver_assigned", result)
    return result

@trips_router.put("/{trip_id}/schedule")
async def update_trip_schedule(
    trip_id: str,
    scheduled_date: str = Body(...),
    scheduled_time: str = Body(...),
    current_user: dict = Depends(get_current_user)
):
    """Update trip schedule"""
    trip = await db.trips.find_one({"id": trip_id})
    if not trip:
        raise HTTPException(status_code=404, detail="Viagem não encontrada")
    
    scheduled_datetime = f"{scheduled_date}T{scheduled_time}:00"
    
    status_log = {
        "status": "schedule_updated",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "changed_by": current_user["role"],
        "notes": f"Agendamento alterado para {scheduled_date} às {scheduled_time}"
    }
    
    result = await db.trips.find_one_and_update(
        {"id": trip_id},
        {
            "$set": {
                "scheduled_date": scheduled_date,
                "scheduled_time": scheduled_time,
                "scheduled_datetime": scheduled_datetime,
                "updated_at": datetime.now(timezone.utc).isoformat()
            },
            "$push": {"status_history": status_log}
        },
        return_document=True
    )
    result.pop("_id", None)
    
    await notify_clients("schedule_update", result)
    return result

@trips_router.post("/{trip_id}/cancel")
async def cancel_trip(
    trip_id: str,
    reason: str = Body(..., embed=True),
    current_user: dict = Depends(get_current_user_optional)
):
    """Cancel a trip"""
    trip = await db.trips.find_one({"id": trip_id})
    if not trip:
        raise HTTPException(status_code=404, detail="Viagem não encontrada")
    
    if trip["status"] in [TripStatus.COMPLETED, TripStatus.CANCELLED]:
        raise HTTPException(status_code=400, detail="Esta viagem não pode ser cancelada")
    
    status_log = {
        "status": TripStatus.CANCELLED,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "changed_by": current_user["role"] if current_user else "user",
        "notes": f"Motivo: {reason}"
    }
    
    result = await db.trips.find_one_and_update(
        {"id": trip_id},
        {
            "$set": {
                "status": TripStatus.CANCELLED,
                "cancellation_reason": reason,
                "updated_at": datetime.now(timezone.utc).isoformat()
            },
            "$push": {"status_history": status_log}
        },
        return_document=True
    )
    result.pop("_id", None)
    
    await notify_clients("trip_status_update", result)
    return result

# ==================== LEGACY COMPATIBILITY ROUTES ====================
# These routes maintain backward compatibility with the existing frontend

@legacy_router.get("/")
async def root():
    return {"message": "ARC Transportation Platform API v2.0"}

@legacy_router.get("/employees/search")
async def legacy_search_employee(matricula: str = Query(...)):
    """Legacy employee search - redirects to passengers"""
    passenger = await db.passengers.find_one(
        {"matricula": matricula, "operator_id": ARC_OPERATOR_ID},
        {"_id": 0}
    )
    if not passenger:
        raise HTTPException(status_code=404, detail="Funcionário não encontrado")
    
    return {
        "matricula": passenger.get("matricula", ""),
        "full_name": passenger.get("name", ""),
        "default_address": passenger.get("address", ""),
        "phone": passenger.get("phone", "")
    }

@legacy_router.get("/employees")
async def legacy_list_employees():
    """Legacy employees list"""
    passengers = await db.passengers.find(
        {"operator_id": ARC_OPERATOR_ID},
        {"_id": 0}
    ).to_list(1000)
    
    return [{
        "matricula": p.get("matricula", ""),
        "full_name": p.get("name", ""),
        "default_address": p.get("address", ""),
        "phone": p.get("phone", "")
    } for p in passengers]

@legacy_router.post("/employees/upload-csv")
async def legacy_upload_employees_csv(file: UploadFile = File(...), replace: bool = False):
    """Legacy CSV upload for employees"""
    if not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="Arquivo deve ser CSV")
    
    try:
        contents = await file.read()
        try:
            decoded = contents.decode('utf-8')
        except UnicodeDecodeError:
            decoded = contents.decode('latin-1')
        
        reader = csv.DictReader(io.StringIO(decoded))
        passengers = []
        errors = []
        row_num = 1
        
        for row in reader:
            row_num += 1
            normalized = {k.lower().strip(): v.strip() if v else "" for k, v in row.items() if k}
            
            matricula = normalized.get('matricula') or normalized.get('matrícula') or normalized.get('id') or ""
            name = normalized.get('name') or normalized.get('nome') or normalized.get('full_name') or ""
            address = normalized.get('address') or normalized.get('endereco') or normalized.get('default_address') or ""
            phone = normalized.get('phone') or normalized.get('telefone') or normalized.get('tel') or ""
            
            if not matricula:
                errors.append(f"Linha {row_num}: Matrícula não encontrada")
                continue
            if not name:
                errors.append(f"Linha {row_num}: Nome não encontrado")
                continue
            
            passengers.append({
                "id": str(uuid.uuid4()),
                "operator_id": ARC_OPERATOR_ID,
                "client_company_id": ARC_CLIENT_COMPANY_ID,
                "matricula": str(matricula),
                "name": name,
                "address": address,
                "phone": phone,
                "email": "",
                "neighborhood": "",
                "city": "",
                "pickup_point": "",
                "notes": "",
                "status": "active",
                "created_at": datetime.now(timezone.utc).isoformat(),
                "updated_at": datetime.now(timezone.utc).isoformat()
            })
        
        if not passengers:
            raise HTTPException(status_code=400, detail=f"Nenhum funcionário válido. Erros: {'; '.join(errors)}")
        
        if replace:
            await db.passengers.delete_many({"operator_id": ARC_OPERATOR_ID})
            await db.passengers.insert_many(passengers)
            action = "substituídos"
        else:
            for p in passengers:
                await db.passengers.update_one(
                    {"operator_id": ARC_OPERATOR_ID, "matricula": p["matricula"]},
                    {"$set": p},
                    upsert=True
                )
            action = "importados/atualizados"
        
        return {
            "success": True,
            "message": f"{len(passengers)} funcionários {action}",
            "imported_count": len(passengers),
            "errors": errors if errors else None
        }
    except Exception as e:
        logger.error(f"CSV upload error: {e}")
        raise HTTPException(status_code=400, detail=f"Erro ao processar CSV: {str(e)}")

@legacy_router.get("/drivers")
async def legacy_list_drivers(active_only: bool = True):
    """Legacy drivers list"""
    query = {"operator_id": ARC_OPERATOR_ID}
    if active_only:
        query["status"] = {"$in": ["available", "on_trip"]}
    
    drivers = await db.drivers_v2.find(query, {"_id": 0}).to_list(100)
    return [{
        "id": d.get("id", ""),
        "name": d.get("name", ""),
        "phone": d.get("phone", ""),
        "active": d.get("status") in ["available", "on_trip"]
    } for d in drivers]

@legacy_router.post("/drivers/upload-csv")
async def legacy_upload_drivers_csv(file: UploadFile = File(...), replace: bool = False):
    """Legacy CSV upload for drivers"""
    if not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="Arquivo deve ser CSV")
    
    try:
        contents = await file.read()
        try:
            decoded = contents.decode('utf-8')
        except UnicodeDecodeError:
            decoded = contents.decode('latin-1')
        
        reader = csv.DictReader(io.StringIO(decoded))
        drivers = []
        errors = []
        row_num = 1
        
        for row in reader:
            row_num += 1
            normalized = {k.lower().strip(): v.strip() if v else "" for k, v in row.items() if k}
            
            name = normalized.get('name') or normalized.get('nome') or normalized.get('motorista') or ""
            phone = normalized.get('phone') or normalized.get('telefone') or normalized.get('tel') or ""
            
            if not name:
                errors.append(f"Linha {row_num}: Nome não encontrado")
                continue
            
            drivers.append({
                "id": str(uuid.uuid4()),
                "operator_id": ARC_OPERATOR_ID,
                "user_id": None,
                "name": name,
                "phone": phone,
                "email": "",
                "document": "",
                "license_number": "",
                "license_category": "",
                "license_expiry": "",
                "photo_url": None,
                "authorized_cities": [],
                "availability": {
                    "monday": True, "tuesday": True, "wednesday": True,
                    "thursday": True, "friday": True, "saturday": False, "sunday": False,
                    "start_time": "06:00", "end_time": "22:00"
                },
                "default_vehicle_id": None,
                "status": "available",
                "notes": "",
                "created_at": datetime.now(timezone.utc).isoformat(),
                "updated_at": datetime.now(timezone.utc).isoformat()
            })
        
        if not drivers:
            raise HTTPException(status_code=400, detail=f"Nenhum motorista válido. Erros: {'; '.join(errors)}")
        
        if replace:
            await db.drivers_v2.delete_many({"operator_id": ARC_OPERATOR_ID})
        
        await db.drivers_v2.insert_many(drivers)
        
        return {
            "success": True,
            "message": f"{len(drivers)} motoristas importados",
            "imported_count": len(drivers),
            "errors": errors if errors else None
        }
    except Exception as e:
        logger.error(f"Drivers CSV upload error: {e}")
        raise HTTPException(status_code=400, detail=f"Erro ao processar CSV: {str(e)}")

# Legacy request endpoints (map to trips)
class LegacyPassenger(BaseModel):
    matricula: str
    full_name: str
    address: str = ""
    phone: str = ""

class LegacyRequestCreate(BaseModel):
    requester_name: str
    main_passenger: LegacyPassenger
    additional_passengers: List[LegacyPassenger] = []
    origin_type: str = "fixar"
    origin_address: str = "FIXAR"
    destination_type: str = "cadastrado"
    destination_address: str = ""
    is_scheduled: bool = False
    scheduled_date: str = ""
    scheduled_time: str = ""

@legacy_router.post("/requests")
async def legacy_create_request(data: LegacyRequestCreate):
    """Legacy request creation - maps to trips"""
    passengers = [{
        "passenger_id": "",
        "matricula": data.main_passenger.matricula,
        "name": data.main_passenger.full_name,
        "phone": data.main_passenger.phone,
        "address": data.main_passenger.address,
        "neighborhood": "",
        "city": "",
        "pickup_point": "",
        "stop_order": 0
    }]
    
    for idx, p in enumerate(data.additional_passengers):
        passengers.append({
            "passenger_id": "",
            "matricula": p.matricula,
            "name": p.full_name,
            "phone": p.phone,
            "address": p.address,
            "neighborhood": "",
            "city": "",
            "pickup_point": "",
            "stop_order": idx + 1
        })
    
    scheduled_datetime = ""
    if data.is_scheduled and data.scheduled_date and data.scheduled_time:
        scheduled_datetime = f"{data.scheduled_date}T{data.scheduled_time}:00"
    
    trip = {
        "id": str(uuid.uuid4()),
        "operator_id": ARC_OPERATOR_ID,
        "client_company_id": ARC_CLIENT_COMPANY_ID,
        "requester_name": data.requester_name,
        "requester_user_id": None,
        "trip_type": "on_demand",
        "is_scheduled": data.is_scheduled,
        "scheduled_date": data.scheduled_date,
        "scheduled_time": data.scheduled_time,
        "scheduled_datetime": scheduled_datetime,
        "recurrence_pattern": None,
        "origin_type": data.origin_type,
        "origin_address": data.origin_address,
        "origin_neighborhood": "",
        "origin_city": "",
        "origin_lat": None,
        "origin_lng": None,
        "destination_type": data.destination_type,
        "destination_address": data.destination_address,
        "destination_neighborhood": "",
        "destination_city": "",
        "destination_lat": None,
        "destination_lng": None,
        "passengers": passengers,
        "passenger_count": len(passengers),
        "driver_id": "",
        "driver_name": "",
        "driver_phone": "",
        "vehicle_id": None,
        "vehicle_plate": "",
        "vehicle_type": "",
        "stops": [],
        "status": TripStatus.PENDING,
        "status_history": [{
            "status": TripStatus.PENDING,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "changed_by": "system",
            "notes": "Solicitação criada"
        }],
        "cancellation_reason": "",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "started_at": None,
        "completed_at": None,
        "driver_notes": "",
        "incidents": [],
        "proof_photos": []
    }
    
    await db.trips.insert_one(trip)
    await notify_clients("new_request", trip)
    
    # Return in legacy format
    return {
        "id": trip["id"],
        "requester_name": trip["requester_name"],
        "main_passenger": {
            "matricula": passengers[0]["matricula"],
            "full_name": passengers[0]["name"],
            "address": passengers[0]["address"],
            "phone": passengers[0]["phone"]
        },
        "additional_passengers": [{
            "matricula": p["matricula"],
            "full_name": p["name"],
            "address": p["address"],
            "phone": p["phone"]
        } for p in passengers[1:]],
        "origin_type": trip["origin_type"],
        "origin_address": trip["origin_address"],
        "destination_type": trip["destination_type"],
        "destination_address": trip["destination_address"],
        "status": "aguardando",
        "is_scheduled": trip["is_scheduled"],
        "scheduled_date": trip["scheduled_date"],
        "scheduled_time": trip["scheduled_time"],
        "driver_name": "",
        "driver_phone": "",
        "created_at": trip["created_at"],
        "updated_at": trip["updated_at"]
    }

@legacy_router.get("/requests")
async def legacy_list_requests(
    status: Optional[str] = None,
    scheduled: Optional[bool] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None
):
    """Legacy requests list - maps to trips"""
    query = {"operator_id": ARC_OPERATOR_ID}
    
    # Map legacy status to trip status
    status_map = {
        "aguardando": TripStatus.PENDING,
        "confirmado": TripStatus.CONFIRMED,
        "finalizado": TripStatus.COMPLETED,
        "cancelado": TripStatus.CANCELLED
    }
    
    if status:
        query["status"] = status_map.get(status, status)
    if scheduled is not None:
        query["is_scheduled"] = scheduled
    if start_date:
        query["created_at"] = {"$gte": start_date + "T00:00:00"}
    if end_date:
        if "created_at" in query:
            query["created_at"]["$lte"] = end_date + "T23:59:59"
        else:
            query["created_at"] = {"$lte": end_date + "T23:59:59"}
    
    trips = await db.trips.find(query, {"_id": 0}).sort("created_at", -1).to_list(500)
    
    # Convert to legacy format
    reverse_status = {v: k for k, v in status_map.items()}
    
    return [convert_trip_to_legacy(t, reverse_status) for t in trips]

def convert_trip_to_legacy(trip: dict, reverse_status: dict) -> dict:
    """Convert trip to legacy request format"""
    passengers = trip.get("passengers", [])
    main_p = passengers[0] if passengers else {}
    add_p = passengers[1:] if len(passengers) > 1 else []
    
    return {
        "id": trip.get("id", ""),
        "requester_name": trip.get("requester_name", ""),
        "main_passenger": {
            "matricula": main_p.get("matricula", ""),
            "full_name": main_p.get("name", ""),
            "address": main_p.get("address", ""),
            "phone": main_p.get("phone", "")
        },
        "additional_passengers": [{
            "matricula": p.get("matricula", ""),
            "full_name": p.get("name", ""),
            "address": p.get("address", ""),
            "phone": p.get("phone", "")
        } for p in add_p],
        "origin_type": trip.get("origin_type", "fixed"),
        "origin_address": trip.get("origin_address", "FIXAR"),
        "destination_type": trip.get("destination_type", "registered"),
        "destination_address": trip.get("destination_address", ""),
        "status": reverse_status.get(trip.get("status", ""), trip.get("status", "")),
        "cancellation_reason": trip.get("cancellation_reason", ""),
        "is_scheduled": trip.get("is_scheduled", False),
        "scheduled_date": trip.get("scheduled_date", ""),
        "scheduled_time": trip.get("scheduled_time", ""),
        "scheduled_datetime": trip.get("scheduled_datetime", ""),
        "driver_id": trip.get("driver_id", ""),
        "driver_name": trip.get("driver_name", ""),
        "driver_phone": trip.get("driver_phone", ""),
        "status_logs": trip.get("status_history", []),
        "created_at": trip.get("created_at", ""),
        "updated_at": trip.get("updated_at", "")
    }

@legacy_router.get("/requests/active")
async def legacy_list_active_requests():
    """Legacy active requests"""
    query = {
        "operator_id": ARC_OPERATOR_ID,
        "status": {"$in": [TripStatus.PENDING, TripStatus.CONFIRMED, TripStatus.IN_PROGRESS]}
    }
    trips = await db.trips.find(query, {"_id": 0}).sort("created_at", -1).to_list(100)
    
    reverse_status = {
        TripStatus.PENDING: "aguardando",
        TripStatus.CONFIRMED: "confirmado",
        TripStatus.COMPLETED: "finalizado",
        TripStatus.CANCELLED: "cancelado"
    }
    
    return [convert_trip_to_legacy(t, reverse_status) for t in trips]

@legacy_router.get("/requests/history")
async def legacy_get_history(start_date: Optional[str] = None, end_date: Optional[str] = None):
    """Legacy history endpoint"""
    query = {"operator_id": ARC_OPERATOR_ID}
    if start_date:
        query["created_at"] = {"$gte": start_date + "T00:00:00"}
    if end_date:
        if "created_at" in query:
            query["created_at"]["$lte"] = end_date + "T23:59:59"
        else:
            query["created_at"] = {"$lte": end_date + "T23:59:59"}
    
    trips = await db.trips.find(query, {"_id": 0}).sort("created_at", -1).to_list(1000)
    
    reverse_status = {
        TripStatus.PENDING: "aguardando",
        TripStatus.CONFIRMED: "confirmado",
        TripStatus.COMPLETED: "finalizado",
        TripStatus.CANCELLED: "cancelado"
    }
    
    return [convert_trip_to_legacy(t, reverse_status) for t in trips]

@legacy_router.get("/requests/export-csv")
async def legacy_export_csv(start_date: Optional[str] = None, end_date: Optional[str] = None):
    """Legacy CSV export"""
    query = {"operator_id": ARC_OPERATOR_ID}
    if start_date:
        query["created_at"] = {"$gte": start_date + "T00:00:00"}
    if end_date:
        if "created_at" in query:
            query["created_at"]["$lte"] = end_date + "T23:59:59"
        else:
            query["created_at"] = {"$lte": end_date + "T23:59:59"}
    
    trips = await db.trips.find(query, {"_id": 0}).sort("created_at", -1).to_list(1000)
    
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "ID", "Data Criação", "Solicitante", "Passageiro Principal", "Matricula",
        "Telefone", "Origem", "Destino", "Status", "Agendado", "Data Agendamento",
        "Hora Agendamento", "Motorista", "Tel Motorista", "Motivo Cancelamento"
    ])
    
    status_map = {
        TripStatus.PENDING: "Aguardando",
        TripStatus.CONFIRMED: "Confirmado",
        TripStatus.COMPLETED: "Finalizado",
        TripStatus.CANCELLED: "Cancelado"
    }
    
    for trip in trips:
        passengers = trip.get("passengers", [])
        main_p = passengers[0] if passengers else {}
        writer.writerow([
            trip.get("id", "")[:8],
            trip.get("created_at", "")[:19].replace("T", " "),
            trip.get("requester_name", ""),
            main_p.get("name", ""),
            main_p.get("matricula", ""),
            main_p.get("phone", ""),
            trip.get("origin_address", ""),
            trip.get("destination_address", ""),
            status_map.get(trip.get("status", ""), trip.get("status", "")),
            "Sim" if trip.get("is_scheduled") else "Não",
            trip.get("scheduled_date", ""),
            trip.get("scheduled_time", ""),
            trip.get("driver_name", ""),
            trip.get("driver_phone", ""),
            trip.get("cancellation_reason", "")
        ])
    
    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=relatorio_taxi_{datetime.now().strftime('%Y%m%d')}.csv"}
    )

@legacy_router.get("/requests/{request_id}")
async def legacy_get_request(request_id: str):
    """Legacy get single request"""
    trip = await db.trips.find_one({"id": request_id}, {"_id": 0})
    if not trip:
        raise HTTPException(status_code=404, detail="Solicitação não encontrada")
    
    reverse_status = {
        TripStatus.PENDING: "aguardando",
        TripStatus.CONFIRMED: "confirmado",
        TripStatus.COMPLETED: "finalizado",
        TripStatus.CANCELLED: "cancelado"
    }
    
    return convert_trip_to_legacy(trip, reverse_status)

class LegacyStatusUpdate(BaseModel):
    status: str

@legacy_router.put("/requests/{request_id}/status")
async def legacy_update_status(request_id: str, data: LegacyStatusUpdate):
    """Legacy status update"""
    status_map = {
        "aguardando": TripStatus.PENDING,
        "confirmado": TripStatus.CONFIRMED,
        "finalizado": TripStatus.COMPLETED,
        "cancelado": TripStatus.CANCELLED
    }
    
    new_status = status_map.get(data.status, data.status)
    
    status_log = {
        "status": new_status,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "changed_by": "admin",
        "notes": ""
    }
    
    update_data = {
        "status": new_status,
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    if new_status == TripStatus.COMPLETED:
        update_data["completed_at"] = datetime.now(timezone.utc).isoformat()
    
    result = await db.trips.find_one_and_update(
        {"id": request_id},
        {"$set": update_data, "$push": {"status_history": status_log}},
        return_document=True
    )
    
    if not result:
        raise HTTPException(status_code=404, detail="Solicitação não encontrada")
    
    result.pop("_id", None)
    await notify_clients("status_update", result)
    
    reverse_status = {v: k for k, v in status_map.items()}
    return convert_trip_to_legacy(result, reverse_status)

class LegacyDriverAssignment(BaseModel):
    driver_id: str = ""
    driver_name: str = ""
    driver_phone: str = ""

@legacy_router.put("/requests/{request_id}/assign-driver")
async def legacy_assign_driver(request_id: str, data: LegacyDriverAssignment):
    """Legacy driver assignment"""
    status_log = {
        "status": "driver_assigned",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "changed_by": "admin",
        "notes": f"Motorista designado: {data.driver_name}"
    }
    
    result = await db.trips.find_one_and_update(
        {"id": request_id},
        {
            "$set": {
                "driver_id": data.driver_id,
                "driver_name": data.driver_name,
                "driver_phone": data.driver_phone,
                "updated_at": datetime.now(timezone.utc).isoformat()
            },
            "$push": {"status_history": status_log}
        },
        return_document=True
    )
    
    if not result:
        raise HTTPException(status_code=404, detail="Solicitação não encontrada")
    
    result.pop("_id", None)
    await notify_clients("driver_assigned", result)
    
    reverse_status = {
        TripStatus.PENDING: "aguardando",
        TripStatus.CONFIRMED: "confirmado",
        TripStatus.COMPLETED: "finalizado",
        TripStatus.CANCELLED: "cancelado"
    }
    return convert_trip_to_legacy(result, reverse_status)

class LegacyScheduleUpdate(BaseModel):
    scheduled_date: str
    scheduled_time: str

@legacy_router.put("/requests/{request_id}/schedule")
async def legacy_update_schedule(request_id: str, data: LegacyScheduleUpdate):
    """Legacy schedule update"""
    scheduled_datetime = f"{data.scheduled_date}T{data.scheduled_time}:00"
    
    status_log = {
        "status": "schedule_updated",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "changed_by": "user",
        "notes": f"Agendamento alterado para {data.scheduled_date} às {data.scheduled_time}"
    }
    
    result = await db.trips.find_one_and_update(
        {"id": request_id},
        {
            "$set": {
                "scheduled_date": data.scheduled_date,
                "scheduled_time": data.scheduled_time,
                "scheduled_datetime": scheduled_datetime,
                "updated_at": datetime.now(timezone.utc).isoformat()
            },
            "$push": {"status_history": status_log}
        },
        return_document=True
    )
    
    if not result:
        raise HTTPException(status_code=404, detail="Solicitação não encontrada")
    
    result.pop("_id", None)
    await notify_clients("schedule_update", result)
    
    reverse_status = {
        TripStatus.PENDING: "aguardando",
        TripStatus.CONFIRMED: "confirmado",
        TripStatus.COMPLETED: "finalizado",
        TripStatus.CANCELLED: "cancelado"
    }
    return convert_trip_to_legacy(result, reverse_status)

@legacy_router.delete("/requests/{request_id}")
async def legacy_cancel_request(request_id: str):
    """Legacy request cancellation"""
    trip = await db.trips.find_one({"id": request_id})
    if not trip:
        raise HTTPException(status_code=404, detail="Solicitação não encontrada")
    
    if trip["status"] not in [TripStatus.PENDING]:
        raise HTTPException(status_code=400, detail="Apenas solicitações aguardando podem ser canceladas")
    
    await db.trips.update_one(
        {"id": request_id},
        {"$set": {"status": TripStatus.CANCELLED, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    trip["status"] = TripStatus.CANCELLED
    await notify_clients("status_update", trip)
    
    return {"message": "Solicitação cancelada com sucesso"}

class LegacyCancelRequest(BaseModel):
    reason: str

@legacy_router.post("/requests/{request_id}/cancel")
async def legacy_cancel_with_reason(request_id: str, data: LegacyCancelRequest):
    """Legacy cancel with reason"""
    trip = await db.trips.find_one({"id": request_id})
    if not trip:
        raise HTTPException(status_code=404, detail="Solicitação não encontrada")
    
    if trip["status"] in [TripStatus.COMPLETED, TripStatus.CANCELLED]:
        raise HTTPException(status_code=400, detail="Esta solicitação não pode ser cancelada")
    
    status_log = {
        "status": TripStatus.CANCELLED,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "changed_by": "user",
        "notes": f"Motivo: {data.reason}"
    }
    
    result = await db.trips.find_one_and_update(
        {"id": request_id},
        {
            "$set": {
                "status": TripStatus.CANCELLED,
                "cancellation_reason": data.reason,
                "updated_at": datetime.now(timezone.utc).isoformat()
            },
            "$push": {"status_history": status_log}
        },
        return_document=True
    )
    
    result.pop("_id", None)
    await notify_clients("status_update", result)
    
    reverse_status = {
        TripStatus.PENDING: "aguardando",
        TripStatus.CONFIRMED: "confirmado",
        TripStatus.COMPLETED: "finalizado",
        TripStatus.CANCELLED: "cancelado"
    }
    return convert_trip_to_legacy(result, reverse_status)

# Legacy admin verify
class LegacyAdminVerify(BaseModel):
    password: str

@legacy_router.post("/admin/verify")
async def legacy_admin_verify(data: LegacyAdminVerify):
    """Legacy admin password verification"""
    if data.password == "ARC123":
        return {"verified": True}
    raise HTTPException(status_code=401, detail="Senha incorreta")

# ==================== SSE ENDPOINT ====================

@legacy_router.get("/requests/stream/events")
async def stream_events():
    """SSE endpoint for real-time updates"""
    async def event_generator():
        yield f"data: {json.dumps({'type': 'connected', 'message': 'SSE connection established'})}\n\n"
        
        while True:
            try:
                try:
                    event = await asyncio.wait_for(request_events.get(), timeout=30.0)
                    yield f"data: {json.dumps(event)}\n\n"
                except asyncio.TimeoutError:
                    yield f"data: {json.dumps({'type': 'heartbeat'})}\n\n"
            except Exception as e:
                logger.error(f"SSE error: {e}")
                break
    
    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )

# ==================== SMART TRIP ASSEMBLY ====================

import_router = APIRouter(prefix="/api/import", tags=["Import & Assembly"])

class ImportPreviewRow(BaseModel):
    row_num: int
    passenger_name: str = ""
    passenger_phone: str = ""
    passenger_address: str = ""
    passenger_neighborhood: str = ""
    passenger_city: str = ""
    pickup_time: str = ""
    destination: str = ""
    is_valid: bool = True
    errors: List[str] = []
    passenger_id: Optional[str] = None  # If matched to existing passenger

class ImportPreview(BaseModel):
    total_rows: int
    valid_rows: int
    invalid_rows: int
    rows: List[ImportPreviewRow]
    columns_detected: List[str]

class TripSuggestion(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    vehicle_type: str
    vehicle_capacity: int
    driver_id: Optional[str] = None
    driver_name: str = ""
    passengers: List[dict]
    passenger_count: int
    city: str = ""
    neighborhood: str = ""
    scheduled_time: str = ""
    destination: str = ""
    estimated_stops: int
    confidence: float  # 0-1 how confident we are about this grouping

class SmartAssemblyResult(BaseModel):
    suggestions: List[TripSuggestion]
    unassigned_passengers: List[dict]
    total_vehicles_needed: int
    warnings: List[str]

@import_router.post("/preview-spreadsheet")
async def preview_spreadsheet(
    file: UploadFile = File(...),
    client_company_id: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    """Preview spreadsheet before importing - returns parsed data with validation"""
    if not file.filename.endswith(('.csv', '.xlsx', '.xls')):
        raise HTTPException(status_code=400, detail="Formato de arquivo não suportado. Use CSV ou Excel.")
    
    try:
        contents = await file.read()
        
        # Parse based on file type
        if file.filename.endswith('.csv'):
            try:
                decoded = contents.decode('utf-8')
            except UnicodeDecodeError:
                decoded = contents.decode('latin-1')
            reader = csv.DictReader(io.StringIO(decoded))
            rows = list(reader)
            columns = reader.fieldnames or []
        else:
            # For Excel, we'd need openpyxl - fallback to CSV error
            raise HTTPException(status_code=400, detail="Por enquanto, apenas CSV é suportado. Excel em breve.")
        
        # Column mapping (flexible matching)
        column_map = {
            'name': ['name', 'nome', 'passenger', 'passageiro', 'funcionario', 'employee'],
            'phone': ['phone', 'telefone', 'tel', 'celular', 'mobile'],
            'address': ['address', 'endereco', 'endereço', 'rua', 'street'],
            'neighborhood': ['neighborhood', 'bairro', 'district'],
            'city': ['city', 'cidade', 'municipio'],
            'time': ['time', 'hora', 'horario', 'horário', 'pickup_time', 'saida'],
            'destination': ['destination', 'destino', 'dest', 'to'],
            'matricula': ['matricula', 'matrícula', 'id', 'registration', 'code']
        }
        
        def find_column(row, keys):
            normalized = {k.lower().strip(): v for k, v in row.items() if k}
            for key in keys:
                if key in normalized:
                    return normalized[key].strip() if normalized[key] else ""
            return ""
        
        # Get existing passengers for matching
        existing_passengers = await db.passengers.find(
            {"client_company_id": client_company_id},
            {"_id": 0, "id": 1, "name": 1, "phone": 1, "matricula": 1}
        ).to_list(1000)
        
        def match_passenger(name, phone, matricula):
            """Try to match with existing passenger"""
            for p in existing_passengers:
                if matricula and p.get("matricula") == matricula:
                    return p["id"]
                if phone and p.get("phone") == phone:
                    return p["id"]
                if name and p.get("name", "").lower() == name.lower():
                    return p["id"]
            return None
        
        # Process rows
        preview_rows = []
        valid_count = 0
        
        for idx, row in enumerate(rows):
            name = find_column(row, column_map['name'])
            phone = find_column(row, column_map['phone'])
            address = find_column(row, column_map['address'])
            neighborhood = find_column(row, column_map['neighborhood'])
            city = find_column(row, column_map['city'])
            time = find_column(row, column_map['time'])
            destination = find_column(row, column_map['destination'])
            matricula = find_column(row, column_map['matricula'])
            
            errors = []
            if not name:
                errors.append("Nome não encontrado")
            
            is_valid = len(errors) == 0
            if is_valid:
                valid_count += 1
            
            passenger_id = match_passenger(name, phone, matricula)
            
            preview_rows.append(ImportPreviewRow(
                row_num=idx + 2,  # +2 for header and 0-index
                passenger_name=name,
                passenger_phone=phone,
                passenger_address=address,
                passenger_neighborhood=neighborhood,
                passenger_city=city,
                pickup_time=time,
                destination=destination,
                is_valid=is_valid,
                errors=errors,
                passenger_id=passenger_id
            ))
        
        return ImportPreview(
            total_rows=len(preview_rows),
            valid_rows=valid_count,
            invalid_rows=len(preview_rows) - valid_count,
            rows=preview_rows,
            columns_detected=columns
        )
        
    except Exception as e:
        logger.error(f"Preview error: {e}")
        raise HTTPException(status_code=400, detail=f"Erro ao processar arquivo: {str(e)}")

@import_router.post("/smart-assembly")
async def smart_trip_assembly(
    passengers: List[dict] = Body(...),
    client_company_id: str = Body(...),
    scheduled_date: str = Body(...),
    current_user: dict = Depends(get_current_user)
):
    """
    Smart Trip Assembly Engine
    Groups passengers by city, neighborhood, time, and destination
    Suggests optimal vehicle assignments based on capacity
    """
    
    # Get available drivers and vehicles
    operator_id = current_user.get("operator_id", ARC_OPERATOR_ID)
    
    available_drivers = await db.drivers_v2.find(
        {"operator_id": operator_id, "status": "available"},
        {"_id": 0}
    ).to_list(100)
    
    available_vehicles = await db.vehicles.find(
        {"operator_id": operator_id, "status": "available"},
        {"_id": 0}
    ).to_list(100)
    
    # Group passengers by city + neighborhood + time + destination
    groups = {}
    for p in passengers:
        # Create grouping key
        city = p.get('passenger_city', '').lower().strip()
        neighborhood = p.get('passenger_neighborhood', '').lower().strip()
        time = p.get('pickup_time', '').strip()
        destination = p.get('destination', '').lower().strip()
        
        key = f"{city}|{neighborhood}|{time}|{destination}"
        if key not in groups:
            groups[key] = {
                'city': p.get('passenger_city', ''),
                'neighborhood': p.get('passenger_neighborhood', ''),
                'time': time,
                'destination': p.get('destination', ''),
                'passengers': []
            }
        groups[key]['passengers'].append(p)
    
    # Generate trip suggestions
    suggestions = []
    unassigned = []
    warnings = []
    driver_idx = 0
    
    for key, group in groups.items():
        group_passengers = group['passengers']
        group_size = len(group_passengers)
        
        # Determine vehicle type based on passenger count
        if group_size <= 4:
            vehicle_type = VehicleType.CAR
            capacity = 4
        elif group_size <= 6:
            vehicle_type = VehicleType.VAN
            capacity = 6
        elif group_size <= 15:
            vehicle_type = VehicleType.MINIBUS
            capacity = 15
        else:
            vehicle_type = VehicleType.BUS
            capacity = 40
        
        # Split into multiple trips if needed
        for i in range(0, group_size, capacity):
            trip_passengers = group_passengers[i:i+capacity]
            
            # Assign driver if available
            driver = None
            driver_name = ""
            driver_id = None
            
            if driver_idx < len(available_drivers):
                driver = available_drivers[driver_idx]
                driver_name = driver.get('name', '')
                driver_id = driver.get('id')
                driver_idx += 1
            else:
                warnings.append(f"Motorista não disponível para viagem em {group['city']} às {group['time']}")
            
            suggestions.append(TripSuggestion(
                vehicle_type=vehicle_type,
                vehicle_capacity=capacity,
                driver_id=driver_id,
                driver_name=driver_name,
                passengers=[{
                    'name': p.get('passenger_name', ''),
                    'phone': p.get('passenger_phone', ''),
                    'address': p.get('passenger_address', ''),
                    'passenger_id': p.get('passenger_id')
                } for p in trip_passengers],
                passenger_count=len(trip_passengers),
                city=group['city'],
                neighborhood=group['neighborhood'],
                scheduled_time=group['time'],
                destination=group['destination'],
                estimated_stops=len(set(p.get('passenger_address', '') for p in trip_passengers)),
                confidence=0.8 if driver else 0.5
            ))
    
    return SmartAssemblyResult(
        suggestions=suggestions,
        unassigned_passengers=unassigned,
        total_vehicles_needed=len(suggestions),
        warnings=warnings
    )

@import_router.post("/confirm-trips")
async def confirm_assembled_trips(
    suggestions: List[dict] = Body(...),
    client_company_id: str = Body(...),
    scheduled_date: str = Body(...),
    current_user: dict = Depends(get_current_user)
):
    """Confirm and create trips from assembly suggestions"""
    
    company = await db.client_companies.find_one({"id": client_company_id})
    if not company:
        raise HTTPException(status_code=404, detail="Empresa não encontrada")
    
    operator_id = company.get("operator_id", ARC_OPERATOR_ID)
    created_trips = []
    
    for suggestion in suggestions:
        # Build passengers list
        passengers = []
        for idx, p in enumerate(suggestion.get('passengers', [])):
            passengers.append({
                "passenger_id": p.get('passenger_id', ''),
                "matricula": "",
                "name": p.get('name', ''),
                "phone": p.get('phone', ''),
                "address": p.get('address', ''),
                "neighborhood": suggestion.get('neighborhood', ''),
                "city": suggestion.get('city', ''),
                "pickup_point": "",
                "stop_order": idx
            })
        
        scheduled_time = suggestion.get('scheduled_time', '08:00')
        scheduled_datetime = f"{scheduled_date}T{scheduled_time}:00"
        
        trip = {
            "id": str(uuid.uuid4()),
            "operator_id": operator_id,
            "client_company_id": client_company_id,
            "requester_name": current_user.get("name", "Sistema"),
            "requester_user_id": current_user.get("user_id"),
            "trip_type": "on_demand",
            "is_scheduled": True,
            "scheduled_date": scheduled_date,
            "scheduled_time": scheduled_time,
            "scheduled_datetime": scheduled_datetime,
            "recurrence_pattern": None,
            "origin_type": "custom",
            "origin_address": company.get("default_pickup_address", ""),
            "origin_neighborhood": "",
            "origin_city": suggestion.get('city', ''),
            "origin_lat": None,
            "origin_lng": None,
            "destination_type": "custom",
            "destination_address": suggestion.get('destination', ''),
            "destination_neighborhood": "",
            "destination_city": "",
            "destination_lat": None,
            "destination_lng": None,
            "passengers": passengers,
            "passenger_count": len(passengers),
            "driver_id": suggestion.get('driver_id', ''),
            "driver_name": suggestion.get('driver_name', ''),
            "driver_phone": "",
            "vehicle_id": None,
            "vehicle_plate": "",
            "vehicle_type": suggestion.get('vehicle_type', VehicleType.CAR),
            "stops": [],
            "status": TripStatus.SCHEDULED,
            "status_history": [{
                "status": TripStatus.SCHEDULED,
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "changed_by": "smart_assembly",
                "notes": "Viagem criada via montagem inteligente"
            }],
            "cancellation_reason": "",
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat(),
            "started_at": None,
            "completed_at": None,
            "driver_notes": "",
            "incidents": [],
            "proof_photos": []
        }
        
        await db.trips.insert_one(trip)
        created_trips.append(trip["id"])
        await notify_clients("new_trip", trip)
    
    return {
        "success": True,
        "message": f"{len(created_trips)} viagens criadas com sucesso",
        "trip_ids": created_trips
    }

# ==================== REPORTS & EXPORTS ====================

reports_router = APIRouter(prefix="/api/reports", tags=["Reports"])

@reports_router.get("/summary")
async def get_reports_summary(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    client_company_id: Optional[str] = None,
    driver_id: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Get summary statistics for reports"""
    query = filter_by_tenant(current_user, {})
    
    if client_company_id:
        query["client_company_id"] = client_company_id
    if driver_id:
        query["driver_id"] = driver_id
    if start_date:
        query["created_at"] = {"$gte": start_date + "T00:00:00"}
    if end_date:
        if "created_at" in query:
            query["created_at"]["$lte"] = end_date + "T23:59:59"
        else:
            query["created_at"] = {"$lte": end_date + "T23:59:59"}
    
    trips = await db.trips.find(query, {"_id": 0}).to_list(10000)
    
    # Calculate statistics
    total_trips = len(trips)
    completed_trips = len([t for t in trips if t.get("status") == TripStatus.COMPLETED])
    cancelled_trips = len([t for t in trips if t.get("status") == TripStatus.CANCELLED])
    scheduled_trips = len([t for t in trips if t.get("is_scheduled")])
    total_passengers = sum(t.get("passenger_count", 0) for t in trips)
    
    # Group by driver
    by_driver = {}
    for t in trips:
        driver = t.get("driver_name") or "Não designado"
        if driver not in by_driver:
            by_driver[driver] = {"trips": 0, "passengers": 0, "completed": 0}
        by_driver[driver]["trips"] += 1
        by_driver[driver]["passengers"] += t.get("passenger_count", 0)
        if t.get("status") == TripStatus.COMPLETED:
            by_driver[driver]["completed"] += 1
    
    # Group by city
    by_city = {}
    for t in trips:
        city = t.get("origin_city") or t.get("destination_city") or "N/A"
        if city not in by_city:
            by_city[city] = 0
        by_city[city] += 1
    
    # Group by vehicle type
    by_vehicle = {}
    for t in trips:
        vtype = t.get("vehicle_type") or "taxi"
        if vtype not in by_vehicle:
            by_vehicle[vtype] = 0
        by_vehicle[vtype] += 1
    
    # Group by company
    company_ids = list(set(t.get("client_company_id") for t in trips if t.get("client_company_id")))
    companies = await db.client_companies.find({"id": {"$in": company_ids}}, {"_id": 0, "id": 1, "legal_name": 1, "trade_name": 1}).to_list(100)
    company_map = {c["id"]: c.get("trade_name") or c.get("legal_name") for c in companies}
    
    by_company = {}
    for t in trips:
        company_name = company_map.get(t.get("client_company_id"), "N/A")
        if company_name not in by_company:
            by_company[company_name] = 0
        by_company[company_name] += 1
    
    return {
        "summary": {
            "total_trips": total_trips,
            "completed_trips": completed_trips,
            "cancelled_trips": cancelled_trips,
            "scheduled_trips": scheduled_trips,
            "total_passengers": total_passengers,
            "completion_rate": round(completed_trips / total_trips * 100, 1) if total_trips > 0 else 0
        },
        "by_driver": [{"name": k, **v} for k, v in sorted(by_driver.items(), key=lambda x: x[1]["trips"], reverse=True)],
        "by_city": [{"city": k, "trips": v} for k, v in sorted(by_city.items(), key=lambda x: x[1], reverse=True)],
        "by_vehicle_type": [{"type": k, "trips": v} for k, v in by_vehicle.items()],
        "by_company": [{"company": k, "trips": v} for k, v in sorted(by_company.items(), key=lambda x: x[1], reverse=True)]
    }

@reports_router.get("/export/trips")
async def export_trips_report(
    format: str = "csv",
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    client_company_id: Optional[str] = None,
    driver_id: Optional[str] = None,
    status: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Export trips report as CSV or PDF"""
    query = filter_by_tenant(current_user, {})
    
    if client_company_id:
        query["client_company_id"] = client_company_id
    if driver_id:
        query["driver_id"] = driver_id
    if status:
        query["status"] = status
    if start_date:
        query["created_at"] = {"$gte": start_date + "T00:00:00"}
    if end_date:
        if "created_at" in query:
            query["created_at"]["$lte"] = end_date + "T23:59:59"
        else:
            query["created_at"] = {"$lte": end_date + "T23:59:59"}
    
    trips = await db.trips.find(query, {"_id": 0}).sort("created_at", -1).to_list(10000)
    
    # Get company names
    company_ids = list(set(t.get("client_company_id") for t in trips if t.get("client_company_id")))
    companies = await db.client_companies.find({"id": {"$in": company_ids}}, {"_id": 0, "id": 1, "trade_name": 1, "legal_name": 1}).to_list(100)
    company_map = {c["id"]: c.get("trade_name") or c.get("legal_name") for c in companies}
    
    status_labels = {
        TripStatus.PENDING: "Aguardando",
        TripStatus.SCHEDULED: "Agendado",
        TripStatus.CONFIRMED: "Confirmado",
        TripStatus.IN_PROGRESS: "Em Andamento",
        TripStatus.COMPLETED: "Finalizado",
        TripStatus.CANCELLED: "Cancelado"
    }
    
    if format == "csv":
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow([
            "ID", "Data Criação", "Empresa", "Solicitante", "Passageiro Principal",
            "Qtd Passageiros", "Origem", "Destino", "Status", "Agendado",
            "Data Agendamento", "Hora", "Motorista", "Tel Motorista",
            "Tipo Veículo", "Motivo Cancelamento"
        ])
        
        for trip in trips:
            passengers = trip.get("passengers", [])
            main_p = passengers[0] if passengers else {}
            writer.writerow([
                trip.get("id", "")[:8],
                trip.get("created_at", "")[:19].replace("T", " "),
                company_map.get(trip.get("client_company_id"), "N/A"),
                trip.get("requester_name", ""),
                main_p.get("name", ""),
                trip.get("passenger_count", 0),
                trip.get("origin_address", ""),
                trip.get("destination_address", ""),
                status_labels.get(trip.get("status", ""), trip.get("status", "")),
                "Sim" if trip.get("is_scheduled") else "Não",
                trip.get("scheduled_date", ""),
                trip.get("scheduled_time", ""),
                trip.get("driver_name", ""),
                trip.get("driver_phone", ""),
                trip.get("vehicle_type", ""),
                trip.get("cancellation_reason", "")
            ])
        
        output.seek(0)
        filename = f"relatorio_viagens_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
        return StreamingResponse(
            iter([output.getvalue()]),
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename={filename}"}
        )
    
    # For PDF, return JSON for now (PDF generation would need additional library)
    return {"trips": trips, "format": "json", "note": "PDF export coming soon"}

@reports_router.get("/export/drivers")
async def export_drivers_report(
    format: str = "csv",
    current_user: dict = Depends(get_current_user)
):
    """Export drivers report"""
    query = filter_by_tenant(current_user, {})
    query.pop("client_company_id", None)
    
    drivers = await db.drivers_v2.find(query, {"_id": 0}).to_list(500)
    
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "ID", "Nome", "Telefone", "Email", "CPF", "CNH", "Categoria",
        "Validade CNH", "Cidades Autorizadas", "Status"
    ])
    
    status_labels = {
        "available": "Disponível",
        "on_trip": "Em Viagem",
        "unavailable": "Indisponível",
        "day_off": "Folga",
        "vacation": "Férias"
    }
    
    for driver in drivers:
        writer.writerow([
            driver.get("id", "")[:8],
            driver.get("name", ""),
            driver.get("phone", ""),
            driver.get("email", ""),
            driver.get("document", ""),
            driver.get("license_number", ""),
            driver.get("license_category", ""),
            driver.get("license_expiry", ""),
            ", ".join(driver.get("authorized_cities", [])),
            status_labels.get(driver.get("status", ""), driver.get("status", ""))
        ])
    
    output.seek(0)
    filename = f"relatorio_motoristas_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )

@reports_router.get("/export/passengers")
async def export_passengers_report(
    format: str = "csv",
    client_company_id: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Export passengers report"""
    query = filter_by_tenant(current_user, {})
    
    if client_company_id:
        query["client_company_id"] = client_company_id
    
    passengers = await db.passengers.find(query, {"_id": 0}).to_list(10000)
    
    # Get company names
    company_ids = list(set(p.get("client_company_id") for p in passengers if p.get("client_company_id")))
    companies = await db.client_companies.find({"id": {"$in": company_ids}}, {"_id": 0, "id": 1, "trade_name": 1, "legal_name": 1}).to_list(100)
    company_map = {c["id"]: c.get("trade_name") or c.get("legal_name") for c in companies}
    
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "Matrícula", "Nome", "Telefone", "Email", "Endereço",
        "Bairro", "Cidade", "Empresa", "Status"
    ])
    
    for p in passengers:
        writer.writerow([
            p.get("matricula", ""),
            p.get("name", ""),
            p.get("phone", ""),
            p.get("email", ""),
            p.get("address", ""),
            p.get("neighborhood", ""),
            p.get("city", ""),
            company_map.get(p.get("client_company_id"), "N/A"),
            "Ativo" if p.get("status") == "active" else "Inativo"
        ])
    
    output.seek(0)
    filename = f"relatorio_passageiros_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )

# ==================== INCLUDE ROUTERS ====================

app.include_router(auth_router)
app.include_router(operators_router)
app.include_router(companies_router)
app.include_router(passengers_router)
app.include_router(drivers_router)
app.include_router(vehicles_router)
app.include_router(trips_router)
app.include_router(import_router)
app.include_router(reports_router)
app.include_router(legacy_router)

# ==================== MIDDLEWARE ====================

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

# ==================== STARTUP ====================

@app.on_event("startup")
async def startup():
    """Startup tasks"""
    logger.info("ARC Transportation Platform v2.0 starting...")
    # Run migration if needed
    from migrate import run_migration
    try:
        await run_migration()
    except Exception as e:
        logger.warning(f"Migration already done or error: {e}")
    logger.info("Server ready")

@app.on_event("shutdown")
async def shutdown():
    client.close()
