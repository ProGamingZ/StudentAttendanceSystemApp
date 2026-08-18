import AsyncStorage from '@react-native-async-storage/async-storage';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../firebase/config';

const QUEUE_KEY = '@attendance_queue';

export const addPunchToQueue = async (docId: string, payload: any) => {
  try {
    const existingQueueStr = await AsyncStorage.getItem(QUEUE_KEY);
    const queue = existingQueueStr ? JSON.parse(existingQueueStr) : [];
    
    queue.push({ docId, payload, timestamp: Date.now() });
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  } catch (error) {
    console.error("Error saving to offline queue:", error);
  }
};

export const syncQueue = async () => {
  try {
    const queueStr = await AsyncStorage.getItem(QUEUE_KEY);
    if (!queueStr) return;
    
    const queue = JSON.parse(queueStr);
    if (queue.length === 0) return;

    const failedItems = [];

    for (const item of queue) {
      try {
        const docRef = doc(db, 'attendance_logs', item.docId);
        await setDoc(docRef, item.payload, { merge: true });
      } catch (e) {
        console.error("Failed to sync item:", e);
        failedItems.push(item);
      }
    }
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(failedItems));
  } catch (error) {
    console.error("Sync process error:", error);
  }
};