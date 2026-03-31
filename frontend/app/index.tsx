import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert,
  ActivityIndicator, TextInput, Modal, KeyboardAvoidingView, Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { GoogleGenerativeAI } from "@google/generative-ai";

// Configuración de URLs y Keys con seguridad
const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || 'https://tu-backend-temporal.com';

export default function Index() {
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showManualForm, setShowManualForm] = useState(false);
  const [saving, setSaving] = useState(false);
  
  const [editForm, setEditForm] = useState({
    establishment_name: '', cif: '', address: '', phone: '', 
    total: '', date: '', payment_method: 'efectivo', category: 'Varios',
  });

  // Inicializamos Gemini de forma segura
  const model = useMemo(() => {
    const apiKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
    if (!apiKey) return null;
    const genAI = new GoogleGenerativeAI(apiKey);
    return genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
  }, []);

  const loadData = useCallback(async () => {
    if (!API_URL || API_URL.includes('tu-backend')) return;
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/expenses`);
      if (response.ok) {
        const data = await response.json();
        setExpenses(data);
      }
    } catch (e) {
      console.log("Servidor no disponible todavía");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const analyzeWithGemini = async (base64: string) => {
    if (!model) {
      Alert.alert("Error de Configuración", "La clave API no se ha cargado correctamente en el APK.");
      return;
    }

    try {
      const prompt = `Analiza este ticket. Responde SOLO con un JSON puro: {"establecimiento": "nombre", "total": 0.00, "fecha": "DD/MM/YYYY", "cif": "", "direccion": "", "telefono": "", "categoria": "Comida"}`;
      
      const result = await model.generateContent([
        prompt,
        { inlineData: { data: base64, mimeType: "image/jpeg" } }
      ]);
      
      const response = await result.response;
      let text = response.text().replace(/```json/g, "").replace(/```/g, "").trim();
      const data = JSON.parse(text);

      setEditForm({
        establishment_name: data.establecimiento || 'Desconocido',
        cif: data.cif || '',
        address: data.direccion || '',
        phone: data.telefono || '',
        total: data.total ? data.total.toString() : '0',
        date: data.fecha || new Date().toLocaleDateString('es-ES'),
        payment_method: 'efectivo',
        category: data.categoria || 'Varios',
      });
      
      setShowManualForm(true);
      
    } catch (error) {
      console.error(error);
      Alert.alert("Aviso", "Gemini no pudo procesar la imagen, pero puedes rellenar los datos a mano.");
      setShowManualForm(true);
    }
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert("Permiso denegado", "Necesitamos la cámara para escanear tickets.");
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      quality: 0.5, // Bajamos un poco la calidad para que Gemini responda más rápido
      base64: true,
    });

    if (!result.canceled && result.assets[0].base64) {
      setUploading(true);
      await analyzeWithGemini(result.assets[0].base64);
      setUploading(false);
    }
  };

  const createManualExpense = async () => {
    if (!editForm.establishment_name || !editForm.total) {
      Alert.alert("Faltan datos", "Por favor pon el nombre y el total.");
      return;
    }

    setSaving(true);
    try {
      // Intentar guardar en backend si existe
      const response = await fetch(`${API_URL}/api/expenses/manual`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          ...editForm, 
          total: parseFloat(editForm.total.replace(',', '.')) || 0 
        }),
      });

      if (response.ok) {
        Alert.alert('Éxito', 'Gasto guardado correctamente');
        loadData();
      } else {
        Alert.alert('Nota', 'Se procesó el ticket pero el servidor de base de datos no respondió.');
      }
    } catch (e) {
      Alert.alert('Local', 'Gasto procesado (Sin conexión al servidor)');
    } finally {
      setSaving(false);
      setShowManualForm(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Efrain Gastos 🤖</Text>
        {loading && <ActivityIndicator size="small" color="#4A90D9" />}
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {expenses.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="receipt-outline" size={64} color="#333" />
            <Text style={styles.emptyText}>No hay gastos todavía. ¡Usa la cámara!</Text>
          </View>
        ) : (
          expenses.map((exp: any, index) => (
            <View key={index} style={styles.card}>
              <View>
                <Text style={styles.cardTitle}>{exp.establishment_name}</Text>
                <Text style={styles.cardDate}>{exp.date}</Text>
              </View>
              <Text style={styles.cardTotal}>€{exp.total}</Text>
            </View>
          ))
        )}
      </ScrollView>

      <Modal visible={showManualForm} animationType="slide" transparent={false}>
        <KeyboardAvoidingView 
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={{flex: 1, backgroundColor: '#0a0a0a'}}
        >
          <SafeAreaView style={{flex: 1}}>
            <View style={styles.header}>
              <TouchableOpacity onPress={() => setShowManualForm(false)}>
                <Ionicons name="close" size={28} color="#fff" />
              </TouchableOpacity>
              <Text style={styles.headerTitle}>Confirmar Gasto</Text>
              <TouchableOpacity onPress={createManualExpense} disabled={saving}>
                {saving ? <ActivityIndicator color="#4A90D9" /> : <Ionicons name="checkmark-done" size={28} color="#4A90D9" />}
              </TouchableOpacity>
            </View>
            
            <ScrollView style={{padding: 20}}>
              <Text style={styles.label}>Establecimiento</Text>
              <TextInput 
                style={styles.input} 
                value={editForm.establishment_name} 
                onChangeText={(t) => setEditForm({...editForm, establishment_name: t})}
                placeholderTextColor="#555"
              />
              
              <Text style={styles.label}>Total (€)</Text>
              <TextInput 
                style={styles.input} 
                keyboardType="decimal-pad" 
                value={editForm.total} 
                onChangeText={(t) => setEditForm({...editForm, total: t})}
                placeholderTextColor="#555"
              />

              <Text style={styles.label}>Categoría</Text>
              <TextInput 
                style={styles.input} 
                value={editForm.category} 
                onChangeText={(t) => setEditForm({...editForm, category: t})}
                placeholderTextColor="#555"
              />
            </ScrollView>
          </SafeAreaView>
        </KeyboardAvoidingView>
      </Modal>

      <TouchableOpacity 
        style={[styles.fab, uploading && {backgroundColor: '#333'}]} 
        onPress={takePhoto}
        disabled={uploading}
      >
        {uploading ? <ActivityIndicator color="#fff" /> : <Ionicons name="camera" size={32} color="#fff" />}
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  header: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center',
    paddingHorizontal: 20, 
    paddingVertical: 15,
    borderBottomWidth: 1, 
    borderBottomColor: '#222' 
  },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#fff' },
  scroll: { paddingBottom: 100, paddingTop: 10 },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', marginTop: 100 },
  emptyText: { color: '#555', marginTop: 10, fontSize: 16 },
  card: { 
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 18, 
    backgroundColor: '#161616', 
    marginHorizontal: 15, 
    marginVertical: 6, 
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#222'
  },
  cardTitle: { color: '#fff', fontSize: 16, fontWeight: '600' },
  cardDate: { color: '#666', fontSize: 13, marginTop: 2 },
  cardTotal: { color: '#4A90D9', fontSize: 18, fontWeight: 'bold' },
  fab: { 
    position: 'absolute', 
    bottom: 30, 
    right: 30, 
    backgroundColor: '#4A90D9', 
    width: 68, 
    height: 68, 
    borderRadius: 34, 
    justifyContent: 'center', 
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  label: { color: '#aaa', marginBottom: 8, fontSize: 14, fontWeight: '500' },
  input: { 
    backgroundColor: '#1a1a1a', 
    color: '#fff', 
    padding: 16, 
    borderRadius: 12, 
    marginBottom: 20,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#333'
  }
});
