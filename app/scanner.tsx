import AsyncStorage from "@react-native-async-storage/async-storage";
import { useLocalSearchParams } from "expo-router";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
} from "firebase/firestore";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Button,
  FlatList,
  Image,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { db } from "../firebase/config";
import { useNetworkSync } from "../hooks/useNetworkSync";
import { addPunchToQueue, syncQueue } from "../services/syncService";
import { getLocalYYYYMMDD } from "../utils/dateHelpers";

export default function ScannerScreen() {
  const { eventStr, userStr } = useLocalSearchParams<{
    eventStr: string;
    userStr: string;
  }>();
  const event = eventStr ? JSON.parse(eventStr) : null;
  const user = userStr ? JSON.parse(userStr) : null;

  const isOnline = useNetworkSync();
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);

  const [student, setStudent] = useState<any>(null);
  const [existingPunches, setExistingPunches] = useState<any>({});
  const [loading, setLoading] = useState(false);

  const todayDate = getLocalYYYYMMDD();
  const todayConfig = event?.days?.find((d: any) => d.date === todayDate);

  // --- AUTOCOMPLETE SEARCH LOGIC ---
  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      if (searchQuery.length >= 2 && !student) {
        fetchSearchResults();
      } else {
        setSearchResults([]);
        setShowDropdown(false);
      }
    }, 300); // 300ms debounce to limit Firestore reads
    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery]);

  const fetchSearchResults = async () => {
    try {
      const q = query(
        collection(db, "users"),
        where("student_id", ">=", searchQuery),
        where("student_id", "<=", searchQuery + "\uf8ff"),
      );
      const snapshot = await getDocs(q);

      // Filter out non-students just in case
      const results = snapshot.docs
        .map((doc) => doc.data())
        .filter((user) => user.role !== "superadmin" && user.role !== "admin");

      setSearchResults(results);
      setShowDropdown(true);
    } catch (error) {
      console.error("Search error:", error);
    }
  };

  // --- STUDENT SELECTION & VALIDATION ---
  const handleSelectStudent = async (selectedStudent: any) => {
    setSearchQuery(selectedStudent.student_id);
    setShowDropdown(false);
    setLoading(true);

    if (!todayConfig) {
      Alert.alert("No Schedule", "This event is not scheduled for today.");
      setLoading(false);
      return;
    }

    const { programs, years, sections } = todayConfig;
    const isProgramValid =
      programs.length === 0 || programs.includes(selectedStudent.program);
    const isYearValid =
      years.length === 0 || years.includes(selectedStudent.year);
    const isSectionValid =
      sections.length === 0 || sections.includes(selectedStudent.section);

    if (isProgramValid && isYearValid && isSectionValid) {
      setStudent(selectedStudent);
      await loadAttendanceState(selectedStudent.student_id);
    } else {
      setStudent(null);
      Alert.alert("Ineligible", "Student not eligible for this event today.", [
        { text: "OK", style: "destructive" },
      ]);
    }
    setLoading(false);
  };

  // --- FETCH EXISTING PUNCHES (Online + Offline Merge) ---
  const loadAttendanceState = async (studentId: string) => {
    const docId = `${studentId}_${event.id}_${todayDate}`;
    let currentPunches = {};

    try {
      // 1. Fetch from Firestore if online
      if (isOnline) {
        const docRef = doc(db, "attendance_logs", docId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          currentPunches = docSnap.data();
        }
      }

      // 2. Merge with Offline Queue (so UI updates accurately if they just punched offline)
      const queueStr = await AsyncStorage.getItem("@attendance_queue");
      if (queueStr) {
        const queue = JSON.parse(queueStr);
        const queuedItems = queue.filter((item: any) => item.docId === docId);
        queuedItems.forEach((item: any) => {
          currentPunches = { ...currentPunches, ...item.payload };
        });
      }

      setExistingPunches(currentPunches);
    } catch (error) {
      console.error("Error loading attendance state:", error);
    }
  };

  // --- PUNCH SUBMISSION ---
  const handlePunch = async (punchType: string) => {
    if (!student || !event || !user) return;

    const docId = `${student.student_id}_${event.id}_${todayDate}`;

    // 12-Hour Format logic (09:42am)
    const now = new Date();
    let hours = now.getHours();
    const minutes = now.getMinutes().toString().padStart(2, "0");
    const ampm = hours >= 12 ? "pm" : "am";

    hours = hours % 12;
    hours = hours ? hours : 12;
    const formattedHours = hours.toString().padStart(2, "0");
    const formattedTime = `${formattedHours}:${minutes}${ampm}`;

    const dbFieldMap: Record<string, string> = {
      m_in: "morning_in",
      m_out: "morning_out",
      a_in: "afternoon_in",
      a_out: "afternoon_out",
    };

    const actualDbField = dbFieldMap[punchType];

    const payload = {
      student_id: student.student_id,
      student_name: `${student.first_name} ${student.last_name}`,
      program: student.program,
      section: student.section,
      sbo_name: user.sbo_name || "Super Admin",
      event_id: event.id,
      date: todayDate,
      [actualDbField]: formattedTime,
    };

    // Save locally immediately
    await addPunchToQueue(docId, payload);
    Alert.alert(
      "Success",
      `${actualDbField.replace("_", " ").toUpperCase()} recorded at ${formattedTime}!`,
    );

    // Update local state instantly so the button disables itself
    setExistingPunches((prev: any) => ({
      ...prev,
      [actualDbField]: formattedTime,
    }));

    if (isOnline) {
      syncQueue();
    }

    // Clear search to get ready for next student
    setStudent(null);
    setSearchQuery("");
    setExistingPunches({});
  };

  // --- BUTTON LOGIC DETERMINATION ---
  const currentHour = new Date().getHours();
  const isMorning = currentHour < 12;
  const isAfternoon = currentHour >= 12;

  const hasMIn = !!existingPunches?.morning_in;
  const hasMOut = !!existingPunches?.morning_out;
  const hasAIn = !!existingPunches?.afternoon_in;
  const hasAOut = !!existingPunches?.afternoon_out;

  const mInDisabled = !student || !isMorning || hasMIn || !todayConfig?.m_in;
  const mOutDisabled =
    !student || !isMorning || !hasMIn || hasMOut || !todayConfig?.m_out;

  const aInDisabled = !student || !isAfternoon || hasAIn || !todayConfig?.a_in;
  const aOutDisabled =
    !student || !isAfternoon || !hasAIn || hasAOut || !todayConfig?.a_out;

  return (
    <View style={styles.container}>
      <Text style={[styles.status, { color: isOnline ? "green" : "red" }]}>
        {isOnline ? "🟢 Online" : "🔴 Offline Mode"}
      </Text>

      {/* SEARCH SECTION WITH AUTOCOMPLETE */}
      <View style={styles.searchSection}>
        <TextInput
          style={styles.input}
          placeholder="Type Student ID..."
          value={searchQuery}
          onChangeText={(text) => {
            setSearchQuery(text);
            if (student) {
              setStudent(null);
              setExistingPunches({});
            }
          }}
        />

        {showDropdown && searchResults.length > 0 && (
          <View style={styles.dropdown}>
            <FlatList
              data={searchResults}
              keyExtractor={(item) => item.student_id}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.dropdownItem}
                  onPress={() => handleSelectStudent(item)}
                >
                  <Text style={styles.dropdownId}>{item.student_id}</Text>
                  <Text style={styles.dropdownName}>
                    {item.first_name} {item.last_name}
                  </Text>
                </TouchableOpacity>
              )}
            />
          </View>
        )}
      </View>

      {loading && (
        <ActivityIndicator size="large" style={{ marginBottom: 15 }} />
      )}

      {/* PERMANENT PLACEHOLDER UI */}
      <View style={styles.studentCard}>
        {student && student.photo_url ? (
          <Image source={{ uri: student.photo_url }} style={styles.photo} />
        ) : (
          <View style={styles.photoPlaceholder}>
            <Text style={styles.photoText}>Photo</Text>
          </View>
        )}

        <Text style={styles.name}>
          {student
            ? `${student.first_name} ${student.last_name}`
            : "Student Name"}
        </Text>
        <Text style={styles.details}>
          {student ? student.student_id : "ID Number"}
        </Text>
        <Text style={styles.details}>
          {student
            ? `${student.program} - Year ${student.year} Section ${student.section}`
            : "Program - Year - Section"}
        </Text>

        {/* DYNAMIC TIME-BASED BUTTONS */}
        <View style={styles.grid}>
          <View style={styles.gridItem}>
            <Button
              title={hasMIn ? "M IN (Done)" : "Morning IN"}
              disabled={mInDisabled}
              onPress={() => handlePunch("m_in")}
            />
          </View>
          <View style={styles.gridItem}>
            <Button
              title={hasMOut ? "M OUT (Done)" : "Morning OUT"}
              disabled={mOutDisabled}
              onPress={() => handlePunch("m_out")}
              color="#ff5c5c"
            />
          </View>
          <View style={styles.gridItem}>
            <Button
              title={hasAIn ? "A IN (Done)" : "Afternoon IN"}
              disabled={aInDisabled}
              onPress={() => handlePunch("a_in")}
            />
          </View>
          <View style={styles.gridItem}>
            <Button
              title={hasAOut ? "A OUT (Done)" : "Afternoon OUT"}
              disabled={aOutDisabled}
              onPress={() => handlePunch("a_out")}
              color="#ff5c5c"
            />
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 15, backgroundColor: "#f5f5f5" },
  status: { fontWeight: "bold", alignSelf: "center", marginBottom: 10 },

  searchSection: { marginBottom: 20, position: "relative", zIndex: 10 },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    padding: 12,
    borderRadius: 8,
    backgroundColor: "white",
    fontSize: 16,
  },

  dropdown: {
    position: "absolute",
    top: 55,
    left: 0,
    right: 0,
    backgroundColor: "white",
    borderRadius: 8,
    elevation: 5,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 4,
    maxHeight: 200,
    zIndex: 10,
  },
  dropdownItem: {
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  dropdownId: { fontWeight: "bold", color: "#333" },
  dropdownName: { color: "#666" },

  studentCard: {
    padding: 20,
    backgroundColor: "white",
    borderRadius: 10,
    alignItems: "center",
    elevation: 3,
    zIndex: 1,
  },
  photo: { width: 100, height: 100, borderRadius: 50, marginBottom: 15 },
  photoPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: "#ddd",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 15,
  },
  photoText: { color: "#888", fontWeight: "bold" },
  name: { fontSize: 22, fontWeight: "bold", marginBottom: 5 },
  details: { fontSize: 16, color: "#555", marginBottom: 5 },

  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 20,
    justifyContent: "space-between",
    width: "100%",
  },
  gridItem: { width: "48%", marginVertical: 5 },
});
