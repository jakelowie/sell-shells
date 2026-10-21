const assert = require("node:assert/strict");
const { test } = require("node:test");

const { cartItemSchema, createOrderSchema } = require("../dist/validation/shop.js");
const { listShellImagesSchema } = require("../dist/validation/shell-image.js");
const { formatPayPalAmount, validatePayPalOrder } = require("../dist/services/paypal.service.js");
const { calculateTotalAvailable } = require("../dist/services/stock-info.service.js");

const validCheckout = {
  idempotency_key: "11111111-1111-4111-8111-111111111111",
  customer: { name: "Test Customer", email: "customer@example.com", phone: "+1 (555) 123-4567" },
  delivery_address: {
    street_address: "15 Shore Road",
    city: "Cebu City",
    province: "Cebu",
    postal_code: "6000",
    country: "Philippines",
    address_details: "Leave at reception"
  }
};

test("shop validation accepts a complete guest checkout and rejects malformed customer data", () => {
  assert.equal(createOrderSchema.safeParse(validCheckout).success, true);
  assert.equal(createOrderSchema.safeParse({ ...validCheckout, customer: { ...validCheckout.customer, email: "bad-address" } }).success, false);
  assert.equal(createOrderSchema.safeParse({ ...validCheckout, customer: { ...validCheckout.customer, phone: "......." } }).success, false);
  assert.equal(createOrderSchema.safeParse({ ...validCheckout, delivery_address: { ...validCheckout.delivery_address, city: "" } }).success, false);
  assert.equal(createOrderSchema.safeParse({ ...validCheckout, admin: true }).success, false);
});

test("shop cart quantity validation enforces UUID and bounded integer quantities", () => {
  assert.equal(cartItemSchema.safeParse({ shell_id: "11111111-1111-4111-8111-111111111111", quantity: 2 }).success, true);
  assert.equal(cartItemSchema.safeParse({ shell_id: "not-a-uuid", quantity: 1 }).success, false);
  assert.equal(cartItemSchema.safeParse({ shell_id: "11111111-1111-4111-8111-111111111111", quantity: 0 }).success, false);
  assert.equal(cartItemSchema.safeParse({ shell_id: "11111111-1111-4111-8111-111111111111", quantity: 1.5 }).success, false);
});

test("stock totals divide for per-set stock types and multiply for other stock types", () => {
  assert.equal(calculateTotalAvailable(24, 6, true), 4);
  assert.equal(calculateTotalAvailable(3, 12, false), 36);
  assert.equal(calculateTotalAvailable(null, 12, true), null);
  assert.throws(() => calculateTotalAvailable(24, 0, true), /greater than zero/i);
});

test("PayPal amounts use the configured currency precision without silent rounding", () => {
  assert.equal(formatPayPalAmount(12.5, "USD"), "12.50");
  assert.equal(formatPayPalAmount(12, "JPY"), "12");
  assert.equal(formatPayPalAmount(12.345, "KWD"), "12.345");
  assert.throws(() => formatPayPalAmount(12.5, "JPY"), /more decimal places/i);
  assert.throws(() => formatPayPalAmount(Number.POSITIVE_INFINITY, "USD"), /amount is invalid/i);
});

test("PayPal capture is accepted only for the expected completed order, amount, and currency", () => {
  const expected = { paypalOrderId: "PAYPAL-ORDER-1", localOrderId: "local-order-1", expectedAmount: 15, currency: "USD", requireCompleted: true };
  const completed = {
    id: "PAYPAL-ORDER-1", status: "COMPLETED", purchase_units: [{ reference_id: "local-order-1", payments: { captures: [{ id: "CAPTURE-1", status: "COMPLETED", amount: { currency_code: "USD", value: "15.00" } }] } }]
  };
  assert.deepEqual(validatePayPalOrder(completed, expected), { orderId: "PAYPAL-ORDER-1", captureId: "CAPTURE-1", amount: "15.00", currency: "USD" });
  assert.throws(() => validatePayPalOrder({ ...completed, status: "APPROVED" }, expected), /payment has not completed/i);
  assert.throws(() => validatePayPalOrder({ ...completed, id: "OTHER-ORDER" }, expected), /payment has not completed/i);
  assert.throws(() => validatePayPalOrder({ ...completed, purchase_units: [{ ...completed.purchase_units[0], payments: { captures: [{ id: "CAPTURE-1", status: "COMPLETED", amount: { currency_code: "USD", value: "14.00" } }] } }] }, expected), /does not match/i);
});

test("batch shell-image queries accept bounded UUID lists without mixing single and batch filters", () => {
  assert.equal(listShellImagesSchema.safeParse({ shell_ids: "11111111-1111-4111-8111-111111111111" }).success, true);
  assert.equal(listShellImagesSchema.safeParse({ shell_ids: "invalid" }).success, false);
  assert.equal(listShellImagesSchema.safeParse({ shell_id: "11111111-1111-4111-8111-111111111111", shell_ids: "11111111-1111-4111-8111-111111111111" }).success, false);
});
