import { list, record } from './client';
import type { Shell, ShellImage, ShellType } from './types';

const PAGE_SIZE = 100;

export async function getShellTypes() {
  const firstPage = await list<ShellType>('/api/shell-types', {
    limit: PAGE_SIZE, offset: 0, sort_by: 'shell_type_name', sort_order: 'asc',
  });
  const pageCount = Math.ceil(Math.max(0, firstPage.pagination.total - firstPage.data.length) / PAGE_SIZE);
  const remainingPages = await Promise.all(
    Array.from({ length: pageCount }, (_, index) => list<ShellType>('/api/shell-types', {
      limit: PAGE_SIZE, offset: (index + 1) * PAGE_SIZE, sort_by: 'shell_type_name', sort_order: 'asc',
    })),
  );
  return { ...firstPage, data: [...firstPage.data, ...remainingPages.flatMap(page => page.data)] };
}

export function getShellsForType(typeId: string, offset: number, limit: number) {
  return list<Shell>('/api/shells', {
    shell_type_id: typeId, limit, offset, sort_by: 'shell_name', sort_order: 'asc',
  });
}

export function getShellById(shellId: string) {
  return record<Shell>(`/api/shells/${encodeURIComponent(shellId)}`);
}

export async function getAllImagesForShell(shellId: string) {
  const firstPage = await list<ShellImage>('/api/shell-images', {
    shell_id: shellId, limit: PAGE_SIZE, offset: 0, sort_by: 'created_at', sort_order: 'desc',
  });
  const pageCount = Math.ceil(Math.max(0, firstPage.pagination.total - firstPage.data.length) / PAGE_SIZE);
  const remainingPages = await Promise.all(
    Array.from({ length: pageCount }, (_, index) => list<ShellImage>('/api/shell-images', {
      shell_id: shellId, limit: PAGE_SIZE, offset: (index + 1) * PAGE_SIZE, sort_by: 'created_at', sort_order: 'desc',
    })),
  );
  return [...firstPage.data, ...remainingPages.flatMap(page => page.data)];
}
