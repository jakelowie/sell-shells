import { Redirect } from "expo-router";
import { useAuth } from "../auth/context";
import { Loading } from "./ui";
import { View } from "react-native";

export function RequireAdmin({ children }: { children: React.ReactNode }) {
  const { loading, role } = useAuth();
  if (loading)
    return (
      <View style={{ flex: 1, justifyContent: "center" }}>
        <Loading />
      </View>
    );
  if (!role) return <Redirect href="/login" />;
  return <>{children}</>;
}
