'use client';

import { createContext, useContext, useEffect, useMemo, useState } from 'react';

const CartContext = createContext(null);

const STORAGE_KEY = 'jasdor-cart-v2';

// Diskon 50% sudah otomatis dipotong di harga (display & calc)
export const DISCOUNT_RATE = 0.5;
export const DISCOUNT_MAX = 35000;
export const DEFAULT_SERVICE_FEE = 7000;

// Harga setelah diskon 50% dengan cap Rp 35.000.
// - Harga ≤ 70.000  → potong 50%
// - Harga > 70.000  → potong Rp 35.000 (max)
export function applyDiscount(price) {
  const n = Number(price) || 0;
  const discount = Math.min(Math.floor(n * DISCOUNT_RATE), DISCOUNT_MAX);
  return n - discount;
}

export function CartProvider({ children }) {
  const [items, setItems] = useState([]);
  const [store, setStore] = useState(null);
  const [pickup, setPickup] = useState({ type: 'now', time: '' });
  const [orderType, setOrderType] = useState('pickup');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [deliveryLocation, setDeliveryLocation] = useState(null); // {lat, lng}
  const [hydrated, setHydrated] = useState(false);
  const [serviceFeeConfig, setServiceFeeConfig] = useState(DEFAULT_SERVICE_FEE);
  const [deliveryConfig, setDeliveryConfig] = useState({
    enabled: false,
    fee: 0,
    outlets: [],
  });

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        setItems(parsed.items || []);
        setStore(parsed.store || null);
        if (parsed.pickup) setPickup(parsed.pickup);
      }
    } catch (_) {}
    setHydrated(true);

    // Fetch fee dari API
    fetch('/api/service-fee')
      .then((r) => r.json())
      .then((j) => {
        if (j.error_code === 0 && j.data?.fee != null) {
          setServiceFeeConfig(j.data.fee);
        }
      })
      .catch(() => {});

    // Fetch delivery config
    fetch('/api/delivery-config')
      .then((r) => r.json())
      .then((j) => {
        if (j.error_code === 0 && j.data) {
          setDeliveryConfig(j.data);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ items, store, pickup }));
  }, [items, store, pickup, hydrated]);

  function addItem(product, storeInfo) {
    setStore((prev) => prev || storeInfo || null);
    setItems((prev) => {
      const existing = prev.find((p) => p.id === product.id);
      if (existing) {
        return prev.map((p) =>
          p.id === product.id ? { ...p, qty: p.qty + 1 } : p
        );
      }
      // Simpan harga asli (orig_price). Diskon dihitung di level cart dengan cap.
      const origPrice = Number(product.price) || 0;
      return [
        ...prev,
        {
          id: product.id,
          name: product.name,
          price: origPrice,        // harga asli (sebelum diskon)
          orig_price: origPrice,   // alias kompatibilitas
          image: product.image,
          product_code: product.product_code,
          variant: product.variant || '',
          addons: product.addons || [],
          notes: product.notes || [],
          qty: 1,
        },
      ];
    });
  }

  function removeItem(id) {
    setItems((prev) => prev.filter((p) => p.id !== id));
  }

  function updateQty(id, qty) {
    setItems((prev) =>
      prev
        .map((p) => (p.id === id ? { ...p, qty: Math.max(0, qty) } : p))
        .filter((p) => p.qty > 0)
    );
  }

  function clear() {
    setItems([]);
    setStore(null);
    setPickup({ type: 'now', time: '' });
    setOrderType('pickup');
    setDeliveryAddress('');
    setDeliveryLocation(null);
  }

  // Subtotal harga normal (sebelum diskon)
  const origSubtotal = useMemo(
    () => items.reduce((acc, p) => acc + Number(p.orig_price || p.price) * p.qty, 0),
    [items]
  );

  // Diskon 50% dengan cap Rp 35.000
  const discountUncapped = Math.floor(origSubtotal * DISCOUNT_RATE);
  const totalDiscount = Math.min(discountUncapped, DISCOUNT_MAX);
  const discountCapped = discountUncapped > DISCOUNT_MAX;

  // Subtotal akhir (setelah diskon dengan cap)
  const subtotal = origSubtotal - totalDiscount;

  const serviceFee = items.length > 0 ? serviceFeeConfig : 0;
  const deliveryAvailable =
    !!deliveryConfig.enabled &&
    !!store?.code &&
    deliveryConfig.outlets.includes(store.code);
  const deliveryFee =
    items.length > 0 && orderType === 'delivery' && deliveryAvailable
      ? deliveryConfig.fee
      : 0;
  const total = subtotal + serviceFee + deliveryFee;
  const totalQty = items.reduce((a, b) => a + b.qty, 0);

  const value = {
    items,
    store,
    setStore,
    pickup,
    setPickup,
    orderType,
    setOrderType,
    deliveryAddress,
    setDeliveryAddress,
    deliveryLocation,
    setDeliveryLocation,
    deliveryAvailable,
    deliveryFee,
    deliveryConfig,
    addItem,
    removeItem,
    updateQty,
    clear,
    subtotal,
    origSubtotal,
    discount: totalDiscount,
    discountCapped,
    serviceFee,
    total,
    totalQty,
    DISCOUNT_RATE,
    DISCOUNT_MAX,
    SERVICE_FEE: serviceFeeConfig,
    applyDiscount,
    hydrated,
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used inside CartProvider');
  return ctx;
}

export function rupiah(n) {
  if (n == null || isNaN(n)) return 'Rp 0';
  return 'Rp ' + Number(n).toLocaleString('id-ID');
}
