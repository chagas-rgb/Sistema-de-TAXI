# ARC Transportation Platform - Product Requirements Document

## Version 2.0 - Multi-Tenant Transportation Management Platform

---

## Original Problem Statement

Build a multi-tenant transportation management platform that evolves from the existing "ARC Transporte" taxi request app to support:
- Multiple transportation operators (my businesses)
- Multiple client companies per operator (my customers)
- Fleet management for taxis, vans, and buses
- Smart trip assembly and route optimization
- Driver and client portals
- Advanced reporting and exports

---

## Architecture

### Multi-Tenant Hierarchy
```
Platform (1)
  └── Operators (Many) - Transportation companies I operate
        └── Client Companies (Many) - Businesses that use my service
              └── Passengers (Many) - Employees who request rides
        └── Drivers (Many) - My drivers
        └── Vehicles (Many) - My fleet
        └── Trips (Many) - Ride requests/routes
```

### User Roles
1. **Platform Owner** - Full access across all operators (devchagass@gmail.com)
2. **Operator Admin** - Manages one operator's resources
3. **Client Admin** - Manages one client company
4. **Client User** - Views client company data
5. **Driver** - Views assigned trips

---

## Tech Stack
- **Backend**: FastAPI + Python 3.11
- **Frontend**: React 18 + Vite + Tailwind CSS + Shadcn/UI
- **Database**: MongoDB (Motor async driver)
- **Authentication**: JWT-based with bcrypt
- **Real-time**: Server-Sent Events (SSE)

---

## Database Collections

| Collection | Purpose |
|------------|---------|
| platform | Platform settings (singleton) |
| users | User accounts with roles |
| operators | Transportation operators |
| client_companies | Client companies |
| passengers | Passenger database |
| drivers_v2 | Driver registry (migrated) |
| vehicles | Vehicle fleet |
| trips | Trip/ride requests |
| employees | Legacy (migrated to passengers) |
| drivers | Legacy (migrated to drivers_v2) |
| taxi_requests | Legacy (migrated to trips) |

---

## What's Been Implemented

### Phase 1: Foundations ✅
- [x] Multi-tenant data model (Platform → Operator → Client Company)
- [x] JWT authentication with role-based access control
- [x] Auto-migration of existing ARC data as first Operator
- [x] Platform Owner account (devchagass@gmail.com)
- [x] Operator Admin accounts
- [x] Tenant filtering on all queries

### Phase 2: Core Registries ✅
- [x] Client Company CRUD (legal_name, trade_name, CNPJ, contacts)
- [x] Central Passenger Database (matricula, name, address, city, neighborhood)
- [x] Driver Registry (name, phone, CNH, authorized_cities, availability)
- [x] Vehicle Registry (brand, model, plate, type, capacity, primary_driver)
- [x] CSV Import for passengers and drivers
- [x] Search and filtering

### Phase 3: Import & Smart Assembly ✅
- [x] Spreadsheet preview endpoint with validation
- [x] Column auto-detection (flexible mapping)
- [x] Passenger matching with existing database
- [x] Smart Trip Assembly Engine
  - Groups passengers by city, neighborhood, time, destination
  - Suggests optimal vehicle type based on passenger count
  - Auto-assigns available drivers
  - Handles capacity splitting
- [x] Bulk trip confirmation

### Phase 4: Portals ✅
- [x] Driver Portal (mobile-friendly)
  - Today's trips view
  - Upcoming trips view
  - Trip details with passenger info
  - Start/Complete trip actions
  - Quick call passenger
- [x] Client Company Portal
  - Active trips dashboard
  - Trip history with search/filters
  - Statistics (total, active, completed, cancelled)
- [x] Updated Admin Dashboard
  - All CRUD operations
  - CSV import with preview

### Phase 5: Reporting & Export ✅
- [x] Reports summary endpoint (by driver, city, company, vehicle type)
- [x] Trips CSV export with filters
- [x] Drivers CSV export
- [x] Passengers CSV export
- [x] Date range filtering
- [x] Statistics (completion rate, total passengers, etc.)

### Phase 6: Validations & Notifications ✅
- [x] Server-side validation module
  - Driver availability checks
  - City authorization validation
  - Vehicle capacity validation
  - Time conflict detection
  - Duplicate passenger warnings
- [x] Notification service abstraction
  - In-app notifications (SSE)
  - SMS channel (Twilio-ready, mocked)
  - WhatsApp placeholder (ready for integration)
  - Push notification placeholder
  - Trip confirmed/cancelled notifications

### Legacy Compatibility ✅
- [x] All existing `/api/requests` endpoints work
- [x] `/api/employees` endpoints work
- [x] `/api/drivers` endpoints work
- [x] Legacy admin password (ARC123) still works
- [x] Public tracking page works
- [x] SSE real-time updates work

---

## API Endpoints

### Authentication
- `POST /api/auth/login` - Login
- `POST /api/auth/register` - Register (admin only)
- `GET /api/auth/me` - Current user info
- `POST /api/auth/change-password` - Change password

### Operators (Platform Owner only)
- `GET /api/operators` - List operators
- `POST /api/operators` - Create operator
- `GET /api/operators/{id}` - Get operator
- `PUT /api/operators/{id}` - Update operator

### Client Companies
- `GET /api/companies` - List companies
- `POST /api/companies` - Create company
- `GET /api/companies/{id}` - Get company
- `PUT /api/companies/{id}` - Update company

### Passengers
- `GET /api/passengers` - List passengers
- `GET /api/passengers/search?matricula=XXX` - Search by matricula
- `POST /api/passengers` - Create passenger
- `PUT /api/passengers/{id}` - Update passenger
- `POST /api/passengers/upload-csv` - CSV import

### Drivers
- `GET /api/drivers` - List drivers
- `POST /api/drivers` - Create driver
- `GET /api/drivers/{id}` - Get driver
- `PUT /api/drivers/{id}` - Update driver
- `PUT /api/drivers/{id}/status` - Update status
- `POST /api/drivers/upload-csv` - CSV import

### Vehicles
- `GET /api/vehicles` - List vehicles
- `POST /api/vehicles` - Create vehicle
- `GET /api/vehicles/{id}` - Get vehicle
- `PUT /api/vehicles/{id}` - Update vehicle

### Trips
- `GET /api/trips` - List trips
- `GET /api/trips/active` - Active trips
- `POST /api/trips` - Create trip
- `GET /api/trips/{id}` - Get trip
- `PUT /api/trips/{id}/status` - Update status
- `PUT /api/trips/{id}/assign-driver` - Assign driver
- `PUT /api/trips/{id}/schedule` - Update schedule
- `POST /api/trips/{id}/cancel` - Cancel with reason

### Import & Assembly
- `POST /api/import/preview-spreadsheet` - Preview CSV
- `POST /api/import/smart-assembly` - Generate trip suggestions
- `POST /api/import/confirm-trips` - Create trips from suggestions

### Reports
- `GET /api/reports/summary` - Statistics summary
- `GET /api/reports/export/trips` - Export trips CSV
- `GET /api/reports/export/drivers` - Export drivers CSV
- `GET /api/reports/export/passengers` - Export passengers CSV

### Legacy (Backward Compatible)
- `POST /api/requests` - Create taxi request
- `GET /api/requests` - List requests
- `GET /api/requests/active` - Active requests
- `PUT /api/requests/{id}/status` - Update status
- `PUT /api/requests/{id}/assign-driver` - Assign driver
- `POST /api/admin/verify` - Verify admin password

---

## Frontend Routes

| Route | Access | Description |
|-------|--------|-------------|
| `/` | Public | Taxi request form (legacy) |
| `/status/:id` | Public | Request status |
| `/acompanhamento` | Public | Real-time tracking |
| `/admin-control` | Password: ARC123 | Legacy admin panel |
| `/login` | Public | New login page |
| `/platform` | Platform Owner | Platform control dashboard |
| `/admin` | Operator Admin+ | Operator management |
| `/driver` | Driver+ | Driver portal |
| `/portal` | Client User+ | Client portal |

---

## Test Credentials

See `/app/memory/test_credentials.md` for all login credentials.

---

## Files Reference

### Backend
- `/app/backend/server.py` - Main FastAPI application
- `/app/backend/auth.py` - Authentication module
- `/app/backend/models.py` - Pydantic models
- `/app/backend/migrate.py` - Database migration script
- `/app/backend/validations.py` - Business rules validation
- `/app/backend/notifications.py` - Notification service

### Frontend
- `/app/frontend/src/App.js` - Router and providers
- `/app/frontend/src/contexts/AuthContext.jsx` - Auth context
- `/app/frontend/src/pages/LoginPage.jsx` - Login
- `/app/frontend/src/pages/PlatformDashboard.jsx` - Platform owner
- `/app/frontend/src/pages/OperatorAdminDashboard.jsx` - Operator admin
- `/app/frontend/src/pages/DriverPortal.jsx` - Driver portal
- `/app/frontend/src/pages/ClientPortal.jsx` - Client portal
- `/app/frontend/src/components/SmartAssemblyWizard.jsx` - Import wizard

---

## Assumptions Made

1. **Vehicle Capacities**: Default capacities set as Car=4, Van=6, Minibus=15, Bus=40
2. **Time Conflicts**: Trips within the same hour are considered conflicts
3. **Driver Authorization**: Empty authorized_cities means driver can work anywhere
4. **CSV Columns**: Flexible column name matching (e.g., "nome" or "name")
5. **Status Flow**: pending → scheduled → confirmed → in_progress → completed

---

## What Could NOT Be Implemented

1. **Excel Import**: Only CSV is currently supported (would need openpyxl library)
2. **PDF Export**: Returns JSON (would need reportlab or similar library)
3. **Live GPS/Map**: Data model supports lat/lng but no map integration yet
4. **WhatsApp Integration**: Placeholder channel ready for Twilio WhatsApp Business API
5. **Push Notifications**: Placeholder channel ready for Firebase FCM or similar

---

## Suggested Next Steps

1. **Live GPS Tracking**: Integrate Google Maps or Mapbox for driver location
2. **WhatsApp Business**: Configure Twilio WhatsApp for customer notifications
3. **Mobile Apps**: Native iOS/Android apps for drivers
4. **Route Optimization**: Integrate with Google Directions API for stop ordering
5. **Financial Module**: Track trip costs, driver payments, client billing
6. **Analytics Dashboard**: Charts and graphs for business insights

---

## Change Log

### 2024-12-14 (This Session)
- Complete platform rebuild from single-tenant to multi-tenant
- Implemented all 6 phases as requested
- Migrated existing ARC data to new structure
- Added authentication, all registries, smart assembly, portals, reports
- Maintained full backward compatibility with legacy endpoints

---

*Last updated: December 14, 2024*
