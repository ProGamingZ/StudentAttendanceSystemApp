import { router, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { signOut } from "firebase/auth";
import { collection, getDocs, query, where } from "firebase/firestore";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Button,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { auth, db } from "../firebase/config";
import { useNetworkSync } from "../hooks/useNetworkSync";
import { getLocalYYYYMMDD } from "../utils/dateHelpers";

export default function EventSelection() {
  const { userStr } = useLocalSearchParams<{ userStr: string }>();
  const user = userStr ? JSON.parse(userStr) : null;
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const isOnline = useNetworkSync();
  const insets = useSafeAreaInsets();
  const todayDate = getLocalYYYYMMDD();

  useEffect(() => {
    const fetchEvents = async () => {
      if (!user) return;
      if (!isOnline) {
        setLoading(false);
        return;
      }

      try {
        let eventsQuery =
          user.role === "superadmin"
            ? collection(db, "events")
            : query(
                collection(db, "events"),
                where("sbo_names", "array-contains", user.sbo_name),
              );

        const snapshot = await getDocs(eventsQuery);
        const fetchedEvents = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setEvents(fetchedEvents);
      } catch (error) {
        console.error("Error fetching events:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchEvents();
  }, [user, isOnline]);

  const handleLogout = async () => {
    try {
      if (isOnline) await signOut(auth);
      router.replace("/");
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  // --- UI HELPER FUNCTIONS ---
  const renderPunches = (day: any) => {
    const punches = [];
    if (day.m_in) punches.push("Morning IN");
    if (day.m_out) punches.push("Morning OUT");
    if (day.a_in) punches.push("Afternoon IN");
    if (day.a_out) punches.push("Afternoon OUT");
    return punches.length > 0 ? punches.join(" | ") : "No Attendance Tracked";
  };

  const renderArrayDetails = (arr: any[], label: string) => {
    if (!arr || arr.length === 0) return `All ${label}`;
    return arr.join(", ");
  };

  const renderEventItem = ({ item }: { item: any }) => {
    const totalDays = item.days?.length || 0;
    const currentDayIndex = item.days?.findIndex(
      (d: any) => d.date === todayDate,
    );
    const isEventActiveToday =
      currentDayIndex !== -1 && currentDayIndex !== undefined;

    return (
      <TouchableOpacity
        style={[
          styles.card,
          isEventActiveToday
            ? styles.activeCard
            : [styles.inactiveCard, { backgroundColor: "#f9f9f9" }],
        ]}
        onPress={() =>
          router.push({
            pathname: "/scanner",
            params: { eventStr: JSON.stringify(item), userStr },
          })
        }
      >
        <Text style={[styles.eventName, { color: "black" }]}>{item.name}</Text>
        <Text
          style={isEventActiveToday ? styles.activeText : styles.inactiveText}
        >
          Spans {totalDays} Day{totalDays > 1 ? "s" : ""}{" "}
          {isEventActiveToday
            ? `(Today is Day ${currentDayIndex + 1})`
            : "(Not scheduled today)"}
        </Text>

        {/* Detailed Days Breakdown */}
        {item.days?.map((day: any, index: number) => {
          const isToday = day.date === todayDate;
          if (!isToday) return null; // Only show today's rules to save space

          return (
            <View
              key={index}
              style={{
                marginTop: 10,
                padding: 10,
                backgroundColor: "#f4f4f4",
                borderRadius: 6,
              }}
            >
              <Text style={{ fontSize: 13, color: "#444", marginBottom: 3 }}>
                <Text style={{ fontWeight: "bold" }}>Punches: </Text>
                {renderPunches(day)}
              </Text>
              <Text style={{ fontSize: 13, color: "#444", marginBottom: 3 }}>
                <Text style={{ fontWeight: "bold" }}>Programs: </Text>
                {renderArrayDetails(day.programs, "Programs")}
              </Text>
            </View>
          );
        })}
      </TouchableOpacity>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: "#121212" }}>
      <StatusBar style="light" />

      <View
        style={[
          styles.container,
          {
            backgroundColor: "#f0f2f5",
            marginTop: insets.top,
            marginBottom: insets.bottom,
          },
        ]}
      >
        <View style={styles.headerRow}>
          <Text style={[styles.header, { color: "#333" }]}>
            {user?.role === "superadmin"
              ? "All Events (Super Admin)"
              : `Events for ${user?.sbo_name}`}
          </Text>
          <Button title="Logout" color="#ff5c5c" onPress={handleLogout} />
        </View>

        {!isOnline && (
          <Text style={styles.offlineWarning}>
            Offline: Displaying cached events only.
          </Text>
        )}

        {loading ? (
          <ActivityIndicator
            size="large"
            color="#0000ff"
            style={{ marginTop: 20 }}
          />
        ) : events.length === 0 ? (
          <Text style={styles.emptyText}>No events loaded.</Text>
        ) : (
          <FlatList
            data={events}
            keyExtractor={(item) => item.id}
            renderItem={renderEventItem}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 15 },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 15,
    marginTop: 10,
  },
  header: { fontSize: 18, fontWeight: "bold", flex: 1 },
  offlineWarning: {
    color: "#ff9800",
    textAlign: "center",
    marginBottom: 10,
    fontWeight: "bold",
  },
  emptyText: {
    fontSize: 16,
    color: "#666",
    textAlign: "center",
    marginTop: 20,
  },
  card: { padding: 15, marginBottom: 15, borderRadius: 10, borderWidth: 1 },
  activeCard: { backgroundColor: "#ffffff", borderColor: "#4CAF50" },
  inactiveCard: { borderColor: "#ccc" },
  eventName: { fontSize: 18, fontWeight: "bold" },
  activeText: { color: "#2e7d32", marginTop: 5 },
  inactiveText: { color: "#888", marginTop: 5 },
});
