import { useLocalSearchParams } from 'expo-router';
import { collection, getDocs, query, where } from 'firebase/firestore';
import React, { useState } from 'react';
import { ActivityIndicator, Alert, Button, StyleSheet, Text, TextInput, View } from 'react-native';
import { db } from '../firebase/config';
import { useNetworkSync } from '../hooks/useNetworkSync';
import { addPunchToQueue, syncQueue } from '../services/syncService';
import { getLocalYYYYMMDD } from '../utils/dateHelpers';

export default function ScannerScreen() {
  const { eventStr, userStr } = useLocalSearchParams<{ eventStr: string, userStr: string }>();
  const event = eventStr ? JSON.parse(eventStr) : null;
  const user = userStr ? JSON.parse(userStr) : null;
  
  const isOnline = useNetworkSync();
  const [searchQuery, setSearchQuery] = useState('');
  const [student, setStudent] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const todayDate = getLocalYYYYMMDD();
  const todayConfig = event?.days?.find((d: any) => d.date === todayDate);

  const searchStudent = async () => {
    if (!searchQuery) return;
    setLoading(true);
    try {
      const q = query(collection(db, 'users'), where('student_id', '==', searchQuery));
      const snapshot = await getDocs(q);
      
      if (snapshot.empty) {
        Alert.alert("Not Found", "No student matches this ID.");
        setStudent(null);
      } else {
        const foundStudent = snapshot.docs[0].data();
        validateStudent(foundStudent);
      }
    } catch (error: any) {
      Alert.alert("Error", error.message);
    }
    setLoading(false);
  };

  const validateStudent = (foundStudent: any) => {
    if (!todayConfig) {
      Alert.alert("No Schedule", "This event is not scheduled for today.");
      return;
    }

    const { programs, years, sections } = todayConfig;
    
    const isProgramValid = programs.length === 0 || programs.includes(foundStudent.program);
    const isYearValid = years.length === 0 || years.includes(foundStudent.year);
    const isSectionValid = sections.length === 0 || sections.includes(foundStudent.section);

    if (isProgramValid && isYearValid && isSectionValid) {
      setStudent(foundStudent);
    } else {
      setStudent(null);
      Alert.alert("Ineligible", "Student not eligible for this event today.", [{ text: "OK", style: "destructive" }]);
    }
  };

  const handlePunch = async (punchType: string) => {
    if (!student || !event || !user) return;

    const docId = `${student.student_id}_${event.id}_${todayDate}`;
    const timestamp = new Date().toISOString();

    const dbFieldMap: Record<string, string> = {
      'm_in': 'morning_in',
      'm_out': 'morning_out',
      'a_in': 'afternoon_in',
      'a_out': 'afternoon_out'
    };
    
    const actualDbField = dbFieldMap[punchType];

    const payload = {
      student_id: student.student_id,
      student_name: `${student.first_name} ${student.last_name}`,
      program: student.program,
      section: student.section,
      sbo_name: user.sbo_name,
      event_id: event.id,
      date: todayDate,
      [actualDbField]: timestamp // Uses the mapped full word!
    };

    await addPunchToQueue(docId, payload);
    Alert.alert("Success", isOnline ? "Saved & Synced!" : "Saved Offline.");

    if (isOnline) {
      syncQueue(); 
    }
    
    setStudent(null);
    setSearchQuery('');
  };

  return (
    <View style={styles.container}>
      <Text style={[styles.status, { color: isOnline ? 'green' : 'red' }]}>
        {isOnline ? '🟢 Online' : '🔴 Offline Mode'}
      </Text>

      <View style={styles.searchSection}>
        <TextInput
          style={styles.input}
          placeholder="Enter Student ID..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          onSubmitEditing={searchStudent}
        />
        <Button title="Search" onPress={searchStudent} />
      </View>

      {loading && <ActivityIndicator size="large" />}

      {student && todayConfig && (
        <View style={styles.studentCard}>
          <View style={styles.photoPlaceholder}>
            <Text style={styles.photoText}>Photo</Text>
          </View>
          <Text style={styles.name}>{student.first_name} {student.last_name}</Text>
          <Text style={styles.details}>{student.student_id}</Text>
          <Text style={styles.details}>{student.program} - Year {student.year} Section {student.section}</Text>

          <View style={styles.grid}>
            <View style={styles.gridItem}>
              <Button title="Morning IN" disabled={!todayConfig.m_in} onPress={() => handlePunch('m_in')} />
            </View>
            <View style={styles.gridItem}>
              <Button title="Morning OUT" disabled={!todayConfig.m_out} onPress={() => handlePunch('m_out')} color="#ff5c5c"/>
            </View>
            <View style={styles.gridItem}>
              <Button title="Afternoon IN" disabled={!todayConfig.a_in} onPress={() => handlePunch('a_in')} />
            </View>
            <View style={styles.gridItem}>
              <Button title="Afternoon OUT" disabled={!todayConfig.a_out} onPress={() => handlePunch('a_out')} color="#ff5c5c"/>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 15, backgroundColor: '#f5f5f5' },
  status: { fontWeight: 'bold', alignSelf: 'center', marginBottom: 10 },
  searchSection: { flexDirection: 'row', marginBottom: 20 },
  input: { flex: 1, borderWidth: 1, borderColor: '#ccc', padding: 10, marginRight: 10, borderRadius: 8, backgroundColor: 'white' },
  studentCard: { padding: 20, backgroundColor: 'white', borderRadius: 10, alignItems: 'center', elevation: 3 },
  photoPlaceholder: { width: 100, height: 100, borderRadius: 50, backgroundColor: '#ddd', justifyContent: 'center', alignItems: 'center', marginBottom: 15 },
  photoText: { color: '#888' },
  name: { fontSize: 22, fontWeight: 'bold', marginBottom: 5 },
  details: { fontSize: 16, color: '#555', marginBottom: 5 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 20, justifyContent: 'space-between' },
  gridItem: { width: '48%', marginVertical: 5 }
});