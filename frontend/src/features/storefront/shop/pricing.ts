import type { ShopCartItem } from "../../../shared/api";

export function cartItemsSubtotal(items: ShopCartItem[]) {
  return items.reduce((sum, item) => sum + (item.price ?? 0) * item.quantity, 0);
}

export function cartShippingTotal(items: ShopCartItem[]) {
  return items.reduce((sum, item) => sum + (item.shipping_fee ?? 0) * item.quantity, 0);
}

export function cartItemShippingTotal(item: ShopCartItem) {
  return (item.shipping_fee ?? 0) * item.quantity;
}

export function orderGrandTotal(itemsSubtotal: number, shippingTotal: number, discount = 0) {
  return itemsSubtotal + shippingTotal - discount;
}
