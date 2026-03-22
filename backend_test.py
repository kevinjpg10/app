#!/usr/bin/env python3
"""
Backend API Testing for Efrain Asistente de Gastos
Tests all backend endpoints with comprehensive validation
"""

import requests
import json
import base64
import io
from PIL import Image, ImageDraw, ImageFont
import sys
import time

# Backend URL from frontend .env
BACKEND_URL = "https://smart-expense-hub-5.preview.emergentagent.com/api"

def create_test_receipt_image():
    """Create a test receipt image with realistic data for OCR testing"""
    # Create a white image (receipt-like)
    width, height = 400, 600
    image = Image.new('RGB', (width, height), 'white')
    draw = ImageDraw.Draw(image)
    
    # Try to use a basic font, fallback to default if not available
    try:
        font_large = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 20)
        font_medium = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 16)
        font_small = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 12)
    except:
        font_large = ImageFont.load_default()
        font_medium = ImageFont.load_default()
        font_small = ImageFont.load_default()
    
    # Draw receipt content
    y_pos = 20
    
    # Header
    draw.text((50, y_pos), "SUPERMERCADO MADRID", fill='black', font=font_large)
    y_pos += 40
    
    # Business details
    draw.text((50, y_pos), "CIF: B12345678", fill='black', font=font_medium)
    y_pos += 25
    draw.text((50, y_pos), "Calle Gran Via 123", fill='black', font=font_medium)
    y_pos += 20
    draw.text((50, y_pos), "28013 Madrid", fill='black', font=font_medium)
    y_pos += 25
    draw.text((50, y_pos), "Tel: 915551234", fill='black', font=font_medium)
    y_pos += 40
    
    # Date and time
    draw.text((50, y_pos), "Fecha: 15/12/2024", fill='black', font=font_medium)
    y_pos += 20
    draw.text((50, y_pos), "Hora: 14:30", fill='black', font=font_medium)
    y_pos += 40
    
    # Items
    draw.text((50, y_pos), "PRODUCTOS:", fill='black', font=font_medium)
    y_pos += 25
    draw.text((50, y_pos), "Pan integral        2.50€", fill='black', font=font_small)
    y_pos += 20
    draw.text((50, y_pos), "Leche 1L            1.20€", fill='black', font=font_small)
    y_pos += 20
    draw.text((50, y_pos), "Manzanas 1kg        3.80€", fill='black', font=font_small)
    y_pos += 20
    draw.text((50, y_pos), "Yogures x6          4.50€", fill='black', font=font_small)
    y_pos += 20
    draw.text((50, y_pos), "Aceite oliva        8.90€", fill='black', font=font_small)
    y_pos += 40
    
    # Total
    draw.text((50, y_pos), "TOTAL: 20.90€", fill='black', font=font_large)
    y_pos += 40
    
    # Payment method
    draw.text((50, y_pos), "PAGO: TARJETA VISA", fill='black', font=font_medium)
    y_pos += 25
    draw.text((50, y_pos), "****1234", fill='black', font=font_medium)
    y_pos += 40
    
    # Footer
    draw.text((50, y_pos), "Gracias por su compra", fill='black', font=font_small)
    
    # Convert to base64
    buffer = io.BytesIO()
    image.save(buffer, format='JPEG', quality=95)
    buffer.seek(0)
    
    image_base64 = base64.b64encode(buffer.getvalue()).decode('utf-8')
    return image_base64

def test_health_endpoints():
    """Test root and health endpoints"""
    print("🔍 Testing Health and Root Endpoints...")
    
    results = {
        "root_endpoint": False,
        "health_endpoint": False,
        "errors": []
    }
    
    try:
        # Test root endpoint
        response = requests.get(f"{BACKEND_URL}/", timeout=10)
        if response.status_code == 200:
            data = response.json()
            if "message" in data and "Efrain" in data["message"]:
                results["root_endpoint"] = True
                print("✅ Root endpoint working")
            else:
                results["errors"].append(f"Root endpoint unexpected response: {data}")
        else:
            results["errors"].append(f"Root endpoint failed: {response.status_code} - {response.text}")
    except Exception as e:
        results["errors"].append(f"Root endpoint error: {str(e)}")
    
    try:
        # Test health endpoint
        response = requests.get(f"{BACKEND_URL}/health", timeout=10)
        if response.status_code == 200:
            data = response.json()
            if "status" in data and data["status"] == "healthy":
                results["health_endpoint"] = True
                print("✅ Health endpoint working")
            else:
                results["errors"].append(f"Health endpoint unexpected response: {data}")
        else:
            results["errors"].append(f"Health endpoint failed: {response.status_code} - {response.text}")
    except Exception as e:
        results["errors"].append(f"Health endpoint error: {str(e)}")
    
    return results

def test_get_expenses():
    """Test GET /api/expenses endpoint"""
    print("🔍 Testing Get All Expenses...")
    
    results = {
        "working": False,
        "errors": []
    }
    
    try:
        response = requests.get(f"{BACKEND_URL}/expenses", timeout=15)
        if response.status_code == 200:
            data = response.json()
            if isinstance(data, list):
                results["working"] = True
                print(f"✅ Get expenses working - Found {len(data)} expenses")
            else:
                results["errors"].append(f"Expected list, got: {type(data)}")
        else:
            results["errors"].append(f"Get expenses failed: {response.status_code} - {response.text}")
    except Exception as e:
        results["errors"].append(f"Get expenses error: {str(e)}")
    
    return results

def test_summary_stats():
    """Test GET /api/expenses/summary/stats endpoint"""
    print("🔍 Testing Summary Statistics...")
    
    results = {
        "working": False,
        "errors": []
    }
    
    try:
        response = requests.get(f"{BACKEND_URL}/expenses/summary/stats", timeout=15)
        if response.status_code == 200:
            data = response.json()
            required_fields = ["total_expenses", "total_amount", "card_payments", "cash_payments"]
            if all(field in data for field in required_fields):
                results["working"] = True
                print(f"✅ Summary stats working - Total expenses: {data['total_expenses']}, Total amount: {data['total_amount']}")
            else:
                results["errors"].append(f"Missing required fields in response: {data}")
        else:
            results["errors"].append(f"Summary stats failed: {response.status_code} - {response.text}")
    except Exception as e:
        results["errors"].append(f"Summary stats error: {str(e)}")
    
    return results

def test_create_expense_with_ocr():
    """Test POST /api/expenses with OCR"""
    print("🔍 Testing Create Expense with OCR...")
    
    results = {
        "working": False,
        "expense_id": None,
        "errors": []
    }
    
    try:
        # Create test receipt image
        print("📸 Creating test receipt image...")
        image_base64 = create_test_receipt_image()
        
        # Create expense
        payload = {
            "image_base64": image_base64
        }
        
        print("🤖 Sending to OCR endpoint...")
        response = requests.post(
            f"{BACKEND_URL}/expenses", 
            json=payload, 
            timeout=60  # OCR can take time
        )
        
        if response.status_code == 200:
            data = response.json()
            required_fields = ["id", "establishment_name", "total", "payment_method"]
            if all(field in data for field in required_fields):
                results["working"] = True
                results["expense_id"] = data["id"]
                print(f"✅ OCR expense creation working")
                print(f"   - ID: {data['id']}")
                print(f"   - Establishment: {data['establishment_name']}")
                print(f"   - Total: {data['total']}")
                print(f"   - Payment: {data['payment_method']}")
            else:
                results["errors"].append(f"Missing required fields in response: {data}")
        else:
            results["errors"].append(f"Create expense failed: {response.status_code} - {response.text}")
    except Exception as e:
        results["errors"].append(f"Create expense error: {str(e)}")
    
    return results

def test_update_expense(expense_id):
    """Test PUT /api/expenses/{id}"""
    print("🔍 Testing Update Expense...")
    
    results = {
        "working": False,
        "errors": []
    }
    
    if not expense_id:
        results["errors"].append("No expense ID provided for update test")
        return results
    
    try:
        # Update expense data
        update_data = {
            "establishment_name": "SUPERMERCADO ACTUALIZADO",
            "total": 25.50
        }
        
        response = requests.put(
            f"{BACKEND_URL}/expenses/{expense_id}", 
            json=update_data, 
            timeout=15
        )
        
        if response.status_code == 200:
            data = response.json()
            if data.get("establishment_name") == "SUPERMERCADO ACTUALIZADO" and data.get("total") == 25.50:
                results["working"] = True
                print("✅ Update expense working")
            else:
                results["errors"].append(f"Update not reflected in response: {data}")
        else:
            results["errors"].append(f"Update expense failed: {response.status_code} - {response.text}")
    except Exception as e:
        results["errors"].append(f"Update expense error: {str(e)}")
    
    return results

def test_delete_expense(expense_id):
    """Test DELETE /api/expenses/{id}"""
    print("🔍 Testing Delete Expense...")
    
    results = {
        "working": False,
        "errors": []
    }
    
    if not expense_id:
        results["errors"].append("No expense ID provided for delete test")
        return results
    
    try:
        response = requests.delete(f"{BACKEND_URL}/expenses/{expense_id}", timeout=15)
        
        if response.status_code == 200:
            data = response.json()
            if "message" in data and "eliminado" in data["message"]:
                results["working"] = True
                print("✅ Delete expense working")
            else:
                results["errors"].append(f"Unexpected delete response: {data}")
        else:
            results["errors"].append(f"Delete expense failed: {response.status_code} - {response.text}")
    except Exception as e:
        results["errors"].append(f"Delete expense error: {str(e)}")
    
    return results

def test_excel_export():
    """Test GET /api/expenses/export/excel"""
    print("🔍 Testing Excel Export...")
    
    results = {
        "working": False,
        "errors": []
    }
    
    try:
        response = requests.get(f"{BACKEND_URL}/expenses/export/excel", timeout=30)
        
        if response.status_code == 200:
            content_type = response.headers.get('content-type', '')
            if 'spreadsheet' in content_type or 'excel' in content_type:
                # Check if we got actual Excel content
                if len(response.content) > 1000:  # Excel files are typically larger
                    results["working"] = True
                    print(f"✅ Excel export working - File size: {len(response.content)} bytes")
                else:
                    results["errors"].append(f"Excel file too small: {len(response.content)} bytes")
            else:
                results["errors"].append(f"Wrong content type: {content_type}")
        else:
            results["errors"].append(f"Excel export failed: {response.status_code} - {response.text}")
    except Exception as e:
        results["errors"].append(f"Excel export error: {str(e)}")
    
    return results

def main():
    """Run all backend tests"""
    print("🚀 Starting Backend API Tests for Efrain Asistente de Gastos")
    print(f"🌐 Backend URL: {BACKEND_URL}")
    print("=" * 60)
    
    all_results = {}
    
    # Test 1: Health endpoints
    all_results["health"] = test_health_endpoints()
    
    # Test 2: Get expenses
    all_results["get_expenses"] = test_get_expenses()
    
    # Test 3: Summary stats
    all_results["summary_stats"] = test_summary_stats()
    
    # Test 4: Create expense with OCR
    all_results["create_expense"] = test_create_expense_with_ocr()
    expense_id = all_results["create_expense"].get("expense_id")
    
    # Test 5: Update expense (if we have an ID)
    if expense_id:
        all_results["update_expense"] = test_update_expense(expense_id)
        
        # Test 6: Delete expense (if we have an ID)
        all_results["delete_expense"] = test_delete_expense(expense_id)
    else:
        all_results["update_expense"] = {"working": False, "errors": ["No expense created to test update"]}
        all_results["delete_expense"] = {"working": False, "errors": ["No expense created to test delete"]}
    
    # Test 7: Excel export
    all_results["excel_export"] = test_excel_export()
    
    # Summary
    print("\n" + "=" * 60)
    print("📊 TEST RESULTS SUMMARY")
    print("=" * 60)
    
    total_tests = 0
    passed_tests = 0
    
    for test_name, result in all_results.items():
        total_tests += 1
        if test_name == "health":
            # Health has two sub-tests
            if result["root_endpoint"] and result["health_endpoint"]:
                passed_tests += 1
                print(f"✅ {test_name}: PASSED")
            else:
                print(f"❌ {test_name}: FAILED")
                for error in result["errors"]:
                    print(f"   - {error}")
        else:
            if result["working"]:
                passed_tests += 1
                print(f"✅ {test_name}: PASSED")
            else:
                print(f"❌ {test_name}: FAILED")
                for error in result["errors"]:
                    print(f"   - {error}")
    
    print(f"\n📈 Overall: {passed_tests}/{total_tests} tests passed")
    
    # Return results for programmatic use
    return all_results

if __name__ == "__main__":
    results = main()
    
    # Exit with error code if any tests failed
    failed_tests = sum(1 for result in results.values() 
                      if not (result.get("working", False) or 
                             (result.get("root_endpoint", False) and result.get("health_endpoint", False))))
    
    if failed_tests > 0:
        sys.exit(1)
    else:
        sys.exit(0)