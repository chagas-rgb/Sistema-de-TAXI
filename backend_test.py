import requests
import sys
import json
import uuid
import io
import csv
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

    def create_test_csv(self, content):
        """Create a test CSV file in memory"""
        csv_buffer = io.StringIO()
        csv_writer = csv.writer(csv_buffer)
        for row in content:
            csv_writer.writerow(row)
        csv_content = csv_buffer.getvalue().encode('utf-8')
        return csv_content

    def run_file_test(self, name, method, endpoint, expected_status, files=None, data=None):
        """Run a single API test with file upload"""
        url = f"{self.base_url}/{endpoint.lstrip('/')}"

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        print(f"   URL: {url}")
        
        try:
            if method == 'POST':
                response = requests.post(url, files=files, data=data)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ PASSED - Status: {response.status_code}")
                try:
                    response_json = response.json()
                    if 'imported_count' in response_json:
                        print(f"   Imported {response_json['imported_count']} employees")
                    if 'message' in response_json:
                        print(f"   Message: {response_json['message']}")
                    return True, response_json
                except:
                    return True, {}
            else:
                print(f"❌ FAILED - Expected {expected_status}, got {response.status_code}")
                print(f"   Response: {response.text[:200]}")
                return False, {}

        except Exception as e:
            print(f"❌ FAILED - Error: {str(e)}")
            return False, {}

    def test_csv_upload_functionality(self):
        """Test CSV upload feature comprehensively"""
        print("\n" + "="*50)
        print("TESTING CSV UPLOAD FUNCTIONALITY")
        print("="*50)

        # Test 1: Basic CSV upload with upsert mode
        csv_content = self.create_test_csv([
            ["matricula", "name", "address", "phone"],
            ["TEST001", "CSV Test Employee 1", "Test Address 1", "(11) 99999-0001"],
            ["TEST002", "CSV Test Employee 2", "Test Address 2", "(11) 99999-0002"]
        ])
        
        files = {'file': ('test_employees.csv', csv_content, 'text/csv')}
        
        success, response = self.run_file_test(
            "CSV Upload - Basic (Upsert)",
            "POST",
            "/employees/upload-csv?replace=false",
            200,
            files=files
        )
        
        if not success:
            print("❌ Basic CSV upload failed")
            return False

        # Test 2: Flexible column names (Portuguese)
        csv_content_pt = self.create_test_csv([
            ["matrícula", "nome", "endereco", "telefone"],
            ["TEST003", "Funcionário Teste 3", "Endereço Teste 3", "(11) 99999-0003"],
            ["TEST004", "Funcionário Teste 4", "Endereço Teste 4", "(11) 99999-0004"]
        ])
        
        files_pt = {'file': ('test_employees_pt.csv', csv_content_pt, 'text/csv')}
        
        success, response = self.run_file_test(
            "CSV Upload - Flexible Columns",
            "POST",
            "/employees/upload-csv?replace=false",
            200,
            files=files_pt
        )
        
        if not success:
            print("❌ Flexible columns CSV upload failed")
            return False

        # Test 3: Replace mode
        csv_content_replace = self.create_test_csv([
            ["matricula", "full_name", "default_address", "phone"],
            ["REPLACE001", "Replace Employee 1", "Replace Address 1", "(11) 99999-9001"],
            ["REPLACE002", "Replace Employee 2", "Replace Address 2", "(11) 99999-9002"]
        ])
        
        files_replace = {'file': ('replace_employees.csv', csv_content_replace, 'text/csv')}
        
        success, response = self.run_file_test(
            "CSV Upload - Replace Mode",
            "POST",
            "/employees/upload-csv?replace=true",
            200,
            files=files_replace
        )
        
        if not success:
            print("❌ Replace mode CSV upload failed")
            return False

        # Test 4: Invalid file format
        files_invalid = {'file': ('test.txt', b'This is not a CSV file', 'text/plain')}
        
        success, response = self.run_file_test(
            "CSV Upload - Invalid File Format",
            "POST",
            "/employees/upload-csv?replace=false",
            400,
            files=files_invalid
        )
        
        if not success:
            print("❌ Invalid file format test failed - should have returned 400")
            return False

        # Test 5: Search imported employee
        success, response = self.run_test(
            "Search Imported Employee",
            "GET",
            "/employees/search?matricula=REPLACE001",
            200
        )
        
        if success and response.get('matricula') == 'REPLACE001':
            print(f"✅ Found imported employee: {response.get('full_name')}")
        else:
            print("❌ Could not find imported employee")
            return False

        # Test 6: List all employees to verify import
        success, response = self.run_test(
            "List All Employees After Import",
            "GET",
            "/employees",
            200
        )
        
        if success and isinstance(response, list):
            test_employees = [emp for emp in response if emp.get('matricula', '').startswith('REPLACE')]
            if test_employees:
                print(f"✅ Found {len(test_employees)} imported test employees")
                return True
            else:
                print("❌ No test employees found in employee list")
                return False
        else:
            print("❌ Employee list retrieval failed")
            return False

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
    tester.test_csv_upload_functionality()
    
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