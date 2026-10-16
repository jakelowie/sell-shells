import type {
  ShellDescription,
  ShellDescriptionInsert,
  ShellDescriptionUpdate
} from "../validation/shell-description";
import type {
  ShellStockType,
  ShellStockTypeInsert,
  ShellStockTypeUpdate
} from "../validation/shell-stock-type";
import type { StockInfo, StockInfoInsert, StockInfoUpdate } from "../validation/stock-info";
import type { ShellImage, ShellImageInsert, ShellImageUpdate } from "../validation/shell-image";
import type { ShellType, ShellTypeInsert, ShellTypeUpdate } from "../validation/shell-type";
import type { ShellLocality, ShellLocalityInsert, ShellLocalityUpdate } from "../validation/shell-locality";

export type AppRole = "user" | "admin" | "superadmin";
export type UserRole = {
  user_id: string;
  email: string | null;
  role: AppRole;
  created_at: string;
  updated_at: string;
};

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];
export type ShopSession = { session_id: string; token_hash: string; created_at: string; last_seen_at: string };
export type ShopCart = { cart_id: string; session_id: string; status: "active" | "converted"; created_at: string; updated_at: string };
export type ShopCartItem = { cart_id: string; shell_id: string; quantity: number; created_at: string; updated_at: string };
export type ShopOrderStatus = "pending" | "paid" | "failed" | "cancelled" | "refunded";
export type ShopPaymentStatus = "pending" | "captured" | "failed" | "cancelled" | "refunded";
export type ShopOrder = {
  order_id: string;
  order_number: string;
  session_id: string;
  cart_id: string;
  idempotency_key: string;
  order_status: ShopOrderStatus;
  payment_status: ShopPaymentStatus;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  delivery_address: Json;
  currency: string;
  subtotal: number;
  delivery_fee: number;
  total: number;
  paypal_order_id: string | null;
  paypal_capture_id: string | null;
  capture_request_id: string;
  payment_metadata: Json | null;
  expires_at: string;
  created_at: string;
  updated_at: string;
};
export type ShopOrderItem = {
  order_item_id: string;
  order_id: string;
  shell_id: string | null;
  shell_name: string;
  quantity: number;
  unit_price: number;
  line_total: number;
  created_at: string;
};

type ShellDescriptionStockTypeRelationship = {
  foreignKeyName: "shell_description_shell_stock_type_id_fkey";
  columns: ["shell_stock_type_id"];
  isOneToOne: false;
  referencedRelation: "shell_stock_type";
  referencedColumns: ["stock_id"];
};
type ShellDescriptionTypeRelationship = {
  foreignKeyName: "shell_description_shell_type_id_fkey";
  columns: ["shell_type_id"];
  isOneToOne: false;
  referencedRelation: "shell_type";
  referencedColumns: ["type_id"];
};
type ShellDescriptionLocalityRelationship = {
  foreignKeyName: "shell_description_locality_id_fkey";
  columns: ["locality_id"];
  isOneToOne: false;
  referencedRelation: "shell_locality";
  referencedColumns: ["locality_id"];
};
type ShellDescriptionStockRelationship = {
  foreignKeyName: "stock_info_shell_id_fkey";
  columns: ["shell_id"];
  isOneToOne: false;
  referencedRelation: "shell_description";
  referencedColumns: ["shell_id"];
};
type ShellStockTypeRelationship = {
  foreignKeyName: "stock_info_shell_stock_id_fkey";
  columns: ["shell_stock_id"];
  isOneToOne: false;
  referencedRelation: "shell_stock_type";
  referencedColumns: ["stock_id"];
};
type ShellImageRelationship = {
  foreignKeyName: "shell_images_shell_id_fkey";
  columns: ["shell_id"];
  isOneToOne: false;
  referencedRelation: "shell_description";
  referencedColumns: ["shell_id"];
};

export type Database = {
  public: {
    Tables: {
      shell_description: {
        Row: ShellDescription;
        Insert: ShellDescriptionInsert;
        Update: ShellDescriptionUpdate;
        Relationships: [ShellDescriptionStockTypeRelationship, ShellDescriptionTypeRelationship, ShellDescriptionLocalityRelationship];
      };
      shell_locality: {
        Row: ShellLocality;
        Insert: ShellLocalityInsert;
        Update: ShellLocalityUpdate;
        Relationships: [];
      };
      shell_stock_type: {
        Row: ShellStockType;
        Insert: ShellStockTypeInsert;
        Update: ShellStockTypeUpdate;
        Relationships: [];
      };
      shell_stocks_info: {
        Row: StockInfo;
        Insert: StockInfoInsert;
        Update: StockInfoUpdate;
        Relationships: [ShellDescriptionStockRelationship, ShellStockTypeRelationship];
      };
      shell_images: {
        Row: ShellImage;
        Insert: ShellImageInsert;
        Update: ShellImageUpdate;
        Relationships: [ShellImageRelationship];
      };
      shell_type: {
        Row: ShellType;
        Insert: ShellTypeInsert;
        Update: ShellTypeUpdate;
        Relationships: [];
      };
      user_roles: {
        Row: UserRole;
        Insert: Pick<UserRole, "user_id" | "email" | "role">;
        Update: Partial<Pick<UserRole, "email" | "role">>;
        Relationships: [];
      };
      shop_sessions: {
        Row: ShopSession;
        Insert: Pick<ShopSession, "token_hash"> & Partial<Pick<ShopSession, "session_id" | "created_at" | "last_seen_at">>;
        Update: Partial<Pick<ShopSession, "last_seen_at">>;
        Relationships: [];
      };
      shop_carts: {
        Row: ShopCart;
        Insert: Pick<ShopCart, "session_id"> & Partial<Pick<ShopCart, "cart_id" | "status" | "created_at" | "updated_at">>;
        Update: Partial<Pick<ShopCart, "status" | "updated_at">>;
        Relationships: [];
      };
      shop_cart_items: {
        Row: ShopCartItem;
        Insert: Pick<ShopCartItem, "cart_id" | "shell_id" | "quantity"> & Partial<Pick<ShopCartItem, "created_at" | "updated_at">>;
        Update: Partial<Pick<ShopCartItem, "quantity" | "updated_at">>;
        Relationships: [];
      };
      shop_orders: {
        Row: ShopOrder;
        Insert: Omit<ShopOrder, "order_id" | "order_number" | "created_at" | "updated_at"> & Partial<Pick<ShopOrder, "order_id" | "order_number" | "created_at" | "updated_at">>;
        Update: Partial<Pick<ShopOrder, "order_status" | "payment_status" | "paypal_order_id" | "paypal_capture_id" | "payment_metadata" | "updated_at">>;
        Relationships: [];
      };
      shop_order_items: {
        Row: ShopOrderItem;
        Insert: Omit<ShopOrderItem, "order_item_id" | "created_at"> & Partial<Pick<ShopOrderItem, "order_item_id" | "created_at">>;
        Update: Partial<Pick<ShopOrderItem, "shell_name" | "quantity" | "unit_price" | "line_total">>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      assign_user_role: {
        Args: { target_user_id: string; new_role: AppRole };
        Returns: UserRole;
      };
      shop_available_quantities: {
        Args: { p_shell_ids: string[] };
        Returns: Json;
      };
      shop_cart_snapshot: {
        Args: { p_session_id: string };
        Returns: Json;
      };
      shop_set_cart_item: {
        Args: { p_session_id: string; p_shell_id: string; p_quantity: number };
        Returns: Json;
      };
      shop_add_cart_item: {
        Args: { p_session_id: string; p_shell_id: string; p_quantity: number };
        Returns: Json;
      };
      shop_create_order: {
        Args: {
          p_session_id: string;
          p_idempotency_key: string;
          p_customer_name: string;
          p_customer_email: string;
          p_customer_phone: string;
          p_delivery_address: Json;
          p_currency: string;
          p_delivery_fee: number;
          p_expires_at: string;
        };
        Returns: Json;
      };
    };
    Enums: { app_role: AppRole };
    CompositeTypes: Record<string, never>;
  };
};
