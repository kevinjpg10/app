import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, Image, Alert,
  ActivityIndicator, RefreshControl, Platform, Linking, TextInput,
  KeyboardAvoidingView, Modal, Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { PieChart } from 'react-native-gifted-charts';

// --- INYECCIÓN DE GEMINI ---
import { GoogleGenerativeAI } from "@google/generative-ai";
const genAI = new GoogleGenerativeAI(process.env.EXPO_PUBLIC_GEMINI_API_KEY || '');
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
// ---------------------------

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';
const screenWidth = Dimensions.get('window').width;

// (Interfaces mantenidas igual)
interface Expense { id: string; establishment_name: string; cif: string; address: string; phone: string; total: number; date: string; payment_method: string; category: string; image_base64?: string; created_at: string; }
interface Summary { total_expenses: number; total_amount: number; card_payments: { count: number; total: number }; cash_payments: { count: number; total: number }; categories: { [key: string]: { count: number; total: number; percentage: number } }; }
interface EditFormData { establishment_name: string; cif: string; address: string; phone: string; total: string; date: string; payment_method: string; category: string; }

const CATEGORIES = ['Comida', 'Gasolina', 'Transporte', 'Alojamiento', 'Material', 'Varios'];
const CATEGORY_COLORS: { [key: string]: string } = { 'Comida': '#FF6384', 'Gasolina': '#36A2EB', 'Transporte': '#FFCE56', 'Alojamiento': '#4BC0C0', 'Material': '#9966FF', 'Varios': '#FF9F40' };

export default function Index() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);
  const [activeTab, setActiveTab] = useState<'all' | 'card' | 'cash'>('all');
  const [isEditing, setIsEditing] = useState(false);
  const [showManualForm, setShowManualForm] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editForm, setEditForm] = useState<EditFormData>({
    establishment_name: '', cif: '', address: '', phone: '', total: '', date: '', payment_method: 'efectivo', category: 'Varios',
  });

  // --- FUNCIÓN MÁGICA DE GEMINI ---
  const analyzeWithGemini = async (base64: string) => {
    try {
      const prompt = `Analiza este ticket de compra. Extrae los datos y responde EXCLUSIVAMENTE con un objeto JSON con este formato:
      {"establecimiento": "nombre", "total": 0.00, "fecha": "DD/MM/YYYY", "cif": "B123...", "direccion": "calle...", "telefono": "123...", "categoria": "Comida o Gasolina o Transporte o Alojamiento o Material o Varios"}
      Si no ves un dato, pon "". Categoría debe ser una de la lista.`;

      const result = await model.generateContent([
        prompt,
        { inlineData: { data: base64, mimeType: "image/jpeg" } }
      ]);
      const response = await result.response;
      const jsonStr = response.text().replace(/```json/g, "").replace(/```/g, "").trim();
      const data = JSON.parse(jsonStr);

      setEditForm({
        establishment_name: data.establecimiento || '',
        cif: data.cif || '',
        address: data.direccion || '',
        phone: data.telefono || '',
        total: data.total ? data.total.toString() : '',
        date: data.fecha || '',
        payment_method: 'efectivo',
        category: data.categoria || 'Varios',
      });
      setShowManualForm(true); // Abrimos el formulario ya rellenado
    } catch (error) {
      console.error("Error en Gemini:", error);
      Alert.alert("Aviso", "La IA no pudo leer el ticket, pero puedes rellenarlo manualmente.");
      setShowManualForm(true);
    }
  };
  // ---------------------------------

  const fetchExpenses = useCallback(async () => {
    try {
      const response = await fetch(`${API_URL}/api/expenses`);
      if (response.ok) setExpenses(await response.json());
    } catch (error) { console.error('Error fetching expenses:', error); }
  }, []);

  const fetchSummary = useCallback(async () => {
    try {
      const response = await fetch(`${API_URL}/api/expenses/summary/stats`);
      if (response.ok) setSummary(await response.json());
    } catch (error) { console.error('Error fetching summary:', error); }
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    await Promise.all([fetchExpenses(), fetchSummary()]);
    setLoading(false);
  }, [fetchExpenses, fetchSummary]);

  useEffect(() => { loadData(); }, [loadData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true, quality: 0.7, base64: true,
    });
    if (!result.canceled && result.assets[0].base64) {
      setUploading(true);
      await analyzeWithGemini(result.assets[0].base64);
      setUploading(false);
    }
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') return;
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true, quality: 0.7, base64: true,
    });
    if (!result.canceled && result.assets[0].base64) {
      setUploading(true);
      await analyzeWithGemini(result.assets[0].base64);
      setUploading(false);
    }
  };

  // (Mantenemos el resto de funciones: createManualExpense, delete, etc. del código original)
  // [AQUÍ VA EL RESTO DE TU CÓDIGO ORIGINAL DESDE createManualExpense HACIA ABAJO]
  // ... (Me salto el resto por espacio, pero mantén tus funciones de guardado y los estilos)
