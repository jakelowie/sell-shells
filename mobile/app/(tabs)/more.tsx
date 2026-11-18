import { useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, paged } from "../../src/api/client";
import { Action, Field, Loading, Notice, Page, Panel, Title } from "../../src/components/ui";
import { RequireAdmin } from "../../src/components/RequireAdmin";
import { useAuth } from "../../src/auth/context";
import { colors } from "../../src/theme";

const queues = ["Returns", "Feedback", "Invoices", "Discounts", "Shipping", "Settings"] as const;
type Queue = (typeof queues)[number];
function More() {
  const [queue, setQueue] = useState<Queue>("Returns");
  const [message, setMessage] = useState("");
  const [remark, setRemark] = useState("");
  const { email, role, signOut } = useAuth();
  const qc = useQueryClient();
  const path =
    queue === "Returns"
      ? "/api/admin/commerce/returns"
      : queue === "Feedback"
        ? "/api/admin/commerce/feedback"
        : queue === "Invoices"
          ? "/api/admin/commerce/invoices"
          : queue === "Discounts"
            ? "/api/admin/commerce/discounts"
            : queue === "Shipping"
              ? "/api/admin/commerce/shipping/couriers"
              : "/api/admin/commerce/settings";
  const data = useQuery({
    queryKey: ["admin-queue", queue],
    queryFn: async () =>
      queue === "Settings"
        ? (await api<{ data: any }>(path)).data
        : queue === "Discounts" || queue === "Shipping"
          ? (await api<{ data: any[] }>(path)).data
          : (await paged<any>(path, 0, 30)).data,
  });
  const act = useMutation({
    mutationFn: async ({ id, body, method, suffix = "" }: any) =>
      api(`/api/admin/commerce/${queue.toLowerCase()}${id ? `/${id}` : ""}${suffix}`, {
        method: method || "PATCH",
        body: JSON.stringify(body),
      }),
    onSuccess: async () => {
      setMessage("Saved.");
      await qc.invalidateQueries({ queryKey: ["admin-queue", queue] });
    },
    onError: (e) => setMessage((e as Error).message),
  });
  const cards: Record<
    Exclude<Queue, "Settings" | "Shipping">,
    (item: any, i: number) => React.ReactNode
  > = {
    Returns: (item, i) => (
      <>
        <Text style={{ color: colors.ink, fontWeight: "800" }}>
          Return request {item.return_number || `#${i + 1}`}
        </Text>
        <Text style={{ color: colors.muted, marginTop: 5 }}>
          {item.reason || item.details || "No reason supplied"}
        </Text>
        <Text style={{ color: colors.coral, marginTop: 7, fontWeight: "700" }}>{item.status}</Text>
        <Field label="Admin remarks" value={remark} onChangeText={setRemark} />
        <View style={{ flexDirection: "row", gap: 8 }}>
          <View style={{ flex: 1 }}>
            <Action
              label="Approve"
              onPress={() =>
                act.mutate({
                  id: item.return_id,
                  body: { status: "approved", admin_remarks: remark || undefined },
                })
              }
            />
          </View>
          <View style={{ flex: 1 }}>
            <Action
              label="Reject"
              secondary
              onPress={() =>
                act.mutate({
                  id: item.return_id,
                  body: { status: "rejected", admin_remarks: remark || undefined },
                })
              }
            />
          </View>
        </View>
      </>
    ),
    Feedback: (item) => (
      <>
        <Text style={{ color: colors.ink, fontWeight: "700" }}>{item.feedback_message}</Text>
        <Text style={{ color: colors.muted, marginTop: 7 }}>
          {new Date(item.created_at).toLocaleDateString()}
        </Text>
      </>
    ),
    Invoices: (item) => (
      <>
        <Text style={{ color: colors.ink, fontWeight: "800" }}>Invoice request</Text>
        <Text style={{ color: colors.muted, marginTop: 5 }}>Status: {item.status}</Text>
        {item.status === "pending" || item.status === "under_review" ? (
          <Action
            label="Approve request"
            onPress={() => act.mutate({ id: item.invoice_id, body: { status: "approved" } })}
          />
        ) : null}
        {item.status === "approved" || item.status === "generated" ? (
          <Action
            label="Generate invoice snapshot"
            onPress={() =>
              act.mutate({ id: item.invoice_id, method: "POST", suffix: "/generate", body: {} })
            }
          />
        ) : null}
      </>
    ),
    Discounts: (item) => (
      <>
        <Text style={{ color: colors.ink, fontWeight: "800" }}>{item.code}</Text>
        <Text style={{ color: colors.muted, marginTop: 5 }}>
          {item.discount_type}: {item.discount_value} · {item.active ? "Active" : "Inactive"}
        </Text>
        <Action
          label={item.active ? "Deactivate" : "Activate"}
          secondary
          onPress={() => act.mutate({ id: item.discount_id, body: { active: !item.active } })}
        />
      </>
    ),
  };
  return (
    <Page>
      <ScrollView>
        <Title title="Store tools" subtitle="Customer requests, store setup, and your account." />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
          {queues.map((item) => (
            <View key={item} style={{ marginRight: 8 }}>
              <Action
                label={item}
                secondary={queue !== item}
                onPress={() => {
                  setQueue(item);
                  setMessage("");
                }}
              />
            </View>
          ))}
        </ScrollView>
        {message ? <Notice text={message} error={act.isError} /> : null}
        {data.isLoading ? (
          <Loading />
        ) : data.isError ? (
          <Panel>
            <Text style={{ color: colors.red }}>{(data.error as Error).message}</Text>
          </Panel>
        ) : queue === "Settings" ? (
          <Panel>
            <Text style={{ color: colors.ink, fontSize: 18, fontWeight: "800", marginBottom: 12 }}>
              Store contact
            </Text>
            <Text style={{ color: colors.muted }}>
              Email: {data.data?.business_contact?.email || "Not set"}
            </Text>
            <Text style={{ color: colors.muted, marginTop: 6 }}>
              Phone: {data.data?.business_contact?.phone || "Not set"}
            </Text>
            <Text
              style={{
                color: colors.ink,
                fontSize: 17,
                fontWeight: "800",
                marginTop: 18,
                marginBottom: 8,
              }}
            >
              Return policy
            </Text>
            <Text style={{ color: colors.muted }}>
              Status: {data.data?.return_policy?.enabled ? "Enabled" : "Disabled"}
            </Text>
            <Text style={{ color: colors.muted, marginTop: 6 }}>
              {data.data?.return_policy?.terms || "No terms configured."}
            </Text>
          </Panel>
        ) : queue === "Shipping" ? (
          (data.data ?? []).map((item: any) => (
            <Panel key={item.courier_id}>
              <Text style={{ color: colors.ink, fontWeight: "800" }}>{item.name}</Text>
              <Text style={{ color: colors.muted, marginTop: 5 }}>
                {item.active ? "Active courier" : "Inactive courier"}
              </Text>
            </Panel>
          ))
        ) : (
          ((data.data ?? []) as any[]).map((item, i) => (
            <Panel
              key={item.return_id || item.invoice_id || item.feedback_id || item.discount_id || i}
            >
              {cards[queue as Exclude<Queue, "Settings" | "Shipping">](item, i)}
            </Panel>
          ))
        )}
        <Panel style={{ marginTop: 16 }}>
          <Text style={{ color: colors.ink, fontWeight: "800" }}>{email}</Text>
          <Text style={{ color: colors.muted, marginVertical: 5 }}>{role}</Text>
          <Action label="Sign out" secondary onPress={() => void signOut()} />
        </Panel>
      </ScrollView>
    </Page>
  );
}
export default function MoreScreen() {
  return (
    <RequireAdmin>
      <More />
    </RequireAdmin>
  );
}
