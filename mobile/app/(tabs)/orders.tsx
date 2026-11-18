import { useState } from "react";
import { RefreshControl, ScrollView, Text, View } from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, paged } from "../../src/api/client";
import { Action, Field, Loading, Notice, Page, Panel, Title } from "../../src/components/ui";
import { RequireAdmin } from "../../src/components/RequireAdmin";
import { colors } from "../../src/theme";

type Order = {
  order_id: string;
  order_number: string;
  order_status: string;
  payment_status: string;
  fulfillment_status: string;
  customer_name: string;
  customer_email: string;
  currency: string;
  total: number;
  created_at: string;
  tracking_number?: string;
  items?: any[];
};
type Courier = { courier_id: string; name: string };
function Orders() {
  const [offset, setOffset] = useState(0);
  const [selected, setSelected] = useState<Order | null>(null);
  const [tracking, setTracking] = useState("");
  const [courier, setCourier] = useState("");
  const [note, setNote] = useState("");
  const [message, setMessage] = useState("");
  const qc = useQueryClient();
  const list = useQuery({
    queryKey: ["orders", offset],
    queryFn: () => paged<Order>("/api/admin/orders", offset, 25),
  });
  const detail = useQuery({
    queryKey: ["order", selected?.order_id],
    enabled: !!selected,
    queryFn: async () =>
      (await api<{ data: Order }>(`/api/admin/orders/${selected!.order_id}`)).data,
  });
  const couriers = useQuery({
    queryKey: ["couriers"],
    queryFn: async () =>
      (await api<{ data: Courier[] }>("/api/admin/commerce/shipping/couriers")).data,
  });
  const change = useMutation({
    mutationFn: (body: any) =>
      api(`/api/admin/commerce/orders/${selected!.order_id}/status`, {
        method: "PATCH",
        body: JSON.stringify(body),
      }),
    onSuccess: async () => {
      setMessage("Order status updated.");
      await qc.invalidateQueries({ queryKey: ["orders"] });
      await detail.refetch();
    },
  });
  const doStatus = (status: string) => {
    setMessage("");
    const body: any = { status };
    if (status === "shipped") {
      if (!courier || !tracking.trim()) {
        setMessage("Choose a courier and enter the tracking number first.");
        return;
      }
      body.courier_id = courier;
      body.tracking_number = tracking.trim();
    }
    if (note.trim()) body.remarks = note.trim();
    change.mutate(body);
  };
  return (
    <Page>
      <ScrollView
        refreshControl={
          <RefreshControl refreshing={list.isRefetching} onRefresh={() => void list.refetch()} />
        }
      >
        <Title title="Orders" subtitle="Review payments and keep each order moving." />
        {selected ? (
          <>
            <Action
              label="← All orders"
              secondary
              onPress={() => {
                setSelected(null);
                setMessage("");
              }}
            />
            {detail.isLoading ? (
              <Loading />
            ) : detail.isError ? (
              <Notice text={(detail.error as Error).message} error />
            ) : (
              <>
                <Panel style={{ marginTop: 12 }}>
                  <Text style={{ color: colors.coral, fontWeight: "800" }}>
                    ORDER #{detail.data?.order_number}
                  </Text>
                  <Text
                    style={{ color: colors.ink, fontSize: 21, fontWeight: "800", marginTop: 7 }}
                  >
                    {detail.data?.customer_name}
                  </Text>
                  <Text style={{ color: colors.muted, marginTop: 3 }}>
                    {detail.data?.customer_email}
                  </Text>
                  <Text style={{ color: colors.ink, marginTop: 12 }}>
                    Payment: {detail.data?.payment_status} · Fulfillment:{" "}
                    {detail.data?.fulfillment_status}
                  </Text>
                  <Text style={{ fontWeight: "800", marginTop: 10 }}>
                    {detail.data?.currency} {Number(detail.data?.total).toFixed(2)}
                  </Text>
                </Panel>
                <Text
                  style={{ fontSize: 18, fontWeight: "800", color: colors.ink, marginBottom: 9 }}
                >
                  Items
                </Text>
                {detail.data?.items?.map((item, i) => (
                  <Panel key={i}>
                    <Text style={{ color: colors.ink, fontWeight: "700" }}>
                      {item.shell_name} × {item.quantity}
                    </Text>
                    <Text style={{ color: colors.muted, marginTop: 4 }}>
                      {detail.data?.currency} {item.line_total}
                    </Text>
                  </Panel>
                ))}
                {detail.data?.fulfillment_status !== "delivered" &&
                detail.data?.fulfillment_status !== "cancelled" ? (
                  <Panel>
                    <Text
                      style={{
                        fontSize: 17,
                        fontWeight: "800",
                        marginBottom: 12,
                        color: colors.ink,
                      }}
                    >
                      Update fulfillment
                    </Text>
                    {detail.data?.fulfillment_status === "pending" ||
                    detail.data?.fulfillment_status === "preparing" ? (
                      <>
                        <Text style={{ color: colors.muted, marginBottom: 10 }}>
                          Mark as preparing before shipping, or ship directly when ready.
                        </Text>
                        <Action
                          label="Mark preparing"
                          secondary
                          onPress={() => doStatus("preparing")}
                        />
                        <View style={{ height: 8 }} />
                        <Field
                          label="Tracking number"
                          value={tracking}
                          onChangeText={setTracking}
                        />
                        <Text style={{ color: colors.ink, fontWeight: "700", marginBottom: 8 }}>
                          Courier
                        </Text>
                        {couriers.data
                          ?.filter((c) => (c as any).active !== false)
                          .map((c) => (
                            <View key={c.courier_id} style={{ marginBottom: 7 }}>
                              <Action
                                label={`${courier === c.courier_id ? "✓ " : ""}${c.name}`}
                                secondary
                                onPress={() => setCourier(c.courier_id)}
                              />
                            </View>
                          ))}
                        {!couriers.data?.length ? (
                          <Text style={{ color: colors.muted, marginBottom: 8 }}>
                            No couriers configured. Set up a courier in the web admin first.
                          </Text>
                        ) : null}
                        <Action
                          label="Mark shipped"
                          onPress={() => doStatus("shipped")}
                          disabled={change.isPending}
                        />
                      </>
                    ) : (
                      <Action
                        label="Mark delivered"
                        onPress={() => doStatus("delivered")}
                        disabled={change.isPending}
                      />
                    )}
                    <View style={{ height: 12 }} />
                    <Field label="Internal note (optional)" value={note} onChangeText={setNote} />
                    {message ? <Notice text={message} error={message.includes("first")} /> : null}
                    {change.isError ? (
                      <Notice text={(change.error as Error).message} error />
                    ) : null}
                  </Panel>
                ) : null}
              </>
            )}
          </>
        ) : list.isLoading ? (
          <Loading />
        ) : list.isError ? (
          <Panel>
            <Text style={{ color: colors.red }}>{(list.error as Error).message}</Text>
          </Panel>
        ) : (
          <>
            {list.data?.data.map((order) => (
              <Panel key={order.order_id}>
                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.ink, fontWeight: "800", fontSize: 16 }}>
                      #{order.order_number}
                    </Text>
                    <Text style={{ color: colors.muted, marginTop: 5 }}>{order.customer_name}</Text>
                    <Text
                      style={{ color: colors.coral, fontSize: 12, fontWeight: "700", marginTop: 7 }}
                    >
                      {order.fulfillment_status} · {order.payment_status}
                    </Text>
                  </View>
                  <Text style={{ color: colors.ink, fontWeight: "800" }}>
                    {order.currency} {Number(order.total).toFixed(2)}
                  </Text>
                </View>
                <View style={{ marginTop: 13 }}>
                  <Action label="View order" secondary onPress={() => setSelected(order)} />
                </View>
              </Panel>
            ))}
            <View style={{ flexDirection: "row", gap: 10, marginBottom: 24 }}>
              <View style={{ flex: 1 }}>
                <Action
                  label="Previous"
                  secondary
                  disabled={offset === 0}
                  onPress={() => setOffset(Math.max(0, offset - 25))}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Action
                  label="Next"
                  secondary
                  disabled={offset + 25 >= (list.data?.pagination.total ?? 0)}
                  onPress={() => setOffset(offset + 25)}
                />
              </View>
            </View>
          </>
        )}
      </ScrollView>
    </Page>
  );
}
export default function OrdersScreen() {
  return (
    <RequireAdmin>
      <Orders />
    </RequireAdmin>
  );
}
