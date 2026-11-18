import { Redirect } from "expo-router";
import { useAuth } from "../src/auth/context";
import { Loading } from "../src/components/ui";
import { View } from "react-native";

export default function Index() {
  const { loading, role } = useAuth();
  if (loading)
    return (
      <View style={{ flex: 1, justifyContent: "center" }}>
        <Loading />
      </View>
    );
  return <Redirect href={role ? "/(tabs)" : "/login"} />;
}
