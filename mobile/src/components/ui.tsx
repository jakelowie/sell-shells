import type { ReactNode } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { colors } from "../theme";

export function Page({ children }: { children: ReactNode }) {
  return <View style={styles.page}>{children}</View>;
}
export function Title({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <View style={styles.title}>
      <Text style={styles.h1}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}
export function Panel({ children, style }: { children: ReactNode; style?: object }) {
  return <View style={[styles.panel, style]}>{children}</View>;
}
export function Action({
  label,
  onPress,
  secondary = false,
  disabled = false,
}: {
  label: string;
  onPress: () => void;
  secondary?: boolean;
  disabled?: boolean;
}) {
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={[styles.action, secondary && styles.secondary, disabled && { opacity: 0.5 }]}
    >
      <Text style={[styles.actionText, secondary && styles.secondaryText]}>{label}</Text>
    </Pressable>
  );
}
export function Field(props: React.ComponentProps<typeof TextInput> & { label: string }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{props.label}</Text>
      <TextInput
        {...props}
        placeholderTextColor="#9A958D"
        style={[
          styles.input,
          props.multiline && { minHeight: 90, textAlignVertical: "top" },
          props.style,
        ]}
      />
    </View>
  );
}
export function Loading() {
  return (
    <View style={{ padding: 30 }}>
      <ActivityIndicator color={colors.coral} />
    </View>
  );
}
export function Notice({ text, error = false }: { text: string; error?: boolean }) {
  return (
    <Text style={{ color: error ? colors.red : colors.green, marginTop: 10, lineHeight: 20 }}>
      {text}
    </Text>
  );
}
const styles = StyleSheet.create({
  page: { flex: 1, paddingHorizontal: 20, paddingTop: 16 },
  title: { marginBottom: 20 },
  h1: { color: colors.ink, fontSize: 28, fontWeight: "800", letterSpacing: -0.6 },
  subtitle: { color: colors.muted, marginTop: 5, fontSize: 14 },
  panel: {
    backgroundColor: colors.card,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 12,
  },
  action: {
    backgroundColor: colors.ink,
    borderRadius: 12,
    paddingVertical: 13,
    paddingHorizontal: 16,
    alignItems: "center",
  },
  actionText: { color: "white", fontWeight: "700", fontSize: 15 },
  secondary: { backgroundColor: colors.cream, borderWidth: 1, borderColor: colors.border },
  secondaryText: { color: colors.ink },
  field: { marginBottom: 14 },
  label: { color: colors.ink, fontWeight: "700", marginBottom: 7 },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "white",
    borderRadius: 12,
    paddingHorizontal: 13,
    paddingVertical: 12,
    color: colors.ink,
    fontSize: 16,
  },
});
