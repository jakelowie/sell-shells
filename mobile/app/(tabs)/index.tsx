import { useQuery } from "@tanstack/react-query";
import { ScrollView, Text, View, RefreshControl } from "react-native";
import { router } from "expo-router";
import { api, paged } from "../../src/api/client";
import { Page, Panel, Title, Loading } from "../../src/components/ui";
import { RequireAdmin } from "../../src/components/RequireAdmin";
import { colors } from "../../src/theme";

type Order = {
  order_id: string;
  order_number: string;
  order_status: string;
  payment_status: string;
  customer_name: string;
  currency: string;
  total: number;
  fulfillment_status?: string;
  created_at: string;
};
function Metric({
  label,
  value,
  color = colors.ink,
}: {
  label: string;
  value: string | number;
  color?: string;
}) {
  return (
    <View style={{ flex: 1 }}>
      <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "600" }}>{label}</Text>
      <Text style={{ color, fontSize: 25, fontWeight: "800", marginTop: 5 }}>{value}</Text>
    </View>
  );
}
function Dashboard() {
  const query = useQuery({
    queryKey: ["dashboard"],
    queryFn: async () => {
      const [orders, returns, feedback] = await Promise.all([
        paged<Order>("/api/admin/orders", 0, 100),
        paged<any>("/api/admin/commerce/returns", 0, 100),
        paged<any>("/api/admin/commerce/feedback", 0, 100),
      ]);
      return {
        orders: orders.data,
        total: orders.pagination.total,
        returns: returns.data,
        feedback: feedback.data,
      };
    },
  });
  const capturedByCurrency = (query.data?.orders ?? [])
    .filter((o) => o.payment_status === "captured")
    .reduce<Record<string, number>>((totals, order) => {
      totals[order.currency] = (totals[order.currency] || 0) + Number(order.total || 0);
      return totals;
    }, {});
  const capturedLabel =
    Object.entries(capturedByCurrency)
      .map(
        ([currency, value]) =>
          `${currency} ${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`,
      )
      .join(" · ") || "0";
  return (
    <Page>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={query.isRefetching} onRefresh={() => void query.refetch()} />
        }
      >
        <Title title="Good day" subtitle="Here’s what’s happening at craftshellhouse." />
        {query.isLoading ? (
          <Loading />
        ) : query.isError ? (
          <Panel>
            <Text style={{ color: colors.red }}>{(query.error as Error).message}</Text>
          </Panel>
        ) : (
          <>
            <Panel>
              <View style={{ flexDirection: "row", gap: 18 }}>
                <Metric label="ALL ORDERS" value={query.data?.total ?? 0} />
                <Metric
                  label="TO PREPARE"
                  value={
                    query.data?.orders.filter(
                      (o) =>
                        o.fulfillment_status === "pending" || o.fulfillment_status === "preparing",
                    ).length ?? 0
                  }
                  color={colors.coral}
                />
              </View>
            </Panel>
            <Panel>
              <View style={{ flexDirection: "row", gap: 18 }}>
                <Metric
                  label="IN TRANSIT"
                  value={
                    query.data?.orders.filter((o) => o.fulfillment_status === "shipped").length ?? 0
                  }
                />
                <Metric
                  label="RETURNS TO REVIEW"
                  value={
                    query.data?.returns.filter(
                      (r) => r.status === "pending" || r.status === "under_review",
                    ).length ?? 0
                  }
                  color={colors.amber}
                />
              </View>
            </Panel>
            <Panel>
              <View style={{ flexDirection: "row", gap: 18 }}>
                <Metric label="RECENT FEEDBACK" value={query.data?.feedback.length ?? 0} />
                <Metric label="CAPTURED SALES*" value={capturedLabel} />
              </View>
              <Text style={{ color: colors.muted, fontSize: 11, marginTop: 12 }}>
                *Latest 100 orders, grouped by currency.
              </Text>
            </Panel>
            <Text
              style={{
                color: colors.ink,
                fontSize: 18,
                fontWeight: "800",
                marginTop: 10,
                marginBottom: 10,
              }}
            >
              Recent orders
            </Text>
            {query.data?.orders.slice(0, 5).map((order) => (
              <Panel key={order.order_id}>
                <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                  <View>
                    <Text style={{ color: colors.ink, fontWeight: "800" }}>
                      #{order.order_number}
                    </Text>
                    <Text style={{ color: colors.muted, marginTop: 4 }}>{order.customer_name}</Text>
                  </View>
                  <Text style={{ color: colors.ink, fontWeight: "700" }}>
                    {order.currency} {Number(order.total).toFixed(2)}
                  </Text>
                </View>
                <Text
                  style={{ color: colors.coral, fontSize: 12, fontWeight: "700", marginTop: 9 }}
                >
                  {order.fulfillment_status || order.order_status}
                </Text>
              </Panel>
            ))}
          </>
        )}
      </ScrollView>
    </Page>
  );
}
export default function HomeScreen() {
  return (
    <RequireAdmin>
      <Dashboard />
    </RequireAdmin>
  );
}
