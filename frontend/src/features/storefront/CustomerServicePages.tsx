import { FormEvent, useEffect, useState } from "react";
import { CircleAlert, CheckCircle2 } from "lucide-react";

import {
  getPublicStoreSettings,
  listFeedback,
  listInvoiceRequests,
  listReturnRequests,
  requestInvoice,
  submitContactInquiry,
  submitFeedback,
  submitReturnRequest,
  uploadReturnEvidence,
} from "../../shared/api";

import { StoreFooter, StoreHeader } from "./StoreChrome";

type Nav = (path: string) => void;

function Frame({ onNavigate, children }: { onNavigate: Nav; children: React.ReactNode }) {
  return (
    <div className="storefront shop-storefront">
      <StoreHeader onNavigate={onNavigate} />
      <main className="shop-main customer-service-page">{children}</main>
      <StoreFooter onNavigate={onNavigate} />
    </div>
  );
}

function Feedback({ onNavigate }: { onNavigate: Nav }) {
  const [order, setOrder] = useState("");
  const [message, setMessage] = useState("");
  const [rows, setRows] = useState<any[]>([]);
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = () =>
    listFeedback(10, page * 10)
      .then((r) => {
        setRows(r.data);
        setTotal(r.pagination.total);
      })
      .catch((e) => setError((e as Error).message));

  useEffect(() => {
    void load();
  }, [page]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");

    try {
      await submitFeedback({
        order_id: order,
        feedback_message: message,
      });

      setNotice("Feedback submitted.");
      setOrder("");
      setMessage("");
      setPage(0);

      await load();
    } catch (x) {
      setError((x as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Frame onNavigate={onNavigate}>
      <h1>Customer feedback</h1>
      <p>Share feedback about an order from this shopping session.</p>

      <form className="customer-service-form" onSubmit={submit}>
        <label>
          Order ID
          <input required value={order} onChange={(e) => setOrder(e.target.value)} />
        </label>

        <label>
          Feedback
          <textarea
            required
            maxLength={5000}
            rows={5}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
          />
        </label>

        <button disabled={busy}>{busy ? "Submitting…" : "Submit feedback"}</button>
      </form>

      <Notice notice={notice} error={error} />

      <h2>Your submitted feedback</h2>

      {rows.map((row) => (
        <article className="service-record" key={row.feedback_id}>
          <small>
            {row.order_id} · {new Date(row.created_at).toLocaleDateString()}
          </small>
          <p>{row.feedback_message}</p>
        </article>
      ))}

      <Pager page={page} total={total} onPage={setPage} />
    </Frame>
  );
}

function Contact({ onNavigate }: { onNavigate: Nav }) {
  const [values, set] = useState({
    customer_name: "",
    email: "",
    order_id: "",
    subject: "",
    message: "",
  });

  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [settings, setSettings] = useState<any>(null);

  useEffect(() => {
    void getPublicStoreSettings()
      .then((r) => setSettings(r.data))
      .catch(() => setSettings(null));
  }, []);

  const send = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);

    try {
      await submitContactInquiry({
        ...values,
        order_id: values.order_id || undefined,
      });

      setNotice("Your inquiry was received.");

      set({
        customer_name: "",
        email: "",
        order_id: "",
        subject: "",
        message: "",
      });
    } catch (x) {
      setError((x as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const contact = settings?.business_contact;

  return (
    <Frame onNavigate={onNavigate}>
      <h1>Contact us</h1>
      <p>Send a question to the store team.</p>

      {contact && (contact.email || contact.phone || contact.address || contact.hours) ? (
        <section className="service-record">
          <h2>Store contact information</h2>

          {contact.email && (
            <p>
              Email: <a href={`mailto:${contact.email}`}>{contact.email}</a>
            </p>
          )}

          {contact.phone && <p>Phone: {contact.phone}</p>}

          {contact.address && <p>{contact.address}</p>}

          {contact.hours && <p>Hours: {contact.hours}</p>}
        </section>
      ) : (
        <p>Store contact details are not configured.</p>
      )}

      <form className="customer-service-form" onSubmit={send}>
        <label>
          Name
          <input
            required
            maxLength={120}
            value={values.customer_name}
            onChange={(e) =>
              set({
                ...values,
                customer_name: e.target.value,
              })
            }
          />
        </label>

        <label>
          Email
          <input
            required
            type="email"
            maxLength={254}
            value={values.email}
            onChange={(e) =>
              set({
                ...values,
                email: e.target.value,
              })
            }
          />
        </label>

        <label>
          Order ID <small>(optional)</small>
          <input
            value={values.order_id}
            onChange={(e) =>
              set({
                ...values,
                order_id: e.target.value,
              })
            }
          />
        </label>

        <label>
          Subject
          <input
            required
            maxLength={160}
            value={values.subject}
            onChange={(e) =>
              set({
                ...values,
                subject: e.target.value,
              })
            }
          />
        </label>

        <label>
          Message
          <textarea
            required
            maxLength={5000}
            rows={5}
            value={values.message}
            onChange={(e) =>
              set({
                ...values,
                message: e.target.value,
              })
            }
          />
        </label>

        <button disabled={busy}>{busy ? "Sending…" : "Send inquiry"}</button>
      </form>

      <Notice notice={notice} error={error} />
    </Frame>
  );
}

function Returns({ onNavigate }: { onNavigate: Nav }) {
  const [values, set] = useState({
    order_id: "",
    reason: "",
    details: "",
    requested_resolution: "refund" as "refund" | "replacement" | "other",
  });

  const [rows, setRows] = useState<any[]>([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [policy, setPolicy] = useState<any>(null);

  const load = () =>
    listReturnRequests()
      .then((r) => setRows(r.data))
      .catch((e) => setError((e as Error).message));

  useEffect(() => {
    void load();

    void getPublicStoreSettings()
      .then((r) => setPolicy(r.data.return_policy))
      .catch(() => setPolicy(null));
  }, []);

  const submit = async (e: FormEvent) => {
    e.preventDefault();

    try {
      await submitReturnRequest(values);

      setNotice("Return request submitted for review.");

      set({
        ...values,
        reason: "",
        details: "",
      });

      await load();
    } catch (x) {
      setError((x as Error).message);
    }
  };

  return (
    <Frame onNavigate={onNavigate}>
      <h1>Return request</h1>

      <p>
        Review the{" "}
        <a
          href="/return-policy"
          onClick={(e) => {
            e.preventDefault();
            onNavigate("/return-policy");
          }}
        >
          return policy
        </a>{" "}
        before submitting.
      </p>

      {policy?.enabled && (
        <div className="service-record">
          <strong>Return window: {policy.window_days} days from purchase</strong>
          <p>{policy.terms}</p>
        </div>
      )}

      <form className="customer-service-form" onSubmit={submit}>
        <label>
          Order ID
          <input
            required
            value={values.order_id}
            onChange={(e) =>
              set({
                ...values,
                order_id: e.target.value,
              })
            }
          />
        </label>

        <label>
          Reason
          <input
            required
            maxLength={160}
            value={values.reason}
            onChange={(e) =>
              set({
                ...values,
                reason: e.target.value,
              })
            }
          />
        </label>

        <label>
          Details
          <textarea
            required
            maxLength={5000}
            rows={5}
            value={values.details}
            onChange={(e) =>
              set({
                ...values,
                details: e.target.value,
              })
            }
          />
        </label>

        <label>
          Requested resolution
          <select
            value={values.requested_resolution}
            onChange={(e) =>
              set({
                ...values,
                requested_resolution: e.target.value as typeof values.requested_resolution,
              })
            }
          >
            <option value="refund">Refund review</option>
            <option value="replacement">Replacement</option>
            <option value="other">Other</option>
          </select>
        </label>

        <button disabled={!policy?.enabled}>Submit request</button>

        {!policy?.enabled && (
          <small>Return requests are unavailable until the store configures its policy.</small>
        )}
      </form>

      <Notice notice={notice} error={error} />

      <h2>Request history</h2>

      {rows.map((row) => (
        <article className="service-record" key={row.return_id}>
          <strong>{row.status}</strong>

          <small>
            {row.order_id} · {new Date(row.created_at).toLocaleDateString()}
          </small>

          <p>
            {row.reason}: {row.details}
          </p>

          {["pending", "under_review", "additional_information_required"].includes(row.status) && (
            <label>
              Add evidence image
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                onChange={async (e) => {
                  const file = e.target.files?.[0];

                  if (!file) return;

                  try {
                    await uploadReturnEvidence(row.return_id, file);

                    setNotice("Evidence uploaded securely.");
                  } catch (x) {
                    setError((x as Error).message);
                  } finally {
                    e.target.value = "";
                  }
                }}
              />
            </label>
          )}
        </article>
      ))}
    </Frame>
  );
}

function Invoices({ onNavigate }: { onNavigate: Nav }) {
  const [order, setOrder] = useState("");
  const [rows, setRows] = useState<any[]>([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = () =>
    listInvoiceRequests()
      .then((r) => setRows(r.data))
      .catch((e) => setError((e as Error).message));

  useEffect(() => {
    void load();
  }, []);

  const submit = async (e: FormEvent) => {
    e.preventDefault();

    try {
      await requestInvoice(order);

      setNotice("Invoice request recorded.");
      setOrder("");

      await load();
    } catch (x) {
      setError((x as Error).message);
    }
  };

  return (
    <Frame onNavigate={onNavigate}>
      <h1>Invoices</h1>

      <p>
        Request an invoice for an order. Staff review and generate invoices from the saved order
        totals.
      </p>

      <form className="customer-service-form" onSubmit={submit}>
        <label>
          Order ID
          <input required value={order} onChange={(e) => setOrder(e.target.value)} />
        </label>

        <button>Request invoice</button>
      </form>

      <Notice notice={notice} error={error} />

      {rows.map((row) => (
        <article className="service-record" key={row.invoice_id}>
          <strong>
            Invoice {row.invoice_number ?? "pending"} · {row.status}
          </strong>

          <small>Order {row.order_id}</small>

          {row.snapshot && (
            <div className="customer-invoice">
              <p>
                <strong>{row.snapshot.order?.customer_name}</strong>
                <br />
                {row.snapshot.order?.customer_email}
              </p>

              <p>
                Issued {new Date(row.snapshot.generated_at).toLocaleDateString()} · Payment{" "}
                {row.snapshot.order?.payment_status}
              </p>

              <div>
                {(row.snapshot.items ?? []).map((item: any, index: number) => (
                  <p key={index}>
                    {item.shell_name} × {item.quantity} · {Number(item.line_total).toFixed(2)}
                  </p>
                ))}
              </div>

              <p>
                Products {Number(row.snapshot.order?.subtotal).toFixed(2)} · Discount{" "}
                {Number(row.snapshot.order?.discount_amount ?? 0).toFixed(2)} · Shipping{" "}
                {Number(row.snapshot.order?.delivery_fee).toFixed(2)}
              </p>

              <strong>
                Total payable: {row.snapshot.order?.currency}{" "}
                {Number(row.snapshot.order?.total).toFixed(2)}
              </strong>

              <button onClick={() => window.print()}>Print / Save invoice</button>
            </div>
          )}
        </article>
      ))}
    </Frame>
  );
}

function Delivery({ onNavigate }: { onNavigate: Nav }) {
  const [payment, setPayment] = useState<any>(null);

  useEffect(() => {
    void getPublicStoreSettings()
      .then((r) => setPayment(r.data.payment_information))
      .catch(() => setPayment(null));
  }, []);

  const paymentConfigured = Boolean(payment?.methods || payment?.instructions || payment?.policy);

  return (
    <Frame onNavigate={onNavigate}>
      <h1>Payment & delivery</h1>

      <section className="service-record">
        <h2>Payment</h2>

        {payment?.methods && <SettingText heading="Supported methods" value={payment.methods} />}
        {payment?.instructions && (
          <SettingText heading="Payment instructions" value={payment.instructions} />
        )}
        {payment?.policy && <SettingText heading="Payment policy" value={payment.policy} />}

        {!paymentConfigured && (
          <p>
            Payment instructions are not configured. PayPal checkout availability appears at
            checkout.
          </p>
        )}
      </section>

      <section className="service-record">
        <h2>Delivery charges</h2>
        <p>
          Each shell uses its assigned shipping method and fee. The bag and checkout show shipping
          costs per shell and quantity before payment.
        </p>
      </section>
    </Frame>
  );
}

function SettingText({ heading, value }: { heading: string; value: string }) {
  const paragraphs = value
    .trim()
    .replace(/\r\n?/g, "\n")
    .split(/\n[\t ]*\n+/)
    .filter(Boolean);

  if (paragraphs.length === 0) return null;

  return (
    <div className="service-setting-copy">
      <h3>{heading}</h3>
      {paragraphs.map((paragraph, index) => {
        const lines = paragraph.split("\n").filter((line) => line.trim());
        const isBulletList = lines.length > 0 && lines.every((line) => /^\s*[-*•]\s+/.test(line));
        const isNumberedList =
          lines.length > 0 && lines.every((line) => /^\s*\d+[.)]\s+/.test(line));

        if (isBulletList || isNumberedList) {
          const List = isNumberedList ? "ol" : "ul";
          return (
            <List key={index}>
              {lines.map((line, lineIndex) => (
                <li key={lineIndex}>{line.replace(/^\s*(?:[-*•]|\d+[.)])\s+/, "")}</li>
              ))}
            </List>
          );
        }

        return (
          <p key={index}>
            {lines.map((line, lineIndex) => (
              <span key={lineIndex}>
                {line}
                {lineIndex < lines.length - 1 && <br />}
              </span>
            ))}
          </p>
        );
      })}
    </div>
  );
}

function Notice({ notice, error }: { notice?: string; error?: string }) {
  return (
    <>
      {notice && (
        <p className="service-notice success">
          <CheckCircle2 size={16} />
          {notice}
        </p>
      )}

      {error && (
        <p className="service-notice error">
          <CircleAlert size={16} />
          {error}
        </p>
      )}
    </>
  );
}

function Pager({
  page,
  total,
  onPage,
}: {
  page: number;
  total: number;
  onPage: (p: number) => void;
}) {
  return total > 10 ? (
    <div className="service-pager">
      <button disabled={!page} onClick={() => onPage(page - 1)}>
        Previous
      </button>

      <span>
        {page + 1} / {Math.ceil(total / 10)}
      </span>

      <button disabled={(page + 1) * 10 >= total} onClick={() => onPage(page + 1)}>
        Next
      </button>
    </div>
  ) : null;
}

function ReturnPolicy({ onNavigate }: { onNavigate: Nav }) {
  const [policy, setPolicy] = useState<any>(null);

  useEffect(() => {
    void getPublicStoreSettings()
      .then((r) => setPolicy(r.data.return_policy))
      .catch(() => setPolicy(null));
  }, []);

  return (
    <Frame onNavigate={onNavigate}>
      <h1>Return policy</h1>

      {policy?.enabled ? (
        <>
          <p>Requests must be submitted within {policy.window_days} days of the order date.</p>

          <article className="service-record">
            <p>{policy.terms}</p>

            <p>
              <strong>Evidence:</strong> {policy.evidence}
            </p>

            <p>
              <strong>Return shipping:</strong> {policy.shipping_responsibility}
            </p>

            <p>
              <strong>Refund processing:</strong> {policy.refund_information}
            </p>

            <p>
              <strong>Non-returnable items:</strong> {policy.non_returnable}
            </p>
          </article>

          <button onClick={() => onNavigate("/returns/request")}>Start a return request</button>
        </>
      ) : (
        <p>The store has not published a return policy yet.</p>
      )}
    </Frame>
  );
}

export function CustomerServicePage({ path, onNavigate }: { path: string; onNavigate: Nav }) {
  if (path === "/feedback") {
    return <Feedback onNavigate={onNavigate} />;
  }

  if (path === "/contact") {
    return <Contact onNavigate={onNavigate} />;
  }

  if (path === "/returns" || path === "/returns/request") {
    return <Returns onNavigate={onNavigate} />;
  }

  if (path === "/return-policy") {
    return <ReturnPolicy onNavigate={onNavigate} />;
  }

  if (path === "/invoices") {
    return <Invoices onNavigate={onNavigate} />;
  }

  return <Delivery onNavigate={onNavigate} />;
}
