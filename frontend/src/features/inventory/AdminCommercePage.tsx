import { FormEvent, useCallback, useEffect, useState } from "react";
import { ArrowLeft, CircleAlert, LoaderCircle, RotateCw, Shell } from "lucide-react";
import {
  getAdminCollection,
  getAdminPaged,
  getReturnEvidence,
  patchAdmin,
  postAdmin,
} from "../../shared/api/admin-commerce";
import { useAuth } from "../auth/AuthProvider";

type Tab =
  | "feedback"
  | "inquiries"
  | "returns"
  | "discounts"
  | "couriers"
  | "services"
  | "rates"
  | "settings";
const tabs: Tab[] = [
  "feedback",
  "inquiries",
  "returns",
  "discounts",
  "couriers",
  "services",
  "rates",
  "settings",
];
const initialSettings = {
  business_contact: { email: "", phone: "", address: "", hours: "" },
  payment_information: { methods: "", instructions: "", policy: "" },
  return_policy: {
    enabled: false,
    window_days: "",
    terms: "",
    evidence: "",
    shipping_responsibility: "",
    refund_information: "",
    non_returnable: "",
  },
};
export default function AdminCommercePage({ onNavigate }: { onNavigate: (path: string) => void }) {
  const { user, role, signOut } = useAuth();
  const [tab, setTab] = useState<Tab>("feedback");
  const [rows, setRows] = useState<any[]>([]);
  const [offset, setOffset] = useState(0);
  const [total, setTotal] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [settings, setSettings] = useState<any>(initialSettings);
  const [editing, setEditing] = useState<any>(null);
  const load = useCallback(async () => {
    setBusy(true);
    setError("");
    try {
      if (tab === "settings") {
        const result = await getAdminCollection("settings");
        const value: any = result.data;
        setSettings({
          business_contact: { ...initialSettings.business_contact, ...value.business_contact },
          payment_information: {
            ...initialSettings.payment_information,
            ...value.payment_information,
          },
          return_policy: {
            ...initialSettings.return_policy,
            ...value.return_policy,
            window_days: value.return_policy?.window_days ?? "",
          },
        });
        setRows([]);
        return;
      }
      const paged = ["feedback", "inquiries", "returns", "invoices"].includes(tab);
      const result: any = paged
        ? await getAdminPaged(tab, offset)
        : await getAdminCollection(
            tab === "couriers"
              ? "shipping/couriers"
              : tab === "services"
                ? "shipping/services"
                : tab === "rates"
                  ? "shipping/rates"
                  : "discounts",
          );
      setRows(result.data ?? []);
      setTotal(result.pagination?.total ?? result.data?.length ?? 0);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }, [tab, offset]);
  useEffect(() => {
    void load();
  }, [load]);
  const saveSettings = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await patchAdmin("settings", {
        business_contact: {
          email: settings.business_contact.email || null,
          phone: settings.business_contact.phone || null,
          address: settings.business_contact.address || null,
          hours: settings.business_contact.hours || null,
        },
        payment_information: {
          methods: settings.payment_information.methods || null,
          instructions: settings.payment_information.instructions || null,
          policy: settings.payment_information.policy || null,
        },
        return_policy: {
          ...settings.return_policy,
          window_days:
            settings.return_policy.window_days === ""
              ? null
              : Number(settings.return_policy.window_days),
        },
      });
      setNotice("Store information saved.");
    } catch (e) {
      setError((e as Error).message);
    }
  };
  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    setNotice("");
    const values = Object.fromEntries(new FormData(form).entries());
    try {
      let route: string = tab;
      let body: any = values;
      if (tab === "discounts") {
        body = {
          ...values,
          discount_value: Number(values.discount_value),
          minimum_subtotal: Number(values.minimum_subtotal || 0),
          usage_limit: values.usage_limit ? Number(values.usage_limit) : null,
          per_customer_limit: values.per_customer_limit ? Number(values.per_customer_limit) : null,
          maximum_discount: values.maximum_discount ? Number(values.maximum_discount) : null,
          starts_at: values.starts_at ? new Date(String(values.starts_at)).toISOString() : null,
          expires_at: values.expires_at ? new Date(String(values.expires_at)).toISOString() : null,
          active: values.active === "on",
        };
      }
      if (tab === "couriers") {
        route = "shipping/couriers";
        body = {
          ...values,
          tracking_url_template: values.tracking_url_template || null,
          active: values.active === "on",
        };
      }
      if (tab === "services") {
        route = "shipping/services";
        body = { ...values, active: values.active === "on" };
      }
      if (tab === "rates") {
        route = "shipping/rates";
        body = {
          ...values,
          amount: Number(values.amount),
          min_days: Number(values.min_days),
          max_days: Number(values.max_days),
          starts_at: values.starts_at ? new Date(String(values.starts_at)).toISOString() : null,
          expires_at: values.expires_at ? new Date(String(values.expires_at)).toISOString() : null,
          active: values.active === "on",
        };
      }
      await postAdmin(route, body);
      setNotice("Saved.");
      form.reset();
      await load();
    } catch (e) {
      setError((e as Error).message);
    }
  };
  const update = async (path: string, body: any) => {
    try {
      if (path.endsWith("/generate")) await postAdmin(path, body);
      else await patchAdmin(path, body);
      setNotice("Updated.");
      await load();
    } catch (e) {
      setError((e as Error).message);
    }
  };
  const saveEdit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editing) return;
    const entries = Object.fromEntries(new FormData(e.currentTarget).entries());
    const body: any = {};
    for (const [key, value] of Object.entries(entries)) {
      const original = editing[key];
      body[key] =
        typeof original === "boolean"
          ? value === "on"
          : typeof original === "number"
            ? value === ""
              ? null
              : Number(value)
            : key.endsWith("_at")
              ? value
                ? new Date(String(value)).toISOString()
                : null
              : original === null && value === ""
                ? null
                : value;
    }
    const idKey =
      tab === "discounts"
        ? "discount_id"
        : tab === "couriers"
          ? "courier_id"
          : tab === "services"
            ? "service_id"
            : "rate_id";
    const base =
      tab === "couriers"
        ? "shipping/couriers"
        : tab === "services"
          ? "shipping/services"
          : tab === "rates"
            ? "shipping/rates"
            : "discounts";
    try {
      await patchAdmin(`${base}/${editing[idKey]}`, body);
      setEditing(null);
      setNotice("Changes saved.");
      await load();
    } catch (e) {
      setError((e as Error).message);
    }
  };
  const openEvidence = async (returnId: string) => {
    try {
      const result = await getReturnEvidence(returnId);
      if (!result.data.length) {
        setNotice("No evidence was attached.");
        return;
      }
      result.data.forEach((item) => window.open(item.signed_url, "_blank", "noopener,noreferrer"));
    } catch (e) {
      setError((e as Error).message);
    }
  };
  const renderSettingsField = (
    section: string,
    key: string,
    label: string,
    type = "text",
    multiline = false,
  ) => (
    <label key={key} className={multiline ? "settings-long-field" : undefined}>
      {label}
      {multiline ? (
        <textarea
          rows={5}
          value={settings[section][key] ?? ""}
          onChange={(e) =>
            setSettings((s: any) => ({
              ...s,
              [section]: { ...s[section], [key]: e.target.value },
            }))
          }
        />
      ) : (
        <input
          type={type}
          value={settings[section][key] ?? ""}
          onChange={(e) =>
            setSettings((s: any) => ({
              ...s,
              [section]: {
                ...s[section],
                [key]: type === "checkbox" ? e.target.checked : e.target.value,
              },
            }))
          }
        />
      )}
    </label>
  );
  return (
    <div className="admin-orders-shell">
      <header className="admin-orders-topbar">
        <a
          className="admin-orders-brand"
          href="/admin"
          onClick={(e) => {
            e.preventDefault();
            onNavigate("/admin");
          }}
        >
          <Shell size={19} /> shellhouse
        </a>
        <span>
          {user?.email} · {role}
        </span>
        <button className="auth-signout" onClick={() => void signOut()}>
          Sign out
        </button>
      </header>
      <main className="admin-orders-main">
        <button className="admin-orders-back" onClick={() => onNavigate("/admin")}>
          <ArrowLeft size={14} /> Inventory
        </button>
        <div className="admin-orders-heading">
          <div>
            <span className="eyebrow">STORE / MANAGEMENT</span>
            <h1>Commerce management</h1>
            <p>Review customer requests and manage promotions, couriers and delivery rates.</p>
          </div>
          <button className="admin-orders-refresh" onClick={() => void load()} disabled={busy}>
            <RotateCw size={14} /> Refresh
          </button>
        </div>
        <nav className="commerce-admin-tabs">
          {tabs.map((name) => (
            <button
              key={name}
              className={tab === name ? "active" : ""}
              onClick={() => {
                setTab(name);
                setOffset(0);
                setNotice("");
              }}
            >
              {name[0].toUpperCase() + name.slice(1)}
            </button>
          ))}
        </nav>
        {error && (
          <p className="service-notice error">
            <CircleAlert size={16} />
            {error}
          </p>
        )}
        {notice && <p className="service-notice success">{notice}</p>}
        {tab === "settings" ? (
          <form className="admin-commerce-form settings-form" onSubmit={saveSettings}>
            <h2>Business contact</h2>
            {renderSettingsField("business_contact", "email", "Public email", "email")}
            {renderSettingsField("business_contact", "phone", "Public phone")}
            {renderSettingsField("business_contact", "address", "Business address")}
            {renderSettingsField("business_contact", "hours", "Support hours")}
            <h2>Payment information</h2>
            {renderSettingsField("payment_information", "methods", "Supported methods")}
            {renderSettingsField(
              "payment_information",
              "instructions",
              "Payment instructions",
              "text",
              true,
            )}
            {renderSettingsField("payment_information", "policy", "Payment policy", "text", true)}
            <h2>Return policy</h2>
            <label>
              <input
                type="checkbox"
                checked={settings.return_policy.enabled}
                onChange={(e) =>
                  setSettings((s: any) => ({
                    ...s,
                    return_policy: { ...s.return_policy, enabled: e.target.checked },
                  }))
                }
              />{" "}
              Accept return requests
            </label>
            {renderSettingsField("return_policy", "window_days", "Request window (days)", "number")}
            {renderSettingsField(
              "return_policy",
              "terms",
              "Eligibility and conditions",
              "text",
              true,
            )}
            {renderSettingsField("return_policy", "evidence", "Required evidence", "text", true)}
            {renderSettingsField(
              "return_policy",
              "shipping_responsibility",
              "Return shipping responsibility",
              "text",
              true,
            )}
            {renderSettingsField(
              "return_policy",
              "refund_information",
              "Refund processing information",
              "text",
              true,
            )}
            {renderSettingsField(
              "return_policy",
              "non_returnable",
              "Non-returnable items",
              "text",
              true,
            )}
            <button>Save store settings</button>
          </form>
        ) : (
          <>
            {["discounts", "couriers", "services", "rates"].includes(tab) && (
              <form className="admin-commerce-form" onSubmit={submit}>
                {tab === "discounts" ? (
                  <>
                    <label>
                      Code
                      <input name="code" required minLength={3} />
                    </label>
                    <label>
                      Type
                      <select name="discount_type">
                        <option value="percentage">Percentage</option>
                        <option value="fixed">Fixed amount</option>
                      </select>
                    </label>
                    <label>
                      Value
                      <input name="discount_value" type="number" step="0.01" min="0.01" required />
                    </label>
                    <label>
                      Maximum discount
                      <input name="maximum_discount" type="number" step="0.01" min="0" />
                    </label>
                    <label>
                      Minimum subtotal
                      <input
                        name="minimum_subtotal"
                        type="number"
                        step="0.01"
                        min="0"
                        defaultValue="0"
                      />
                    </label>
                    <label>
                      Usage limit
                      <input name="usage_limit" type="number" min="0" />
                    </label>
                    <label>
                      Per session limit (blank = unlimited)
                      <input name="per_customer_limit" type="number" min="1" />
                    </label>
                    <label>
                      Starts
                      <input name="starts_at" type="datetime-local" />
                    </label>
                    <label>
                      Expires
                      <input name="expires_at" type="datetime-local" />
                    </label>
                    <label>
                      <input name="active" type="checkbox" /> Active
                    </label>
                  </>
                ) : tab === "couriers" ? (
                  <>
                    <label>
                      Name
                      <input name="name" required />
                    </label>
                    <label>
                      Description
                      <input name="description" />
                    </label>
                    <label>
                      Tracking URL template
                      <input name="tracking_url_template" type="url" />
                    </label>
                    <label>
                      <input name="active" type="checkbox" /> Active
                    </label>
                  </>
                ) : tab === "services" ? (
                  <>
                    <label>
                      Courier ID
                      <input name="courier_id" required />
                    </label>
                    <label>
                      Service name
                      <input name="name" required />
                    </label>
                    <label>
                      <input name="active" type="checkbox" /> Active
                    </label>
                  </>
                ) : (
                  <>
                    <label>
                      Service ID
                      <input name="service_id" required />
                    </label>
                    <label>
                      Country code
                      <input name="country_code" required maxLength={2} />
                    </label>
                    <label>
                      Currency
                      <input name="currency" required maxLength={3} />
                    </label>
                    <label>
                      Amount
                      <input name="amount" required type="number" min="0" step="0.01" />
                    </label>
                    <label>
                      Min days
                      <input name="min_days" required type="number" min="0" />
                    </label>
                    <label>
                      Max days
                      <input name="max_days" required type="number" min="0" />
                    </label>
                    <label>
                      Effective from
                      <input name="starts_at" type="datetime-local" />
                    </label>
                    <label>
                      Effective until
                      <input name="expires_at" type="datetime-local" />
                    </label>
                    <label>
                      <input name="active" type="checkbox" /> Active
                    </label>
                  </>
                )}
                <button>Save {tab.slice(0, -1)}</button>
              </form>
            )}
            {busy ? (
              <div className="loading">
                <LoaderCircle className="spin" /> Loading…
              </div>
            ) : (
              <section className="admin-orders-table-panel">
                <div className="admin-orders-table-wrap">
                  <table className="admin-orders-table">
                    <thead>
                      <tr>
                        {Object.keys(rows[0] ?? { record: "No records" })
                          .slice(0, 7)
                          .map((k) => (
                            <th key={k}>{k.replace(/_/g, " ").toUpperCase()}</th>
                          ))}
                        {(tab === "returns" ||
                          ["discounts", "couriers", "services", "rates"].includes(tab)) && (
                          <th>MANAGE</th>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row, i) => (
                        <tr
                          key={
                            row.feedback_id ||
                            row.inquiry_id ||
                            row.return_id ||
                            row.invoice_id ||
                            row.discount_id ||
                            row.courier_id ||
                            row.service_id ||
                            row.rate_id ||
                            i
                          }
                        >
                          {Object.entries(row)
                            .slice(0, 7)
                            .map(([key, value]) => (
                              <td key={key}>
                                {typeof value === "object"
                                  ? JSON.stringify(value)
                                  : String(value ?? "")}
                              </td>
                            ))}
                          {tab === "returns" && (
                            <td>
                              <select
                                value={row.status}
                                onChange={(e) =>
                                  void update(`returns/${row.return_id}`, {
                                    status: e.target.value,
                                  })
                                }
                              >
                                {[
                                  "pending",
                                  "under_review",
                                  "additional_information_required",
                                  "approved",
                                  "rejected",
                                  "return_in_progress",
                                  "returned",
                                  "refund_processing",
                                  "refunded",
                                  "closed",
                                ].map((s) => (
                                  <option key={s}>{s}</option>
                                ))}
                              </select>
                              <button onClick={() => void openEvidence(row.return_id)}>
                                Evidence
                              </button>
                            </td>
                          )}
                          {["discounts", "couriers", "services", "rates"].includes(tab) && (
                            <td>
                              <button onClick={() => setEditing(row)}>Edit</button>
                              <button
                                onClick={() => {
                                  let resourcePath: string;
                                  let resourceId: string;

                                  if (tab === "discounts") {
                                    resourcePath = "discounts";
                                    resourceId = row.discount_id;
                                  } else if (tab === "couriers") {
                                    resourcePath = "shipping/couriers";
                                    resourceId = row.courier_id;
                                  } else if (tab === "services") {
                                    resourcePath = "shipping/services";
                                    resourceId = row.service_id;
                                  } else {
                                    resourcePath = "shipping/rates";
                                    resourceId = row.rate_id;
                                  }

                                  void update(`${resourcePath}/${resourceId}`, {
                                    active: !row.active,
                                  });
                                }}
                              >
                                {row.active ? "Deactivate" : "Activate"}
                              </button>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {rows.length === 0 && <p className="admin-orders-empty">No records.</p>}
                </div>
                {["feedback", "inquiries", "returns", "invoices"].includes(tab) && (
                  <div className="admin-orders-pagination">
                    <span>{total} records</span>
                    <div>
                      <button
                        disabled={!offset}
                        onClick={() => setOffset(Math.max(0, offset - 25))}
                      >
                        ‹
                      </button>
                      <button
                        disabled={offset + 25 >= total}
                        onClick={() => setOffset(offset + 25)}
                      >
                        ›
                      </button>
                    </div>
                  </div>
                )}
              </section>
            )}
          </>
        )}
        {editing && (
          <div className="commerce-edit-backdrop">
            <form className="commerce-edit-modal" onSubmit={saveEdit}>
              <header>
                <strong>Edit configuration</strong>
                <button type="button" onClick={() => setEditing(null)}>
                  ×
                </button>
              </header>
              {Object.entries(editing)
                .filter(
                  ([key, value]) =>
                    ![
                      "discount_id",
                      "courier_id",
                      "service_id",
                      "rate_id",
                      "created_at",
                      "updated_at",
                      "usage_count",
                    ].includes(key) &&
                    (value === null || typeof value !== "object"),
                )
                .map(([key, value]) => (
                  <label key={key}>
                    {key.replace(/_/g, " ")}
                    <input
                      name={key}
                      type={
                        typeof value === "boolean"
                          ? "checkbox"
                          : typeof value === "number"
                            ? "number"
                            : key.endsWith("_at")
                              ? "datetime-local"
                              : "text"
                      }
                      min={key === "per_customer_limit" ? 1 : undefined}
                      defaultChecked={typeof value === "boolean" ? value : undefined}
                      defaultValue={
                        typeof value === "boolean" || value === null
                          ? ""
                          : key.endsWith("_at") && value
                            ? new Date(String(value)).toISOString().slice(0, 16)
                            : String(value ?? "")
                      }
                    />
                  </label>
                ))}
              <button>Save changes</button>
            </form>
          </div>
        )}
      </main>
    </div>
  );
}
