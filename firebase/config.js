import AsyncStorage from '@react-native-async-storage/async-storage';
import { initializeApp } from 'firebase/app';
import { getReactNativePersistence, initializeAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyA5JY0YqQGZJWxG4HcwzwNd95YNB5UleOo",
  authDomain: "studentattendancesystem-a1ace.firebaseapp.com",
  projectId: "studentattendancesystem-a1ace",
  storageBucket: "studentattendancesystem-a1ace.firebasestorage.app",
  messagingSenderId: "310250922922",
  appId: "1:310250922922:web:7b511954a7dc04c370c1d3"
};

const app = initializeApp(firebaseConfig);
export const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage)
});
export const db = getFirestore(app);