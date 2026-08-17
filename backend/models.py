"""
Multi-Tenant Data Models
Platform → Operator → Client Company → Passengers/Drivers/Vehicles → Trips
"""
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional
from datetime import datetime, timezone
import uuid

# ==================== PLATFORM MODELS ====================

class Platform(BaseModel):
    """Platform-level settings (singleton)"""
    model_config = ConfigDict(extra="ignore")
    id: str = "platform"
    name: str = "Transportation Management Platform"
    owner_email: str = ""
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    settings: dict = {}

# ==================== OPERATOR MODELS ====================

class OperatorBranding(BaseModel):
    """Operator branding configuration"""
    logo_url: Optional[str] = None
    primary_color: str = "#1e3a5f"
    secondary_color: str = "#ffffff"
    favicon_url: Optional[str] = None

class Operator(BaseModel):
    """Transportation operator (e.g., ARC Transporte)"""
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    trade_name: str = ""  # Nome fantasia
    tax_id: str = ""  # CNPJ
    email: str = ""
    phone: str = ""
    address: str = ""
    city: str = ""
    state: str = ""
    branding: OperatorBranding = OperatorBranding()
    status: str = "active"  # active, inactive, suspended
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    updated_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class OperatorCreate(BaseModel):
    name: str
    trade_name: str = ""
    tax_id: str = ""
    email: str = ""
    phone: str = ""
    address: str = ""
    city: str = ""
    state: str = ""
    branding: Optional[OperatorBranding] = None

# ==================== CLIENT COMPANY MODELS ====================

class ClientCompanyContact(BaseModel):
    """Contact person for a client company"""
    name: str
    role: str = ""  # e.g., "HR Manager", "Transport Coordinator"
    email: str = ""
    phone: str = ""

class ClientCompany(BaseModel):
    """Client company that uses the transportation service"""
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    operator_id: str  # Which operator manages this client
    legal_name: str  # Razão social
    trade_name: str = ""  # Nome fantasia
    tax_id: str = ""  # CNPJ
    contacts: List[ClientCompanyContact] = []
    phone: str = ""
    email: str = ""
    address: str = ""
    city: str = ""
    state: str = ""
    neighborhood: str = ""
    default_pickup_address: str = ""  # Default origin for rides (company HQ)
    notes: str = ""
    status: str = "active"  # active, inactive, suspended
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    updated_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class ClientCompanyCreate(BaseModel):
    operator_id: str
    legal_name: str
    trade_name: str = ""
    tax_id: str = ""
    contacts: List[ClientCompanyContact] = []
    phone: str = ""
    email: str = ""
    address: str = ""
    city: str = ""
    state: str = ""
    neighborhood: str = ""
    default_pickup_address: str = ""
    notes: str = ""

# ==================== PASSENGER MODELS ====================

class Passenger(BaseModel):
    """Central passenger database - reusable across trips"""
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    operator_id: str
    client_company_id: str
    matricula: str = ""  # Employee registration ID
    name: str
    phone: str = ""
    email: str = ""
    address: str = ""
    neighborhood: str = ""
    city: str = ""
    pickup_point: str = ""  # Specific pickup location notes
    notes: str = ""
    status: str = "active"  # active, inactive
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    updated_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class PassengerCreate(BaseModel):
    client_company_id: str
    matricula: str = ""
    name: str
    phone: str = ""
    email: str = ""
    address: str = ""
    neighborhood: str = ""
    city: str = ""
    pickup_point: str = ""
    notes: str = ""

class PassengerInTrip(BaseModel):
    """Passenger info embedded in a trip"""
    passenger_id: str
    matricula: str = ""
    name: str
    phone: str = ""
    address: str = ""
    neighborhood: str = ""
    city: str = ""
    pickup_point: str = ""
    stop_order: int = 0  # Order in route

# ==================== DRIVER MODELS ====================

class DriverAvailability(BaseModel):
    """Driver availability schedule"""
    monday: bool = True
    tuesday: bool = True
    wednesday: bool = True
    thursday: bool = True
    friday: bool = True
    saturday: bool = False
    sunday: bool = False
    start_time: str = "06:00"
    end_time: str = "22:00"

class Driver(BaseModel):
    """Driver working for an operator"""
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    operator_id: str
    user_id: Optional[str] = None  # Link to user account for driver portal
    name: str
    phone: str = ""
    email: str = ""
    document: str = ""  # CPF
    license_number: str = ""  # CNH
    license_category: str = ""  # A, B, C, D, E
    license_expiry: str = ""
    photo_url: Optional[str] = None
    authorized_cities: List[str] = []  # Cities driver can operate in
    availability: DriverAvailability = DriverAvailability()
    default_vehicle_id: Optional[str] = None
    status: str = "available"  # available, on_trip, unavailable, day_off, vacation
    notes: str = ""
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    updated_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class DriverCreate(BaseModel):
    name: str
    phone: str = ""
    email: str = ""
    document: str = ""
    license_number: str = ""
    license_category: str = ""
    license_expiry: str = ""
    authorized_cities: List[str] = []
    availability: Optional[DriverAvailability] = None
    default_vehicle_id: Optional[str] = None
    notes: str = ""

# ==================== VEHICLE MODELS ====================

class VehicleType:
    CAR = "car"
    VAN = "van"
    BUS = "bus"
    TAXI = "taxi"
    MINIBUS = "minibus"

DEFAULT_CAPACITIES = {
    VehicleType.CAR: 4,
    VehicleType.TAXI: 4,
    VehicleType.VAN: 6,
    VehicleType.MINIBUS: 15,
    VehicleType.BUS: 40,
}

class Vehicle(BaseModel):
    """Vehicle in operator's fleet"""
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    operator_id: str
    brand: str = ""
    model: str = ""
    plate: str
    vehicle_type: str = VehicleType.CAR
    capacity: int = 4
    color: str = ""
    year: str = ""
    primary_driver_id: Optional[str] = None
    status: str = "available"  # available, on_trip, maintenance, inactive
    notes: str = ""
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    updated_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class VehicleCreate(BaseModel):
    brand: str = ""
    model: str = ""
    plate: str
    vehicle_type: str = VehicleType.CAR
    capacity: Optional[int] = None  # If None, use default for type
    color: str = ""
    year: str = ""
    primary_driver_id: Optional[str] = None
    notes: str = ""

# ==================== TRIP/ROUTE MODELS ====================

class TripStop(BaseModel):
    """A stop in a trip route"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    order: int
    passenger_id: Optional[str] = None
    passenger_name: str = ""
    address: str
    neighborhood: str = ""
    city: str = ""
    lat: Optional[float] = None  # For future GPS integration
    lng: Optional[float] = None
    scheduled_time: str = ""
    actual_arrival_time: Optional[str] = None
    status: str = "pending"  # pending, arrived, completed, skipped
    notes: str = ""

class TripStatus:
    PENDING = "pending"        # Created, not yet assigned
    SCHEDULED = "scheduled"    # Assigned and scheduled
    CONFIRMED = "confirmed"    # Driver confirmed
    IN_PROGRESS = "in_progress"  # Trip started
    COMPLETED = "completed"    # Trip finished
    CANCELLED = "cancelled"    # Trip cancelled

class Trip(BaseModel):
    """A trip/ride request"""
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    operator_id: str
    client_company_id: str
    
    # Legacy compatibility
    requester_name: str = ""
    requester_user_id: Optional[str] = None
    
    # Trip type
    trip_type: str = "on_demand"  # on_demand, fixed_route, recurring
    is_scheduled: bool = False
    scheduled_date: str = ""
    scheduled_time: str = ""
    scheduled_datetime: str = ""
    recurrence_pattern: Optional[str] = None  # daily, weekly, monthly
    
    # Origin/Destination
    origin_type: str = "fixed"  # fixed (company HQ), custom
    origin_address: str = ""
    origin_neighborhood: str = ""
    origin_city: str = ""
    origin_lat: Optional[float] = None
    origin_lng: Optional[float] = None
    
    destination_type: str = "registered"  # registered (passenger address), custom
    destination_address: str = ""
    destination_neighborhood: str = ""
    destination_city: str = ""
    destination_lat: Optional[float] = None
    destination_lng: Optional[float] = None
    
    # Passengers
    passengers: List[PassengerInTrip] = []
    passenger_count: int = 0
    
    # Assignment
    driver_id: Optional[str] = None
    driver_name: str = ""
    driver_phone: str = ""
    vehicle_id: Optional[str] = None
    vehicle_plate: str = ""
    vehicle_type: str = ""
    
    # Route (for multi-stop trips)
    stops: List[TripStop] = []
    
    # Status tracking
    status: str = TripStatus.PENDING
    status_history: List[dict] = []
    cancellation_reason: str = ""
    
    # Timestamps
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    updated_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    started_at: Optional[str] = None
    completed_at: Optional[str] = None
    
    # Driver notes/incidents
    driver_notes: str = ""
    incidents: List[dict] = []
    proof_photos: List[str] = []
    
    # Voucher tracking
    voucher_number: str = ""  # Optional voucher/reference number

class TripCreate(BaseModel):
    client_company_id: str
    requester_name: str = ""
    trip_type: str = "on_demand"
    is_scheduled: bool = False
    scheduled_date: str = ""
    scheduled_time: str = ""
    origin_type: str = "fixed"
    origin_address: str = ""
    origin_city: str = ""
    destination_type: str = "registered"
    destination_address: str = ""
    destination_city: str = ""
    passengers: List[PassengerInTrip] = []

# ==================== LEGACY COMPATIBILITY ====================

class LegacyTaxiRequest(BaseModel):
    """Compatibility model for existing taxi_requests"""
    id: str
    requester_name: str = ""
    main_passenger: dict = {}
    additional_passengers: List[dict] = []
    origin_type: str = "fixar"
    origin_address: str = "FIXAR"
    destination_type: str = "cadastrado"
    destination_address: str = ""
    status: str = "aguardando"
    cancellation_reason: str = ""
    driver_name: str = ""
    driver_phone: str = ""
    driver_id: str = ""
    is_scheduled: bool = False
    scheduled_date: str = ""
    scheduled_time: str = ""
    scheduled_datetime: str = ""
    status_logs: List[dict] = []
    created_at: str = ""
    updated_at: str = ""
