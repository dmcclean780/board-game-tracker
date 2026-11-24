import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold, useFonts } from "@expo-google-fonts/inter";
import { Stack } from "expo-router";
import { Button, Message, Screen } from "../components/ui";
import { auth, AuthProvider, useAuth } from "../auth";
import { ThemeProvider, useTheme } from "../theme";

function Routes() {
  const { c } = useTheme();
  const { session, me, meError } = useAuth();
  if (session === undefined) return null;
  if (session && meError) {
    return (
      <Screen title="Something went wrong">
        <Message error text="We can't reach the server. Try again shortly." />
        <Button title="Sign out" onPress={() => auth.signOut()} />
      </Screen>
    );
  }
  if (session && !me) return null; // waiting for /me
  const scheduled = !!me?.deletion_scheduled_for;
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: c.bg } }}>
      <Stack.Protected guard={!session}>
        <Stack.Screen name="login" />
        <Stack.Screen name="sign-up" />
        <Stack.Screen name="forgot-password" />
      </Stack.Protected>
      <Stack.Protected guard={!!session && !scheduled}>
        <Stack.Screen name="(app)" />
      </Stack.Protected>
      <Stack.Protected guard={!!session && scheduled}>
        <Stack.Screen name="restore" />
      </Stack.Protected>
      {/* The recovery link signs the user in, so this must be reachable in either state. */}
      <Stack.Screen name="reset-password" />
    </Stack>
  );
}

export default function Layout() {
  const [fonts, fontError] = useFonts({ Inter_400Regular, Inter_500Medium, Inter_600SemiBold });
  if (!fonts && !fontError) return null; // on error, fall back to the system font
  return (
    <ThemeProvider>
      <AuthProvider>
        <Routes />
      </AuthProvider>
    </ThemeProvider>
  );
}
