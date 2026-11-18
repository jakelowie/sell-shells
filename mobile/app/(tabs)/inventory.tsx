import { useState } from "react";
import { Image, Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../src/api/client";
import { Action, Field, Loading, Notice, Page, Panel, Title } from "../../src/components/ui";
import { RequireAdmin } from "../../src/components/RequireAdmin";
import { colors } from "../../src/theme";

type Shell = {
  shell_id: string;
  shell_name: string | null;
  note: string | null;
  price: number | null;
  author: string | null;
  deepness: string | null;
  from: string | null;
  locality_id: string | null;
  shell_stock_type_id: string | null;
  shell_type_id: string | null;
  shell_weight: string | null;
  shell_size: string | null;
  shipping_id: string | null;
  is_deleted?: boolean;
  shell_images?: { image_url?: string; public_url?: string; is_main_image?: boolean }[];
};
type Locality = { locality_id: string; locality: string | null };
type ShellType = { type_id: string; shell_type_name: string | null };
type StockType = { stock_id: string; stock_name: string | null };
type Unit = { id: string; unit_name: string | null; measurement_for: "size" | "weight" | null };
type ShippingFee = {
  id: string;
  shipping_name: string | null;
  shipping_fee: number | null;
  is_active: boolean | null;
};
type Choice = { id: string; label: string };
function Inventory() {
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Shell | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [author, setAuthor] = useState("");
  const [deepness, setDeepness] = useState("");
  const [source, setSource] = useState("");
  const [localityId, setLocalityId] = useState("");
  const [shellTypeId, setShellTypeId] = useState("");
  const [stockTypeId, setStockTypeId] = useState("");
  const [weight, setWeight] = useState("");
  const [weightUnit, setWeightUnit] = useState("");
  const [size, setSize] = useState("");
  const [sizeUnit, setSizeUnit] = useState("");
  const [shippingId, setShippingId] = useState("");
  const [showAdvancedInfo, setShowAdvancedInfo] = useState(false);
  const [image, setImage] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [note, setNote] = useState("");
  const qc = useQueryClient();
  const data = useQuery({
    queryKey: ["inventory", search],
    queryFn: () =>
      api<{ data: Shell[]; pagination: { total: number } }>(
        `/api/shells?limit=25&offset=0${search ? `&shell_name=${encodeURIComponent(search)}` : ""}`,
      ),
  });
  const localities = useQuery({
    queryKey: ["shell-localities"],
    queryFn: () =>
      api<{ data: Locality[]; pagination: { total: number } }>(
        "/api/shell-localities?limit=100&offset=0",
      ),
  });
  const shellTypes = useQuery({
    queryKey: ["shell-types"],
    queryFn: () => api<{ data: ShellType[] }>("/api/shell-types?limit=100&offset=0"),
  });
  const stockTypes = useQuery({
    queryKey: ["shell-stock-types"],
    queryFn: () => api<{ data: StockType[] }>("/api/shell-stock-types?limit=100&offset=0"),
  });
  const units = useQuery({
    queryKey: ["measurement-units"],
    queryFn: () => api<{ data: Unit[] }>("/api/units?limit=100&offset=0"),
  });
  const shippingFees = useQuery({
    queryKey: ["shipping-fees"],
    queryFn: () => api<{ data: ShippingFee[] }>("/api/shipping-fees?limit=100&offset=0"),
  });
  const shopConfig = useQuery({
    queryKey: ["shop-config"],
    queryFn: () => api<{ data: { currency: string | null } }>("/api/shop/config"),
  });
  const save = useMutation({
    mutationFn: async () => {
      const withUnit = (value: string, unit: string) => {
        const text = value.trim();
        const suffix = unit.trim();
        if (
          !text ||
          !suffix ||
          text
            .toLocaleLowerCase()
            .replace(/\s+/g, "")
            .endsWith(suffix.toLocaleLowerCase().replace(/\s+/g, ""))
        )
          return text || null;
        return `${text} ${suffix}`;
      };
      const body: Record<string, unknown> = {
        shell_name: name.trim(),
        note: description.trim() || null,
        price: price ? Number(price) : null,
        shell_type_id: shellTypeId || null,
        shell_stock_type_id: stockTypeId || null,
        shell_weight: withUnit(weight, weightUnit),
        shell_size: withUnit(size, sizeUnit),
        shipping_id: shippingId || null,
      };
      if (showAdvancedInfo) {
        body.author = author.trim() || null;
        body.deepness = deepness.trim() || null;
        body.from = source.trim() || null;
        body.locality_id = localityId || null;
      }
      if (price && (!Number.isFinite(Number(price)) || Number(price) < 0))
        throw new Error("Enter a valid non-negative price.");
      const result = editing
        ? await api<{ data: Shell }>(`/api/shells/${editing.shell_id}`, {
            method: "PATCH",
            body: JSON.stringify(body),
          })
        : await api<{ data: Shell }>("/api/shells", { method: "POST", body: JSON.stringify(body) });
      if (image) {
        const form = new FormData();
        form.append("shell_id", result.data.shell_id);
        form.append("image", {
          uri: image.uri,
          name: image.fileName || "product.jpg",
          type: image.mimeType || "image/jpeg",
        } as any);
        await api("/api/shell-images", { method: "POST", body: form });
      }
    },
    onSuccess: async () => {
      setEditing(null);
      setFormOpen(false);
      setName("");
      setDescription("");
      setPrice("");
      setAuthor("");
      setDeepness("");
      setSource("");
      setLocalityId("");
      setShellTypeId("");
      setStockTypeId("");
      setWeight("");
      setWeightUnit("");
      setSize("");
      setSizeUnit("");
      setShippingId("");
      setShowAdvancedInfo(false);
      setImage(null);
      setNote("Shell saved.");
      await qc.invalidateQueries({ queryKey: ["inventory"] });
    },
    onError: (e) => setNote((e as Error).message),
  });
  const archive = useMutation({
    mutationFn: (id: string) => api(`/api/shells/${id}`, { method: "DELETE" }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["inventory"] });
      setNote("Shell archived.");
    },
  });
  const startEdit = (item: Shell | null) => {
    setEditing(item);
    setFormOpen(true);
    setName(item?.shell_name ?? "");
    setDescription(item?.note ?? "");
    setPrice(item?.price == null ? "" : String(item.price));
    setAuthor(item?.author ?? "");
    setDeepness(item?.deepness ?? "");
    setSource(item?.from ?? "");
    setLocalityId(item?.locality_id ?? "");
    setShellTypeId(item?.shell_type_id ?? "");
    setStockTypeId(item?.shell_stock_type_id ?? "");
    setWeight(item?.shell_weight ?? "");
    setWeightUnit("");
    setSize(item?.shell_size ?? "");
    setSizeUnit("");
    setShippingId(item?.shipping_id ?? "");
    setShowAdvancedInfo(false);
    setImage(null);
    setNote("");
  };
  const chooseImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.8,
    });
    if (!result.canceled) setImage(result.assets[0]);
  };
  return (
    <Page>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl refreshing={data.isRefetching} onRefresh={() => void data.refetch()} />
        }
      >
        <Title title="Inventory" subtitle="Manage your shell listings and prices." />
        <Field
          label="Search products"
          value={search}
          onChangeText={setSearch}
          placeholder="Search by name"
        />
        <View style={{ marginBottom: 12 }}>
          <Action label="＋ Add shell" onPress={() => startEdit(null)} />
        </View>
        {note ? (
          <Notice text={note} error={note !== "Shell saved." && note !== "Shell archived."} />
        ) : null}
        {formOpen ? (
          <Panel>
            <Text style={{ fontSize: 18, fontWeight: "800", color: colors.ink, marginBottom: 12 }}>
              {editing ? "Edit shell" : "New shell"}
            </Text>
            <Field label="Shell name" value={name} onChangeText={setName} />
            <Field
              label="Description"
              value={description}
              onChangeText={setDescription}
              multiline
              placeholder="Add shell description"
            />
            <ChoiceField
              label="Shell type"
              value={shellTypeId}
              onChange={setShellTypeId}
              options={(shellTypes.data?.data ?? []).map((type) => ({
                id: type.type_id,
                label: type.shell_type_name || "Unnamed type",
              }))}
            />
            {shellTypes.isLoading ? <LookupHint text="Loading shell types…" /> : null}
            {shellTypes.isError ? (
              <LookupHint text={(shellTypes.error as Error).message} error />
            ) : null}
            <Field
              label={`Price${shopConfig.data?.data.currency ? ` (${shopConfig.data.data.currency})` : ""}`}
              value={price}
              onChangeText={setPrice}
              keyboardType="decimal-pad"
            />
            <ChoiceField
              label="Shipping fee"
              value={shippingId}
              onChange={setShippingId}
              options={(shippingFees.data?.data ?? [])
                .filter((fee) => fee.is_active === true || fee.id === editing?.shipping_id)
                .map((fee) => ({
                  id: fee.id,
                  label: `${fee.shipping_name || "Shipping"} · ${fee.shipping_fee == null ? "Fee not set" : formatMoney(fee.shipping_fee, shopConfig.data?.data.currency ?? null)}${fee.is_active === false ? " (inactive)" : ""}`,
                }))}
            />
            {shippingFees.isLoading ? <LookupHint text="Loading shipping fees…" /> : null}
            {shippingFees.isError ? (
              <LookupHint
                text={`Shipping fees could not be loaded; the current assignment will be kept. ${(shippingFees.error as Error).message}`}
                error
              />
            ) : null}
            <Pressable
              onPress={() => void chooseImage()}
              style={{
                marginBottom: 12,
                padding: 12,
                borderRadius: 12,
                backgroundColor: colors.cream,
              }}
            >
              <Text style={{ color: colors.ink, fontWeight: "700" }}>
                {image ? image.fileName || "Image selected" : "Choose shell image"}
              </Text>
            </Pressable>
            {image ? (
              <Image
                source={{ uri: image.uri }}
                style={{ width: 100, height: 100, borderRadius: 12, marginBottom: 12 }}
              />
            ) : null}
            <ChoiceField
              label="Stock unit type"
              value={stockTypeId}
              onChange={setStockTypeId}
              options={(stockTypes.data?.data ?? []).map((stock) => ({
                id: stock.stock_id,
                label: stock.stock_name || "Unnamed stock type",
              }))}
            />
            {stockTypes.isLoading ? <LookupHint text="Loading stock types…" /> : null}
            {stockTypes.isError ? (
              <LookupHint text={(stockTypes.error as Error).message} error />
            ) : null}
            <Field label="Weight" value={weight} onChangeText={setWeight} placeholder="e.g. 20" />
            <ChoiceField
              label="Weight unit (optional)"
              value={weightUnit}
              onChange={setWeightUnit}
              options={(units.data?.data ?? [])
                .filter((unit) => unit.measurement_for === "weight")
                .map((unit) => ({ id: unit.unit_name || "", label: unit.unit_name || "" }))}
            />
            <Field label="Size" value={size} onChangeText={setSize} placeholder="e.g. 5–7 cm" />
            <ChoiceField
              label="Size unit (optional)"
              value={sizeUnit}
              onChange={setSizeUnit}
              options={(units.data?.data ?? [])
                .filter((unit) => unit.measurement_for === "size")
                .map((unit) => ({ id: unit.unit_name || "", label: unit.unit_name || "" }))}
            />
            {units.isLoading ? <LookupHint text="Loading measurement units…" /> : null}
            {units.isError ? <LookupHint text={(units.error as Error).message} error /> : null}
            <View style={{ marginBottom: 12 }}>
              <Action
                label={showAdvancedInfo ? "Hide" : "Add Advance Information"}
                secondary
                onPress={() => setShowAdvancedInfo((visible) => !visible)}
              />
            </View>
            {showAdvancedInfo ? (
              <>
                <Field label="Author" value={author} onChangeText={setAuthor} />
                <Field label="Deepness" value={deepness} onChangeText={setDeepness} />
                <Field label="Source" value={source} onChangeText={setSource} />
                <ChoiceField
                  label="Locality"
                  value={localityId}
                  onChange={setLocalityId}
                  options={(localities.data?.data ?? []).map((locality) => ({
                    id: locality.locality_id,
                    label: locality.locality || "Unnamed locality",
                  }))}
                />
                {localities.isLoading ? <LookupHint text="Loading localities…" /> : null}
                {localities.isError ? (
                  <LookupHint text={(localities.error as Error).message} error />
                ) : null}
              </>
            ) : null}
            <Action
              label={save.isPending ? "Saving…" : "Save shell"}
              onPress={() => save.mutate()}
              disabled={save.isPending || !name.trim()}
            />
            <View style={{ height: 8 }} />
            <Action
              label="Cancel"
              secondary
              onPress={() => {
                setFormOpen(false);
                setEditing(null);
                setName("");
                setDescription("");
                setPrice("");
                setAuthor("");
                setDeepness("");
                setSource("");
                setLocalityId("");
                setShellTypeId("");
                setStockTypeId("");
                setWeight("");
                setWeightUnit("");
                setSize("");
                setSizeUnit("");
                setShippingId("");
                setImage(null);
                setShowAdvancedInfo(false);
              }}
            />
          </Panel>
        ) : null}
        {data.isLoading ? (
          <Loading />
        ) : data.isError ? (
          <Panel>
            <Text style={{ color: colors.red }}>{(data.error as Error).message}</Text>
          </Panel>
        ) : (
          data.data?.data.map((item) => (
            <Panel key={item.shell_id}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.ink, fontWeight: "800", fontSize: 16 }}>
                    {item.shell_name || "Unnamed shell"}
                  </Text>
                  <Text style={{ color: colors.muted, marginTop: 5 }}>
                    {item.author || "No maker listed"}
                  </Text>
                </View>
                <Text style={{ color: colors.ink, fontWeight: "800" }}>
                  {item.price == null ? "No price" : `₱${Number(item.price).toFixed(2)}`}
                </Text>
              </View>
              <View style={{ flexDirection: "row", gap: 8, marginTop: 12 }}>
                <View style={{ flex: 1 }}>
                  <Action label="Edit" secondary onPress={() => startEdit(item)} />
                </View>
                <View style={{ flex: 1 }}>
                  <Action label="Archive" secondary onPress={() => archive.mutate(item.shell_id)} />
                </View>
              </View>
            </Panel>
          ))
        )}
      </ScrollView>
    </Page>
  );
}

function ChoiceField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Choice[];
}) {
  const choices = [{ id: "", label: "Not specified" }, ...options.filter((option) => option.id)];
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={{ color: colors.ink, fontWeight: "700", marginBottom: 7 }}>{label}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        {choices.map((choice) => {
          const selected = value === choice.id;
          return (
            <Pressable
              key={choice.id || `${label}-none`}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected }}
              onPress={() => onChange(choice.id)}
              style={{
                paddingHorizontal: 12,
                paddingVertical: 10,
                marginRight: 8,
                borderRadius: 12,
                backgroundColor: selected ? colors.ink : colors.cream,
              }}
            >
              <Text style={{ color: selected ? "white" : colors.ink }}>{choice.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

function LookupHint({ text, error = false }: { text: string; error?: boolean }) {
  return <Text style={{ color: error ? colors.red : colors.muted, marginBottom: 10 }}>{text}</Text>;
}

function formatMoney(value: number, currency: string | null) {
  if (!currency) return value.toFixed(2);
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(value);
  } catch {
    return `${value.toFixed(2)} ${currency}`;
  }
}

export default function InventoryScreen() {
  return (
    <RequireAdmin>
      <Inventory />
    </RequireAdmin>
  );
}
