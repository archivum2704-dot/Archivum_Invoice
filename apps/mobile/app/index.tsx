import { Redirect } from "expo-router";
import { useAuth } from "@/context/auth-context";
import { View, ActivityIndicator } from "react-native";

export default function Index() {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return <Redirect href={session ? "/(app)/dashboard" : "/(auth)/login"} />;
}
