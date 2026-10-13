import { list, mutate, record, request, type Shell, type ShellImage, type ShellType, type StockInfo, type StockType } from '../../../shared/api';
import type { InventorySection } from '../types';

export const INVENTORY_ENDPOINTS: Record<InventorySection, string> = {
  shells: '/api/shells',
  'stock-types': '/api/shell-stock-types',
  'shell-types': '/api/shell-types',
  'stock-info': '/api/shell-stocks-info',
  images: '/api/shell-images',
};

const RECORD_ID_FIELD: Record<InventorySection, string> = {
  shells: 'shell_id',
  'stock-types': 'stock_id',
  'shell-types': 'type_id',
  'stock-info': 'stock_info_id',
  images: 'image_id',
};

export function inventoryRecordId(section: InventorySection, item: unknown): string | number {
  const value = (item as Record<string, string | number>)[RECORD_ID_FIELD[section]];
  if (value === undefined) throw new Error('The selected record has no identifier.');
  return value;
}

export function inventoryRecordLabel(section: InventorySection, item: unknown): string {
  const record = item as Record<string, string | null>;
  if (section === 'shells') return record.shell_name || 'this shell';
  if (section === 'images') return record.file_name || 'this image';
  return 'this record';
}

export async function listInventory(section: InventorySection, page: number, pageSize: number, search: string, includeDeleted: boolean) {
  const params: Record<string, string | number | boolean | undefined> = {
    limit: pageSize,
    offset: page * pageSize,
    sort_by: 'created_at',
    sort_order: 'desc',
  };
  if (section === 'shells') {
    if (search) params.shell_name = search;
    if (includeDeleted) params.include_deleted = true;
  }
  if (section === 'stock-types' && search) params.stock_name = search;
  if (section === 'shell-types' && search) params.shell_type_name = search;
  if (section === 'stock-info' && search) params.shell_id = search;
  if (section === 'images' && search) params.file_name = search;
  return list<unknown>(INVENTORY_ENDPOINTS[section], params);
}

export async function listInventoryLookups() {
  const [shellPage, stockPage, typePage] = await Promise.all([
    list<Shell>('/api/shells', { limit: 100, offset: 0 }),
    list<StockType>('/api/shell-stock-types', { limit: 100, offset: 0 }),
    list<ShellType>('/api/shell-types', { limit: 100, offset: 0 }),
  ]);
  return { shells: shellPage.data, stocks: stockPage.data, types: typePage.data };
}

export async function getInventoryRecord(section: InventorySection, id: string | number) {
  return record<unknown>(`${INVENTORY_ENDPOINTS[section]}/${encodeURIComponent(String(id))}`);
}

export async function saveInventoryRecord(section: InventorySection, form: HTMLFormElement, dialog: { mode: 'create' | 'edit'; item?: Record<string, unknown> }) {
  const values = Object.fromEntries(new FormData(form).entries());
  const editing = dialog.mode === 'edit';
  const recordId = dialog.item?.[RECORD_ID_FIELD[section]];
  let body: Record<string, unknown> = {};
  let endpoint = INVENTORY_ENDPOINTS[section];

  if (editing) {
    if (recordId === undefined) throw new Error('The selected record has no identifier.');
    endpoint += `/${encodeURIComponent(String(recordId))}`;
  }

  if (section === 'shells') {
    for (const field of ['shell_name', 'author', 'locality', 'deepness', 'from', 'note']) body[field] = values[field] || null;
    body.shell_stock_type_id = values.shell_stock_type_id || null;
    body.shell_type_id = values.shell_type_id || null;
  } else if (section === 'stock-types') {
    body.stock_name = values.stock_name || null;
  } else if (section === 'shell-types') {
    body.shell_type_name = values.shell_type_name || null;
  } else if (section === 'stock-info') {
    body = { shell_id: values.shell_id || null, shell_stock_id: values.shell_stock_id || null };
    for (const field of ['shell_stock', 'shell_pcs_per_stock']) body[field] = values[field] === '' ? null : Number(values[field]);
  } else if (editing) {
    body = {
      file_name: values.file_name || null,
      shell_id: values.shell_id || null,
      is_main_image: values.is_main_image === '' ? null : values.is_main_image === 'true',
    };
  } else {
    const file = (form.querySelector('input[type=file]') as HTMLInputElement | null)?.files?.[0];
    if (!file) throw new Error('Choose an image to upload.');
    if (file.size > 5 * 1024 * 1024) throw new Error('Image must be 5 MB or smaller.');
    const upload = new FormData();
    upload.append('image', file);
    if (values.shell_id) upload.append('shell_id', String(values.shell_id));
    if (values.is_main_image) upload.append('is_main_image', String(values.is_main_image));
    await request(endpoint, { method: 'POST', body: upload });
    return;
  }

  await mutate(endpoint, editing ? 'PATCH' : 'POST', body);
}

export function deleteInventoryRecord(section: InventorySection, id: string | number) {
  return mutate(`${INVENTORY_ENDPOINTS[section]}/${encodeURIComponent(String(id))}`, 'DELETE');
}

export type InventoryRecord = Shell | StockType | ShellType | StockInfo | ShellImage;
