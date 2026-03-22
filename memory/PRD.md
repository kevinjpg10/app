# Efrain - Asistente de Gastos

## Descripción
Aplicación móvil para gestión de gastos que permite subir fotos de tickets y facturas, extraer automáticamente los datos mediante IA (OpenAI GPT-4o), y exportar los datos a Excel.

## Características Principales

### 1. Captura de Tickets
- Subir fotos desde la galería
- Tomar fotos con la cámara
- Procesamiento automático con OCR usando GPT-4o

### 2. Extracción de Datos
La IA extrae automáticamente:
- Nombre del establecimiento
- CIF (número de identificación fiscal)
- Dirección
- Teléfono
- Total pagado
- Fecha
- Método de pago (tarjeta o efectivo)

### 3. Gestión de Gastos
- Lista de todos los gastos
- Filtro por método de pago (todos/tarjeta/efectivo)
- Vista detallada de cada gasto
- Edición y eliminación de gastos
- Pull-to-refresh para actualizar

### 4. Resumen y Estadísticas
- Total de gastos
- Total pagado con tarjeta
- Total pagado en efectivo
- Contador de gastos por método de pago

### 5. Exportación a Excel
- Descarga de archivo .xlsx
- 3 hojas: Todos los Gastos, Pagos con Tarjeta, Pagos en Efectivo
- Formato profesional con totales

## Tecnologías Utilizadas

### Frontend (Expo/React Native)
- expo-image-picker: Para capturar fotos
- expo-file-system: Para manejo de archivos
- expo-sharing: Para compartir archivos
- @react-native-async-storage/async-storage: Almacenamiento local
- @expo/vector-icons (Ionicons): Iconografía

### Backend (FastAPI)
- emergentintegrations: Integración con OpenAI GPT-4o para OCR
- openpyxl: Generación de archivos Excel
- motor: Conexión a MongoDB

### Base de Datos
- MongoDB: Almacenamiento de gastos

## API Endpoints

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | /api/ | Información de la API |
| GET | /api/health | Estado del servicio |
| GET | /api/expenses | Obtener todos los gastos |
| POST | /api/expenses | Crear gasto (con imagen base64) |
| GET | /api/expenses/{id} | Obtener gasto específico |
| PUT | /api/expenses/{id} | Actualizar gasto |
| DELETE | /api/expenses/{id} | Eliminar gasto |
| GET | /api/expenses/export/excel | Exportar a Excel |
| GET | /api/expenses/summary/stats | Estadísticas de gastos |

## Uso

1. Abrir la app
2. Tocar el botón de cámara (azul) en la esquina inferior derecha
3. Seleccionar "Tomar Foto" o "Galería"
4. La IA procesará el ticket y extraerá los datos automáticamente
5. Ver el gasto en la lista principal
6. Tocar un gasto para ver los detalles
7. Usar el botón de descarga (arriba a la derecha) para exportar a Excel

## Permisos Requeridos
- Cámara: Para tomar fotos de tickets
- Galería: Para seleccionar fotos existentes
