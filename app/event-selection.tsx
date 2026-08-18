import { router, useLocalSearchParams } from 'expo-router';
import { collection, getDocs, query, where } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { db } from '../firebase/config';

export default function EventSelection() {
  const { userStr } = useLocalSearchParams<{ userStr: string }>();
  const user = userStr ? JSON.parse(userStr) : null;
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchEvents = async () => {
      if (!user) return;
      
      try {
        let eventsQuery;
        
        if (user.role === 'superadmin') {
          // Super Admins see all events
          eventsQuery = collection(db, 'events');
        } else {
          // Admins & Officers only see events where their SBO is a co-host
          eventsQuery = query(
            collection(db, 'events'), 
            where('sbo_names', 'array-contains', user.sbo_name)
          );
        }
        
        const snapshot = await getDocs(eventsQuery);
        const fetchedEvents = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setEvents(fetchedEvents);
      } catch (error) {
        console.error("Error fetching events:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchEvents();
  }, [user]);

  const headerText = user?.role === 'superadmin' 
    ? 'All University Events (Super Admin)' 
    : `Events for ${user?.sbo_name}`;

  return (
    <View style={styles.container}>
      <Text style={styles.header}>{headerText}</Text>
      
      {loading ? (
        <ActivityIndicator size="large" color="#0000ff" style={{ marginTop: 20 }} />
      ) : events.length === 0 ? (
        <Text style={styles.emptyText}>No active events found.</Text>
      ) : (
        <FlatList
          data={events}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <TouchableOpacity 
              style={styles.card}
              onPress={() => router.push({ 
                pathname: '/scanner', 
                params: { eventStr: JSON.stringify(item), userStr } 
              })}
            >
              <Text style={styles.eventName}>{item.name}</Text>
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  header: { fontSize: 20, fontWeight: 'bold', marginBottom: 15 },
  card: { padding: 20, backgroundColor: '#e0e0e0', marginBottom: 10, borderRadius: 8 },
  eventName: { fontSize: 18 },
  emptyText: { fontSize: 16, color: '#666', textAlign: 'center', marginTop: 20 }
});