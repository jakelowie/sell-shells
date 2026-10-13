import { Image as ImageIcon } from 'lucide-react';
import type { Shell, ShellType, StockType } from '../../../shared/api';
import type { InventorySection } from '../types';

type Row = Record<string, unknown>;
type TableConfig = {
  columns: string[];
  id: string;
  title: (row: Row) => string;
  subtitle: (row: Row) => string;
  values: (row: Row) => string[];
};

type Props = {
  section: InventorySection;
  data: unknown[];
  shells: Shell[];
  stocks: StockType[];
  types: ShellType[];
  onEdit: (record: unknown) => void;
  onDelete: (record: unknown) => void;
};

const textValue = (value: unknown, fallback = '—') => typeof value === 'string' && value ? value : fallback;
const dateValue = (row: Row) => new Date(String(row.created_at)).toLocaleDateString();
const shellName = (id: unknown, shells: Shell[]) => shells.find(shell => shell.shell_id === id)?.shell_name || '—';

export default function InventoryTable({ section, data, shells, stocks, types, onEdit, onDelete }: Props) {
  const config: Record<InventorySection, TableConfig> = {
    shells: {
      columns: ['SHELL', 'AUTHOR', 'LOCALITY', 'TYPE', 'STOCK TYPE', 'ADDED'],
      id: 'shell_id', title: row => textValue(row.shell_name, 'Untitled shell'), subtitle: row => textValue(row.from, 'Origin not recorded'),
      values: row => [textValue(row.author), textValue(row.locality), types.find(type => type.type_id === row.shell_type_id)?.shell_type_name || '—', stocks.find(stock => stock.stock_id === row.shell_stock_type_id)?.stock_name || '—', dateValue(row)],
    },
    'stock-types': {
      columns: ['STOCK TYPE', 'ID', 'CREATED'], id: 'stock_id', title: row => textValue(row.stock_name, 'Unnamed stock type'), subtitle: () => '',
      values: row => [textValue(row.stock_id), dateValue(row)],
    },
    'shell-types': {
      columns: ['SHELL TYPE', 'ID', 'CREATED'], id: 'type_id', title: row => textValue(row.shell_type_name, 'Unnamed shell type'), subtitle: () => '',
      values: row => [textValue(row.type_id), dateValue(row)],
    },
    'stock-info': {
      columns: ['SHELL', 'STOCK TYPE', 'STOCKS', 'PCS / STOCK', 'TOTAL AVAILABLE', 'CREATED'], id: 'stock_info_id', title: row => shellName(row.shell_id, shells), subtitle: row => `Record #${String(row.stock_info_id ?? '')}`,
      values: row => [stocks.find(stock => stock.stock_id === row.shell_stock_id)?.stock_name || '—', String(row.shell_stock ?? '—'), String(row.shell_pcs_per_stock ?? '—'), String(row.shell_total_available ?? '—'), dateValue(row)],
    },
    images: {
      columns: ['IMAGE', 'FILE NAME', 'SHELL', 'MAIN IMAGE', 'UPLOADED'], id: 'image_id', title: row => textValue(row.file_name, 'Untitled image'), subtitle: row => textValue(row.image_id),
      values: row => [shellName(row.shell_id, shells), row.is_main_image ? 'Main image' : '—', dateValue(row)],
    },
  };
  const table = config[section];

  return (
    <div className="table-wrap">
      <table>
        <thead><tr>{table.columns.map(column => <th key={column}>{column}</th>)}<th className="actions-heading">ACTIONS</th></tr></thead>
        <tbody>{data.map(raw => {
          const row = raw as Row;
          const key = String(row[table.id] ?? '');
          const imageUrl = typeof row.image_url === 'string' ? row.image_url : '';
          return (
            <tr key={key}>
              {section === 'images' ? <>
                <td><div className="image-cell">{imageUrl ? <img src={imageUrl} alt={textValue(row.file_name, 'Shell')} /> : <div className="image-placeholder"><ImageIcon size={17} /></div>}</div></td>
                <td><div className="primary-cell">{table.title(row)}</div><div className="secondary-cell">{table.subtitle(row)}</div></td>
                <td>{shellName(row.shell_id, shells)}</td>
                <td>{row.is_main_image ? <span className="pill main-pill">Main</span> : '—'}</td>
                <td>{dateValue(row)}</td>
              </> : <>
                <td><div className="primary-cell">{table.title(row)}</div><div className="secondary-cell">{table.subtitle(row)}</div></td>
                {table.values(row).map((value, index) => <td key={`${table.id}-${index}`}>{section === 'shells' && index === 3 ? <span className="pill">{value}</span> : section === 'stock-info' && index === 3 ? <span className="quantity">{value}</span> : value}</td>)}
              </>}
              <td><div className="row-actions"><button onClick={() => onEdit(raw)}>Edit</button><button className="delete-btn" onClick={() => onDelete(raw)} aria-label="Delete record">×</button></div></td>
            </tr>
          );
        })}</tbody>
      </table>
    </div>
  );
}
