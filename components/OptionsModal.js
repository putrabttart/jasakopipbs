'use client';

import { useEffect, useMemo, useState } from 'react';
import { rupiah, useCart, applyDiscount } from './CartContext';
import { fetchOptions } from './productOptions';
import { Icon } from './Icons';

export default function OptionsModal({ product, storeCode, store, prefetchedData, checkDiscountCap, onClose, onAdded }) {
  const [data, setData] = useState(prefetchedData || null);
  const [loading, setLoading] = useState(!prefetchedData);
  const [error, setError] = useState('');
  const [qty, setQty] = useState(1);

  const [dimSel, setDimSel] = useState({});
  const [noteSel, setNoteSel] = useState({});
  const [addonSel, setAddonSel] = useState({});

  const { addItem } = useCart();

  useEffect(() => {
    if (!product) return;
    if (data) {
      // sudah ada prefetch, set defaults
      applyDefaults(data);
      return;
    }
    let cancel = false;
    async function load() {
      setLoading(true);
      setError('');
      try {
        const fetched = await fetchOptions(product, storeCode);
        if (cancel) return;
        setData(fetched);
        applyDefaults(fetched);
      } catch (e) {
        if (!cancel) setError(e.message || 'Terjadi kesalahan');
      } finally {
        if (!cancel) setLoading(false);
      }
    }
    load();
    return () => {
      cancel = true;
    };
    // eslint-disable-next-line
  }, [product, storeCode]);

  function applyDefaults(d) {
    const defDim = {};
    const impact = d.default_selection_impact_sku || {};
    Object.keys(impact).forEach((k) => {
      defDim[k] = Number(impact[k]);
    });
    setDimSel(defDim);

    const defNote = {};
    const dn = d.default_selection_notes || {};
    Object.keys(dn).forEach((k) => {
      defNote[k] = Number(dn[k]);
    });
    setNoteSel(defNote);
  }

  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') onClose?.();
    }
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  const dimensions = data?.product_dimension_wording?.dimension_wordings || [];
  const addons = data?.product_addon_wording?.addon_wordings || [];
  const notes = data?.notes || [];

  const optionKey = useMemo(() => {
    if (!dimensions.length) return '';
    const sorted = [...dimensions].sort((a, b) => a.dimension_code - b.dimension_code);
    let key = '';
    for (const dim of sorted) {
      const v = dimSel[dim.dimension_code];
      if (v == null) return '';
      key += `${dim.dimension_code}-${v}:`;
    }
    return key;
  }, [dimensions, dimSel]);

  const matched = data?.option_product_map?.[optionKey];
  const basePrice = matched ? Number(matched.price) : Number(data?.base_product?.price) || 0;

  const addonTotal = useMemo(() => {
    let sum = 0;
    for (const dim of addons) {
      for (const v of dim.dimension_value_wordings || []) {
        if (addonSel[v.addon_sku]) sum += Number(v.addon_price) || 0;
      }
    }
    return sum;
  }, [addons, addonSel]);

  const unitPrice = basePrice + addonTotal;
  const totalPrice = unitPrice * qty;
  // Tampilan estimasi setelah diskon (sebelum cap di cart level)
  const totalPriceAfterDiscount = applyDiscount(totalPrice);

  const summary = useMemo(() => {
    const parts = [];
    if (matched?.display_description) parts.push(matched.display_description);

    for (const n of notes) {
      for (const g of n.groups || []) {
        if (isInvisible(g.invisible_when, dimSel)) continue;
        const v = noteSel[g.option_type];
        if (v == null) continue;
        const idx = (g.values || []).indexOf(v);
        if (idx >= 0) parts.push(g.value_texts[idx]);
      }
    }

    const addonNames = [];
    for (const dim of addons) {
      for (const v of dim.dimension_value_wordings || []) {
        if (addonSel[v.addon_sku]) addonNames.push(v.value_text);
      }
    }
    if (addonNames.length) parts.push(addonNames.join(' + '));

    return parts.filter(Boolean).join(', ');
  }, [matched, notes, dimSel, noteSel, addons, addonSel]);

  function toggleAddon(sku) {
    setAddonSel((prev) => ({ ...prev, [sku]: !prev[sku] }));
  }

  function handleAdd() {
    if (!data) return;
    if (!optionKey || !matched) {
      alert('Lengkapi pilihan terlebih dahulu');
      return;
    }

    const doAdd = () => {
      // Selected addon list (untuk identitas unik & info)
      const selectedAddons = [];
      for (const dim of addons) {
        for (const v of dim.dimension_value_wordings || []) {
          if (addonSel[v.addon_sku]) {
            selectedAddons.push({
              sku: v.addon_sku,
              name: v.value_text,
              price: Number(v.addon_price) || 0,
            });
          }
        }
      }

      // Notes selected (visible)
      const selectedNotes = [];
      for (const n of notes) {
        for (const g of n.groups || []) {
          if (isInvisible(g.invisible_when, dimSel)) continue;
          const v = noteSel[g.option_type];
          if (v == null) continue;
          const idx = (g.values || []).indexOf(v);
          if (idx >= 0) {
            selectedNotes.push({
              option: g.option_name,
              value: g.value_texts[idx],
            });
          }
        }
      }

      const addonIds = selectedAddons.map((a) => a.sku).sort().join('-');
      const noteIds = selectedNotes.map((n) => n.value).join('-');
      const uniqueId = `${matched.product_code}_${addonIds}_${noteIds}`;

      const productForCart = {
        id: uniqueId,
        name: product.name,
        product_code: matched.product_code,
        price: unitPrice,
        image: product.image,
        variant: summary,
        addons: selectedAddons,
        notes: selectedNotes,
      };

      for (let i = 0; i < qty; i++) {
        addItem(productForCart, store);
      }

      onAdded?.();
      onClose?.();
    };

    // Jika parent menyediakan checkDiscountCap, biarkan parent yang tampilkan modal.
    if (checkDiscountCap) {
      checkDiscountCap(unitPrice, qty, doAdd);
    } else {
      doAdd();
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center">
      <div
        className="absolute inset-0 bg-ink-900/50 backdrop-blur-sm"
        onClick={onClose}
      />

      <div className="relative w-full md:max-w-2xl bg-white rounded-t-3xl md:rounded-3xl shadow-2xl max-h-[92vh] md:max-h-[88vh] flex flex-col fade-up overflow-hidden">
        {/* header */}
        <div className="relative">
          <div className="aspect-[16/9] md:aspect-[21/9] bg-ink-100 overflow-hidden">
            {product?.image ? (
              <img
                src={product.image}
                alt={product.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-ink-400">
                <Icon.Coffee size={56} />
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
          </div>
          <button
            onClick={onClose}
            className="absolute top-3 right-3 w-9 h-9 rounded-full bg-white shadow-soft hover:bg-ink-100 flex items-center justify-center transition text-ink-900"
            aria-label="Tutup"
          >
            <Icon.Close size={18} strokeWidth={2.4} />
          </button>
          <div className="absolute bottom-3 left-4 right-4 text-white">
            <h2 className="text-lg md:text-xl font-bold leading-tight">{product?.name}</h2>
            {data?.base_product?.description && (
              <p className="text-xs opacity-90 line-clamp-2 mt-0.5">{data.base_product.description}</p>
            )}
          </div>
        </div>

        {/* body */}
        <div className="flex-1 overflow-y-auto px-4 md:px-6 py-5 scrollbar-thin">
          {loading && (
            <div className="space-y-3">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-16 rounded-xl shimmer" />
              ))}
            </div>
          )}

          {error && !loading && (
            <div className="rounded-xl bg-red-50 border border-red-200 p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {!loading && !error && data && (
            <div className="space-y-5">
              {dimensions.map((dim) => (
                <DimensionGroup
                  key={dim.dimension_code}
                  dim={dim}
                  selected={dimSel[dim.dimension_code]}
                  onSelect={(v) =>
                    setDimSel((prev) => ({ ...prev, [dim.dimension_code]: v }))
                  }
                />
              ))}

              {notes.map((n, ni) => (
                <div key={ni}>
                  {n.title && <p className="text-xs font-semibold text-ink-900 mb-2">{n.title}</p>}
                  {(n.groups || []).map((g) => {
                    if (isInvisible(g.invisible_when, dimSel)) return null;
                    return (
                      <NoteGroup
                        key={g.option_type}
                        group={g}
                        selected={noteSel[g.option_type]}
                        onSelect={(v) =>
                          setNoteSel((prev) => ({ ...prev, [g.option_type]: v }))
                        }
                      />
                    );
                  })}
                </div>
              ))}

              {/* Divider antara wajib dan opsional */}
              {addons.length > 0 && (
                <div className="flex items-center gap-3 pt-2">
                  <div className="flex-1 h-px bg-ink-200" />
                  <span className="text-[10px] text-ink-400 uppercase tracking-wider font-bold">
                    Tambahan Opsional
                  </span>
                  <div className="flex-1 h-px bg-ink-200" />
                </div>
              )}

              {addons.map((dim) => (
                <AddonGroup
                  key={dim.dimension_code}
                  dim={dim}
                  selected={addonSel}
                  onToggle={toggleAddon}
                />
              ))}
            </div>
          )}
        </div>

        {/* footer */}
        {!loading && !error && data && (
          <div
            className="border-t border-ink-200 bg-white px-4 md:px-6 py-2.5 flex items-center gap-2"
            style={{ paddingBottom: 'max(0.625rem, env(safe-area-inset-bottom))' }}
          >
            <div className="flex items-center gap-1.5 bg-ink-100 rounded-full p-1 shrink-0">
              <button
                onClick={() => setQty((q) => Math.max(1, q - 1))}
                className="w-7 h-7 rounded-full bg-white border border-ink-200 hover:border-ink-900 text-ink-900 font-semibold flex items-center justify-center active:scale-90 transition"
                aria-label="Kurangi"
              >
                −
              </button>
              <span className="text-xs font-bold w-4 text-center text-ink-900">{qty}</span>
              <button
                onClick={() => setQty((q) => q + 1)}
                className="w-7 h-7 rounded-full bg-ink-900 hover:bg-ink-800 text-white font-semibold flex items-center justify-center active:scale-90 transition"
                aria-label="Tambah"
              >
                +
              </button>
            </div>
            <button
              onClick={handleAdd}
              disabled={!matched}
              className="flex-1 bg-ink-900 text-white rounded-xl py-2.5 px-3 hover:bg-ink-800 disabled:bg-ink-300 active:scale-95 transition flex items-center justify-between font-semibold text-xs gap-2"
            >
              <span>Tambah</span>
              <span className="flex items-baseline gap-1">
                {totalPrice > totalPriceAfterDiscount && (
                  <span className="text-[10px] line-through opacity-60 font-normal">
                    {rupiah(totalPrice)}
                  </span>
                )}
                <span>{rupiah(totalPriceAfterDiscount)}</span>
              </span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function isInvisible(invisible_when, dimSel) {
  if (!invisible_when) return false;
  return Object.keys(invisible_when).every(
    (k) => Number(dimSel[k]) === Number(invisible_when[k])
  );
}

function DimensionGroup({ dim, selected, onSelect }) {
  const items = dim.dimension_value_wordings || [];
  // Grid 2 kolom kalau item <=2, 3 kolom kalau >=3
  const gridCols = items.length <= 2 ? 'grid-cols-2' : 'grid-cols-3';

  return (
    <div>
      <div className="flex items-baseline justify-between mb-3">
        <p className="text-sm font-bold text-ink-900">{dim.dimension_text}</p>
        <span className="text-[10px] text-red-500 font-bold uppercase tracking-wider">Wajib</span>
      </div>
      <div className={'grid gap-2 ' + gridCols}>
        {items.map((v) => {
          const active = Number(selected) === Number(v.value);
          return (
            <button
              key={v.value}
              onClick={() => onSelect(v.value)}
              className={
                'relative rounded-xl border-2 p-3 flex flex-col items-center gap-1.5 transition active:scale-95 ' +
                (active
                  ? 'border-ink-900 bg-ink-900 text-white shadow-md'
                  : 'border-ink-200 bg-white text-ink-700 hover:border-ink-400')
              }
            >
              {active && (
                <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-white text-ink-900 grid place-items-center">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 6 9 17l-5-5" />
                  </svg>
                </span>
              )}
              {v.icon && (
                <img
                  src={v.icon}
                  alt={v.value_text}
                  className={'w-7 h-7 object-contain ' + (active ? 'brightness-0 invert' : '')}
                />
              )}
              <span className="text-xs font-semibold text-center leading-tight">
                {v.value_text}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function NoteGroup({ group, selected, onSelect }) {
  const items = group.values || [];
  const gridCols = items.length <= 2 ? 'grid-cols-2' : 'grid-cols-3';

  return (
    <div className="mt-5">
      <div className="flex items-baseline justify-between mb-3">
        <p className="text-sm font-bold text-ink-900">{group.option_name}</p>
      </div>
      <div className={'grid gap-2 ' + gridCols}>
        {items.map((val, i) => {
          const active = Number(selected) === Number(val);
          return (
            <button
              key={val}
              onClick={() => onSelect(val)}
              className={
                'relative rounded-xl border-2 p-3 text-xs font-semibold transition active:scale-95 ' +
                (active
                  ? 'border-ink-900 bg-ink-900 text-white shadow-md'
                  : 'border-ink-200 bg-white text-ink-700 hover:border-ink-400')
              }
            >
              {active && (
                <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-white text-ink-900 grid place-items-center">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 6 9 17l-5-5" />
                  </svg>
                </span>
              )}
              {group.value_texts[i]}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function AddonGroup({ dim, selected, onToggle }) {
  return (
    <div>
      <div className="flex items-baseline justify-between mb-3">
        <p className="text-sm font-bold text-ink-900">{dim.dimension_text}</p>
        <span className="text-[10px] text-ink-500 font-semibold uppercase tracking-wider">
          Opsional
        </span>
      </div>
      <div className="space-y-2">
        {(dim.dimension_value_wordings || []).map((v) => {
          const active = !!selected[v.addon_sku];
          return (
            <button
              key={v.addon_sku}
              onClick={() => onToggle(v.addon_sku)}
              className={
                'w-full rounded-xl border-2 p-2.5 flex items-center gap-3 text-left transition active:scale-[.98] ' +
                (active
                  ? 'border-ink-900 bg-ink-50'
                  : 'border-ink-200 bg-white hover:border-ink-400')
              }
            >
              <div
                className={
                  'w-5 h-5 rounded-md border-2 shrink-0 grid place-items-center transition ' +
                  (active ? 'border-ink-900 bg-ink-900' : 'border-ink-300 bg-white')
                }
              >
                {active && (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 6 9 17l-5-5" />
                  </svg>
                )}
              </div>

              {v.value_icon && (
                <div className="w-10 h-10 rounded-lg bg-white border border-ink-200 overflow-hidden shrink-0">
                  <img
                    src={v.value_icon}
                    alt={v.value_text}
                    className="w-full h-full object-cover"
                  />
                </div>
              )}

              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-ink-900 truncate">
                  {v.value_text}
                </p>
              </div>

              <div className="shrink-0 text-right">
                <p
                  className={
                    'text-xs font-bold ' +
                    (active ? 'text-ink-900' : 'text-accent-600')
                  }
                >
                  +{rupiah(v.addon_price)}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
