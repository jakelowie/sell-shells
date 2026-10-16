import { useState, type FormEvent } from 'react';
import { CircleAlert, LoaderCircle, X } from 'lucide-react';
import type { Shell, ShellLocality, ShellType, StockType } from '../../../shared/api';
import type { InventorySection } from '../types';

type DialogState = { mode: 'create' | 'edit'; item?: Record<string, unknown> };
type Props = {
  section: InventorySection;
  dialog: DialogState;
  shells: Shell[];
  stocks: StockType[];
  types: ShellType[];
  localities: ShellLocality[];
  saving: boolean;
  error: string;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
};

export default function RecordModal({ section, dialog, shells, stocks, types, localities, saving, error, onClose, onSubmit }: Props) {
  const edit = dialog.mode === 'edit';
  const item = dialog.item ?? {};
  const field = (name: string) => item[name] ?? '';
  const [stockCount, setStockCount] = useState(String(field('shell_stock')));
  const [piecesPerStock, setPiecesPerStock] = useState(String(field('shell_pcs_per_stock')));

  const input = (name: string, label: string, options: { type?: string; required?: boolean; placeholder?: string; value?: string; onChange?: React.ChangeEventHandler<HTMLInputElement>; step?: string } = {}) => (
    <label className="field">
      <span>{label}</span>
      <input name={name} type={options.type ?? 'text'} defaultValue={options.value === undefined ? String(field(name)) : undefined} value={options.value} onChange={options.onChange} step={options.step} placeholder={options.placeholder} required={options.required} />
    </label>
  );
  const select = (name: string, label: string, options: { id: string; label: string }[], nullable = true) => (
    <label className="field">
      <span>{label}</span>
      <select name={name} defaultValue={String(field(name))}>
        <option value="">{nullable ? 'Not specified' : 'Select an option'}</option>
        {options.map(option => <option value={option.id} key={option.id}>{option.label}</option>)}
      </select>
    </label>
  );
  const recordName = section === 'shells' ? 'shell' : section === 'images' ? 'image' : section === 'stock-info' ? 'stock record' : section === 'stock-types' ? 'stock type' : section === 'shell-types' ? 'shell type' : 'locality';
  const computedTotal = stockCount !== '' && piecesPerStock !== '' && Number.isFinite(Number(stockCount) * Number(piecesPerStock)) ? Number(stockCount) * Number(piecesPerStock) : '';

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <form className="modal" onSubmit={onSubmit}>
        <div className="modal-heading">
          <div>
            <div className="eyebrow">
              {edit ? 'EDIT RECORD' : 'NEW RECORD'}
            </div>
            <h2>
              {edit ? 'Edit' : 'Add'} {recordName}
            </h2>
          </div>

          <button
            type="button"
            className="close-btn"
            aria-label="Close dialog"
            onClick={onClose}
          >
            <X size={19} />
          </button>
        </div>

        <div className="modal-fields">
          {section === 'shells' && (
            <>
              {input('shell_name', 'Shell name', {
                placeholder: 'e.g. Conus textile',
              })}

              <div className="field-grid">
                {input('author', 'Author', {
                  placeholder: 'Species author',
                })}

                {input('deepness', 'Deepness', {
                  placeholder: 'Depth or range',
                })}

                {input('from', 'Source', {
                  placeholder: 'Source or provenance',
                })}

                {input('price', 'Price', {
                  type: 'number',
                  step: 'any',
                  placeholder: 'Amount',
                })}

                {input('shell_weight', 'Weight', {
                  type: 'number',
                  step: 'any',
                  placeholder: 'Weight (unit not specified)',
                })}
              </div>

              {select(
                'locality_id',
                'Locality',
                localities.map((locality) => ({
                  id: locality.locality_id,
                  label: locality.locality || locality.locality_id,
                })),
              )}

              {select(
                'shell_type_id',
                'Shell type',
                types.map((type) => ({
                  id: type.type_id,
                  label: type.shell_type_name || type.type_id,
                })),
              )}

              {select(
                'shell_stock_type_id',
                'Stock type',
                stocks.map((stock) => ({
                  id: stock.stock_id,
                  label: stock.stock_name || stock.stock_id,
                })),
              )}

              <label className="field">
                <span>Note</span>
                <textarea
                  name="note"
                  defaultValue={String(field('note'))}
                  rows={3}
                  placeholder="Additional observations"
                />
              </label>
            </>
          )}

          {section === 'stock-types' &&
            input('stock_name', 'Stock name', {
              placeholder: 'e.g. Small display box',
            })}

          {section === 'shell-types' &&
            input('shell_type_name', 'Shell type name', {
              placeholder: 'e.g. Gastropod',
            })}

          {section === 'localities' &&
            input('locality', 'Locality name', {
              placeholder: 'e.g. Cebu, Philippines',
            })}

          {section === 'stock-info' && (
            <>
              {select(
                'shell_id',
                'Shell',
                shells.map((shell) => ({
                  id: shell.shell_id,
                  label: shell.shell_name || shell.shell_id,
                })),
              )}

              {select(
                'shell_stock_id',
                'Unit',
                stocks.map((stock) => ({
                  id: stock.stock_id,
                  label: stock.stock_name || stock.stock_id,
                }))
              )}

              <div className="field-grid">
                {input('shell_stock', 'Number of stocks', {
                  type: 'number',
                  step: 'any',
                  value: stockCount,
                  onChange: (event) => setStockCount(event.target.value),
                })}

                {input('shell_pcs_per_stock', 'Pieces per stock', {
                  type: 'number',
                  step: 'any',
                  value: piecesPerStock,
                  onChange: (event) =>
                    setPiecesPerStock(event.target.value),
                })}

                <label className="field">
                  <span>Total available</span>
                  <input
                    className="computed-input"
                    type="number"
                    value={computedTotal}
                    readOnly
                  />
                  <small className="field-hint">
                    Calculated from stock count × pieces per stock
                  </small>
                </label>
              </div>
            </>
          )}

          {section === 'images' && (
            <>
              {!edit && (
                <label className="field">
                  <span>Image file</span>
                  <input
                    className="file-input"
                    name="image"
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    required
                  />
                  <small className="field-hint">
                    JPEG, PNG, WebP or GIF · Up to 5 MB
                  </small>
                </label>
              )}

              {edit && input('file_name', 'File name')}

              {select(
                'shell_id',
                'Related shell',
                shells.map((shell) => ({
                  id: shell.shell_id,
                  label: shell.shell_name || shell.shell_id,
                })),
              )}

              <label className="field">
                <span>Main image</span>
                <select
                  name="is_main_image"
                  defaultValue={
                    field('is_main_image') === true
                      ? 'true'
                      : field('is_main_image') === false
                        ? 'false'
                        : ''
                  }
                >
                  <option value="">Not specified</option>
                  <option value="true">Yes, make main</option>
                  <option value="false">No</option>
                </select>
              </label>
            </>
          )}
        </div>

        {error && (
          <div className="error-banner modal-error">
            <CircleAlert size={16} />
            <span>{error}</span>
          </div>
        )}

        <div className="modal-footer">
          <button
            type="button"
            className="secondary"
            onClick={onClose}
          >
            Cancel
          </button>

          <button className="primary" disabled={saving}>
            {saving && (
              <LoaderCircle size={15} className="spin" />
            )}

            {edit
              ? 'Save changes'
              : section === 'images'
                ? 'Upload image'
                : 'Create record'}
          </button>
        </div>
      </form>
    </div>
  );
}
