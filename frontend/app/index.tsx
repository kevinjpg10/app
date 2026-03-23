import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  Alert,
  ActivityIndicator,
  RefreshControl,
  Platform,
  Linking,
  TextInput,
  KeyboardAvoidingView,
  Modal,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { PieChart } from 'react-native-gifted-charts';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';
const screenWidth = Dimensions.get('window').width;

interface Expense {
  id: string;
  establishment_name: string;
  cif: string;
  address: string;
  phone: string;
  total: number;
  date: string;
  payment_method: string;
  category: string;
  image_base64?: string;
  created_at: string;
}

interface CategoryData {
  count: number;
  total: number;
  percentage: number;
}

interface Summary {
  total_expenses: number;
  total_amount: number;
  card_payments: { count: number; total: number };
  cash_payments: { count: number; total: number };
  categories: { [key: string]: CategoryData };
}

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

const CATEGORIES = ['Comida', 'Gasolina', 'Transporte', 'Alojamiento', 'Material', 'Varios'];
const CATEGORY_COLORS: { [key: string]: string } = {
  'Comida': '#FF6384',
  'Gasolina': '#36A2EB',
  'Transporte': '#FFCE56',
  'Alojamiento': '#4BC0C0',
  'Material': '#9966FF',
  'Varios': '#FF9F40',
};

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
    establishment_name: '',
    cif: '',
    address: '',
    phone: '',
    total: '',
    date: '',
    payment_method: 'efectivo',
    category: 'Varios',
  });

  const fetchExpenses = useCallback(async () => {
    try {
      const response = await fetch(`${API_URL}/api/expenses`);
      if (response.ok) {
        const data = await response.json();
        setExpenses(data);
      }
    } catch (error) {
      console.error('Error fetching expenses:', error);
    }
  }, []);

  const fetchSummary = useCallback(async () => {
    try {
      const response = await fetch(`${API_URL}/api/expenses/summary/stats`);
      if (response.ok) {
        const data = await response.json();
        setSummary(data);
      }
    } catch (error) {
      console.error('Error fetching summary:', error);
    }
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    await Promise.all([fetchExpenses(), fetchSummary()]);
    setLoading(false);
  }, [fetchExpenses, fetchSummary]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const pickImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permiso denegado', 'Necesitamos acceso a tu galería para subir tickets.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.8,
        base64: true,
      });

      if (!result.canceled && result.assets[0].base64) {
        await uploadTicket(result.assets[0].base64);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'No se pudo seleccionar la imagen');
    }
  };

  const takePhoto = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permiso denegado', 'Necesitamos acceso a tu cámara para tomar fotos de tickets.');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        quality: 0.8,
        base64: true,
      });

      if (!result.canceled && result.assets[0].base64) {
        await uploadTicket(result.assets[0].base64);
      }
    } catch (error) {
      console.error('Error taking photo:', error);
      Alert.alert('Error', 'No se pudo tomar la foto');
    }
  };

  const uploadTicket = async (base64Image: string) => {
    setUploading(true);
    try {
      const response = await fetch(`${API_URL}/api/expenses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image_base64: base64Image }),
      });

      if (response.ok) {
        Alert.alert('Éxito', 'Ticket procesado correctamente');
        await loadData();
      } else {
        const error = await response.json();
        Alert.alert('Error', error.detail || 'No se pudo procesar el ticket');
      }
    } catch (error) {
      console.error('Error uploading ticket:', error);
      Alert.alert('Error', 'No se pudo subir el ticket');
    } finally {
      setUploading(false);
    }
  };

  const deleteExpense = async (id: string) => {
    Alert.alert('Eliminar gasto', '¿Estás seguro de que quieres eliminar este gasto?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: async () => {
          try {
            const response = await fetch(`${API_URL}/api/expenses/${id}`, { method: 'DELETE' });
            if (response.ok) {
              await loadData();
              setSelectedExpense(null);
            }
          } catch (error) {
            Alert.alert('Error', 'No se pudo eliminar el gasto');
          }
        },
      },
    ]);
  };

  const deleteAllExpenses = async () => {
    Alert.alert('Borrar Todo', '¿Estás seguro de que quieres eliminar TODOS los gastos?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Borrar Todo',
        style: 'destructive',
        onPress: async () => {
          try {
            const response = await fetch(`${API_URL}/api/expenses`, { method: 'DELETE' });
            if (response.ok) {
              const result = await response.json();
              Alert.alert('Éxito', result.message);
              await loadData();
            }
          } catch (error) {
            Alert.alert('Error', 'No se pudo borrar los gastos');
          }
        },
      },
    ]);
  };

  const togglePaymentMethod = async (expenseId: string) => {
    try {
      const response = await fetch(`${API_URL}/api/expenses/${expenseId}/payment-method`, { method: 'PATCH' });
      if (response.ok) {
        const updatedExpense = await response.json();
        setExpenses(prev => prev.map(e => e.id === expenseId ? updatedExpense : e));
        if (selectedExpense && selectedExpense.id === expenseId) {
          setSelectedExpense(updatedExpense);
        }
        await fetchSummary();
      }
    } catch (error) {
      Alert.alert('Error', 'No se pudo cambiar el método de pago');
    }
  };

  const downloadExcel = async () => {
    try {
      const url = `${API_URL}/api/expenses/export/excel`;
      if (Platform.OS === 'web') {
        window.open(url, '_blank');
      } else {
        await Linking.openURL(url);
      }
    } catch (error) {
      Alert.alert('Error', 'No se pudo descargar el archivo Excel');
    }
  };

  const downloadPDF = async () => {
    try {
      const url = `${API_URL}/api/expenses/export/pdf`;
      if (Platform.OS === 'web') {
        window.open(url, '_blank');
      } else {
        await Linking.openURL(url);
      }
    } catch (error) {
      Alert.alert('Error', 'No se pudo generar el PDF');
    }
  };

  const startEditing = (expense: Expense) => {
    setEditForm({
      establishment_name: expense.establishment_name || '',
      cif: expense.cif || '',
      address: expense.address || '',
      phone: expense.phone || '',
      total: expense.total.toString(),
      date: expense.date || '',
      payment_method: expense.payment_method || 'efectivo',
      category: expense.category || 'Varios',
    });
    setIsEditing(true);
  };

  const saveExpense = async () => {
    if (!selectedExpense) return;
    setSaving(true);
    try {
      const response = await fetch(`${API_URL}/api/expenses/${selectedExpense.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          establishment_name: editForm.establishment_name,
          cif: editForm.cif,
          address: editForm.address,
          phone: editForm.phone,
          total: parseFloat(editForm.total) || 0,
          date: editForm.date,
          payment_method: editForm.payment_method,
          category: editForm.category,
        }),
      });

      if (response.ok) {
        const updatedExpense = await response.json();
        setSelectedExpense(updatedExpense);
        setIsEditing(false);
        await loadData();
        Alert.alert('Éxito', 'Gasto actualizado correctamente');
      } else {
        Alert.alert('Error', 'No se pudo actualizar el gasto');
      }
    } catch (error) {
      Alert.alert('Error', 'No se pudo guardar los cambios');
    } finally {
      setSaving(false);
    }
  };

  const createManualExpense = async () => {
    if (!editForm.establishment_name.trim()) {
      Alert.alert('Error', 'El nombre del establecimiento es obligatorio');
      return;
    }

    setSaving(true);
    try {
      const response = await fetch(`${API_URL}/api/expenses/manual`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          establishment_name: editForm.establishment_name,
          cif: editForm.cif,
          address: editForm.address,
          phone: editForm.phone,
          total: parseFloat(editForm.total) || 0,
          date: editForm.date,
          payment_method: editForm.payment_method,
          category: editForm.category,
        }),
      });

      if (response.ok) {
        setShowManualForm(false);
        resetForm();
        await loadData();
        Alert.alert('Éxito', 'Gasto creado correctamente');
      } else {
        Alert.alert('Error', 'No se pudo crear el gasto');
      }
    } catch (error) {
      Alert.alert('Error', 'No se pudo crear el gasto');
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setEditForm({
      establishment_name: '',
      cif: '',
      address: '',
      phone: '',
      total: '',
      date: '',
      payment_method: 'efectivo',
      category: 'Varios',
    });
  };

  const filteredExpenses = expenses.filter((expense) => {
    if (activeTab === 'all') return true;
    if (activeTab === 'card') return expense.payment_method.toLowerCase() === 'tarjeta';
    return expense.payment_method.toLowerCase() !== 'tarjeta';
  });

  const showAddOptions = () => {
    Alert.alert('Añadir Gasto', 'Selecciona cómo quieres añadir el gasto', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Manual', onPress: () => { resetForm(); setShowManualForm(true); } },
      { text: 'Tomar Foto', onPress: takePhoto },
      { text: 'Galería', onPress: pickImage },
    ]);
  };

  // Prepare pie chart data
  const getPieChartData = () => {
    if (!summary?.categories) return [];
    return Object.entries(summary.categories)
      .filter(([_, data]) => data.total > 0)
      .map(([cat, data]) => ({
        value: data.total,
        color: CATEGORY_COLORS[cat] || '#888',
        text: `${data.percentage}%`,
        label: cat,
      }));
  };

  // Render category selector
  const renderCategorySelector = () => (
    <View style={styles.formGroup}>
      <Text style={styles.formLabel}>Categoría</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScroll}>
        {CATEGORIES.map((cat) => (
          <TouchableOpacity
            key={cat}
            style={[
              styles.categoryChip,
              editForm.category === cat && { backgroundColor: CATEGORY_COLORS[cat] }
            ]}
            onPress={() => setEditForm({ ...editForm, category: cat })}
          >
            <Text style={[
              styles.categoryChipText,
              editForm.category === cat && { color: '#fff' }
            ]}>{cat}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );

  // Render form fields
  const renderFormFields = () => (
    <>
      <View style={styles.formGroup}>
        <Text style={styles.formLabel}>Establecimiento *</Text>
        <TextInput
          style={styles.formInput}
          value={editForm.establishment_name}
          onChangeText={(text) => setEditForm({ ...editForm, establishment_name: text })}
          placeholder="Nombre del establecimiento"
          placeholderTextColor="#666"
        />
      </View>

      {renderCategorySelector()}

      <View style={styles.formGroup}>
        <Text style={styles.formLabel}>CIF</Text>
        <TextInput
          style={styles.formInput}
          value={editForm.cif}
          onChangeText={(text) => setEditForm({ ...editForm, cif: text })}
          placeholder="B12345678"
          placeholderTextColor="#666"
          autoCapitalize="characters"
        />
      </View>

      <View style={styles.formGroup}>
        <Text style={styles.formLabel}>Dirección</Text>
        <TextInput
          style={styles.formInput}
          value={editForm.address}
          onChangeText={(text) => setEditForm({ ...editForm, address: text })}
          placeholder="Calle, número, ciudad"
          placeholderTextColor="#666"
        />
      </View>

      <View style={styles.formGroup}>
        <Text style={styles.formLabel}>Teléfono</Text>
        <TextInput
          style={styles.formInput}
          value={editForm.phone}
          onChangeText={(text) => setEditForm({ ...editForm, phone: text })}
          placeholder="912345678"
          placeholderTextColor="#666"
          keyboardType="phone-pad"
        />
      </View>

      <View style={styles.formGroup}>
        <Text style={styles.formLabel}>Total (€) *</Text>
        <TextInput
          style={styles.formInput}
          value={editForm.total}
          onChangeText={(text) => setEditForm({ ...editForm, total: text.replace(',', '.') })}
          placeholder="0.00"
          placeholderTextColor="#666"
          keyboardType="decimal-pad"
        />
      </View>

      <View style={styles.formGroup}>
        <Text style={styles.formLabel}>Fecha</Text>
        <TextInput
          style={styles.formInput}
          value={editForm.date}
          onChangeText={(text) => setEditForm({ ...editForm, date: text })}
          placeholder="DD/MM/YYYY"
          placeholderTextColor="#666"
        />
      </View>

      <View style={styles.formGroup}>
        <Text style={styles.formLabel}>Método de pago</Text>
        <View style={styles.paymentToggle}>
          <TouchableOpacity
            style={[
              styles.paymentOption,
              editForm.payment_method === 'efectivo' && styles.cashActive,
            ]}
            onPress={() => setEditForm({ ...editForm, payment_method: 'efectivo' })}
          >
            <Ionicons name="cash" size={20} color={editForm.payment_method === 'efectivo' ? '#fff' : '#888'} />
            <Text style={[styles.paymentOptionText, editForm.payment_method === 'efectivo' && { color: '#fff' }]}>Efectivo</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.paymentOption,
              editForm.payment_method === 'tarjeta' && styles.cardActive,
            ]}
            onPress={() => setEditForm({ ...editForm, payment_method: 'tarjeta' })}
          >
            <Ionicons name="card" size={20} color={editForm.payment_method === 'tarjeta' ? '#fff' : '#888'} />
            <Text style={[styles.paymentOptionText, editForm.payment_method === 'tarjeta' && { color: '#fff' }]}>Tarjeta</Text>
          </TouchableOpacity>
        </View>
      </View>
    </>
  );

  // Statistics Modal
  const renderStatsModal = () => (
    <Modal visible={showStats} animationType="slide" transparent={false}>
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => setShowStats(false)} style={styles.backButton}>
            <Ionicons name="close" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Estadísticas</Text>
          <TouchableOpacity onPress={downloadPDF} style={styles.pdfButton}>
            <Ionicons name="document-text" size={22} color="#fff" />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.statsContainer}>
          {/* Pie Chart */}
          <View style={styles.chartCard}>
            <Text style={styles.chartTitle}>Gastos por Categoría</Text>
            {getPieChartData().length > 0 ? (
              <View style={styles.chartWrapper}>
                <PieChart
                  data={getPieChartData()}
                  donut
                  radius={100}
                  innerRadius={60}
                  centerLabelComponent={() => (
                    <View style={styles.centerLabel}>
                      <Text style={styles.centerLabelAmount}>€{summary?.total_amount.toFixed(2)}</Text>
                      <Text style={styles.centerLabelText}>Total</Text>
                    </View>
                  )}
                />
              </View>
            ) : (
              <Text style={styles.noDataText}>No hay datos para mostrar</Text>
            )}
          </View>

          {/* Category Legend */}
          <View style={styles.legendCard}>
            {summary?.categories && Object.entries(summary.categories).map(([cat, data]) => (
              data.total > 0 && (
                <View key={cat} style={styles.legendItem}>
                  <View style={[styles.legendColor, { backgroundColor: CATEGORY_COLORS[cat] }]} />
                  <Text style={styles.legendText}>{cat}</Text>
                  <Text style={styles.legendAmount}>€{data.total.toFixed(2)}</Text>
                  <Text style={styles.legendPercent}>{data.percentage}%</Text>
                </View>
              )
            ))}
          </View>

          {/* PDF Export Button */}
          <TouchableOpacity style={styles.pdfExportButton} onPress={downloadPDF}>
            <Ionicons name="document-text" size={24} color="#fff" />
            <Text style={styles.pdfExportButtonText}>Generar Informe PDF</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );

  // Manual Form Modal
  const renderManualFormModal = () => (
    <Modal visible={showManualForm} animationType="slide" transparent={false}>
      <SafeAreaView style={styles.container}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => setShowManualForm(false)} style={styles.backButton}>
              <Ionicons name="close" size={24} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Nuevo Gasto Manual</Text>
            <TouchableOpacity onPress={createManualExpense} style={styles.saveButton} disabled={saving}>
              {saving ? <ActivityIndicator size="small" color="#4A90D9" /> : <Ionicons name="checkmark" size={24} color="#4A90D9" />}
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.formContainer}>{renderFormFields()}</ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );

  // Detail/Edit View
  if (selectedExpense) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar style="light" />
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => { setSelectedExpense(null); setIsEditing(false); }} style={styles.backButton}>
              <Ionicons name="arrow-back" size={24} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>{isEditing ? 'Editar Gasto' : 'Detalle del Gasto'}</Text>
            {isEditing ? (
              <TouchableOpacity onPress={saveExpense} style={styles.saveButton} disabled={saving}>
                {saving ? <ActivityIndicator size="small" color="#4A90D9" /> : <Ionicons name="checkmark" size={24} color="#4A90D9" />}
              </TouchableOpacity>
            ) : (
              <View style={styles.headerActions}>
                <TouchableOpacity onPress={() => startEditing(selectedExpense)} style={styles.editButton}>
                  <Ionicons name="pencil" size={22} color="#4A90D9" />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => deleteExpense(selectedExpense.id)} style={styles.deleteButton}>
                  <Ionicons name="trash-outline" size={22} color="#ff4444" />
                </TouchableOpacity>
              </View>
            )}
          </View>

          <ScrollView style={styles.detailContainer}>
            {!isEditing && selectedExpense.image_base64 && selectedExpense.image_base64.length > 100 && (
              <Image source={{ uri: `data:image/jpeg;base64,${selectedExpense.image_base64}` }} style={styles.ticketImage} resizeMode="contain" />
            )}

            {isEditing ? (
              <View style={styles.formContainer}>
                {renderFormFields()}
                <TouchableOpacity style={styles.cancelEditButton} onPress={() => setIsEditing(false)}>
                  <Text style={styles.cancelEditButtonText}>Cancelar</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.detailCard}>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Establecimiento</Text>
                  <Text style={styles.detailValue}>{selectedExpense.establishment_name || 'No disponible'}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Categoría</Text>
                  <View style={[styles.categoryBadge, { backgroundColor: CATEGORY_COLORS[selectedExpense.category] || '#888' }]}>
                    <Text style={styles.categoryBadgeText}>{selectedExpense.category || 'Varios'}</Text>
                  </View>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>CIF</Text>
                  <Text style={styles.detailValue}>{selectedExpense.cif || 'No disponible'}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Dirección</Text>
                  <Text style={styles.detailValue}>{selectedExpense.address || 'No disponible'}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Teléfono</Text>
                  <Text style={styles.detailValue}>{selectedExpense.phone || 'No disponible'}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Total</Text>
                  <Text style={styles.detailValueBold}>€{selectedExpense.total.toFixed(2)}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Fecha</Text>
                  <Text style={styles.detailValue}>{selectedExpense.date || 'No disponible'}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Método de pago</Text>
                  <TouchableOpacity
                    onPress={() => togglePaymentMethod(selectedExpense.id)}
                    style={[styles.paymentBadge, styles.paymentBadgeTouchable, selectedExpense.payment_method.toLowerCase() === 'tarjeta' ? styles.cardBadge : styles.cashBadge]}
                  >
                    <Ionicons name={selectedExpense.payment_method.toLowerCase() === 'tarjeta' ? 'card' : 'cash'} size={16} color="#fff" />
                    <Text style={styles.paymentBadgeText}>{selectedExpense.payment_method.charAt(0).toUpperCase() + selectedExpense.payment_method.slice(1)}</Text>
                    <Ionicons name="swap-horizontal" size={14} color="#fff" style={{ marginLeft: 4 }} />
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />
      {renderManualFormModal()}
      {renderStatsModal()}

      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Efrain</Text>
          <Text style={styles.headerSubtitle}>Asistente de Gastos</Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity onPress={() => setShowStats(true)} style={styles.statsButton}>
            <Ionicons name="pie-chart" size={22} color="#4A90D9" />
          </TouchableOpacity>
          <TouchableOpacity onPress={deleteAllExpenses} style={styles.deleteAllButton}>
            <Ionicons name="trash-outline" size={22} color="#ff4444" />
          </TouchableOpacity>
          <TouchableOpacity onPress={downloadExcel} style={styles.downloadButton}>
            <Ionicons name="download-outline" size={24} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Summary Cards */}
      {summary && (
        <View style={styles.summaryContainer}>
          <View style={styles.summaryCard}>
            <Ionicons name="receipt-outline" size={24} color="#4A90D9" />
            <Text style={styles.summaryAmount}>€{summary.total_amount.toFixed(2)}</Text>
            <Text style={styles.summaryLabel}>{summary.total_expenses} gastos</Text>
          </View>
          <View style={styles.summaryCard}>
            <Ionicons name="card-outline" size={24} color="#9B59B6" />
            <Text style={styles.summaryAmount}>€{summary.card_payments.total.toFixed(2)}</Text>
            <Text style={styles.summaryLabel}>{summary.card_payments.count} tarjeta</Text>
          </View>
          <View style={styles.summaryCard}>
            <Ionicons name="cash-outline" size={24} color="#27AE60" />
            <Text style={styles.summaryAmount}>€{summary.cash_payments.total.toFixed(2)}</Text>
            <Text style={styles.summaryLabel}>{summary.cash_payments.count} efectivo</Text>
          </View>
        </View>
      )}

      {/* Tabs */}
      <View style={styles.tabsContainer}>
        <TouchableOpacity style={[styles.tab, activeTab === 'all' && styles.activeTab]} onPress={() => setActiveTab('all')}>
          <Text style={[styles.tabText, activeTab === 'all' && styles.activeTabText]}>Todos</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tab, activeTab === 'card' && styles.activeTab]} onPress={() => setActiveTab('card')}>
          <Ionicons name="card" size={16} color={activeTab === 'card' ? '#fff' : '#888'} />
          <Text style={[styles.tabText, activeTab === 'card' && styles.activeTabText]}>Tarjeta</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tab, activeTab === 'cash' && styles.activeTab]} onPress={() => setActiveTab('cash')}>
          <Ionicons name="cash" size={16} color={activeTab === 'cash' ? '#fff' : '#888'} />
          <Text style={[styles.tabText, activeTab === 'cash' && styles.activeTabText]}>Efectivo</Text>
        </TouchableOpacity>
      </View>

      {/* Expenses List */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4A90D9" />
          <Text style={styles.loadingText}>Cargando gastos...</Text>
        </View>
      ) : (
        <ScrollView style={styles.expensesList} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#4A90D9" />}>
          {filteredExpenses.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="receipt-outline" size={64} color="#444" />
              <Text style={styles.emptyText}>No hay gastos registrados</Text>
              <Text style={styles.emptySubtext}>Sube un ticket o añade manualmente</Text>
            </View>
          ) : (
            filteredExpenses.map((expense) => (
              <View key={expense.id} style={styles.expenseCard}>
                <TouchableOpacity style={styles.expenseLeft} onPress={() => setSelectedExpense(expense)}>
                  <TouchableOpacity
                    onPress={() => togglePaymentMethod(expense.id)}
                    style={[styles.expenseIcon, expense.payment_method.toLowerCase() === 'tarjeta' ? styles.cardIcon : styles.cashIcon]}
                  >
                    <Ionicons name={expense.payment_method.toLowerCase() === 'tarjeta' ? 'card' : 'cash'} size={20} color="#fff" />
                  </TouchableOpacity>
                  <View style={styles.expenseInfo}>
                    <Text style={styles.expenseName} numberOfLines={1}>{expense.establishment_name || 'Establecimiento desconocido'}</Text>
                    <View style={styles.expenseMeta}>
                      <Text style={styles.expenseDate}>{expense.date || 'Sin fecha'}</Text>
                      <View style={[styles.categoryTag, { backgroundColor: CATEGORY_COLORS[expense.category] || '#888' }]}>
                        <Text style={styles.categoryTagText}>{expense.category || 'Varios'}</Text>
                      </View>
                    </View>
                  </View>
                </TouchableOpacity>
                <TouchableOpacity style={styles.expenseRight} onPress={() => setSelectedExpense(expense)}>
                  <Text style={styles.expenseAmount}>€{expense.total.toFixed(2)}</Text>
                  <Ionicons name="chevron-forward" size={20} color="#666" />
                </TouchableOpacity>
              </View>
            ))
          )}
          <View style={styles.bottomSpacer} />
        </ScrollView>
      )}

      {/* Upload Button */}
      {uploading ? (
        <View style={styles.uploadingContainer}>
          <ActivityIndicator size="large" color="#fff" />
          <Text style={styles.uploadingText}>Procesando ticket con IA...</Text>
        </View>
      ) : (
        <TouchableOpacity style={styles.fab} onPress={showAddOptions}>
          <Ionicons name="add" size={32} color="#fff" />
        </TouchableOpacity>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16 },
  headerTitle: { fontSize: 28, fontWeight: 'bold', color: '#fff' },
  headerSubtitle: { fontSize: 14, color: '#888', marginTop: 2 },
  headerActions: { flexDirection: 'row', alignItems: 'center' },
  downloadButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#1a1a1a', justifyContent: 'center', alignItems: 'center' },
  deleteAllButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#1a1a1a', justifyContent: 'center', alignItems: 'center', marginRight: 8 },
  statsButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#1a1a1a', justifyContent: 'center', alignItems: 'center', marginRight: 8 },
  pdfButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#E74C3C', justifyContent: 'center', alignItems: 'center' },
  backButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#1a1a1a', justifyContent: 'center', alignItems: 'center' },
  editButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#1a1a1a', justifyContent: 'center', alignItems: 'center', marginRight: 8 },
  saveButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#1a1a1a', justifyContent: 'center', alignItems: 'center' },
  deleteButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#1a1a1a', justifyContent: 'center', alignItems: 'center' },
  summaryContainer: { flexDirection: 'row', paddingHorizontal: 12, marginBottom: 16 },
  summaryCard: { flex: 1, backgroundColor: '#1a1a1a', borderRadius: 16, padding: 16, marginHorizontal: 4, alignItems: 'center' },
  summaryAmount: { fontSize: 18, fontWeight: 'bold', color: '#fff', marginTop: 8 },
  summaryLabel: { fontSize: 12, color: '#888', marginTop: 4 },
  tabsContainer: { flexDirection: 'row', paddingHorizontal: 16, marginBottom: 16 },
  tab: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, backgroundColor: '#1a1a1a', marginRight: 8 },
  activeTab: { backgroundColor: '#4A90D9' },
  tabText: { color: '#888', fontSize: 14, marginLeft: 4 },
  activeTabText: { color: '#fff', fontWeight: '600' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { color: '#888', marginTop: 12 },
  expensesList: { flex: 1, paddingHorizontal: 16 },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 80 },
  emptyText: { color: '#666', fontSize: 18, marginTop: 16 },
  emptySubtext: { color: '#444', fontSize: 14, marginTop: 4 },
  expenseCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#1a1a1a', borderRadius: 16, padding: 16, marginBottom: 12 },
  expenseLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  expenseIcon: { width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  cardIcon: { backgroundColor: '#9B59B6' },
  cashIcon: { backgroundColor: '#27AE60' },
  expenseInfo: { marginLeft: 12, flex: 1 },
  expenseName: { color: '#fff', fontSize: 16, fontWeight: '600' },
  expenseMeta: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  expenseDate: { color: '#888', fontSize: 12 },
  categoryTag: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8, marginLeft: 8 },
  categoryTagText: { color: '#fff', fontSize: 10, fontWeight: '600' },
  expenseRight: { flexDirection: 'row', alignItems: 'center' },
  expenseAmount: { color: '#fff', fontSize: 18, fontWeight: 'bold', marginRight: 8 },
  bottomSpacer: { height: 100 },
  fab: { position: 'absolute', bottom: 24, right: 24, width: 60, height: 60, borderRadius: 30, backgroundColor: '#4A90D9', justifyContent: 'center', alignItems: 'center', elevation: 8 },
  uploadingContainer: { position: 'absolute', bottom: 24, left: 24, right: 24, backgroundColor: '#4A90D9', borderRadius: 16, padding: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  uploadingText: { color: '#fff', fontSize: 16, fontWeight: '600', marginLeft: 12 },
  detailContainer: { flex: 1, paddingHorizontal: 16 },
  ticketImage: { width: '100%', height: 300, borderRadius: 16, backgroundColor: '#1a1a1a', marginBottom: 16 },
  detailCard: { backgroundColor: '#1a1a1a', borderRadius: 16, padding: 20, marginBottom: 20 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#2a2a2a' },
  detailLabel: { color: '#888', fontSize: 14 },
  detailValue: { color: '#fff', fontSize: 14, flex: 1, textAlign: 'right', marginLeft: 16 },
  detailValueBold: { color: '#4A90D9', fontSize: 20, fontWeight: 'bold' },
  paymentBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
  paymentBadgeTouchable: { borderWidth: 2, borderColor: 'rgba(255,255,255,0.3)' },
  cardBadge: { backgroundColor: '#9B59B6' },
  cashBadge: { backgroundColor: '#27AE60' },
  paymentBadgeText: { color: '#fff', fontSize: 14, fontWeight: '600', marginLeft: 6 },
  categoryBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
  categoryBadgeText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  formContainer: { paddingHorizontal: 16 },
  formGroup: { marginBottom: 20 },
  formLabel: { color: '#888', fontSize: 14, marginBottom: 8 },
  formInput: { backgroundColor: '#1a1a1a', borderRadius: 12, padding: 16, color: '#fff', fontSize: 16, borderWidth: 1, borderColor: '#2a2a2a' },
  categoryScroll: { flexDirection: 'row' },
  categoryChip: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, backgroundColor: '#1a1a1a', marginRight: 8, borderWidth: 1, borderColor: '#2a2a2a' },
  categoryChipText: { color: '#888', fontSize: 14 },
  paymentToggle: { flexDirection: 'row', gap: 12 },
  paymentOption: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#1a1a1a', borderRadius: 12, padding: 16, borderWidth: 1, borderColor: '#2a2a2a' },
  cashActive: { backgroundColor: '#27AE60', borderWidth: 0 },
  cardActive: { backgroundColor: '#9B59B6', borderWidth: 0 },
  paymentOptionText: { color: '#888', fontSize: 16, marginLeft: 8 },
  cancelEditButton: { backgroundColor: '#2a2a2a', borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 8, marginBottom: 40 },
  cancelEditButtonText: { color: '#888', fontSize: 16, fontWeight: '600' },
  statsContainer: { flex: 1, paddingHorizontal: 16 },
  chartCard: { backgroundColor: '#1a1a1a', borderRadius: 16, padding: 20, marginBottom: 16 },
  chartTitle: { color: '#fff', fontSize: 18, fontWeight: '600', marginBottom: 20, textAlign: 'center' },
  chartWrapper: { alignItems: 'center', justifyContent: 'center' },
  centerLabel: { alignItems: 'center' },
  centerLabelAmount: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
  centerLabelText: { color: '#888', fontSize: 12 },
  noDataText: { color: '#666', fontSize: 16, textAlign: 'center', paddingVertical: 40 },
  legendCard: { backgroundColor: '#1a1a1a', borderRadius: 16, padding: 20, marginBottom: 16 },
  legendItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
  legendColor: { width: 16, height: 16, borderRadius: 4 },
  legendText: { color: '#fff', fontSize: 14, marginLeft: 12, flex: 1 },
  legendAmount: { color: '#fff', fontSize: 14, fontWeight: '600', marginRight: 12 },
  legendPercent: { color: '#888', fontSize: 14, width: 50, textAlign: 'right' },
  pdfExportButton: { backgroundColor: '#E74C3C', borderRadius: 16, padding: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 40 },
  pdfExportButtonText: { color: '#fff', fontSize: 18, fontWeight: '600', marginLeft: 12 },
});
