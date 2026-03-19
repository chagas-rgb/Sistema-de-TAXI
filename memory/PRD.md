# ARC Transporte - Taxi Request Web App

## Original Problem Statement
Build a taxi request web app for 'ARC Transporte' with:
- Employee database with matricula, full_name, default_address
- Matrícula auto-lookup to fill Name and Address
- Multi-passenger support (max 4)
- Status tracking: Aguardando, Confirmado, Finalizado
- Cancel option for pending requests
- Admin dashboard with password 'ARC123'
- Real-time SSE updates
- Sound alerts for new requests
- Portuguese language UI
- Navy Blue and White color scheme

## Architecture
- **Backend**: FastAPI + MongoDB
- **Frontend**: React + Shadcn UI + Tailwind CSS
- **Real-time**: Server-Sent Events (SSE)
- **Database**: MongoDB with collections: employees, taxi_requests

## User Personas
1. **Employee (Passenger)**: Requests taxi via matricula lookup, tracks status
2. **Admin (Dispatcher)**: Views all requests, confirms taxis, finishes rides

## Core Requirements (Static)
- [x] Employee lookup by matricula
- [x] Auto-fill name and address
- [x] Multi-passenger support (1-4)
- [x] Request submission
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

## What's Been Implemented
**Date: 2026-03-19**
- Full backend API with FastAPI
- MongoDB integration with 5 sample employees
- SSE endpoint for real-time updates
- Passenger Portal with request form
- Employee matricula lookup
- Multi-passenger management
- Status page with live updates
- Admin dashboard with password protection
- Request confirmation and finish functionality
- Stats dashboard (Aguardando, Em Andamento, Finalizados)
- Sound notification for new requests
- Mobile-responsive design

## API Endpoints
- GET /api/employees - List all employees
- GET /api/employees/search?matricula={id} - Search employee
- POST /api/requests - Create taxi request
- GET /api/requests - List all requests
- GET /api/requests/{id} - Get request by ID
- PUT /api/requests/{id}/status - Update status
- DELETE /api/requests/{id} - Cancel request
- POST /api/admin/verify - Verify admin password
- GET /api/requests/stream/events - SSE endpoint

## Prioritized Backlog

### P0 (Critical) - DONE
- [x] Core taxi request flow
- [x] Admin dashboard
- [x] Real-time updates

### P1 (High)
- [ ] SMS/Email notifications when taxi is confirmed
- [ ] Driver assignment system
- [ ] Request history for employees

### P2 (Medium)
- [ ] Estimated arrival time
- [ ] Driver ratings
- [ ] Multiple vehicle types
- [ ] Route optimization

## Next Tasks
1. Add SMS/Email notifications for status changes
2. Implement driver management system
3. Add request history for employees
4. Enhance admin dashboard with analytics
