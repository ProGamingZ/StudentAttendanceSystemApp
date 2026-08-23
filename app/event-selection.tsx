import { router, useLocalSearchParams } from "expo-router";
import { collection, getDocs, query, where } from "firebase/firestore";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { db } from "../firebase/config";
import { getLocalYYYYMMDD } from "../utils/dateHelpers"; // Import our date helper!

export default function EventSelection() {
  const { userStr } = useLocalSearchParams<{ userStr: string }>();
  const user = userStr ? JSON.parse(userStr) : null;
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const todayDate = getLocalYYYYMMDD();

  useEffect(() => {
    const fetchEvents = async () => {
      if (!user) return;

      try {
        let eventsQuery;

        if (user.role === "superadmin") {
          eventsQuery = collection(db, "events");
        } else {
          eventsQuery = query(
            collection(db, "events"),
            where("sbo_names", "array-contains", user.sbo_name),
          );
        }

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
  }, [user]);

  // --- UI HELPER FUNCTIONS ---

  // Converts booleans to readable punch types
  const renderPunches = (day: any) => {
    const punches = [];
    if (day.m_in) punches.push("Morning IN");
    if (day.m_out) punches.push("Morning OUT");
    if (day.a_in) punches.push("Afternoon IN");
    if (day.a_out) punches.push("Afternoon OUT");
    return punches.length > 0 ? punches.join(" | ") : "No Attendance Tracked";
  };

  // Handles empty arrays by falling back to "All [Category]"
  const renderArrayDetails = (arr: any[], label: string) => {
    if (!arr || arr.length === 0) return `All ${label}`;
    return arr.join(", ");
  };

  // --- RENDER EVENT CARD ---

  const renderEventItem = ({ item }: { item: any }) => {
    const totalDays = item.days?.length || 0;

    // Figure out if today matches any day in the event's schedule
    const currentDayIndex = item.days?.findIndex(
      (d: any) => d.date === todayDate,
    );
    const isEventActiveToday =
      currentDayIndex !== -1 && currentDayIndex !== undefined;

    const dayStatusText = isEventActiveToday
      ? `(Today is Day ${currentDayIndex + 1} of ${totalDays})`
      : `(Not scheduled for today)`;

    return (
      <TouchableOpacity
        style={[
          styles.card,
          isEventActiveToday ? styles.activeCard : styles.inactiveCard,
        ]}
        onPress={() =>
          router.push({
            pathname: "/scanner",
            params: { eventStr: JSON.stringify(item), userStr },
          })
        }
      >
        {/* Event Header */}
        <Text style={styles.eventName}>{item.name}</Text>
        <Text
          style={[
            styles.eventSub,
            isEventActiveToday ? styles.activeText : styles.inactiveText,
          ]}
        >
          Spans {totalDays} Day{totalDays > 1 ? "s" : ""} {dayStatusText}
        </Text>

        {/* List of Days */}
        <View style={styles.daysContainer}>
          {item.days?.map((day: any, index: number) => {
            const isToday = day.date === todayDate;

            return (
              <View
                key={index}
                style={[styles.dayBox, isToday && styles.todayBox]}
              >
                <View style={styles.dayHeaderRow}>
                  <Text style={styles.dayTitle}>
                    Day {index + 1} • {day.date}
                  </Text>
                  {isToday && <Text style={styles.todayBadge}>TODAY</Text>}
                </View>

                <Text style={styles.detailText}>
                  <Text style={styles.boldText}>Punches: </Text>
                  {renderPunches(day)}
                </Text>

                <Text style={styles.detailText}>
                  <Text style={styles.boldText}>Programs: </Text>
                  {renderArrayDetails(day.programs, "Programs")}
                </Text>

                <Text style={styles.detailText}>
                  <Text style={styles.boldText}>Years: </Text>
                  {renderArrayDetails(day.years, "Years")}
                </Text>

                <Text style={styles.detailText}>
                  <Text style={styles.boldText}>Sections: </Text>
                  {renderArrayDetails(day.sections, "Sections")}
                </Text>
              </View>
            );
          })}
        </View>
      </TouchableOpacity>
    );
  };

  const headerText =
    user?.role === "superadmin"
      ? "All University Events (Super Admin)"
      : `Events for ${user?.sbo_name}`;

  return (
    <View style={styles.container}>
      <Text style={styles.header}>{headerText}</Text>

      {loading ? (
        <ActivityIndicator
          size="large"
          color="#0000ff"
          style={{ marginTop: 20 }}
        />
      ) : events.length === 0 ? (
        <Text style={styles.emptyText}>No active events found.</Text>
      ) : (
        <FlatList
          data={events}
          keyExtractor={(item) => item.id}
          renderItem={renderEventItem}
          contentContainerStyle={{ paddingBottom: 20 }}
        />
      )}
    </View>
  );
}

// --- STYLES ---
const styles = StyleSheet.create({
  container: { flex: 1, padding: 15, backgroundColor: "#f0f2f5" },
  header: { fontSize: 20, fontWeight: "bold", marginBottom: 15, color: "#333" },
  emptyText: {
    fontSize: 16,
    color: "#666",
    textAlign: "center",
    marginTop: 20,
  },

  // Card Styles
  card: {
    padding: 15,
    marginBottom: 15,
    borderRadius: 10,
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  activeCard: {
    backgroundColor: "#ffffff",
    borderColor: "#4CAF50",
    borderWidth: 1,
  },
  inactiveCard: {
    backgroundColor: "#f9f9f9",
    borderColor: "#ccc",
    borderWidth: 1,
  },

  eventName: { fontSize: 20, fontWeight: "bold", color: "#1a1a1a" },
  eventSub: { fontSize: 14, marginBottom: 10, fontWeight: "600" },
  activeText: { color: "#4CAF50" },
  inactiveText: { color: "#888" },

  // Day Breakdown Styles
  daysContainer: { marginTop: 10 },
  dayBox: {
    padding: 10,
    backgroundColor: "#f4f4f4",
    borderRadius: 6,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#e0e0e0",
  },
  todayBox: {
    backgroundColor: "#e8f5e9",
    borderColor: "#81c784",
    borderWidth: 1,
  }, // Highlights today in light green

  dayHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 5,
  },
  dayTitle: { fontSize: 16, fontWeight: "bold", color: "#333" },
  todayBadge: {
    backgroundColor: "#4CAF50",
    color: "white",
    fontSize: 10,
    fontWeight: "bold",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    overflow: "hidden",
  },

  detailText: { fontSize: 13, color: "#444", marginBottom: 3 },
  boldText: { fontWeight: "bold", color: "#222" },
});
