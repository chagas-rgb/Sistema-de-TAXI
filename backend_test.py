import requests
import sys
import json
import uuid
from datetime import datetime

class TaxiAppAPITester:
    def __init__(self, base_url="https://arc-taxi-request.preview.emergentagent.com/api"):
        self.base_url = base_url
        self.tests_run = 0
        self.tests_passed = 0
        self.request_id = None

    def run_test(self, name, method, endpoint, expected_status, data=None, headers=None):
        """Run a single API test"""
        url = f"{self.base_url}/{endpoint.lstrip('/')}"
        default_headers = {'Content-Type': 'application/json'}
        if headers:
            default_headers.update(headers)

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        print(f"   URL: {url}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=default_headers)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=default_headers)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=default_headers)
            elif method == 'DELETE':
                response = requests.delete(url, headers=default_headers)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ PASSED - Status: {response.status_code}")
                try:
                    response_json = response.json()
                    if endpoint.endswith("requests") and method == "POST":
                        self.request_id = response_json.get('id')
                        print(f"   Created request ID: {self.request_id}")
                    elif "active" in endpoint and method == "GET":
                        print(f"   Found {len(response_json)} active requests")
                        if response_json:
                            print(f"   Sample statuses: {[r['status'] for r in response_json[:3]]}")
                    elif "admin/verify" in endpoint:
                        print(f"   Admin verification: {response_json}")
                    return True, response_json
                except:
                    return True, {}
            else:
                print(f"❌ FAILED - Expected {expected_status}, got {response.status_code}")
                try:
                    error_detail = response.json()
                    print(f"   Error: {error_detail}")
                except:
                    print(f"   Error response: {response.text}")
                return False, {}

        except Exception as e:
            print(f"❌ FAILED - Connection Error: {str(e)}")
            return False, {}

    def test_basic_endpoints(self):
        """Test basic API endpoints"""
        print("\n" + "="*50)
        print("TESTING BASIC API ENDPOINTS")
        print("="*50)
        
        # Test root endpoint
        self.run_test("API Root", "GET", "/", 200)
        
        # Test employees endpoint
        self.run_test("List Employees", "GET", "/employees", 200)
        
        # Test employee search
        self.run_test("Search Employee", "GET", "/employees/search?matricula=101", 200)

    def test_active_requests_endpoint(self):
        """Test GET /api/requests/active - should return only aguardando and confirmado"""
        print("\n" + "="*50)
        print("TESTING ACTIVE REQUESTS ENDPOINT")
        print("="*50)
        
        success, response = self.run_test("Active Requests", "GET", "/requests/active", 200)
        
        if success and isinstance(response, list):
            valid_statuses = ["aguardando", "confirmado"]
            invalid_requests = [r for r in response if r.get('status') not in valid_statuses]
            if invalid_requests:
                print(f"❌ FAILED - Found requests with invalid status: {[r['status'] for r in invalid_requests]}")
                return False
            else:
                print(f"✅ VALIDATION PASSED - All requests have valid status (aguardando/confirmado)")
                return True
        return False

    def test_taxi_request_workflow(self):
        """Test complete taxi request workflow"""
        print("\n" + "="*50)
        print("TESTING TAXI REQUEST WORKFLOW")
        print("="*50)
        
        # Create a taxi request
        request_data = {
            "requester_name": "João Silva Teste",
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
            "destination_address": "Shopping Center - Av. Principal, 789"
        }
        
        success, response = self.run_test("Create Request", "POST", "/requests", 200, request_data)
        if not success:
            return False
            
        # Get the created request
        if self.request_id:
            self.run_test("Get Request", "GET", f"/requests/{self.request_id}", 200)
        
        return True

    def test_cancellation_with_reason(self):
        """Test POST /api/requests/{id}/cancel with reason"""
        print("\n" + "="*50)
        print("TESTING CANCELLATION WITH REASON")
        print("="*50)
        
        if not self.request_id:
            print("❌ No request ID available for cancellation test")
            return False
        
        # Test cancellation with reason
        cancel_data = {"reason": "Passageiro saiu mais cedo"}
        success, response = self.run_test(
            "Cancel with Reason", 
            "POST", 
            f"/requests/{self.request_id}/cancel", 
            200, 
            cancel_data
        )
        
        if success and response.get('status') == 'cancelado':
            if response.get('cancellation_reason') == "Passageiro saiu mais cedo":
                print("✅ VALIDATION PASSED - Cancellation reason stored correctly")
                return True
            else:
                print(f"❌ VALIDATION FAILED - Expected reason 'Passageiro saiu mais cedo', got '{response.get('cancellation_reason')}'")
                return False
        return False

    def test_admin_endpoint(self):
        """Test admin verification"""
        print("\n" + "="*50)
        print("TESTING ADMIN ENDPOINTS")
        print("="*50)
        
        # Test correct password
        success, response = self.run_test("Admin Login (Correct)", "POST", "/admin/verify", 200, {"password": "ARC123"})
        if success and response.get('verified') == True:
            print("✅ VALIDATION PASSED - Admin authentication works")
        
        # Test wrong password
        self.run_test("Admin Login (Wrong)", "POST", "/admin/verify", 401, {"password": "wrong"})
        
        return True

    def test_sse_endpoint(self):
        """Test SSE endpoint availability"""
        print("\n" + "="*50)
        print("TESTING SSE ENDPOINT")
        print("="*50)
        
        # Just test if the endpoint is accessible (should return 200)
        url = f"{self.base_url}/requests/stream/events"
        try:
            response = requests.get(url, stream=True, timeout=5)
            if response.status_code == 200:
                print(f"✅ SSE Endpoint Available - Status: {response.status_code}")
                print(f"   Content-Type: {response.headers.get('Content-Type', 'N/A')}")
                return True
            else:
                print(f"❌ SSE Endpoint Failed - Status: {response.status_code}")
                return False
        except Exception as e:
            print(f"❌ SSE Endpoint Error: {str(e)}")
            return False

    def test_status_updates(self):
        """Test status update functionality"""
        print("\n" + "="*50)
        print("TESTING STATUS UPDATES")
        print("="*50)
        
        # Create a new request for status testing
        request_data = {
            "requester_name": "Maria Silva Teste",
            "main_passenger": {
                "matricula": "103",
                "full_name": "Carlos Oliveira",
                "address": "Rua das Flores, 789 - Vila Nova",
                "phone": "(11) 99999-1003"
            },
            "additional_passengers": [],
            "destination_address": "Hospital Central - Av. Saúde, 456"
        }
        
        success, response = self.run_test("Create Request for Status Test", "POST", "/requests", 200, request_data)
        if not success:
            return False
            
        status_request_id = response.get('id')
        if not status_request_id:
            print("❌ No request ID returned from creation")
            return False
        
        # Test status update to confirmado
        success, response = self.run_test(
            "Update Status to Confirmado", 
            "PUT", 
            f"/requests/{status_request_id}/status", 
            200, 
            {"status": "confirmado"}
        )
        
        if success and response.get('status') == 'confirmado':
            print("✅ Status update to 'confirmado' successful")
        
        # Test status update to finalizado
        success, response = self.run_test(
            "Update Status to Finalizado", 
            "PUT", 
            f"/requests/{status_request_id}/status", 
            200, 
            {"status": "finalizado"}
        )
        
        if success and response.get('status') == 'finalizado':
            print("✅ Status update to 'finalizado' successful")
            
        return True

def main():
    print("🚖 ARC TRANSPORTE API TESTING")
    print("="*60)
    
    tester = TaxiAppAPITester()
    
    # Run all tests
    tester.test_basic_endpoints()
    tester.test_active_requests_endpoint()
    tester.test_taxi_request_workflow()
    tester.test_cancellation_with_reason()
    tester.test_admin_endpoint()
    tester.test_sse_endpoint()
    tester.test_status_updates()
    
    # Print summary
    print("\n" + "="*60)
    print("📊 TEST SUMMARY")
    print("="*60)
    print(f"Tests Run: {tester.tests_run}")
    print(f"Tests Passed: {tester.tests_passed}")
    print(f"Tests Failed: {tester.tests_run - tester.tests_passed}")
    print(f"Success Rate: {(tester.tests_passed/tester.tests_run*100):.1f}%")
    
    if tester.tests_passed == tester.tests_run:
        print("\n🎉 ALL TESTS PASSED!")
        return 0
    else:
        print(f"\n⚠️  {tester.tests_run - tester.tests_passed} TEST(S) FAILED")
        return 1

if __name__ == "__main__":
    sys.exit(main())