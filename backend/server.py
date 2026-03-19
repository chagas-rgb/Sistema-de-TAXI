from fastapi import FastAPI, APIRouter, HTTPException, Query
from fastapi.responses import StreamingResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional
import uuid
from datetime import datetime, timezone
import asyncio
import json

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app without a prefix
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# ==================== MODELS ====================

class Employee(BaseModel):
    model_config = ConfigDict(extra="ignore")
    matricula: str
    full_name: str
    default_address: str

class Passenger(BaseModel):
    matricula: str
    full_name: str

class TaxiRequest(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    main_passenger: Passenger
    additional_passengers: List[Passenger] = []
    destination_address: str
    status: str = "aguardando"  # aguardando, confirmado, finalizado, cancelado
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    updated_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class TaxiRequestCreate(BaseModel):
    main_passenger: Passenger
    additional_passengers: List[Passenger] = []
    destination_address: str

class StatusUpdate(BaseModel):
    status: str

class AdminVerify(BaseModel):
    password: str

# ==================== SAMPLE DATA ====================

SAMPLE_EMPLOYEES = [
    {"matricula": "101", "full_name": "João Silva", "default_address": "Rua A, 123 - Centro"},
    {"matricula": "102", "full_name": "Maria Santos", "default_address": "Av. Brasil, 456 - Jardim"},
    {"matricula": "103", "full_name": "Carlos Oliveira", "default_address": "Rua das Flores, 789 - Vila Nova"},
    {"matricula": "104", "full_name": "Ana Costa", "default_address": "Praça Central, 321 - Centro"},
    {"matricula": "105", "full_name": "Pedro Lima", "default_address": "Rua do Comércio, 555 - Industrial"},
]

# ==================== STARTUP ====================

@app.on_event("startup")
async def startup_db():
    """Initialize database with sample employees"""
    # Check if employees already exist
    count = await db.employees.count_documents({})
    if count == 0:
        await db.employees.insert_many(SAMPLE_EMPLOYEES)
        logger.info("Sample employees inserted into database")
    else:
        logger.info(f"Employees collection already has {count} documents")

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()

# ==================== SSE EVENT TRACKING ====================

# Global event queue for SSE
request_events = asyncio.Queue()

async def notify_clients(event_type: str, data: dict):
    """Push event to SSE queue"""
    await request_events.put({"type": event_type, "data": data})

# ==================== API ROUTES ====================

@api_router.get("/")
async def root():
    return {"message": "ARC Transporte API"}

# Employee lookup
@api_router.get("/employees/search")
async def search_employee(matricula: str = Query(...)):
    """Search employee by matricula"""
    employee = await db.employees.find_one({"matricula": matricula}, {"_id": 0})
    if not employee:
        raise HTTPException(status_code=404, detail="Funcionário não encontrado")
    return employee

@api_router.get("/employees", response_model=List[Employee])
async def list_employees():
    """List all employees"""
    employees = await db.employees.find({}, {"_id": 0}).to_list(100)
    return employees

# Taxi Request CRUD
@api_router.post("/requests", response_model=TaxiRequest, status_code=201)
async def create_request(request_data: TaxiRequestCreate):
    """Create a new taxi request"""
    # Validate passenger count (max 4)
    total_passengers = 1 + len(request_data.additional_passengers)
    if total_passengers > 4:
        raise HTTPException(status_code=400, detail="Máximo de 4 passageiros por táxi")
    
    request_obj = TaxiRequest(
        main_passenger=request_data.main_passenger,
        additional_passengers=request_data.additional_passengers,
        destination_address=request_data.destination_address
    )
    
    doc = request_obj.model_dump()
    await db.taxi_requests.insert_one(doc)
    
    # Notify SSE clients about new request
    await notify_clients("new_request", doc)
    
    return request_obj

@api_router.get("/requests", response_model=List[TaxiRequest])
async def list_requests(status: Optional[str] = None):
    """List all taxi requests, optionally filtered by status"""
    query = {}
    if status:
        query["status"] = status
    
    requests = await db.taxi_requests.find(query, {"_id": 0}).sort("created_at", -1).to_list(100)
    return requests

@api_router.get("/requests/{request_id}", response_model=TaxiRequest)
async def get_request(request_id: str):
    """Get a single taxi request by ID"""
    request = await db.taxi_requests.find_one({"id": request_id}, {"_id": 0})
    if not request:
        raise HTTPException(status_code=404, detail="Solicitação não encontrada")
    return request

@api_router.put("/requests/{request_id}/status", response_model=TaxiRequest)
async def update_request_status(request_id: str, status_update: StatusUpdate):
    """Update the status of a taxi request"""
    valid_statuses = ["aguardando", "confirmado", "finalizado", "cancelado"]
    if status_update.status not in valid_statuses:
        raise HTTPException(status_code=400, detail=f"Status inválido. Use: {', '.join(valid_statuses)}")
    
    result = await db.taxi_requests.find_one_and_update(
        {"id": request_id},
        {"$set": {
            "status": status_update.status,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }},
        return_document=True
    )
    
    if not result:
        raise HTTPException(status_code=404, detail="Solicitação não encontrada")
    
    # Remove _id before returning
    result.pop("_id", None)
    
    # Notify SSE clients about status change
    await notify_clients("status_update", result)
    
    return result

@api_router.delete("/requests/{request_id}")
async def cancel_request(request_id: str):
    """Cancel a taxi request (only if status is aguardando)"""
    request = await db.taxi_requests.find_one({"id": request_id})
    if not request:
        raise HTTPException(status_code=404, detail="Solicitação não encontrada")
    
    if request["status"] != "aguardando":
        raise HTTPException(status_code=400, detail="Apenas solicitações aguardando podem ser canceladas")
    
    await db.taxi_requests.update_one(
        {"id": request_id},
        {"$set": {
            "status": "cancelado",
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    # Notify SSE clients
    request["status"] = "cancelado"
    request.pop("_id", None)
    await notify_clients("status_update", request)
    
    return {"message": "Solicitação cancelada com sucesso"}

# Admin verification
@api_router.post("/admin/verify")
async def verify_admin(verify_data: AdminVerify):
    """Verify admin password"""
    if verify_data.password == "ARC123":
        return {"verified": True}
    raise HTTPException(status_code=401, detail="Senha incorreta")

# SSE endpoint for real-time updates
@api_router.get("/requests/stream/events")
async def stream_events():
    """SSE endpoint for real-time request updates"""
    async def event_generator():
        # Send initial connection message
        yield f"data: {json.dumps({'type': 'connected', 'message': 'SSE connection established'})}\n\n"
        
        while True:
            try:
                # Wait for events with timeout to keep connection alive
                try:
                    event = await asyncio.wait_for(request_events.get(), timeout=30.0)
                    yield f"data: {json.dumps(event)}\n\n"
                except asyncio.TimeoutError:
                    # Send heartbeat to keep connection alive
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

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)
