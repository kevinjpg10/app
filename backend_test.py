#!/usr/bin/env python3
"""
Comprehensive Backend API Testing for Efrain Asistente de Gastos
Tests all endpoints as requested in the review.
"""

import requests
import json
import base64
import os
from datetime import datetime

# Backend URL from environment
BACKEND_URL = "https://smart-expense-hub-5.preview.emergentagent.com/api"

def test_root_endpoint():
    """Test GET /api/ - Root endpoint"""
    print("\n=== Testing Root Endpoint ===")
    try:
        response = requests.get(f"{BACKEND_URL}/")
        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.json()}")
        
        if response.status_code == 200:
            data = response.json()
            if "Efrain" in data.get("message", ""):
                print("✅ Root endpoint working correctly")
                return True
            else:
                print("❌ Root endpoint response doesn't contain 'Efrain'")
                return False
        else:
            print(f"❌ Root endpoint failed with status {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Root endpoint error: {e}")
        return False

def test_health_endpoint():
    """Test GET /api/health - Health check"""
    print("\n=== Testing Health Endpoint ===")
    try:
        response = requests.get(f"{BACKEND_URL}/health")
        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.json()}")
        
        if response.status_code == 200:
            data = response.json()
            if data.get("status") == "healthy":
                print("✅ Health endpoint working correctly")
                return True
            else:
                print("❌ Health endpoint doesn't return 'healthy' status")
                return False
        else:
            print(f"❌ Health endpoint failed with status {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Health endpoint error: {e}")
        return False

def test_categories_endpoint():
    """Test GET /api/categories - Get categories list"""
    print("\n=== Testing Categories Endpoint ===")
    try:
        response = requests.get(f"{BACKEND_URL}/categories")
        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.json()}")
        
        if response.status_code == 200:
            data = response.json()
            categories = data.get("categories", [])
            expected_categories = ["Comida", "Gasolina", "Transporte", "Alojamiento", "Material", "Varios"]
            
            if all(cat in categories for cat in expected_categories):
                print("✅ Categories endpoint working correctly")
                return True
            else:
                print(f"❌ Categories endpoint missing expected categories. Got: {categories}")
                return False
        else:
            print(f"❌ Categories endpoint failed with status {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Categories endpoint error: {e}")
        return False

def test_get_expenses():
    """Test GET /api/expenses - Get all expenses"""
    print("\n=== Testing Get All Expenses ===")
    try:
        response = requests.get(f"{BACKEND_URL}/expenses")
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            expenses = response.json()
            print(f"Found {len(expenses)} expenses")
            if isinstance(expenses, list):
                print("✅ Get expenses endpoint working correctly")
                return True, expenses
            else:
                print("❌ Get expenses doesn't return a list")
                return False, []
        else:
            print(f"❌ Get expenses failed with status {response.status_code}")
            return False, []
    except Exception as e:
        print(f"❌ Get expenses error: {e}")
        return False, []

def test_create_manual_expense():
    """Test POST /api/expenses/manual - Create manual expense"""
    print("\n=== Testing Create Manual Expense ===")
    try:
        expense_data = {
            "establishment_name": "Test Restaurant",
            "total": 25.50,
            "date": "23/03/2026",
            "payment_method": "tarjeta",
            "category": "Comida"
        }
        
        response = requests.post(
            f"{BACKEND_URL}/expenses/manual",
            json=expense_data,
            headers={"Content-Type": "application/json"}
        )
        
        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.json()}")
        
        if response.status_code == 200:
            created_expense = response.json()
            expense_id = created_expense.get("id")
            
            # Verify the data was saved correctly
            if (created_expense.get("establishment_name") == "Test Restaurant" and
                created_expense.get("total") == 25.50 and
                created_expense.get("category") == "Comida" and
                created_expense.get("payment_method") == "tarjeta"):
                print("✅ Manual expense creation working correctly")
                return True, expense_id
            else:
                print("❌ Manual expense data doesn't match input")
                return False, None
        else:
            print(f"❌ Manual expense creation failed with status {response.status_code}")
            return False, None
    except Exception as e:
        print(f"❌ Manual expense creation error: {e}")
        return False, None

def test_update_expense(expense_id):
    """Test PUT /api/expenses/{id} - Update expense"""
    print(f"\n=== Testing Update Expense (ID: {expense_id}) ===")
    try:
        update_data = {
            "category": "Gasolina"
        }
        
        response = requests.put(
            f"{BACKEND_URL}/expenses/{expense_id}",
            json=update_data,
            headers={"Content-Type": "application/json"}
        )
        
        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.json()}")
        
        if response.status_code == 200:
            updated_expense = response.json()
            if updated_expense.get("category") == "Gasolina":
                print("✅ Expense update working correctly")
                return True
            else:
                print("❌ Expense update didn't change category")
                return False
        else:
            print(f"❌ Expense update failed with status {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Expense update error: {e}")
        return False

def test_toggle_payment_method(expense_id):
    """Test PATCH /api/expenses/{id}/payment-method - Toggle payment method"""
    print(f"\n=== Testing Toggle Payment Method (ID: {expense_id}) ===")
    try:
        response = requests.patch(f"{BACKEND_URL}/expenses/{expense_id}/payment-method")
        
        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.json()}")
        
        if response.status_code == 200:
            updated_expense = response.json()
            new_method = updated_expense.get("payment_method")
            print(f"Payment method toggled to: {new_method}")
            
            # Should have changed from "tarjeta" to "efectivo"
            if new_method == "efectivo":
                print("✅ Payment method toggle working correctly")
                return True
            else:
                print("❌ Payment method didn't toggle correctly")
                return False
        else:
            print(f"❌ Payment method toggle failed with status {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Payment method toggle error: {e}")
        return False

def test_summary_stats():
    """Test GET /api/expenses/summary/stats - Get statistics"""
    print("\n=== Testing Summary Statistics ===")
    try:
        response = requests.get(f"{BACKEND_URL}/expenses/summary/stats")
        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.json()}")
        
        if response.status_code == 200:
            stats = response.json()
            required_fields = ["total_expenses", "total_amount", "card_payments", "cash_payments", "categories"]
            
            if all(field in stats for field in required_fields):
                # Check if categories breakdown is included
                categories = stats.get("categories", {})
                if isinstance(categories, dict) and len(categories) > 0:
                    print("✅ Summary statistics working correctly with categories")
                    return True
                else:
                    print("❌ Summary statistics missing categories breakdown")
                    return False
            else:
                print(f"❌ Summary statistics missing required fields: {required_fields}")
                return False
        else:
            print(f"❌ Summary statistics failed with status {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Summary statistics error: {e}")
        return False

def test_excel_export():
    """Test GET /api/expenses/export/excel - Download Excel"""
    print("\n=== Testing Excel Export ===")
    try:
        response = requests.get(f"{BACKEND_URL}/expenses/export/excel")
        print(f"Status Code: {response.status_code}")
        print(f"Content-Type: {response.headers.get('Content-Type')}")
        print(f"Content-Disposition: {response.headers.get('Content-Disposition')}")
        
        if response.status_code == 200:
            content_type = response.headers.get('Content-Type', '')
            expected_type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            
            if expected_type in content_type:
                print("✅ Excel export working correctly with proper MIME type")
                return True
            else:
                print(f"❌ Excel export has wrong MIME type: {content_type}")
                return False
        else:
            print(f"❌ Excel export failed with status {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Excel export error: {e}")
        return False

def test_pdf_export():
    """Test GET /api/expenses/export/pdf - Download PDF"""
    print("\n=== Testing PDF Export ===")
    try:
        response = requests.get(f"{BACKEND_URL}/expenses/export/pdf")
        print(f"Status Code: {response.status_code}")
        print(f"Content-Type: {response.headers.get('Content-Type')}")
        print(f"Content-Disposition: {response.headers.get('Content-Disposition')}")
        
        if response.status_code == 200:
            content_type = response.headers.get('Content-Type', '')
            
            if "application/pdf" in content_type:
                print("✅ PDF export working correctly with proper MIME type")
                return True
            else:
                print(f"❌ PDF export has wrong MIME type: {content_type}")
                return False
        else:
            print(f"❌ PDF export failed with status {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ PDF export error: {e}")
        return False

def test_delete_expense(expense_id):
    """Test DELETE /api/expenses/{id} - Delete expense"""
    print(f"\n=== Testing Delete Expense (ID: {expense_id}) ===")
    try:
        response = requests.delete(f"{BACKEND_URL}/expenses/{expense_id}")
        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.json()}")
        
        if response.status_code == 200:
            result = response.json()
            if "eliminado" in result.get("message", "").lower():
                print("✅ Expense deletion working correctly")
                return True
            else:
                print("❌ Expense deletion response doesn't confirm deletion")
                return False
        else:
            print(f"❌ Expense deletion failed with status {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Expense deletion error: {e}")
        return False

def main():
    """Run all backend API tests"""
    print("🚀 Starting Comprehensive Backend API Testing")
    print(f"Backend URL: {BACKEND_URL}")
    
    results = {}
    test_expense_id = None
    
    # Test all endpoints in order
    results["root"] = test_root_endpoint()
    results["health"] = test_health_endpoint()
    results["categories"] = test_categories_endpoint()
    results["get_expenses"], _ = test_get_expenses()
    results["summary_stats"] = test_summary_stats()
    
    # Create a test expense
    results["create_manual"], test_expense_id = test_create_manual_expense()
    
    if test_expense_id:
        # Test operations on the created expense
        results["update_expense"] = test_update_expense(test_expense_id)
        results["toggle_payment"] = test_toggle_payment_method(test_expense_id)
    else:
        results["update_expense"] = False
        results["toggle_payment"] = False
    
    # Test export functions
    results["excel_export"] = test_excel_export()
    results["pdf_export"] = test_pdf_export()
    
    # Clean up - delete the test expense
    if test_expense_id:
        results["delete_expense"] = test_delete_expense(test_expense_id)
    else:
        results["delete_expense"] = False
    
    # Summary
    print("\n" + "="*50)
    print("📊 TEST RESULTS SUMMARY")
    print("="*50)
    
    passed = 0
    total = len(results)
    
    for test_name, result in results.items():
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{test_name.replace('_', ' ').title()}: {status}")
        if result:
            passed += 1
    
    print(f"\nOverall: {passed}/{total} tests passed ({passed/total*100:.1f}%)")
    
    if passed == total:
        print("🎉 All backend API tests PASSED!")
    else:
        print("⚠️  Some backend API tests FAILED!")
    
    return results

if __name__ == "__main__":
    main()