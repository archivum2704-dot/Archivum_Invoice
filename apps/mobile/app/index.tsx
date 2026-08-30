import { Redirect } from "expo-router";
import { useAuth } from "@/context/auth-context";
import { View, ActivityIndicator } from "react-native";

export default function Index() {
  const { session, loading, mfaPending } = useAuth();

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (!session) return <Redirect href="/(auth)/login" />;
  if (mfaPending) return <Redirect href="/(auth)/mfa" />;
  return <Redirect href="/(app)/dashboard" />;
}
