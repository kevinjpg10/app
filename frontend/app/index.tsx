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

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';
const screenWidth = Dimensions.get('window').width;

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
      const prompt = `Analiza este ticket. Responde SOLO con un JSON: {"establecimiento": "nombre", "total": 0.00, "fecha": "DD/MM/YYYY", "cif": "", "direccion": "", "telefono": "", "categoria": "Comida o Gasolina o Transporte o Alojamiento o Material o Varios"}`;
      const result = await model.generateContent([prompt, { inlineData: { data: base64, mimeType: "image/jpeg" } }]);
      const response = await result.response;
      const data = JSON.parse(response.text().replace(/```json/g, "").replace(/```/g, ""));
      
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
      setShowManualForm(true);
    } catch (error) {
      setShowManualForm(true);
    }
  };

  const fetchExpenses = useCallback(async () => {
    try {
      const response = await fetch(`${API_URL}/api/expenses`);
      if (response.ok) setExpenses(await response.json());
    } catch (e) { console.error(e); }
  }, []);

  const fetchSummary = useCallback(async () => {
    try {
      const response = await fetch(`${API_URL}/api/expenses/summary/stats`);
      if (response.ok) setSummary(await response.json());
    } catch (e) { console.error(e); }
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

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') return;
    const result = await ImagePicker.launchCameraAsync({ allowsEditing: true, quality: 0.7, base64: true });
    if (!result.canceled && result.assets[0].base64) {
      setUploading(true);
      await analyzeWithGemini(result.assets[0].base64);
      setUploading(false);
    }
  };

  const createManualExpense = async () => {
    setSaving(true);
    try {
      const response = await fetch(`${API_URL}/api/expenses/manual`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...editForm, total: parseFloat(editForm.total) || 0 }),
      });
      if (response.ok) {
        setShowManualForm(false);
        await loadData();
        Alert.alert('Éxito', 'Gasto guardado correctamente');
      }
    } catch (e) { Alert.alert('Error', 'No se pudo guardar'); }
    finally { setSaving(false); }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />
      
      {/* Botón Flotante */}
      <TouchableOpacity style={styles.fab} onPress={takePhoto}>
        {uploading ? <ActivityIndicator color="#fff" /> : <Ionicons name="camera" size={32} color="#fff" />}
      </TouchableOpacity>

      <View style={styles.header}>
        <Text style={styles.headerTitle}>Efrain Gastos 🤖</Text>
      </View>

      <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
        {expenses.length === 0 ? (
          <View style={styles.emptyContainer}><Text style={styles.emptyText}>No hay gastos aún</Text></View>
        ) : (
          expenses.map(exp => (
            <View key={exp.id} style={styles.expenseCard}>
              <Text style={styles.expenseName}>{exp.establishment_name}</Text>
              <Text style={styles.expenseAmount}>€{exp.total.toFixed(2)}</Text>
            </View>
          ))
        )}
      </ScrollView>

      {/* Modal de Confirmación IA */}
      <Modal visible={showManualForm} animationType="slide">
        <SafeAreaView style={styles.container}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => setShowManualForm(false)}><Ionicons name="close" size={24} color="#fff" /></TouchableOpacity>
            <Text style={styles.headerTitle}>Confirmar Datos</Text>
            <TouchableOpacity onPress={createManualExpense} disabled={saving}>
              {saving ? <ActivityIndicator size="small" color="#4A90D9" /> : <Ionicons name="checkmark" size={24} color="#4A90D9" />}
            </TouchableOpacity>
          </View>
          <ScrollView style={{ padding: 20 }}>
            <Text style={styles.formLabel}>Establecimiento</Text>
            <TextInput style={styles.formInput} value={editForm.establishment_name} onChangeText={(t) => setEditForm({...editForm, establishment_name: t})} />
            <Text style={styles.formLabel}>Total (€)</Text>
            <TextInput style={styles.formInput} keyboardType="decimal-pad" value={editForm.total} onChangeText={(t) => setEditForm({...editForm, total: t})} />
            <Text style={styles.formLabel}>Fecha</Text>
            <TextInput style={styles.formInput} value={editForm.date} onChangeText={(t) => setEditForm({...editForm, date: t})} />
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  header: { flexDirection: 'row', justifyContent: 'space-between', padding: 20, paddingTop: 40, borderBottomWidth: 1, borderBottomColor: '#222' },
  headerTitle: { fontSize: 22, fontWeight: 'bold', color: '#fff' },
  expenseCard: { flexDirection: 'row', justifyContent: 'space-between', padding: 15, marginHorizontal: 20, marginVertical: 5, backgroundColor: '#1a1a1a', borderRadius: 10 },
  expenseName: { color: '#fff', fontSize: 16 },
  expenseAmount: { color: '#4A90D9', fontWeight: 'bold' },
  emptyContainer: { alignItems: 'center', marginTop: 100 },
  emptyText: { color: '#666' },
  fab: { position: 'absolute', bottom: 30, right: 30, backgroundColor: '#4A90D9', width: 64, height: 64, borderRadius: 32, justifyContent: 'center', alignItems: 'center', zIndex: 999 },
  formLabel: { color: '#888', marginBottom: 5 },
  formInput: { backgroundColor: '#1a1a1a', color: '#fff', padding: 15, borderRadius: 10, marginBottom: 20 }
});
