import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { signInWithEmailAndPassword } from "firebase/auth";
import { collection, getDocs, query, where } from "firebase/firestore";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Button,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { auth, db } from "../firebase/config";
import { useNetworkSync } from "../hooks/useNetworkSync";

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(true);

  const isOnline = useNetworkSync();
  const insets = useSafeAreaInsets();

  // --- AUTO LOGIN (Skip login if already logged in) ---
  useEffect(() => {
    const checkSession = async () => {
      try {
        const cachedUser = await AsyncStorage.getItem("@cached_user_profile");
        if (auth.currentUser && cachedUser) {
          router.replace({
            pathname: "/event-selection",
            params: { userStr: cachedUser },
          });
        }
      } catch (e) {
        // Ignore and allow manual login
      } finally {
        setLoading(false);
      }
    };
    checkSession();
  }, []);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert("Error", "Please enter both email and password.");
      return;
    }

    setLoading(true);
    const formattedEmail = email.trim().toLowerCase();

    try {
      if (isOnline) {
        // --- ONLINE LOGIN FLOW ---
        const userCredential = await signInWithEmailAndPassword(
          auth,
          formattedEmail,
          password,
        );
        const userQuery = query(
          collection(db, "users"),
          where("email", "==", userCredential.user.email),
        );
        const querySnapshot = await getDocs(userQuery);

        if (querySnapshot.empty)
          throw new Error("Account not found in the users database.");

        const userData = querySnapshot.docs[0].data();

        if (userData.role === "student")
          throw new Error(
            "Access Denied: Students cannot log into this mobile app.",
          );
        if (
          (userData.role === "admin" || userData.role === "officer") &&
          !userData.sbo_name
        ) {
          throw new Error(
            "Access Denied: Your account is not assigned to an SBO.",
          );
        }

        await AsyncStorage.setItem("@cached_email", formattedEmail);
        await AsyncStorage.setItem("@cached_password", password);
        await AsyncStorage.setItem(
          "@cached_user_profile",
          JSON.stringify(userData),
        );

        router.replace({
          pathname: "/event-selection",
          params: { userStr: JSON.stringify(userData) },
        });
      } else {
        // --- OFFLINE LOGIN FLOW ---
        const cachedEmail = await AsyncStorage.getItem("@cached_email");
        const cachedPass = await AsyncStorage.getItem("@cached_password");
        const cachedUser = await AsyncStorage.getItem("@cached_user_profile");

        if (
          formattedEmail === cachedEmail &&
          password === cachedPass &&
          cachedUser
        ) {
          Alert.alert(
            "Offline Mode",
            "Logged in using saved offline credentials.",
          );
          router.replace({
            pathname: "/event-selection",
            params: { userStr: cachedUser },
          });
        } else {
          throw new Error(
            "Invalid offline credentials, or you haven't logged in online on this device yet.",
          );
        }
      }
    } catch (error: any) {
      Alert.alert("Login Failed", error.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading)
    return (
      <View style={[styles.centered, { backgroundColor: "#121212" }]}>
        <ActivityIndicator size="large" color="#ffffff" />
      </View>
    );

  return (
    <View style={{ flex: 1, backgroundColor: "#121212" }}>
      <StatusBar style="light" />

      <View
        style={[
          styles.container,
          {
            backgroundColor: "#f5f5f5",
            marginTop: insets.top + 20,
            marginBottom: insets.bottom + 20,
          },
        ]}
      >
        <Text style={[styles.title, { color: "#000000" }]}>Scanner Login</Text>

        {!isOnline && (
          <Text style={styles.offlineWarning}>
            ⚠️ No connection. Offline login active.
          </Text>
        )}

        <TextInput
          style={[styles.input, { backgroundColor: "white", color: "black" }]}
          placeholder="Email"
          placeholderTextColor="#666"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />

        <TextInput
          style={[styles.input, { backgroundColor: "white", color: "black" }]}
          placeholder="Password"
          placeholderTextColor="#666"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />

        <Button title="Login" onPress={handleLogin} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, justifyContent: "center" },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 20,
    textAlign: "center",
  },
  offlineWarning: {
    color: "#ff9800",
    textAlign: "center",
    marginBottom: 15,
    fontWeight: "bold",
  },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    padding: 12,
    marginBottom: 15,
    borderRadius: 8,
  },
});
