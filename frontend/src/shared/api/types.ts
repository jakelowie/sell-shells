export type Page<T> = { data: T[]; pagination: { limit: number; offset: number; total: number } };
export type Shell = { shell_id: string; created_at: string; shell_name: string | null; author: string | null; deepness: string | null; from: string | null; note: string | null; is_deleted: boolean | null; shell_stock_type_id: string | null; shell_type_id: string | null; price: number | null; locality_id: string | null; shell_weight: number | null };
export type ShellLocality = { locality_id: string; created_at: string; locality: string | null };
export type StockType = { stock_id: string; created_at: string; stock_name: string | null };
export type ShellType = { type_id: string; created_at: string; shell_type_name: string | null };
export type StockInfo = { stock_info_id: number; created_at: string; shell_id: string | null; shell_stock_id: string | null; shell_stock: number | null; shell_pcs_per_stock: number | null; shell_total_available: number | null };
export type ShellImage = { image_id: string; created_at: string; file_name: string | null; storage_path: string | null; shell_id: string | null; is_main_image: boolean | null; image_url?: string | null; image_url_expires_at?: string | null };
