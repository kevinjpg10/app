import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, Image, Alert,
  ActivityIndicator, RefreshControl, Platform, TextInput,
  Modal, Dimensions, KeyboardAvoidingView
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';

// --- INYECCIÓN DE GEMINI ---
import { GoogleGenerativeAI } from "@google/generative-ai";
const genAI = new GoogleGenerativeAI(process.env.EXPO_PUBLIC_GEMINI_API_KEY || '');
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

interface EditFormData { 
  establishment_name: string; 
  cif: string; 
  address: string; 
  phone: string; 
  total: string; 
  date: string; 
  payment_method: string; 
  category: string; 
}

export default function Index() {
  const [expenses, setExpenses] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showManualForm, setShowManualForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editForm, setEditForm] = useState<EditFormData>({
    establishment_name: '', cif: '', address: '', phone: '', total: '', date: '', payment_method: 'efectivo', category: 'Varios',
  });

  const analyzeWithGemini = async (base64: string) => {
    try {
      const prompt = `Analiza este ticket. Responde SOLO con un JSON: {"establecimiento": "nombre", "total": 0.00, "fecha": "DD/MM/YYYY", "cif": "", "direccion": "", "telefono": "", "categoria": "Comida o Gasolina o Transporte o Alojamiento o Material o Varios"}`;
      const result = await model.generateContent([prompt, { inlineData: { data: base64, mimeType: "image/jpeg" } }]);
      const response = await result.response;
      const text = response.text().replace(/```json/g, "").replace(/```/g, "").trim();
      const data = JSON.parse(text);
      
      setEditForm({
        establishment_name: data.establecimiento || '',
        cif: data.cif || '',
        address: data.direccion || '',
        phone: data.telefono || '',
        total: data.total ? data.total.toString() : '',
        date: data.fecha || new Date().toLocaleDateString('es-ES'),
        payment_method: 'efectivo',
        category: data.categoria || 'Varios',
      });
      setShowManualForm(true);
    } catch (error) {
      Alert.alert("Error", "Gemini no pudo leer el ticket, pero puedes rellenarlo a mano.");
      setShowManualForm(true);
    }
  };

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/expenses`);
      if (response.ok) setExpenses(await response.json());
    } catch (e) { console.error(e); }
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

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
    if (!editForm.total || !editForm.establishment_name) {
      Alert.alert("Atención", "Nombre y Total son obligatorios");
      return;
    }
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
        Alert.alert('Éxito ✅', 'Gasto guardado correctamente');
      } else {
        throw new Error();
      }
    } catch (e) { 
      Alert.alert('Error ❌', 'No se pudo conectar con el servidor de Render'); 
    } finally { 
      setSaving(false); 
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />
      
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Efrain Gastos</Text>
        <TouchableOpacity onPress={() => {
          setEditForm({ establishment_name: '', cif: '', address: '', phone: '', total: '', date: new Date().toLocaleDateString('es-ES'), payment_method: 'efectivo', category: 'Varios' });
          setShowManualForm(true);
        }}>
          <Ionicons name="add-circle" size={30} color="#4A90D9" />
        </TouchableOpacity>
      </View>

      <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={loadData} />}>
        {expenses.length === 0 ? (
          <View style={styles.emptyContainer}><Text style={styles.emptyText}>No hay gastos registrados</Text></View>
        ) : (
          expenses.map(exp => (
            <View key={exp.id} style={styles.expenseCard}>
              <View>
                <Text style={styles.expenseName}>{exp.establishment_name}</Text>
                <Text style={styles.expenseDate}>{exp.date}</Text>
              </View>
              <Text style={styles.expenseAmount}>€{parseFloat(exp.total).toFixed(2)}</Text>
            </View>
          ))
        )}
      </ScrollView>

      <TouchableOpacity style={styles.fab} onPress={takePhoto}>
        {uploading ? <ActivityIndicator color="#fff" /> : <Ionicons name="camera" size={32} color="#fff" />}
      </TouchableOpacity>

      {/* MODAL DE FORMULARIO CON SCROLL Y BOTÓN GRANDE */}
      <Modal visible={showManualForm} animationType="slide">
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowManualForm(false)}>
              <Ionicons name="close-circle" size={35} color="#ff4444" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Nuevo Gasto</Text>
            <View style={{ width: 35 }} />
          </View>

          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{flex: 1}}>
            <ScrollView style={{ padding: 20 }}>
              <Text style={styles.formLabel}>Establecimiento *</Text>
              <TextInput style={styles.formInput} placeholder="Ej: Mercadona" placeholderTextColor="#555" value={editForm.establishment_name} onChangeText={(t) => setEditForm({...editForm, establishment_name: t})} />
              
              <Text style={styles.formLabel}>Total (€) *</Text>
              <TextInput style={styles.formInput} keyboardType="decimal-pad" placeholder="0.00" placeholderTextColor="#555" value={editForm.total} onChangeText={(t) => setEditForm({...editForm, total: t})} />
              
              <Text style={styles.formLabel}>Categoría</Text>
              <TextInput style={styles.formInput} placeholder="Comida, Gasolina..." placeholderTextColor="#555" value={editForm.category} onChangeText={(t) => setEditForm({...editForm, category: t})} />

              <Text style={styles.formLabel}>Ciudad / Dirección</Text>
              <TextInput style={styles.formInput} value={editForm.address} onChangeText={(t) => setEditForm({...editForm, address: t})} />

              <Text style={styles.formLabel}>Teléfono</Text>
              <TextInput style={styles.formInput} keyboardType="phone-pad" value={editForm.phone} onChangeText={(t) => setEditForm({...editForm, phone: t})} />

              <Text style={styles.formLabel}>Fecha</Text>
              <TextInput style={styles.formInput} value={editForm.date} onChangeText={(t) => setEditForm({...editForm, date: t})} />

              {/* BOTÓN DE GUARDAR REAL Y VISIBLE */}
              <TouchableOpacity 
                style={styles.saveButton} 
                onPress={createManualExpense}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Ionicons name="save-outline" size={24} color="#fff" style={{marginRight: 10}} />
                    <Text style={styles.saveButtonText}>GUARDAR GASTO</Text>
                  </>
                )}
              </TouchableOpacity>
              
              <View style={{ height: 50 }} />
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  modalContainer: { flex: 1, backgroundColor: '#111' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, paddingTop: 20, backgroundColor: '#111' },
  headerTitle: { fontSize: 24, fontWeight: 'bold', color: '#fff' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: '#333' },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#fff' },
  expenseCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, marginHorizontal: 15, marginVertical: 6, backgroundColor: '#1a1a1a', borderRadius: 15, borderWidth: 1, borderBottomColor: '#333' },
  expenseName: { color: '#fff', fontSize: 17, fontWeight: '600' },
  expenseDate: { color: '#666', fontSize: 13, marginTop: 4 },
  expenseAmount: { color: '#4A90D9', fontSize: 18, fontWeight: 'bold' },
  emptyContainer: { alignItems: 'center', marginTop: 100 },
  emptyText: { color: '#555', fontSize: 16 },
  fab: { position: 'absolute', bottom: 30, right: 30, backgroundColor: '#4A90D9', width: 64, height: 64, borderRadius: 32, justifyContent: 'center', alignItems: 'center', elevation: 5, shadowColor: '#000', shadowOffset: {width: 0, height: 2}, shadowOpacity: 0.25, shadowRadius: 3.84 },
  formLabel: { color: '#4A90D9', marginBottom: 8, fontWeight: '600', fontSize: 14, marginLeft: 5 },
  formInput: { backgroundColor: '#222', color: '#fff', padding: 15, borderRadius: 12, marginBottom: 20, fontSize: 16, borderWidth: 1, borderColor: '#333' },
  saveButton: { backgroundColor: '#4CAF50', padding: 18, borderRadius: 15, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 10, marginBottom: 30 },
  saveButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 18 }
});
