const analyzeWithGemini = async (base64: string) => {
    try {
      const prompt = `Analiza este ticket. Responde SOLO con un JSON puro, sin bloques de código: {"establecimiento": "nombre", "total": 0.00, "fecha": "DD/MM/YYYY", "cif": "", "direccion": "", "telefono": "", "categoria": "Comida"}`;
      const result = await model.generateContent([prompt, { inlineData: { data: base64, mimeType: "image/jpeg" } }]);
      const response = await result.response;
      let text = response.text().trim();
      
      // Limpieza de posibles etiquetas markdown que Gemini a veces añade
      text = text.replace(/```json/g, "").replace(/```/g, "").trim();
      
      const data = JSON.parse(text);
      
      // Preparamos los datos para enviar al servidor
      const expenseData = {
        establishment_name: data.establecimiento || 'Desconocido',
        cif: data.cif || '',
        address: data.direccion || '',
        phone: data.telefono || '',
        total: parseFloat(data.total) || 0,
        date: data.fecha || new Date().toLocaleDateString('es-ES'),
        payment_method: 'efectivo',
        category: data.categoria || 'Varios',
      };

      // --- AQUÍ ESTÁ EL CAMBIO CLAVE: GUARDADO AUTOMÁTICO ---
      const saveResponse = await fetch(`${API_URL}/api/expenses/manual`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(expenseData),
      });

      if (saveResponse.ok) {
        await loadData(); // Recargamos la lista
        Alert.alert("Éxito ✅", `Gasto de ${expenseData.establishment_name} por €${expenseData.total} guardado automáticamente.`);
      } else {
        // Si falla el autoguardado, abrimos el manual por si acaso
        setEditForm({ ...expenseData, total: expenseData.total.toString() });
        setShowManualForm(true);
      }

    } catch (error) {
      console.error(error);
      Alert.alert("Error", "Gemini no pudo procesar la imagen. Inténtalo de nuevo o rellena a mano.");
      setShowManualForm(true);
    }
  };
