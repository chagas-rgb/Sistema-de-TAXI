# ARC Transporte - Taxi Request Web App

## Original Problem Statement
Build a taxi request web app for 'ARC Transporte' with:
- Employee database with matricula, full_name, default_address, phone
- Matrícula auto-lookup to fill Name, Address, AND Phone
- Multi-passenger support (max 4)
- Status tracking: Aguardando, Confirmado, Finalizado
- Cancel option for pending requests
- Admin dashboard with password 'ARC123'
- Real-time SSE updates
- Sound alerts for new requests
- Portuguese language UI
- Navy Blue and White color scheme

### Feature Update (2026-03-19)
- Added "Nome do Solicitante" mandatory field at top of form
- Added phone numbers to employee table and auto-fill
- Admin dashboard shows Solicitante at top + all passenger details with clickable phones

## Architecture
- **Backend**: FastAPI + MongoDB
- **Frontend**: React + Shadcn UI + Tailwind CSS
- **Real-time**: Server-Sent Events (SSE)
- **Database**: MongoDB with collections: employees, taxi_requests

## User Personas
1. **Employee (Passenger)**: Requests taxi via matricula lookup, tracks status
2. **Admin (Dispatcher)**: Views all requests, confirms taxis, finishes rides, calls passengers

## Core Requirements (Static)
- [x] Employee lookup by matricula
- [x] Auto-fill name, address, AND phone
- [x] Multi-passenger support (1-4)
- [x] Request submission with requester name
- [x] Live status tracking
- [x] Request cancellation
- [x] Admin password authentication
- [x] Confirm taxi functionality
- [x] Finish ride functionality
- [x] Real-time SSE updates
- [x] Sound alert for new requests
- [x] Portuguese UI
- [x] Navy Blue/White theme
- [x] Mobile-responsive design
- [x] Nome do Solicitante field
- [x] Clickable phone numbers in admin

## What's Been Implemented
**Date: 2026-03-19**
- Full backend API with FastAPI
- MongoDB integration with 5 sample employees (with phone numbers)
- SSE endpoint for real-time updates
- Passenger Portal with request form
- **Nome do Solicitante** mandatory field
- Employee matricula lookup (name, address, phone)
- Multi-passenger management with full details
- Status page with live updates and passenger info
- Admin dashboard with password protection
- **Solicitante section** at top of each request card
- **All passengers with Name, Address, Phone** (clickable tel: links)
- Request confirmation and finish functionality
- Stats dashboard
- Sound notification for new requests
- Mobile-responsive design

**Update 2: Tracking & Enhanced Cancellation**
- **Acompanhamento (Tracking) page** at /acompanhamento - no password needed
- Real-time SSE updates on tracking page
- Shows all active requests (Aguardando + Confirmado)
- **Cancel with reason** - dropdown with 4 options:
  - Passageiro saiu mais cedo
  - Não é mais necessário
  - Erro na solicitação
  - Outro (with custom text input)
- **cancellation_reason** stored in database
- Admin dashboard shows **"Motivo do Cancelamento"** for cancelled requests
- **Twilio SMS integration** ready (requires credentials):
  - SMS sent when status = Confirmado
  - SMS sent when status = Cancelado (includes reason)

## API Endpoints
- GET /api/employees - List all employees (with phone)
- GET /api/employees/search?matricula={id} - Search employee (with phone)
- POST /api/requests - Create taxi request (with requester_name, passenger phones)
- GET /api/requests - List all requests
- GET /api/requests/active - List active requests (aguardando + confirmado)
- GET /api/requests/{id} - Get request by ID
- PUT /api/requests/{id}/status - Update status
- DELETE /api/requests/{id} - Cancel request (legacy)
- POST /api/requests/{id}/cancel - Cancel with reason
- POST /api/admin/verify - Verify admin password
- GET /api/requests/stream/events - SSE endpoint

## Database Schema

### Employees Collection
```json
{
  "matricula": "101",
  "full_name": "João Silva",
  "default_address": "Rua A, 123 - Centro",
  "phone": "(11) 99999-1001"
}
```

### Taxi Requests Collection
```json
{
  "id": "uuid",
  "requester_name": "Roberto Gerente",
  "main_passenger": {
    "matricula": "101",
    "full_name": "João Silva",
    "address": "Rua A, 123",
    "phone": "(11) 99999-1001"
  },
  "additional_passengers": [...],
  "destination_address": "...",
  "status": "aguardando",
  "created_at": "ISO timestamp",
  "updated_at": "ISO timestamp"
}
```

## Prioritized Backlog

### P0 (Critical) - DONE
- [x] Core taxi request flow
- [x] Admin dashboard
- [x] Real-time updates
- [x] Nome do Solicitante
- [x] Phone numbers integration

### P1 (High)
- [ ] WhatsApp/SMS notifications when taxi is confirmed
- [ ] Driver assignment system
- [ ] Request history for employees

### P2 (Medium)
- [ ] Estimated arrival time
- [ ] Driver ratings
- [ ] Multiple vehicle types
- [ ] Route optimization

## Next Tasks
1. Add WhatsApp/SMS notifications for status changes
2. Implement driver management system
3. Add request history for employees
4. Enhance admin dashboard with analytics
