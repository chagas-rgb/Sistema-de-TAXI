from fastapi import FastAPI, APIRouter, HTTPException, Query, UploadFile, File
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
import csv
import io

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

# ==================== TWILIO SMS SERVICE ====================

# Twilio configuration (optional - will work without it)
TWILIO_ACCOUNT_SID = os.environ.get('TWILIO_ACCOUNT_SID')
TWILIO_AUTH_TOKEN = os.environ.get('TWILIO_AUTH_TOKEN')
TWILIO_PHONE_NUMBER = os.environ.get('TWILIO_PHONE_NUMBER')

twilio_client = None
if TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN:
    try:
        from twilio.rest import Client
        twilio_client = Client(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)
        logger.info("Twilio SMS service initialized")
    except Exception as e:
        logger.warning(f"Twilio not available: {e}")

async def send_sms_notification(phone: str, message: str):
    """Send SMS notification via Twilio"""
    if not twilio_client or not TWILIO_PHONE_NUMBER:
        logger.info(f"SMS would be sent to {phone}: {message}")
        return False
    
    try:
        # Format phone number for Brazil if needed
        formatted_phone = phone.replace("(", "").replace(")", "").replace(" ", "").replace("-", "")
        if not formatted_phone.startswith("+"):
            formatted_phone = f"+55{formatted_phone}"
        
        twilio_client.messages.create(
            body=message,
            from_=TWILIO_PHONE_NUMBER,
            to=formatted_phone
        )
        logger.info(f"SMS sent to {formatted_phone}")
        return True
    except Exception as e:
        logger.error(f"Failed to send SMS: {e}")
        return False

async def notify_passengers_status_change(request_data: dict, new_status: str, cancellation_reason: str = None):
    """Send SMS to all passengers when status changes"""
    all_passengers = [request_data.get('main_passenger', {})] + request_data.get('additional_passengers', [])
    
    if new_status == "confirmado":
        message = f"ARC Transporte: Seu táxi foi CONFIRMADO e está a caminho! Destino: {request_data.get('destination_address', 'N/A')}"
    elif new_status == "cancelado":
        reason_text = f" Motivo: {cancellation_reason}" if cancellation_reason else ""
        message = f"ARC Transporte: Sua solicitação de táxi foi CANCELADA.{reason_text}"
    else:
        return
    
    for passenger in all_passengers:
        phone = passenger.get('phone', '')
        if phone:
            await send_sms_notification(phone, message)

# ==================== MODELS ====================

class Employee(BaseModel):
    model_config = ConfigDict(extra="ignore")
    matricula: str
    full_name: str
    default_address: str
    phone: str

class Passenger(BaseModel):
    matricula: str
    full_name: str
    address: str = ""
    phone: str = ""

class TaxiRequest(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    requester_name: str = ""  # Nome do Solicitante
    main_passenger: Passenger
    additional_passengers: List[Passenger] = []
    destination_address: str
    status: str = "aguardando"  # aguardando, confirmado, finalizado, cancelado
    cancellation_reason: str = ""  # Reason for cancellation
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    updated_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class TaxiRequestCreate(BaseModel):
    requester_name: str  # Nome do Solicitante
    main_passenger: Passenger
    additional_passengers: List[Passenger] = []
    destination_address: str

class StatusUpdate(BaseModel):
    status: str

class CancelRequest(BaseModel):
    reason: str  # Cancellation reason

class AdminVerify(BaseModel):
    password: str

# ==================== SAMPLE DATA ====================

SAMPLE_EMPLOYEES = [
    {"matricula": "101", "full_name": "João Silva", "default_address": "Rua A, 123 - Centro", "phone": "(11) 99999-1001"},
    {"matricula": "102", "full_name": "Maria Santos", "default_address": "Av. Brasil, 456 - Jardim", "phone": "(11) 99999-1002"},
    {"matricula": "103", "full_name": "Carlos Oliveira", "default_address": "Rua das Flores, 789 - Vila Nova", "phone": "(11) 99999-1003"},
    {"matricula": "104", "full_name": "Ana Costa", "default_address": "Praça Central, 321 - Centro", "phone": "(11) 99999-1004"},
    {"matricula": "105", "full_name": "Pedro Lima", "default_address": "Rua do Comércio, 555 - Industrial", "phone": "(11) 99999-1005"},
]

# ==================== STARTUP ====================

@app.on_event("startup")
async def startup_db():
    """Initialize database with sample employees"""
    # Check if employees need phone field update
    sample_employee = await db.employees.find_one({"matricula": "101"})
    if sample_employee and "phone" not in sample_employee:
        # Update existing employees with phone numbers
        await db.employees.drop()
        await db.employees.insert_many(SAMPLE_EMPLOYEES)
        logger.info("Employees updated with phone numbers")
    elif not sample_employee:
        await db.employees.insert_many(SAMPLE_EMPLOYEES)
        logger.info("Sample employees inserted into database")
    else:
        count = await db.employees.count_documents({})
        logger.info(f"Employees collection already has {count} documents with phone")

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
    employees = await db.employees.find({}, {"_id": 0}).to_list(1000)
    return employees

@api_router.post("/employees/upload-csv")
async def upload_employees_csv(file: UploadFile = File(...), replace: bool = False):
    """Upload CSV file to import employees. CSV must have: matricula, name (or full_name), address (or default_address), phone"""
    if not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="Arquivo deve ser CSV")
    
    try:
        contents = await file.read()
        # Try different encodings
        try:
            decoded = contents.decode('utf-8')
        except UnicodeDecodeError:
            decoded = contents.decode('latin-1')
        
        # Parse CSV
        reader = csv.DictReader(io.StringIO(decoded))
        
        employees = []
        errors = []
        row_num = 1
        
        for row in reader:
            row_num += 1
            # Normalize column names (handle variations)
            normalized = {}
            for key, value in row.items():
                if key:
                    normalized[key.lower().strip()] = value.strip() if value else ""
            
            # Extract fields with flexible column names
            matricula = normalized.get('matricula') or normalized.get('matrícula') or normalized.get('id')
            full_name = normalized.get('name') or normalized.get('full_name') or normalized.get('nome') or normalized.get('nome_completo')
            address = normalized.get('address') or normalized.get('default_address') or normalized.get('endereco') or normalized.get('endereço')
            phone = normalized.get('phone') or normalized.get('telefone') or normalized.get('tel') or normalized.get('celular')
            
            if not matricula:
                errors.append(f"Linha {row_num}: Matrícula não encontrada")
                continue
            if not full_name:
                errors.append(f"Linha {row_num}: Nome não encontrado")
                continue
            
            employees.append({
                "matricula": str(matricula),
                "full_name": full_name,
                "default_address": address or "",
                "phone": phone or ""
            })
        
        if not employees:
            raise HTTPException(status_code=400, detail=f"Nenhum funcionário válido encontrado. Erros: {'; '.join(errors)}")
        
        # Import to database
        if replace:
            # Replace all existing employees
            await db.employees.delete_many({})
            await db.employees.insert_many(employees)
            action = "substituídos"
        else:
            # Upsert - update existing or insert new
            for emp in employees:
                await db.employees.update_one(
                    {"matricula": emp["matricula"]},
                    {"$set": emp},
                    upsert=True
                )
            action = "importados/atualizados"
        
        return {
            "success": True,
            "message": f"{len(employees)} funcionários {action} com sucesso",
            "imported_count": len(employees),
            "errors": errors if errors else None
        }
        
    except Exception as e:
        logger.error(f"CSV upload error: {e}")
        raise HTTPException(status_code=400, detail=f"Erro ao processar CSV: {str(e)}")

# Taxi Request CRUD
@api_router.post("/requests", response_model=TaxiRequest)
async def create_request(request_data: TaxiRequestCreate):
    """Create a new taxi request"""
    # Validate passenger count (max 4)
    total_passengers = 1 + len(request_data.additional_passengers)
    if total_passengers > 4:
        raise HTTPException(status_code=400, detail="Máximo de 4 passageiros por táxi")
    
    request_obj = TaxiRequest(
        requester_name=request_data.requester_name,
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

@api_router.get("/requests/active", response_model=List[TaxiRequest])
async def list_active_requests():
    """List all active taxi requests (aguardando or confirmado)"""
    query = {"status": {"$in": ["aguardando", "confirmado"]}}
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
    
    # Send SMS notification for confirmado status
    if status_update.status == "confirmado":
        await notify_passengers_status_change(result, "confirmado")
    
    # Notify SSE clients about status change
    await notify_clients("status_update", result)
    
    return result

@api_router.delete("/requests/{request_id}")
async def cancel_request(request_id: str):
    """Cancel a taxi request (only if status is aguardando) - legacy endpoint"""
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

@api_router.post("/requests/{request_id}/cancel")
async def cancel_request_with_reason(request_id: str, cancel_data: CancelRequest):
    """Cancel a taxi request with a reason"""
    request = await db.taxi_requests.find_one({"id": request_id})
    if not request:
        raise HTTPException(status_code=404, detail="Solicitação não encontrada")
    
    if request["status"] not in ["aguardando", "confirmado"]:
        raise HTTPException(status_code=400, detail="Esta solicitação não pode ser cancelada")
    
    result = await db.taxi_requests.find_one_and_update(
        {"id": request_id},
        {"$set": {
            "status": "cancelado",
            "cancellation_reason": cancel_data.reason,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }},
        return_document=True
    )
    
    result.pop("_id", None)
    
    # Send SMS notification for cancellation
    await notify_passengers_status_change(result, "cancelado", cancel_data.reason)
    
    # Notify SSE clients
    await notify_clients("status_update", result)
    
    return result

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
