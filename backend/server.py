from fastapi import FastAPI, APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional
import uuid
from datetime import datetime
import io
import httpx
import json

# Exportación
import openpyxl
from openpyxl.styles import Font, Alignment, PatternFill, Border, Side
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from reportlab.lib.units import cm

# --- CONFIGURACIÓN ---
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# Conexión a MongoDB (Asegúrate de que MONGO_URL esté en tus Secrets/Env)
mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ.get('DB_NAME', 'efrain_gastos')]

GEMINI_API_KEY = os.environ.get('GEMINI_API_KEY', '')
EXPENSE_CATEGORIES = ["Comida", "Gasolina", "Transporte", "Alojamiento", "Material", "Varios"]

app = FastAPI(title="Efrain Asistente de Gastos API")
api_router = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# --- MODELOS ---

class Expense(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    establishment_name: str = "Desconocido"
    cif: str = ""
    address: str = ""
    phone: str = ""
    total: float = 0.0
    date: str = ""
    payment_method: str = "efectivo"
    category: str = "Varios"
    image_base64: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)

class ExpenseCreate(BaseModel):
    image_base64: str

class ExpenseManualCreate(BaseModel):
    establishment_name: str
    total: float
    date: Optional[str] = ""
    category: Optional[str] = "Varios"
    payment_method: Optional[str] = "efectivo"
    cif: Optional[str] = ""
    address: Optional[str] = ""
    phone: Optional[str] = ""

class ExpenseResponse(BaseModel):
    id: str
    establishment_name: str
    total: float
    date: str
    category: str
    payment_method: str
    created_at: datetime

# --- LÓGICA GEMINI OCR ---

async def extract_ticket_data(image_base64: str) -> dict:
    if not GEMINI_API_KEY:
        return {"establishment_name": "Error API Key", "total": 0.0}
    
    try:
        # Usamos el modelo Flash 1.5 que es más estable para OCR rápido
        url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={GEMINI_API_KEY}"
        
        prompt = "Analiza este ticket y extrae: establecimiento, total (numero), fecha (DD/MM/YYYY), cif, direccion, telefono, categoria, metodo_pago (tarjeta/efectivo). Responde solo JSON."

        payload = {
            "contents": [{
                "parts": [
                    {"text": prompt},
                    {"inline_data": {"mime_type": "image/jpeg", "data": image_base64}}
                ]
            }]
        }

        async with httpx.AsyncClient(timeout=30.0) as http_client:
            response = await http_client.post(url, json=payload)
            response.raise_for_status()
            result = response.json()

        text = result["candidates"][0]["content"]["parts"][0]["text"].strip()
        # Limpiar posibles bloques de código markdown
        clean_json = text.replace("```json", "").replace("```", "").strip()
        return json.loads(clean_json)

    except Exception as e:
        logger.error(f"Error en Gemini: {e}")
        return {"establishment_name": "Error lectura", "total": 0.0}

# --- RUTAS API ---

@api_router.post("/expenses", response_model=ExpenseResponse)
async def create_expense(expense_data: ExpenseCreate):
    # 1. Extraer datos con IA
    extracted = await extract_ticket_data(expense_data.image_base64)
    
    # 2. Crear objeto de gasto
    expense = Expense(
        establishment_name=extracted.get("establecimiento", extracted.get("establishment_name", "Nuevo Gasto")),
        total=float(extracted.get("total", 0.0)),
        date=extracted.get("fecha", extracted.get("date", datetime.now().strftime("%d/%m/%Y"))),
        category=extracted.get("categoria", "Varios"),
        payment_method=extracted.get("metodo_pago", "efectivo")
    )
    
    # 3. Guardar en MongoDB
    await db.expenses.insert_one(expense.model_dump())
    return expense

@api_router.post("/expenses/manual", response_model=ExpenseResponse)
async def create_manual_expense(expense_data: ExpenseManualCreate):
    expense = Expense(**expense_data.model_dump())
    await db.expenses.insert_one(expense.model_dump())
    return expense

@api_router.get("/expenses", response_model=List[ExpenseResponse])
async def get_expenses():
    # Buscamos todos y ordenamos por fecha de creación (los más nuevos primero)
    cursor = db.expenses.find().sort("created_at", -1)
    expenses = await cursor.to_list(length=100)
    return expenses

# --- EXPORTACIONES (EXCEL) ---

@api_router.get("/expenses/export/excel")
async def export_excel():
    cursor = db.expenses.find().sort("created_at", -1)
    expenses = await cursor.to_list(length=1000)
    
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Gastos Efrain"
    
    headers = ["Fecha", "Establecimiento", "Categoría", "Total", "Pago"]
    ws.append(headers)
    
    for exp in expenses:
        ws.append([exp["date"], exp["establishment_name"], exp["category"], exp["total"], exp["payment_method"]])
    
    buffer = io.BytesIO()
    wb.save(buffer)
    buffer.seek(0)
    
    return StreamingResponse(
        buffer, 
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=gastos.xlsx"}
    )

# --- MIDDLEWARE Y CIERRE ---
app.include_router(api_router)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
