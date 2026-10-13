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
        Relationships: [ShellDescriptionStockTypeRelationship, ShellDescriptionTypeRelationship];
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
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
