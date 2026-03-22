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
        driver_info = ""
        if request_data.get('driver_name'):
            driver_info = f" Motorista: {request_data.get('driver_name')}"
            if request_data.get('driver_phone'):
                driver_info += f" - Tel: {request_data.get('driver_phone')}"
        message = f"ARC Transporte: Seu táxi foi CONFIRMADO!{driver_info} Destino: {request_data.get('destination_address', 'N/A')}"
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

class Driver(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    phone: str
    active: bool = True
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class Passenger(BaseModel):
    matricula: str
    full_name: str
    address: str = ""
    phone: str = ""

class StatusLog(BaseModel):
    status: str
    timestamp: str
    changed_by: str = "system"  # admin, system, user
    notes: str = ""

class TaxiRequest(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    requester_name: str = ""
    main_passenger: Passenger
    additional_passengers: List[Passenger] = []
    # Origin and Destination
    origin_type: str = "fixar"  # fixar, outro
    origin_address: str = "FIXAR"
    destination_type: str = "cadastrado"  # cadastrado, outro
    destination_address: str = ""
    # Status
    status: str = "aguardando"
    cancellation_reason: str = ""
    # Driver info
    driver_name: str = ""
    driver_phone: str = ""
    driver_id: str = ""
    # Scheduling
    is_scheduled: bool = False
    scheduled_date: str = ""
    scheduled_time: str = ""
    scheduled_datetime: str = ""
    # Status history
    status_logs: List[dict] = []
    # Timestamps
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    updated_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class TaxiRequestCreate(BaseModel):
    requester_name: str
    main_passenger: Passenger
    additional_passengers: List[Passenger] = []
    origin_type: str = "fixar"
    origin_address: str = "FIXAR"
    destination_type: str = "cadastrado"
    destination_address: str = ""
    is_scheduled: bool = False
    scheduled_date: str = ""
    scheduled_time: str = ""

class StatusUpdate(BaseModel):
    status: str

class DriverAssignment(BaseModel):
    driver_id: str = ""  # Empty if "Outro"
    driver_name: str = ""
    driver_phone: str = ""

class ScheduleUpdate(BaseModel):
    scheduled_date: str
    scheduled_time: str

class CancelRequest(BaseModel):
    reason: str

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

SAMPLE_DRIVERS = [
    {"id": "d001", "name": "Roberto Motorista", "phone": "(11) 98888-0001", "active": True},
    {"id": "d002", "name": "Fernando Taxi", "phone": "(11) 98888-0002", "active": True},
    {"id": "d003", "name": "Marcos Corrida", "phone": "(11) 98888-0003", "active": True},
]

# ==================== STARTUP ====================

@app.on_event("startup")
async def startup_db():
    """Initialize database with sample data"""
    # Check employees
    sample_employee = await db.employees.find_one({"matricula": "101"})
    if sample_employee and "phone" not in sample_employee:
        await db.employees.drop()
        await db.employees.insert_many(SAMPLE_EMPLOYEES)
        logger.info("Employees updated with phone numbers")
    elif not sample_employee:
        await db.employees.insert_many(SAMPLE_EMPLOYEES)
        logger.info("Sample employees inserted into database")
    
    # Check drivers
    driver_count = await db.drivers.count_documents({})
    if driver_count == 0:
        await db.drivers.insert_many(SAMPLE_DRIVERS)
        logger.info("Sample drivers inserted into database")
    else:
        logger.info(f"Drivers collection has {driver_count} documents")

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()

# ==================== SSE EVENT TRACKING ====================

request_events = asyncio.Queue()

async def notify_clients(event_type: str, data: dict):
    """Push event to SSE queue"""
    await request_events.put({"type": event_type, "data": data})

# ==================== EMPLOYEE ROUTES ====================

@api_router.get("/")
async def root():
    return {"message": "ARC Transporte API"}

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
    """Upload CSV file to import employees"""
    if not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="Arquivo deve ser CSV")
    
    try:
        contents = await file.read()
        try:
            decoded = contents.decode('utf-8')
        except UnicodeDecodeError:
            decoded = contents.decode('latin-1')
        
        reader = csv.DictReader(io.StringIO(decoded))
        employees = []
        errors = []
        row_num = 1
        
        for row in reader:
            row_num += 1
            normalized = {}
            for key, value in row.items():
                if key:
                    normalized[key.lower().strip()] = value.strip() if value else ""
            
            matricula = normalized.get('matricula') or normalized.get('matrícula') or normalized.get('id')
            full_name = normalized.get('name') or normalized.get('full_name') or normalized.get('nome')
            address = normalized.get('address') or normalized.get('default_address') or normalized.get('endereco')
            phone = normalized.get('phone') or normalized.get('telefone') or normalized.get('tel')
            
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
            raise HTTPException(status_code=400, detail=f"Nenhum funcionário válido. Erros: {'; '.join(errors)}")
        
        if replace:
            await db.employees.delete_many({})
            await db.employees.insert_many(employees)
            action = "substituídos"
        else:
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

# ==================== DRIVER ROUTES ====================

@api_router.get("/drivers", response_model=List[Driver])
async def list_drivers(active_only: bool = True):
    """List all drivers"""
    query = {"active": True} if active_only else {}
    drivers = await db.drivers.find(query, {"_id": 0}).to_list(100)
    return drivers

@api_router.post("/drivers", response_model=Driver)
async def create_driver(name: str, phone: str):
    """Create a new driver"""
    driver = Driver(name=name, phone=phone)
    await db.drivers.insert_one(driver.model_dump())
    return driver

@api_router.post("/drivers/upload-csv")
async def upload_drivers_csv(file: UploadFile = File(...), replace: bool = False):
    """Upload CSV file to import drivers"""
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
            normalized = {}
            for key, value in row.items():
                if key:
                    normalized[key.lower().strip()] = value.strip() if value else ""
            
            name = normalized.get('name') or normalized.get('nome') or normalized.get('motorista')
            phone = normalized.get('phone') or normalized.get('telefone') or normalized.get('tel')
            
            if not name:
                errors.append(f"Linha {row_num}: Nome não encontrado")
                continue
            
            drivers.append({
                "id": str(uuid.uuid4()),
                "name": name,
                "phone": phone or "",
                "active": True,
                "created_at": datetime.now(timezone.utc).isoformat()
            })
        
        if not drivers:
            raise HTTPException(status_code=400, detail=f"Nenhum motorista válido. Erros: {'; '.join(errors)}")
        
        if replace:
            await db.drivers.delete_many({})
        
        await db.drivers.insert_many(drivers)
        
        return {
            "success": True,
            "message": f"{len(drivers)} motoristas importados com sucesso",
            "imported_count": len(drivers),
            "errors": errors if errors else None
        }
    except Exception as e:
        logger.error(f"Drivers CSV upload error: {e}")
        raise HTTPException(status_code=400, detail=f"Erro ao processar CSV: {str(e)}")

@api_router.delete("/drivers/{driver_id}")
async def deactivate_driver(driver_id: str):
    """Deactivate a driver"""
    result = await db.drivers.update_one(
        {"id": driver_id},
        {"$set": {"active": False}}
    )
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Motorista não encontrado")
    return {"message": "Motorista desativado"}

# ==================== TAXI REQUEST ROUTES ====================

@api_router.post("/requests", response_model=TaxiRequest)
async def create_request(request_data: TaxiRequestCreate):
    """Create a new taxi request"""
    total_passengers = 1 + len(request_data.additional_passengers)
    if total_passengers > 4:
        raise HTTPException(status_code=400, detail="Máximo de 4 passageiros por táxi")
    
    scheduled_datetime = ""
    if request_data.is_scheduled and request_data.scheduled_date and request_data.scheduled_time:
        scheduled_datetime = f"{request_data.scheduled_date}T{request_data.scheduled_time}:00"
    
    # Initial status log
    initial_log = {
        "status": "aguardando",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "changed_by": "system",
        "notes": "Solicitação criada"
    }
    
    request_obj = TaxiRequest(
        requester_name=request_data.requester_name,
        main_passenger=request_data.main_passenger,
        additional_passengers=request_data.additional_passengers,
        origin_type=request_data.origin_type,
        origin_address=request_data.origin_address,
        destination_type=request_data.destination_type,
        destination_address=request_data.destination_address,
        is_scheduled=request_data.is_scheduled,
        scheduled_date=request_data.scheduled_date,
        scheduled_time=request_data.scheduled_time,
        scheduled_datetime=scheduled_datetime,
        status_logs=[initial_log]
    )
    
    doc = request_obj.model_dump()
    await db.taxi_requests.insert_one(doc)
    await notify_clients("new_request", doc)
    
    return request_obj

@api_router.get("/requests", response_model=List[TaxiRequest])
async def list_requests(
    status: Optional[str] = None, 
    scheduled: Optional[bool] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None
):
    """List taxi requests with optional filters"""
    query = {}
    if status:
        query["status"] = status
    if scheduled is not None:
        query["is_scheduled"] = scheduled
    if start_date:
        query["created_at"] = {"$gte": start_date}
    if end_date:
        if "created_at" in query:
            query["created_at"]["$lte"] = end_date + "T23:59:59"
        else:
            query["created_at"] = {"$lte": end_date + "T23:59:59"}
    
    requests = await db.taxi_requests.find(query, {"_id": 0}).sort("created_at", -1).to_list(500)
    return requests

@api_router.get("/requests/active", response_model=List[TaxiRequest])
async def list_active_requests():
    """List all active taxi requests"""
    query = {"status": {"$in": ["aguardando", "confirmado"]}}
    requests = await db.taxi_requests.find(query, {"_id": 0}).sort("created_at", -1).to_list(100)
    return requests

@api_router.get("/requests/scheduled", response_model=List[TaxiRequest])
async def list_scheduled_requests():
    """List scheduled requests sorted by scheduled time"""
    query = {"is_scheduled": True, "status": {"$in": ["aguardando", "confirmado"]}}
    requests = await db.taxi_requests.find(query, {"_id": 0}).sort("scheduled_datetime", 1).to_list(100)
    return requests

@api_router.get("/requests/immediate", response_model=List[TaxiRequest])
async def list_immediate_requests():
    """List immediate (non-scheduled) requests"""
    query = {"$or": [{"is_scheduled": False}, {"is_scheduled": {"$exists": False}}], "status": {"$in": ["aguardando", "confirmado"]}}
    requests = await db.taxi_requests.find(query, {"_id": 0}).sort("created_at", -1).to_list(100)
    return requests

@api_router.get("/requests/history")
async def get_history(start_date: Optional[str] = None, end_date: Optional[str] = None):
    """Get request history with date filtering"""
    query = {}
    if start_date:
        query["created_at"] = {"$gte": start_date + "T00:00:00"}
    if end_date:
        if "created_at" in query:
            query["created_at"]["$lte"] = end_date + "T23:59:59"
        else:
            query["created_at"] = {"$lte": end_date + "T23:59:59"}
    
    requests = await db.taxi_requests.find(query, {"_id": 0}).sort("created_at", -1).to_list(1000)
    return requests

@api_router.get("/requests/export-csv")
async def export_requests_csv(start_date: Optional[str] = None, end_date: Optional[str] = None):
    """Export requests to CSV"""
    query = {}
    if start_date:
        query["created_at"] = {"$gte": start_date + "T00:00:00"}
    if end_date:
        if "created_at" in query:
            query["created_at"]["$lte"] = end_date + "T23:59:59"
        else:
            query["created_at"] = {"$lte": end_date + "T23:59:59"}
    
    requests = await db.taxi_requests.find(query, {"_id": 0}).sort("created_at", -1).to_list(1000)
    
    output = io.StringIO()
    writer = csv.writer(output)
    
    # Header
    writer.writerow([
        "ID", "Data Criação", "Solicitante", "Passageiro Principal", "Matricula",
        "Telefone", "Origem", "Destino", "Status", "Agendado", "Data Agendamento",
        "Hora Agendamento", "Motorista", "Tel Motorista", "Motivo Cancelamento"
    ])
    
    for req in requests:
        main_p = req.get('main_passenger', {})
        writer.writerow([
            req.get('id', '')[:8],
            req.get('created_at', '')[:19].replace('T', ' '),
            req.get('requester_name', ''),
            main_p.get('full_name', ''),
            main_p.get('matricula', ''),
            main_p.get('phone', ''),
            req.get('origin_address', ''),
            req.get('destination_address', ''),
            req.get('status', ''),
            'Sim' if req.get('is_scheduled') else 'Não',
            req.get('scheduled_date', ''),
            req.get('scheduled_time', ''),
            req.get('driver_name', ''),
            req.get('driver_phone', ''),
            req.get('cancellation_reason', '')
        ])
    
    output.seek(0)
    
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=relatorio_taxi_{datetime.now().strftime('%Y%m%d')}.csv"}
    )

@api_router.get("/requests/{request_id}", response_model=TaxiRequest)
async def get_request(request_id: str):
    """Get a single taxi request by ID"""
    request = await db.taxi_requests.find_one({"id": request_id}, {"_id": 0})
    if not request:
        raise HTTPException(status_code=404, detail="Solicitação não encontrada")
    return request

@api_router.put("/requests/{request_id}/status", response_model=TaxiRequest)
async def update_request_status(request_id: str, status_update: StatusUpdate):
    """Update status of a taxi request"""
    valid_statuses = ["aguardando", "confirmado", "finalizado", "cancelado"]
    if status_update.status not in valid_statuses:
        raise HTTPException(status_code=400, detail=f"Status inválido. Use: {', '.join(valid_statuses)}")
    
    # Add status log
    status_log = {
        "status": status_update.status,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "changed_by": "admin",
        "notes": ""
    }
    
    result = await db.taxi_requests.find_one_and_update(
        {"id": request_id},
        {
            "$set": {
                "status": status_update.status,
                "updated_at": datetime.now(timezone.utc).isoformat()
            },
            "$push": {"status_logs": status_log}
        },
        return_document=True
    )
    
    if not result:
        raise HTTPException(status_code=404, detail="Solicitação não encontrada")
    
    result.pop("_id", None)
    
    if status_update.status == "confirmado":
        await notify_passengers_status_change(result, "confirmado")
    
    await notify_clients("status_update", result)
    
    return result

@api_router.put("/requests/{request_id}/assign-driver", response_model=TaxiRequest)
async def assign_driver(request_id: str, assignment: DriverAssignment):
    """Assign a driver to a request"""
    # Add status log
    status_log = {
        "status": "driver_assigned",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "changed_by": "admin",
        "notes": f"Motorista designado: {assignment.driver_name}"
    }
    
    result = await db.taxi_requests.find_one_and_update(
        {"id": request_id},
        {
            "$set": {
                "driver_id": assignment.driver_id,
                "driver_name": assignment.driver_name,
                "driver_phone": assignment.driver_phone,
                "updated_at": datetime.now(timezone.utc).isoformat()
            },
            "$push": {"status_logs": status_log}
        },
        return_document=True
    )
    
    if not result:
        raise HTTPException(status_code=404, detail="Solicitação não encontrada")
    
    result.pop("_id", None)
    await notify_clients("driver_assigned", result)
    
    return result

@api_router.put("/requests/{request_id}/schedule", response_model=TaxiRequest)
async def update_schedule(request_id: str, schedule: ScheduleUpdate):
    """Update scheduled date/time"""
    scheduled_datetime = f"{schedule.scheduled_date}T{schedule.scheduled_time}:00"
    
    status_log = {
        "status": "schedule_updated",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "changed_by": "user",
        "notes": f"Agendamento alterado para {schedule.scheduled_date} às {schedule.scheduled_time}"
    }
    
    result = await db.taxi_requests.find_one_and_update(
        {"id": request_id},
        {
            "$set": {
                "scheduled_date": schedule.scheduled_date,
                "scheduled_time": schedule.scheduled_time,
                "scheduled_datetime": scheduled_datetime,
                "updated_at": datetime.now(timezone.utc).isoformat()
            },
            "$push": {"status_logs": status_log}
        },
        return_document=True
    )
    
    if not result:
        raise HTTPException(status_code=404, detail="Solicitação não encontrada")
    
    result.pop("_id", None)
    await notify_clients("schedule_update", result)
    
    return result

@api_router.delete("/requests/{request_id}")
async def cancel_request(request_id: str):
    """Cancel a taxi request (legacy endpoint)"""
    request = await db.taxi_requests.find_one({"id": request_id})
    if not request:
        raise HTTPException(status_code=404, detail="Solicitação não encontrada")
    
    if request["status"] != "aguardando":
        raise HTTPException(status_code=400, detail="Apenas solicitações aguardando podem ser canceladas")
    
    await db.taxi_requests.update_one(
        {"id": request_id},
        {"$set": {"status": "cancelado", "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    
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
    
    status_log = {
        "status": "cancelado",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "changed_by": "user",
        "notes": f"Motivo: {cancel_data.reason}"
    }
    
    result = await db.taxi_requests.find_one_and_update(
        {"id": request_id},
        {
            "$set": {
                "status": "cancelado",
                "cancellation_reason": cancel_data.reason,
                "updated_at": datetime.now(timezone.utc).isoformat()
            },
            "$push": {"status_logs": status_log}
        },
        return_document=True
    )
    
    result.pop("_id", None)
    await notify_passengers_status_change(result, "cancelado", cancel_data.reason)
    await notify_clients("status_update", result)
    
    return result

# ==================== ADMIN ROUTES ====================

@api_router.post("/admin/verify")
async def verify_admin(verify_data: AdminVerify):
    """Verify admin password"""
    if verify_data.password == "ARC123":
        return {"verified": True}
    raise HTTPException(status_code=401, detail="Senha incorreta")

# ==================== SSE ENDPOINT ====================

@api_router.get("/requests/stream/events")
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

# Include router and middleware
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)
