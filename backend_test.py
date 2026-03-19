import requests
import sys
import json
from datetime import datetime

class ARCTransporteAPITester:
    def __init__(self, base_url="https://arc-taxi-request.preview.emergentagent.com/api"):
        self.base_url = base_url
        self.tests_run = 0
        self.tests_passed = 0

    def run_test(self, name, method, endpoint, expected_status, data=None, headers=None):
        """Run a single API test"""
        url = f"{self.base_url}/{endpoint}" if not endpoint.startswith('http') else endpoint
        req_headers = {'Content-Type': 'application/json'}
        if headers:
            req_headers.update(headers)

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        print(f"   URL: {url}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=req_headers)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=req_headers)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=req_headers)
            elif method == 'DELETE':
                response = requests.delete(url, headers=req_headers)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ PASSED - Status: {response.status_code}")
                try:
                    response_data = response.json()
                    print(f"   Response: {json.dumps(response_data, indent=2)[:200]}...")
                except:
                    print(f"   Response: {response.text[:100]}...")
            else:
                print(f"❌ FAILED - Expected {expected_status}, got {response.status_code}")
                try:
                    error_data = response.json()
                    print(f"   Error: {error_data}")
                except:
                    print(f"   Error: {response.text[:200]}")

            return success, response.json() if response.text and response.text.startswith(('{', '[')) else {}

        except Exception as e:
            print(f"❌ FAILED - Exception: {str(e)}")
            return False, {}

    def test_employee_endpoints(self):
        """Test employee-related endpoints"""
        print("\n" + "="*50)
        print("TESTING EMPLOYEE ENDPOINTS")
        print("="*50)
        
        # Test: GET /api/employees returns 5 sample employees
        success, employees = self.run_test(
            "List All Employees",
            "GET",
            "employees",
            200
        )
        
        if success and isinstance(employees, list):
            print(f"   Found {len(employees)} employees")
            if len(employees) >= 5:
                print("✅ Has required 5+ sample employees")
                # Check if employees have phone field
                first_employee = employees[0] if employees else {}
                if 'phone' in first_employee:
                    print("✅ Employees have phone field")
                    print(f"   Sample phone: {first_employee['phone']}")
                else:
                    print("❌ Employees missing phone field")
            else:
                print(f"⚠️  Only {len(employees)} employees found, expected 5+")
        
        # Test: Search existing employee (matricula 101)
        success, employee = self.run_test(
            "Search Employee - Matricula 101 (Should exist)",
            "GET", 
            "employees/search?matricula=101",
            200
        )
        
        if success and employee.get('full_name') == 'João Silva':
            print("✅ João Silva found correctly")
            # Check if employee has phone number
            if employee.get('phone') == '(11) 99999-1001':
                print("✅ João Silva has correct phone: (11) 99999-1001")
            else:
                print(f"❌ João Silva phone mismatch: {employee.get('phone')}")
        elif success:
            print(f"⚠️  Found different employee: {employee.get('full_name')}")
            
        # Test: Search non-existing employee (matricula 999)
        success, response = self.run_test(
            "Search Employee - Matricula 999 (Should not exist)",
            "GET",
            "employees/search?matricula=999", 
            404
        )
        
        if success:
            print("✅ Correctly returned 404 for non-existing employee")

    def test_taxi_request_endpoints(self):
        """Test taxi request CRUD operations"""
        print("\n" + "="*50)
        print("TESTING TAXI REQUEST ENDPOINTS")
        print("="*50)
        
        # Test: Create new taxi request
        request_data = {
            "requester_name": "Maria Silva - Coordenadora",  # Test requester_name field
            "main_passenger": {
                "matricula": "101",
                "full_name": "João Silva",
                "address": "Rua A, 123 - Centro",
                "phone": "(11) 99999-1001"
            },
            "additional_passengers": [
                {
                    "matricula": "102", 
                    "full_name": "Maria Santos",
                    "address": "Av. Brasil, 456 - Jardim",
                    "phone": "(11) 99999-1002"
                }
            ],
            "destination_address": "Rua do Destino, 123 - Centro"
        }
        
        success, created_request = self.run_test(
            "Create Taxi Request",
            "POST",
            "requests",
            201,
            data=request_data
        )
        
        request_id = None
        if success and created_request.get('id'):
            request_id = created_request['id']
            print(f"✅ Request created with ID: {request_id}")
            
            # Check if requester_name is stored correctly
            if created_request.get('requester_name') == 'Maria Silva - Coordenadora':
                print("✅ Request has correct requester_name: Maria Silva - Coordenadora")
            else:
                print(f"❌ Request requester_name mismatch: {created_request.get('requester_name')}")
            
            # Verify passengers have phone numbers
            main_passenger = created_request.get('main_passenger', {})
            if main_passenger.get('phone'):
                print(f"✅ Main passenger has phone: {main_passenger.get('phone')}")
            else:
                print("❌ Main passenger missing phone number")
            
            # Verify the request has correct status
            if created_request.get('status') == 'aguardando':
                print("✅ Request has correct initial status: aguardando")
            else:
                print(f"⚠️  Request has unexpected status: {created_request.get('status')}")
        
        # Test: List all requests
        success, all_requests = self.run_test(
            "List All Requests", 
            "GET",
            "requests",
            200
        )
        
        if success and isinstance(all_requests, list):
            print(f"✅ Found {len(all_requests)} total requests")
            
            # Check if requests have requester_name field
            if all_requests:
                sample_request = all_requests[0]
                if 'requester_name' in sample_request:
                    print(f"✅ Requests have requester_name field: {sample_request.get('requester_name')}")
                else:
                    print("❌ Requests missing requester_name field")
            
            # Find our created request
            if request_id:
                our_request = next((r for r in all_requests if r.get('id') == request_id), None)
                if our_request:
                    print("✅ Created request found in list")
                else:
                    print("❌ Created request not found in list")
        
        # Test: Get specific request
        if request_id:
            success, specific_request = self.run_test(
                f"Get Specific Request ({request_id[:8]}...)",
                "GET",
                f"requests/{request_id}",
                200
            )
            
            if success and specific_request.get('id') == request_id:
                print("✅ Specific request retrieved correctly")
        
        # Test: Update request status to confirmado
        if request_id:
            success, updated_request = self.run_test(
                "Update Status to Confirmado",
                "PUT", 
                f"requests/{request_id}/status",
                200,
                data={"status": "confirmado"}
            )
            
            if success and updated_request.get('status') == 'confirmado':
                print("✅ Status updated to confirmado successfully")
        
            # Test: Update request status to finalizado
            success, finalized_request = self.run_test(
                "Update Status to Finalizado",
                "PUT",
                f"requests/{request_id}/status", 
                200,
                data={"status": "finalizado"}
            )
            
            if success and finalized_request.get('status') == 'finalizado':
                print("✅ Status updated to finalizado successfully")
                
        # Test: Create another request for cancellation test
        success, cancel_request = self.run_test(
            "Create Request for Cancellation Test",
            "POST", 
            "requests",
            201,
            data=request_data
        )
        
        cancel_request_id = None
        if success and cancel_request.get('id'):
            cancel_request_id = cancel_request['id']
            
            # Test: Cancel request (DELETE)
            success, cancel_response = self.run_test(
                "Cancel Pending Request",
                "DELETE",
                f"requests/{cancel_request_id}",
                200
            )
            
            if success:
                print("✅ Request cancelled successfully")
                
                # Verify the request is now cancelled
                success, cancelled_request = self.run_test(
                    "Verify Cancelled Request Status",
                    "GET",
                    f"requests/{cancel_request_id}",
                    200
                )
                
                if success and cancelled_request.get('status') == 'cancelado':
                    print("✅ Request status correctly updated to cancelado")

    def test_admin_endpoints(self):
        """Test admin verification endpoints"""
        print("\n" + "="*50)
        print("TESTING ADMIN ENDPOINTS")
        print("="*50)
        
        # Test: Admin verification with correct password
        success, admin_response = self.run_test(
            "Admin Verify - Correct Password (ARC123)",
            "POST",
            "admin/verify",
            200,
            data={"password": "ARC123"}
        )
        
        if success and admin_response.get('verified') is True:
            print("✅ Admin verification successful with correct password")
        
        # Test: Admin verification with wrong password  
        success, wrong_response = self.run_test(
            "Admin Verify - Wrong Password",
            "POST", 
            "admin/verify",
            401,
            data={"password": "wrongpassword"}
        )
        
        if success:
            print("✅ Correctly rejected wrong admin password")

    def test_sse_endpoint(self):
        """Test SSE endpoint availability"""
        print("\n" + "="*50)
        print("TESTING SSE ENDPOINT")
        print("="*50)
        
        # Test SSE endpoint accessibility (we can't test the streaming part easily)
        try:
            response = requests.get(f"{self.base_url}/requests/stream/events", timeout=3)
            if response.status_code == 200:
                print("✅ SSE endpoint is accessible")
            else:
                print(f"❌ SSE endpoint returned status: {response.status_code}")
        except requests.exceptions.Timeout:
            print("✅ SSE endpoint is streaming (timeout after 3s is expected)")
        except Exception as e:
            print(f"❌ SSE endpoint error: {str(e)}")

    def test_edge_cases(self):
        """Test edge cases and error handling"""
        print("\n" + "="*50)
        print("TESTING EDGE CASES")
        print("="*50)
        
        # Test: Create request with too many passengers (> 4)
        invalid_request_data = {
            "requester_name": "Test Coordinator",  # Add required field
            "main_passenger": {"matricula": "101", "full_name": "João Silva"},
            "additional_passengers": [
                {"matricula": "102", "full_name": "Maria Santos"},
                {"matricula": "103", "full_name": "Carlos Oliveira"}, 
                {"matricula": "104", "full_name": "Ana Costa"},
                {"matricula": "105", "full_name": "Pedro Lima"}  # 5th passenger - should fail
            ],
            "destination_address": "Rua do Destino, 123"
        }
        
        success, error_response = self.run_test(
            "Create Request - Too Many Passengers (Should Fail)",
            "POST",
            "requests", 
            400,
            data=invalid_request_data
        )
        
        if success:
            print("✅ Correctly rejected request with too many passengers")
        
        # Test: Update status with invalid status
        # First create a request to update
        valid_request = {
            "requester_name": "Test Coordinator",  # Add required field
            "main_passenger": {"matricula": "101", "full_name": "João Silva"},
            "additional_passengers": [],
            "destination_address": "Test destination"
        }
        
        success, test_request = self.run_test(
            "Create Request for Invalid Status Test",
            "POST",
            "requests",
            201,
            data=valid_request
        )
        
        if success and test_request.get('id'):
            test_request_id = test_request['id']
            
            # Try to update with invalid status
            success, invalid_status_response = self.run_test(
                "Update with Invalid Status (Should Fail)",
                "PUT",
                f"requests/{test_request_id}/status",
                400,
                data={"status": "invalid_status"}
            )
            
            if success:
                print("✅ Correctly rejected invalid status update")

def main():
    print("🚕 ARC Transporte API Testing Suite")
    print("="*60)
    
    tester = ARCTransporteAPITester()
    
    # Run all test suites
    tester.test_employee_endpoints()
    tester.test_taxi_request_endpoints()
    tester.test_admin_endpoints()
    tester.test_sse_endpoint()
    tester.test_edge_cases()
    
    # Print final results
    print("\n" + "="*60)
    print("📊 FINAL TEST RESULTS")
    print("="*60)
    print(f"Tests Run: {tester.tests_run}")
    print(f"Tests Passed: {tester.tests_passed}")
    print(f"Tests Failed: {tester.tests_run - tester.tests_passed}")
    print(f"Success Rate: {(tester.tests_passed/tester.tests_run*100):.1f}%")
    
    if tester.tests_passed == tester.tests_run:
        print("\n🎉 ALL TESTS PASSED! Backend API is working correctly.")
        return 0
    else:
        print(f"\n⚠️  {tester.tests_run - tester.tests_passed} tests failed. Please review the issues above.")
        return 1

if __name__ == "__main__":
    sys.exit(main())