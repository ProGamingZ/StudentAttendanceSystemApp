import { Stack } from 'expo-router';

export default function RootLayout() {
  return (
    <Stack screenOptions={{ headerShown: true }}>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="event-selection" options={{ title: 'Select Event' }} />
      <Stack.Screen name="scanner" options={{ title: 'Scanner' }} />
    </Stack>
  );
}