# Payment Logos

Folder ini untuk menyimpan file logo asli dari penyedia pembayaran.

## Cara pakai

1. Download file PNG/SVG logo dari sumber resmi atau Google Image
2. Simpan di folder ini dengan nama:
   - `gopay.png`
   - `ovo.png`
   - `dana.png`
   - `shopeepay.png`
   - `linkaja.png`
   - `bca.png`
   - `mandiri.png`
   - `bni.png`
   - `bri.png`

3. Update `components/PaymentLogos.js`:

```js
export const PAYMENT_METHODS = [
  { name: 'GoPay', url: '/payment-logos/gopay.png' },
  { name: 'OVO', url: '/payment-logos/ovo.png' },
  { name: 'DANA', url: '/payment-logos/dana.png' },
  { name: 'ShopeePay', url: '/payment-logos/shopeepay.png' },
  { name: 'LinkAja', url: '/payment-logos/linkaja.png' },
  { name: 'BCA', url: '/payment-logos/bca.png' },
  { name: 'Mandiri', url: '/payment-logos/mandiri.png' },
  { name: 'BNI', url: '/payment-logos/bni.png' },
  { name: 'BRI', url: '/payment-logos/bri.png' },
];
```

4. Update render di `app/payment/[token]/page.js`:

```jsx
{PAYMENT_METHODS.map((method) => (
  <div key={method.name} className="bg-white border border-ink-200 rounded-lg h-10 flex items-center justify-center px-2">
    <img src={method.url} alt={method.name} className="max-h-6 max-w-full object-contain" />
  </div>
))}
```

## Sumber rekomendasi

- **brandeps.com** — banyak logo brand Indonesia
- **seeklogo.com** — koleksi logo lengkap
- **vectorlogo.zone** — SVG logos
- Cari di Google: `[brand] logo png transparent`
