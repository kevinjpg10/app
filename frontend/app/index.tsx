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

// --- CONEXIÓN GEMINI SEGURA ---
import { GoogleGenerativeAI } from "@google/generative-ai";
const genAI = new GoogleGenerativeAI(process.env.EXPO_PUBLIC_GEMINI_API_KEY || '');
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

export default function Index() {
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showManualForm, setShowManualForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editForm, setEditForm] = useState({
    establishment_name: '', cif: '', address: '', phone: '', total: '', date: '', payment_method: 'efectivo', category: 'Varios',
  });

  // --- LA FUNCIÓN QUE ME PREGUNTASTE ---
  const analyzeWithGemini = async (base64: string) => {
    try {
      if (!process.env.EXPO_PUBLIC_GEMINI_API_KEY) {
        Alert.alert("Error", "No se detecta la clave API en los Secrets de GitHub.");
        return;
      }

      const prompt = `Analiza este ticket. Responde SOLO con un JSON puro: {"establecimiento": "nombre", "total": 0.00, "fecha": "DD/MM/YYYY", "cif": "", "direccion": "", "telefono": "", "categoria": "Comida"}`;
      
      const result = await model.generateContent([
        prompt,
        { inlineData: { data: base64, mimeType: "image/jpeg" } }
      ]);
      
      const response = await result.response;
      let text = response.text().replace(/```json/g, "").replace(/```/g, "").trim();
      const data = JSON.parse(text);

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
      console.error(error);
      Alert.alert("Aviso", "La IA no pudo leer el ticket correctamente. Inténtalo de nuevo o rellena a mano.");
      setShowManualForm(true);
    }
  };

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/expenses`);
      if (response.ok) setExpenses(await response.json());
    } catch (e) { console.log("Error al cargar datos"); }
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
    setSaving(true);
    try {
      const response = await fetch(`${API_URL}/api/expenses/manual`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...editForm, total: parseFloat(editForm.total) || 0 }),
      });
      if (response.ok) {
        setShowManualForm(false);
        loadData();
        Alert.alert('Éxito', 'Gasto guardado');
      }
    } catch (e) { Alert.alert('Error', 'No se pudo conectar al servidor'); }
    finally { setSaving(false); }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Efrain Gastos 🤖</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {expenses.map((exp: any) => (
          <View key={exp.id} style={styles.card}>
            <Text style={{color: '#fff'}}>{exp.establishment_name} - €{exp.total}</Text>
          </View>
        ))}
      </ScrollView>

      <Modal visible={showManualForm} animationType="slide">
        <SafeAreaView style={styles.container}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => setShowManualForm(false)}><Ionicons name="close" size={24} color="#fff" /></TouchableOpacity>
            <Text style={styles.headerTitle}>Confirmar</Text>
            <TouchableOpacity onPress={createManualExpense} disabled={saving}>
              <Ionicons name="checkmark" size={24} color="#4A90D9" />
            </TouchableOpacity>
          </View>
          <View style={{padding: 20}}>
            <Text style={styles.label}>Establecimiento</Text>
            <TextInput style={styles.input} value={editForm.establishment_name} onChangeText={(t) => setEditForm({...editForm, establishment_name: t})} />
            <Text style={styles.label}>Total (€)</Text>
            <TextInput style={styles.input} keyboardType="decimal-pad" value={editForm.total} onChangeText={(t) => setEditForm({...editForm, total: t})} />
          </View>
        </SafeAreaView>
      </Modal>

      <TouchableOpacity style={styles.fab} onPress={takePhoto}>
        {uploading ? <ActivityIndicator color="#fff" /> : <Ionicons name="camera" size={32} color="#fff" />}
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  header: { flexDirection: 'row', justifyContent: 'space-between', padding: 20, paddingTop: 40, borderBottomWidth: 1, borderBottomColor: '#222' },
  headerTitle: { fontSize: 22, fontWeight: 'bold', color: '#fff' },
  scroll: { paddingBottom: 100 },
  card: { padding: 15, backgroundColor: '#1a1a1a', margin: 10, borderRadius: 10 },
  fab: { position: 'absolute', bottom: 30, right: 30, backgroundColor: '#4A90D9', width: 64, height: 64, borderRadius: 32, justifyContent: 'center', alignItems: 'center' },
  label: { color: '#888', marginBottom: 5 },
  input: { backgroundColor: '#1a1a1a', color: '#fff', padding: 15, borderRadius: 10, marginBottom: 20 }
});
