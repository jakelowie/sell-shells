import { useEffect, useState, type FormEvent } from 'react';
import { CircleAlert, LoaderCircle, X } from 'lucide-react';
import type { Shell, ShellLocality, ShellType, StockType } from '../../../shared/api';
import type { MeasurementUnit } from '../../../shared/api';
import type { ShellImage } from '../../../shared/api';
import type { InventorySection } from '../types';

type DialogState = { mode: 'create' | 'edit'; item?: Record<string, unknown> };
type Props = {
  section: InventorySection;
  dialog: DialogState;
  shells: Shell[];
  stocks: StockType[];
  types: ShellType[];
  localities: ShellLocality[];
  units: MeasurementUnit[];
  images: ShellImage[];
  saving: boolean;
  error: string;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
};

export default function RecordModal({ section, dialog, shells, stocks, types, localities, units, images, saving, error, onClose, onSubmit }: Props) {
  const edit = dialog.mode === 'edit';
  const item = dialog.item ?? {};
  const field = (name: string) => item[name] ?? '';
  const [stockCount, setStockCount] = useState(String(field('shell_stock')));
  const [piecesPerStock, setPiecesPerStock] = useState(String(field('shell_pcs_per_stock')));
  const [stockTypeId, setStockTypeId] = useState(String(field('shell_stock_id')));
  const [files, setFiles] = useState<File[]>([]);
  const [removedImageIds, setRemovedImageIds] = useState<string[]>([]);
  const [mainChoice, setMainChoice] = useState('');
  const [previews, setPreviews] = useState<string[]>([]);
  const [dirty, setDirty] = useState(false);
  useEffect(() => {
    const available = images.filter(image => !removedImageIds.includes(image.image_id));
    if (!mainChoice && available.some(image => image.is_main_image)) setMainChoice(available.find(image => image.is_main_image)!.image_id);
  }, [images, mainChoice, removedImageIds]);
  useEffect(() => {
    const urls = files.map(file => URL.createObjectURL(file));
    setPreviews(urls);
    return () => urls.forEach(URL.revokeObjectURL);
  }, [files]);

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
  const isPerSet = stocks.find(stock => stock.stock_id === stockTypeId)?.stock_name?.trim().toLocaleLowerCase().includes('set');
  const stock = Number(stockCount), pieces = Number(piecesPerStock);
  const calculatedTotal = isPerSet ? stock / pieces : stock * pieces;
  const computedTotal = stockCount !== '' && piecesPerStock !== '' && (!isPerSet || pieces !== 0) && Number.isFinite(calculatedTotal) ? calculatedTotal : '';
  const close = () => { if (dirty && !saving && !window.confirm('Discard your unsaved changes?')) return; onClose(); };
  const removePendingFile = (index: number, button: HTMLButtonElement) => {
    const input = button.closest('form')?.querySelector('input[name="shell_images"]') as HTMLInputElement | null;
    if (input) { const transfer = new DataTransfer(); files.filter((_, currentIndex) => currentIndex !== index).forEach(file => transfer.items.add(file)); input.files = transfer.files; }
    setDirty(true);
    setFiles(current => current.filter((_, currentIndex) => currentIndex !== index));
    setMainChoice(current => { const selected = current.match(/^new:(\d+)$/); if (!selected) return current; const selectedIndex = Number(selected[1]); if (selectedIndex === index) return ''; return selectedIndex > index ? `new:${selectedIndex - 1}` : current; });
  };

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          close();
        }
      }}
    >
      <form className="modal" onSubmit={onSubmit} onChange={() => setDirty(true)}>
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
            onClick={close}
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

                {input('shell_weight', 'Weight', { placeholder: 'e.g. 20 g' })}
                {select('shell_weight_unit', 'Weight unit (optional)', units.filter(unit => unit.measurement_for === 'weight').map(unit => ({ id: unit.unit_name || '', label: unit.unit_name || '' })))}
                {input('shell_size', 'Size', { placeholder: 'e.g. 5–7 cm, approximately 3, or 2 × 4' })}
                {select('shell_size_unit', 'Size unit (optional)', units.filter(unit => unit.measurement_for === 'size').map(unit => ({ id: unit.unit_name || '', label: unit.unit_name || '' })))}
              </div>

              {select(
                'locality_id',
                'Locality',
                localities.map((locality) => ({
                  id: locality.locality_id,
                  label: locality.locality || locality.locality_id,
                })),
              )}

              <div className="field">
                <span>Shell images</span>
                <input className="file-input" name="shell_images" type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple onChange={event => setFiles(Array.from(event.target.files || []))} />
                <small className="field-hint">JPEG, PNG, WebP or GIF · Up to 5 MB each. Select one main image.</small>
                <input type="hidden" name="main_image_choice" value={mainChoice} />
                <input type="hidden" name="remove_image_ids" value={JSON.stringify(removedImageIds)} />
                <input type="hidden" name="existing_image_ids" value={JSON.stringify(images.map(image => image.image_id))} />
                <div className="shell-image-pending">
                  {images.filter(image => !removedImageIds.includes(image.image_id)).map(image => <div className="shell-image-pending-item" key={image.image_id}>
                    {image.image_url ? <img src={image.image_url} alt={image.file_name || 'Shell image'} /> : <span>{image.file_name || 'Existing image'}</span>}
                    <label><input type="radio" name="main_image_choice_radio" checked={mainChoice === image.image_id} onChange={() => setMainChoice(image.image_id)} /> Main</label>
                    <button type="button" onClick={() => { setDirty(true); setRemovedImageIds(ids => [...ids, image.image_id]); if (mainChoice === image.image_id) setMainChoice(''); }}>Remove</button>
                  </div>)}
                  {files.map((file, index) => <div className="shell-image-pending-item" key={`${file.name}-${index}`}>
                    {previews[index] && <img src={previews[index]} alt={file.name} />}
                    <span>{file.name}</span>
                    <label><input type="radio" name="main_image_choice_radio" checked={mainChoice === `new:${index}`} onChange={() => setMainChoice(`new:${index}`)} /> Main</label>
                    <button type="button" onClick={event => removePendingFile(index, event.currentTarget)}>Remove</button>
                  </div>)}
                </div>
              </div>

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

          {section === 'units' && (
            <>
              {input('unit_name', 'Unit name', { required: true, placeholder: 'e.g. mm, cm, g' })}
              <label className="field"><span>Measurement category</span><select name="measurement_for" defaultValue={String(field('measurement_for') || 'size')} required><option value="size">Size</option><option value="weight">Weight</option></select></label>
            </>
          )}

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

              <label className="field">
                <span>Unit</span>
                <select name="shell_stock_id" value={stockTypeId} onChange={event => setStockTypeId(event.target.value)}>
                  <option value="">Not specified</option>
                  {stocks.map(stock => <option value={stock.stock_id} key={stock.stock_id}>{stock.stock_name || stock.stock_id}</option>)}
                </select>
              </label>

              <div className="field-grid">
                {input('shell_stock', 'Number of stocks', {
                  type: 'number',
                  step: 'any',
                  value: stockCount,
                  onChange: (event) => setStockCount(event.target.value),
                })}

                {input('shell_pcs_per_stock', 'Pieces per unit', {
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
                    {isPerSet ? 'Calculated from stock count ÷ pieces per stock' : 'Calculated from stock count × pieces per stock'}
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
            onClick={close}
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
