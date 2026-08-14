"""
Authentication & Authorization Module
Multi-tenant JWT-based authentication with role-based access control
"""
import os
import jwt
import bcrypt
from datetime import datetime, timezone, timedelta
from typing import Optional, List
from fastapi import HTTPException, Security, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, Field
import uuid

# JWT Configuration
JWT_SECRET = os.environ.get('JWT_SECRET', 'arc-transport-super-secret-key-change-in-production')
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_HOURS = 24

security = HTTPBearer(auto_error=False)

# ==================== MODELS ====================

class UserRole:
    PLATFORM_OWNER = "platform_owner"  # Sees everything across all operators
    OPERATOR_ADMIN = "operator_admin"  # Manages one operator
    CLIENT_ADMIN = "client_admin"      # Manages one client company
    CLIENT_USER = "client_user"        # Views client company data
    DRIVER = "driver"                  # Views own trips only

class TokenPayload(BaseModel):
    user_id: str
    email: str
    role: str
    operator_id: Optional[str] = None
    client_company_id: Optional[str] = None
    exp: datetime

class UserCreate(BaseModel):
    email: str
    password: str
    name: str
    role: str = UserRole.CLIENT_USER
    operator_id: Optional[str] = None
    client_company_id: Optional[str] = None
    phone: Optional[str] = ""

class UserLogin(BaseModel):
    email: str
    password: str

class UserResponse(BaseModel):
    id: str
    email: str
    name: str
    role: str
    operator_id: Optional[str] = None
    client_company_id: Optional[str] = None
    operator_name: Optional[str] = None
    client_company_name: Optional[str] = None
    phone: Optional[str] = ""
    status: str = "active"
    created_at: str

class UserInDB(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    email: str
    password_hash: str
    name: str
    role: str
    operator_id: Optional[str] = None
    client_company_id: Optional[str] = None
    phone: str = ""
    status: str = "active"  # active, inactive, suspended
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    updated_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    last_login: Optional[str] = None

# ==================== PASSWORD UTILS ====================

def hash_password(password: str) -> str:
    """Hash a password using bcrypt"""
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode('utf-8'), salt).decode('utf-8')

def verify_password(password: str, hashed: str) -> bool:
    """Verify a password against its hash"""
    return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))

# ==================== JWT UTILS ====================

def create_access_token(user: dict) -> str:
    """Create a JWT token for a user"""
    payload = {
        "user_id": user["id"],
        "email": user["email"],
        "role": user["role"],
        "operator_id": user.get("operator_id"),
        "client_company_id": user.get("client_company_id"),
        "exp": datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRATION_HOURS)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

def decode_token(token: str) -> dict:
    """Decode and validate a JWT token"""
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expirado")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Token inválido")

# ==================== DEPENDENCIES ====================

async def get_current_user(credentials: HTTPAuthorizationCredentials = Security(security)) -> dict:
    """Get the current authenticated user from the JWT token"""
    if not credentials:
        raise HTTPException(status_code=401, detail="Autenticação necessária")
    
    token = credentials.credentials
    payload = decode_token(token)
    return payload

async def get_current_user_optional(credentials: HTTPAuthorizationCredentials = Security(security)) -> Optional[dict]:
    """Get the current user if authenticated, None otherwise"""
    if not credentials:
        return None
    try:
        return decode_token(credentials.credentials)
    except HTTPException:
        return None

def require_roles(allowed_roles: List[str]):
    """Dependency factory to require specific roles"""
    async def role_checker(current_user: dict = Depends(get_current_user)) -> dict:
        if current_user["role"] not in allowed_roles:
            raise HTTPException(status_code=403, detail="Permissão insuficiente")
        return current_user
    return role_checker

def require_platform_owner():
    """Require platform owner role"""
    return require_roles([UserRole.PLATFORM_OWNER])

def require_operator_admin():
    """Require operator admin or higher"""
    return require_roles([UserRole.PLATFORM_OWNER, UserRole.OPERATOR_ADMIN])

def require_client_admin():
    """Require client admin or higher"""
    return require_roles([UserRole.PLATFORM_OWNER, UserRole.OPERATOR_ADMIN, UserRole.CLIENT_ADMIN])

def require_authenticated():
    """Require any authenticated user"""
    return require_roles([UserRole.PLATFORM_OWNER, UserRole.OPERATOR_ADMIN, UserRole.CLIENT_ADMIN, UserRole.CLIENT_USER, UserRole.DRIVER])

# ==================== ACCESS CONTROL HELPERS ====================

def can_access_operator(user: dict, operator_id: str) -> bool:
    """Check if user can access a specific operator's data"""
    if user["role"] == UserRole.PLATFORM_OWNER:
        return True
    return user.get("operator_id") == operator_id

def can_access_client_company(user: dict, client_company_id: str) -> bool:
    """Check if user can access a specific client company's data"""
    if user["role"] == UserRole.PLATFORM_OWNER:
        return True
    if user["role"] == UserRole.OPERATOR_ADMIN:
        # Operator admins can access all client companies within their operator
        # This requires checking the client company's operator_id - done at route level
        return True
    return user.get("client_company_id") == client_company_id

def filter_by_tenant(user: dict, base_query: dict = None) -> dict:
    """Build a MongoDB query filter based on user's tenant access"""
    query = base_query or {}
    
    if user["role"] == UserRole.PLATFORM_OWNER:
        # Platform owner sees everything
        return query
    
    if user["role"] == UserRole.OPERATOR_ADMIN:
        # Operator admin sees only their operator's data
        query["operator_id"] = user["operator_id"]
        return query
    
    if user["role"] in [UserRole.CLIENT_ADMIN, UserRole.CLIENT_USER]:
        # Client users see only their company's data
        query["operator_id"] = user["operator_id"]
        query["client_company_id"] = user["client_company_id"]
        return query
    
    if user["role"] == UserRole.DRIVER:
        # Drivers see only trips assigned to them
        query["operator_id"] = user["operator_id"]
        query["driver_id"] = user["user_id"]
        return query
    
    # Default: deny all
    query["_deny_access"] = True
    return query
