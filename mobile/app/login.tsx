import { useState } from "react";
import { KeyboardAvoidingView, Platform, Text } from "react-native";
import { router } from "expo-router";
import { Action, Field, Page, Panel, Title, Notice } from "../src/components/ui";
import { useAuth } from "../src/auth/context";
import { colors } from "../src/theme";

export default function Login() {
  const { signIn, loading, error } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [localError, setLocalError] = useState("");
  const submit = async () => {
    setLocalError("");
    try {
      await signIn(email.trim(), password);
      router.replace("/(tabs)");
    } catch (e) {
      setLocalError((e as Error).message);
    }
  };
  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <Page>
        <Text
          style={{
            color: colors.coral,
            fontSize: 14,
            fontWeight: "800",
            letterSpacing: 2,
            marginTop: 55,
            marginBottom: 14,
          }}
        >
          craftshellhouse
        </Text>
        <Title title="Welcome back" subtitle="Sign in to manage your store." />
        <Panel>
          <Field
            label="Email"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            textContentType="emailAddress"
          />
          <Field
            label="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            textContentType="password"
          />
          <Action
            label={loading ? "Checking access…" : "Sign in"}
            onPress={() => void submit()}
            disabled={loading || !email || !password}
          />
          {localError || error ? <Notice text={localError || error!} error /> : null}
        </Panel>
      </Page>
    </KeyboardAvoidingView>
  );
}
