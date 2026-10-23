import { list, mutate, record, request, type MeasurementUnit, type Shell, type ShellImage, type ShellLocality, type ShellType, type StockInfo, type StockType } from '../../../shared/api';
import type { InventorySection } from '../types';

export const INVENTORY_ENDPOINTS: Record<InventorySection, string> = {
  shells: '/api/shells',
  'stock-types': '/api/shell-stock-types',
  'shell-types': '/api/shell-types',
  localities: '/api/shell-localities',
  'stock-info': '/api/shell-stocks-info',
  images: '/api/shell-images',
  units: '/api/units',
};

const RECORD_ID_FIELD: Record<InventorySection, string> = {
  shells: 'shell_id',
  'stock-types': 'stock_id',
  'shell-types': 'type_id',
  localities: 'locality_id',
  'stock-info': 'stock_info_id',
  images: 'image_id',
  units: 'id',
};

export function inventoryRecordId(section: InventorySection, item: unknown): string | number {
  const value = (item as Record<string, string | number>)[RECORD_ID_FIELD[section]];
  if (value === undefined) throw new Error('The selected record has no identifier.');
  return value;
}

export function inventoryRecordLabel(section: InventorySection, item: unknown): string {
  const record = item as Record<string, string | null>;
  if (section === 'shells') return record.shell_name || 'this shell';
  if (section === 'localities') return record.locality || 'this locality';
  if (section === 'images') return record.file_name || 'this image';
  if (section === 'units') return record.unit_name || 'this unit';
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
  if (section === 'localities' && search) params.locality = search;
  if (section === 'stock-info' && search) params.shell_id = search;
  if (section === 'images' && search) params.file_name = search;
  if (section === 'units' && search) params.unit_name = search;
  return list<unknown>(INVENTORY_ENDPOINTS[section], params);
}

export async function listInventoryLookups() {
  const [shellPage, stockPage, typePage, localityPage] = await Promise.all([
    list<Shell>('/api/shells', { limit: 100, offset: 0 }),
    list<StockType>('/api/shell-stock-types', { limit: 100, offset: 0 }),
    list<ShellType>('/api/shell-types', { limit: 100, offset: 0 }),
    list<ShellLocality>('/api/shell-localities', { limit: 100, offset: 0 }),
  ]);
  return { shells: shellPage.data, stocks: stockPage.data, types: typePage.data, localities: localityPage.data };
}

export async function getInventoryRecord(section: InventorySection, id: string | number) {
  return record<unknown>(`${INVENTORY_ENDPOINTS[section]}/${encodeURIComponent(String(id))}`);
}

export async function getShellImages(shellId: string) {
  return (await list<ShellImage>('/api/shell-images', { shell_id: shellId, limit: 100, offset: 0, sort_by: 'created_at', sort_order: 'asc' })).data;
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
    for (const field of ['shell_name', 'author', 'deepness', 'from', 'note']) body[field] = values[field] || null;
    body.shell_stock_type_id = values.shell_stock_type_id || null;
    body.shell_type_id = values.shell_type_id || null;
    body.locality_id = values.locality_id || null;
    body.price = values.price === '' ? null : Number(values.price);
    const withUnit = (raw: FormDataEntryValue | undefined, unit: FormDataEntryValue | undefined) => {
      const text = typeof raw === 'string' ? raw.trim() : '';
      const suffix = typeof unit === 'string' ? unit.trim() : '';
      if (!text) return null;
      if (!suffix || text.toLocaleLowerCase().replace(/\s+/g, '').endsWith(suffix.toLocaleLowerCase().replace(/\s+/g, ''))) return text;
      return `${text} ${suffix}`;
    };
    body.shell_weight = withUnit(values.shell_weight, values.shell_weight_unit);
    body.shell_size = withUnit(values.shell_size, values.shell_size_unit);
  } else if (section === 'stock-types') {
    body.stock_name = values.stock_name || null;
  } else if (section === 'shell-types') {
    body.shell_type_name = values.shell_type_name || null;
  } else if (section === 'localities') {
    body.locality = values.locality || null;
  } else if (section === 'units') {
    body = { unit_name: values.unit_name, measurement_for: values.measurement_for };
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

  if (section === 'shells') {
    const files = Array.from((form.querySelector('input[name="shell_images"]') as HTMLInputElement | null)?.files ?? []);
    const mainChoice = String(values.main_image_choice || '');
    const removedIds = JSON.parse(String(values.remove_image_ids || '[]')) as string[];
    const existingIds = JSON.parse(String(values.existing_image_ids || '[]')) as string[];
    const remainingIds = existingIds.filter(id => !removedIds.includes(id));
    const newChoice = mainChoice.match(/^new:(\d+)$/);
    if (!remainingIds.includes(mainChoice) && !(newChoice && Number(newChoice[1]) < files.length)) throw new Error('Select one of the remaining or newly uploaded images as the main image.');
    if (remainingIds.length + files.length < 1) throw new Error('Add at least one shell image before saving.');
    const saved = await mutate<Shell>(endpoint, editing ? 'PATCH' : 'POST', body);
    const shellId = saved.data.shell_id;
    const uploadedIds: string[] = [];
    try {
      const createdImages: ShellImage[] = [];
      for (const file of files) {
        if (file.size > 5 * 1024 * 1024) throw new Error(`${file.name} exceeds the 5 MB limit.`);
        const upload = new FormData(); upload.append('image', file); upload.append('shell_id', shellId);
        const result = await request<{ data: ShellImage }>('/api/shell-images', { method: 'POST', body: upload });
        uploadedIds.push(result.data.image_id); createdImages.push(result.data);
      }
      const mainId = newChoice ? createdImages[Number(newChoice[1])]?.image_id : mainChoice;
      if (!mainId) throw new Error('The selected main image could not be found after upload.');
      await request(`/api/shell-images/${encodeURIComponent(mainId)}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ is_main_image: true }) });
      for (const imageId of removedIds) await request(`/api/shell-images/${encodeURIComponent(imageId)}`, { method: 'DELETE' });
    } catch (error) {
      await Promise.all(uploadedIds.map(imageId => request(`/api/shell-images/${encodeURIComponent(imageId)}`, { method: 'DELETE' }).catch(() => undefined)));
      if (!editing) await request(`/api/shells/${encodeURIComponent(shellId)}`, { method: 'DELETE' }).catch(() => undefined);
      throw error;
    }
    return;
  }
  await mutate(endpoint, editing ? 'PATCH' : 'POST', body);
}

export function deleteInventoryRecord(section: InventorySection, id: string | number) {
  return mutate(`${INVENTORY_ENDPOINTS[section]}/${encodeURIComponent(String(id))}`, 'DELETE');
}

export type InventoryRecord = Shell | StockType | ShellType | ShellLocality | StockInfo | ShellImage;

export async function listUnits() {
  return request<{ data: MeasurementUnit[] }>('/api/units');
}
