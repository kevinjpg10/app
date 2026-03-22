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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

interface Expense {
  id: string;
  establishment_name: string;
  cif: string;
  address: string;
  phone: string;
  total: number;
  date: string;
  payment_method: string;
  image_base64?: string;
  created_at: string;
}

interface Summary {
  total_expenses: number;
  total_amount: number;
  card_payments: { count: number; total: number };
  cash_payments: { count: number; total: number };
}

export default function Index() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);
  const [activeTab, setActiveTab] = useState<'all' | 'card' | 'cash'>('all');

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
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          image_base64: base64Image,
        }),
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
    Alert.alert(
      'Eliminar gasto',
      '¿Estás seguro de que quieres eliminar este gasto?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              const response = await fetch(`${API_URL}/api/expenses/${id}`, {
                method: 'DELETE',
              });
              if (response.ok) {
                await loadData();
                setSelectedExpense(null);
              }
            } catch (error) {
              console.error('Error deleting expense:', error);
              Alert.alert('Error', 'No se pudo eliminar el gasto');
            }
          },
        },
      ]
    );
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
      console.error('Error downloading excel:', error);
      Alert.alert('Error', 'No se pudo descargar el archivo Excel');
    }
  };

  const filteredExpenses = expenses.filter((expense) => {
    if (activeTab === 'all') return true;
    if (activeTab === 'card') return expense.payment_method.toLowerCase() === 'tarjeta';
    return expense.payment_method.toLowerCase() !== 'tarjeta';
  });

  const showImagePicker = () => {
    Alert.alert(
      'Subir Ticket',
      'Selecciona cómo quieres añadir el ticket',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Tomar Foto', onPress: takePhoto },
        { text: 'Galería', onPress: pickImage },
      ]
    );
  };

  if (selectedExpense) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar style="light" />
        <View style={styles.header}>
          <TouchableOpacity onPress={() => setSelectedExpense(null)} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Detalle del Gasto</Text>
          <TouchableOpacity onPress={() => deleteExpense(selectedExpense.id)} style={styles.deleteButton}>
            <Ionicons name="trash-outline" size={24} color="#ff4444" />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.detailContainer}>
          {selectedExpense.image_base64 && (
            <Image
              source={{ uri: `data:image/jpeg;base64,${selectedExpense.image_base64}` }}
              style={styles.ticketImage}
              resizeMode="contain"
            />
          )}

          <View style={styles.detailCard}>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Establecimiento</Text>
              <Text style={styles.detailValue}>{selectedExpense.establishment_name || 'No disponible'}</Text>
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
              <View style={[
                styles.paymentBadge,
                selectedExpense.payment_method.toLowerCase() === 'tarjeta' ? styles.cardBadge : styles.cashBadge
              ]}>
                <Ionicons 
                  name={selectedExpense.payment_method.toLowerCase() === 'tarjeta' ? 'card' : 'cash'} 
                  size={16} 
                  color="#fff" 
                />
                <Text style={styles.paymentBadgeText}>
                  {selectedExpense.payment_method.charAt(0).toUpperCase() + selectedExpense.payment_method.slice(1)}
                </Text>
              </View>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />
      
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Efrain</Text>
          <Text style={styles.headerSubtitle}>Asistente de Gastos</Text>
        </View>
        <TouchableOpacity onPress={downloadExcel} style={styles.downloadButton}>
          <Ionicons name="download-outline" size={24} color="#fff" />
        </TouchableOpacity>
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
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'all' && styles.activeTab]}
          onPress={() => setActiveTab('all')}
        >
          <Text style={[styles.tabText, activeTab === 'all' && styles.activeTabText]}>Todos</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'card' && styles.activeTab]}
          onPress={() => setActiveTab('card')}
        >
          <Ionicons name="card" size={16} color={activeTab === 'card' ? '#fff' : '#888'} />
          <Text style={[styles.tabText, activeTab === 'card' && styles.activeTabText]}>Tarjeta</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'cash' && styles.activeTab]}
          onPress={() => setActiveTab('cash')}
        >
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
        <ScrollView 
          style={styles.expensesList}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#4A90D9" />
          }
        >
          {filteredExpenses.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="receipt-outline" size={64} color="#444" />
              <Text style={styles.emptyText}>No hay gastos registrados</Text>
              <Text style={styles.emptySubtext}>Sube un ticket para empezar</Text>
            </View>
          ) : (
            filteredExpenses.map((expense) => (
              <TouchableOpacity 
                key={expense.id} 
                style={styles.expenseCard}
                onPress={() => setSelectedExpense(expense)}
              >
                <View style={styles.expenseLeft}>
                  <View style={[
                    styles.expenseIcon,
                    expense.payment_method.toLowerCase() === 'tarjeta' ? styles.cardIcon : styles.cashIcon
                  ]}>
                    <Ionicons 
                      name={expense.payment_method.toLowerCase() === 'tarjeta' ? 'card' : 'cash'} 
                      size={20} 
                      color="#fff" 
                    />
                  </View>
                  <View style={styles.expenseInfo}>
                    <Text style={styles.expenseName} numberOfLines={1}>
                      {expense.establishment_name || 'Establecimiento desconocido'}
                    </Text>
                    <Text style={styles.expenseDate}>{expense.date || 'Sin fecha'}</Text>
                  </View>
                </View>
                <View style={styles.expenseRight}>
                  <Text style={styles.expenseAmount}>€{expense.total.toFixed(2)}</Text>
                  <Ionicons name="chevron-forward" size={20} color="#666" />
                </View>
              </TouchableOpacity>
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
        <TouchableOpacity style={styles.fab} onPress={showImagePicker}>
          <Ionicons name="camera" size={28} color="#fff" />
        </TouchableOpacity>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#888',
    marginTop: 2,
  },
  downloadButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#1a1a1a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#1a1a1a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#1a1a1a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  summaryContainer: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    marginBottom: 16,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 4,
    alignItems: 'center',
  },
  summaryAmount: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 8,
  },
  summaryLabel: {
    fontSize: 12,
    color: '#888',
    marginTop: 4,
  },
  tabsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#1a1a1a',
    marginRight: 8,
  },
  activeTab: {
    backgroundColor: '#4A90D9',
  },
  tabText: {
    color: '#888',
    fontSize: 14,
    marginLeft: 4,
  },
  activeTabText: {
    color: '#fff',
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#888',
    marginTop: 12,
  },
  expensesList: {
    flex: 1,
    paddingHorizontal: 16,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 80,
  },
  emptyText: {
    color: '#666',
    fontSize: 18,
    marginTop: 16,
  },
  emptySubtext: {
    color: '#444',
    fontSize: 14,
    marginTop: 4,
  },
  expenseCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  expenseLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  expenseIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardIcon: {
    backgroundColor: '#9B59B6',
  },
  cashIcon: {
    backgroundColor: '#27AE60',
  },
  expenseInfo: {
    marginLeft: 12,
    flex: 1,
  },
  expenseName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  expenseDate: {
    color: '#888',
    fontSize: 12,
    marginTop: 2,
  },
  expenseRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  expenseAmount: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginRight: 8,
  },
  bottomSpacer: {
    height: 100,
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#4A90D9',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#4A90D9',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  uploadingContainer: {
    position: 'absolute',
    bottom: 24,
    left: 24,
    right: 24,
    backgroundColor: '#4A90D9',
    borderRadius: 16,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadingText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 12,
  },
  detailContainer: {
    flex: 1,
    paddingHorizontal: 16,
  },
  ticketImage: {
    width: '100%',
    height: 300,
    borderRadius: 16,
    backgroundColor: '#1a1a1a',
    marginBottom: 16,
  },
  detailCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a2a',
  },
  detailLabel: {
    color: '#888',
    fontSize: 14,
  },
  detailValue: {
    color: '#fff',
    fontSize: 14,
    flex: 1,
    textAlign: 'right',
    marginLeft: 16,
  },
  detailValueBold: {
    color: '#4A90D9',
    fontSize: 20,
    fontWeight: 'bold',
  },
  paymentBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  cardBadge: {
    backgroundColor: '#9B59B6',
  },
  cashBadge: {
    backgroundColor: '#27AE60',
  },
  paymentBadgeText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },
});
