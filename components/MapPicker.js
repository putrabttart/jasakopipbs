'use client';

import { useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { Icon } from './Icons';

// Leaflet harus di-load client-side only (browser API)
const Map = dynamic(() => import('./MapInner'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-64 bg-ink-100 grid place-items-center rounded-xl">
      <Icon.Spinner size={20} className="text-ink-400" />
    </div>
  ),
});

const DEFAULT_CENTER = { lat: -6.2, lng: 106.8166 }; // Jakarta

export default function MapPicker({ value, onChange, storeLat, storeLng }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [showResults, setShowResults] = useState(false);

  // Default center: kalau value ada → pakai value, kalau ada store → pakai store, default Jakarta
  const initialCenter = value?.lat
    ? { lat: value.lat, lng: value.lng }
    : storeLat && storeLng
    ? { lat: Number(storeLat), lng: Number(storeLng) }
    : DEFAULT_CENTER;

  const [center, setCenter] = useState(initialCenter);
  const [marker, setMarker] = useState(value?.lat ? { lat: value.lat, lng: value.lng } : initialCenter);

  // Reverse geocode (lat,lng -> address) saat marker pindah
  async function reverseGeocode(lat, lng) {
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&accept-language=id`
      );
      const data = await res.json();
      const address = data.display_name || '';
      onChange?.({ lat, lng, address });
    } catch (_) {
      onChange?.({ lat, lng, address: '' });
    }
  }

  // Search alamat (geocoding)
  async function searchAddress() {
    if (!searchQuery.trim()) return;
    setSearching(true);
    setShowResults(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
          searchQuery + ', Indonesia'
        )}&accept-language=id&limit=5`
      );
      const data = await res.json();
      setSearchResults(Array.isArray(data) ? data : []);
    } catch (_) {
      setSearchResults([]);
    }
    setSearching(false);
  }

  function selectResult(result) {
    const lat = parseFloat(result.lat);
    const lng = parseFloat(result.lon);
    setCenter({ lat, lng });
    setMarker({ lat, lng });
    onChange?.({ lat, lng, address: result.display_name });
    setShowResults(false);
    setSearchQuery('');
  }

  function useCurrentLocation() {
    if (!navigator.geolocation) {
      alert('Browser tidak mendukung geolocation');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setCenter({ lat, lng });
        setMarker({ lat, lng });
        reverseGeocode(lat, lng);
      },
      () => alert('Gagal mendapatkan lokasi. Pastikan izin lokasi diberikan.')
    );
  }

  function handleMapClick(latlng) {
    setMarker(latlng);
    reverseGeocode(latlng.lat, latlng.lng);
  }

  return (
    <div className="space-y-2">
      {/* Search bar */}
      <div className="flex gap-2">
        <div className="flex-1 flex items-center gap-2 bg-ink-50 border border-ink-200 rounded-xl px-3 py-2.5 focus-within:border-ink-900 transition">
          <Icon.Search size={14} className="text-ink-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), searchAddress())}
            placeholder="Cari alamat..."
            className="flex-1 bg-transparent text-sm outline-none"
          />
        </div>
        <button
          type="button"
          onClick={useCurrentLocation}
          className="bg-white border border-ink-200 hover:border-ink-900 text-ink-900 rounded-xl px-3 transition"
          title="Gunakan lokasi saya"
        >
          <Icon.Pin size={16} />
        </button>
      </div>

      {/* Search results */}
      {showResults && (
        <div className="rounded-xl bg-white border border-ink-200 max-h-48 overflow-y-auto scrollbar-thin">
          {searching ? (
            <div className="p-4 text-center">
              <Icon.Spinner size={16} className="mx-auto text-ink-400" />
            </div>
          ) : searchResults.length === 0 ? (
            <p className="p-4 text-center text-xs text-ink-500">Tidak ditemukan</p>
          ) : (
            searchResults.map((r, i) => (
              <button
                key={i}
                type="button"
                onClick={() => selectResult(r)}
                className="w-full text-left px-3 py-2 text-xs hover:bg-ink-50 border-b border-ink-100 last:border-0 transition"
              >
                {r.display_name}
              </button>
            ))
          )}
        </div>
      )}

      {/* Map */}
      <div className="rounded-xl overflow-hidden border border-ink-200">
        <Map center={center} marker={marker} onMapClick={handleMapClick} />
      </div>

      {/* Selected address */}
      {value?.address && (
        <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3 flex items-start gap-2">
          <Icon.Pin size={14} className="text-emerald-600 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-[10px] uppercase tracking-wider text-emerald-700 font-bold">
              Lokasi Terpilih
            </p>
            <p className="text-xs text-ink-900 mt-0.5 leading-relaxed">{value.address}</p>
            {value.lat && (
              <a
                href={`https://www.google.com/maps?q=${value.lat},${value.lng}`}
                target="_blank"
                rel="noreferrer"
                className="text-[10px] text-emerald-700 hover:underline inline-flex items-center gap-1 mt-1"
              >
                Buka di Google Maps <Icon.ExternalLink size={10} />
              </a>
            )}
          </div>
        </div>
      )}

      <p className="text-[10px] text-ink-500 leading-relaxed">
        💡 Tap pin di peta untuk pindahkan, cari alamat, atau gunakan lokasi saya.
      </p>
    </div>
  );
}
