import { router } from "expo-router";
import { signInWithEmailAndPassword } from "firebase/auth";
import { collection, getDocs, query, where } from "firebase/firestore";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Button,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { auth, db } from "../firebase/config";

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    const cleanEmail = email.toLowerCase().trim();

    if (!cleanEmail || !password) {
      Alert.alert("Error", "Please enter both email and password.");
      return;
    }

    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, cleanEmail, password);

      // 1. THE "GOD ACCOUNT" BYPASS
      if (cleanEmail === "super@admin.com") {
        // Send a fake user object since they don't have a database profile
        router.replace({
          pathname: "/event-selection",
          params: {
            userStr: JSON.stringify({ role: "superadmin", email: cleanEmail }),
          },
        });
        return; // Stop here!
      }

      // 2. NORMAL ACCOUNTS
      const userQuery = query(
        collection(db, "users"),
        where("email", "==", cleanEmail),
      );
      const querySnapshot = await getDocs(userQuery);

      if (querySnapshot.empty) {
        throw new Error(
          "Account not found in the users database. Check for typos.",
        );
      }

      const userData = querySnapshot.docs[0].data();

      if (userData.role === "student") {
        throw new Error(
          "Access Denied: Students cannot log into this mobile app.",
        );
      }

      if (userData.role === "admin" || userData.role === "officer") {
        if (!userData.sbo_name) {
          throw new Error(
            "Access Denied: Your account is not assigned to an SBO.",
          );
        }
      }

      router.replace({
        pathname: "/event-selection",
        params: { userStr: JSON.stringify(userData) },
      });
    } catch (error: any) {
      Alert.alert("Login Failed", error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Scanner Login</Text>

      <TextInput
        style={styles.input}
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
      />

      <TextInput
        style={styles.input}
        placeholder="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />

      {loading ? (
        <ActivityIndicator size="large" color="#0000ff" />
      ) : (
        <Button title="Login" onPress={handleLogin} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, justifyContent: "center" },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 20,
    textAlign: "center",
  },
  input: {
    borderWidth: 1,
    padding: 10,
    marginBottom: 15,
    borderRadius: 5,
    backgroundColor: "white",
  },
});
