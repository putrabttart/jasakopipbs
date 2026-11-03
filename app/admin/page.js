'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import AdminLayout from '@/components/AdminLayout';
import { Icon } from '@/components/Icons';

function rupiah(n) {
  if (n == null || isNaN(n)) return 'Rp 0';
  return 'Rp ' + Number(n).toLocaleString('id-ID');
}

export default function AdminDashboard() {
  return (
    <AdminLayout title="Dashboard">
      <DashboardContent />
    </AdminLayout>
  );
}

function DashboardContent() {
  const [stats, setStats] = useState({
    pending: 0,
    processing: 0,
    ready: 0,
    done: 0,
    today: 0,
    revenue: 0,
    revenueWeek: 0,
  });
  const [recent, setRecent] = useState([]);
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 30000);
    return () => clearInterval(interval);
  }, []);

  async function loadData() {
    const pw = sessionStorage.getItem('admin-auth') || '';
    try {
      const ordersRes = await fetch('/api/orders', {
        headers: { 'x-admin-password': pw },
      });
      const ordersJson = await ordersRes.json();
      if (ordersJson.error_code === 0) {
        const orders = ordersJson.data || [];
        const today = new Date().toDateString();
        const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

        setStats({
          pending: orders.filter((o) => o.status === 'pending').length,
          processing: orders.filter((o) => o.status === 'processing').length,
          ready: orders.filter((o) => o.status === 'ready').length,
          done: orders.filter((o) => o.status === 'done').length,
          today: orders.filter(
            (o) => new Date(o.created_at).toDateString() === today
          ).length,
          revenue: orders
            .filter(
              (o) =>
                o.status !== 'cancelled' &&
                new Date(o.created_at).toDateString() === today
            )
            .reduce((sum, o) => sum + (o.data?.totalToPay || o.data?.total || 0), 0),
          revenueWeek: orders
            .filter(
              (o) =>
                o.status !== 'cancelled' &&
                new Date(o.created_at).getTime() >= weekAgo
            )
            .reduce((sum, o) => sum + (o.data?.totalToPay || o.data?.total || 0), 0),
        });

        setRecent(orders.slice(0, 5));
      }

      const statusRes = await fetch('/api/service-status');
      const statusJson = await statusRes.json();
      if (statusJson.error_code === 0) setStatus(statusJson.data);
    } catch (_) {}

    setLoading(false);
  }

  async function toggleService() {
    const pw = sessionStorage.getItem('admin-auth') || '';
    try {
      const res = await fetch('/api/service-status', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-password': pw,
        },
        body: JSON.stringify({
          open: !status?.open,
          message: status?.message || '',
        }),
      });
      const json = await res.json();
      if (json.error_code === 0) setStatus({ ...json.data });
    } catch (_) {}
  }

  if (loading) {
    return (
      <div className="space-y-3">
        <div className="h-44 rounded-3xl shimmer" />
        <div className="grid grid-cols-3 gap-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 rounded-2xl shimmer" />
          ))}
        </div>
        <div className="h-32 rounded-2xl shimmer" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Greeting */}
      <div>
        <p className="text-xs text-ink-500">{getGreeting()}</p>
        <h1 className="text-xl font-bold text-ink-900 mt-0.5">Selamat datang, Admin</h1>
      </div>

      {/* Hero revenue card */}
      <div className="rounded-3xl bg-gradient-to-br from-ink-900 via-ink-800 to-accent-700 text-white overflow-hidden relative">
        <div className="absolute -top-12 -right-12 w-48 h-48 rounded-full bg-white/10 blur-2xl" />
        <div className="absolute -bottom-16 -left-12 w-56 h-56 rounded-full bg-accent-500/20 blur-3xl" />

        <div className="relative p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] uppercase tracking-wider opacity-70 font-semibold">
                Pendapatan Hari Ini
              </p>
              <p className="text-3xl font-extrabold mt-1 tracking-tight">
                {rupiah(stats.revenue)}
              </p>
              <p className="text-xs opacity-80 mt-1.5 inline-flex items-center gap-1.5">
                <span className="bg-white/15 px-2 py-0.5 rounded-full font-medium">
                  {stats.today} order
                </span>
                <span className="opacity-60">•</span>
                <span className="opacity-90">7 hari: {rupiah(stats.revenueWeek)}</span>
              </p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-white/15 backdrop-blur grid place-items-center shrink-0">
              <Icon.Tag size={20} />
            </div>
          </div>

          {/* Service toggle */}
          <button
            onClick={toggleService}
            className="mt-4 w-full bg-white/10 hover:bg-white/15 backdrop-blur transition rounded-2xl px-4 py-3 flex items-center justify-between text-left"
          >
            <div className="flex items-center gap-3">
              <div className="relative">
                <div
                  className={
                    'w-3 h-3 rounded-full ' +
                    (status?.open ? 'bg-emerald-400' : 'bg-red-400')
                  }
                />
                {status?.open && (
                  <div className="absolute inset-0 w-3 h-3 rounded-full bg-emerald-400 animate-ping" />
                )}
              </div>
              <div>
                <p className="text-sm font-semibold">
                  {status?.open ? 'Layanan Buka' : 'Layanan Tutup'}
                </p>
                <p className="text-[10px] opacity-70">Tap untuk ubah status</p>
              </div>
            </div>
            <Icon.ChevronRight size={16} className="opacity-70" />
          </button>
        </div>
      </div>

      {/* Stat pills */}
      <div>
        <div className="flex items-baseline justify-between mb-2">
          <h3 className="text-xs font-bold text-ink-700 uppercase tracking-wider">
            Status Pesanan
          </h3>
          <Link
            href="/admin/orders"
            className="text-[11px] text-ink-500 hover:text-ink-900 inline-flex items-center gap-1"
          >
            Lihat semua <Icon.ChevronRight size={10} />
          </Link>
        </div>
        <div className="grid grid-cols-4 gap-2">
          <StatPill label="Tunggu" value={stats.pending} color="amber" Ico={Icon.Clock} />
          <StatPill label="Proses" value={stats.processing} color="blue" Ico={Icon.Bolt} />
          <StatPill label="Siap" value={stats.ready} color="emerald" Ico={Icon.Check} />
          <StatPill label="Selesai" value={stats.done} color="ink" Ico={Icon.Receipt} />
        </div>
      </div>

      {/* Quick actions */}
      <div>
        <h3 className="text-xs font-bold text-ink-700 uppercase tracking-wider mb-2">
          Akses Cepat
        </h3>
        <div className="grid grid-cols-3 gap-2">
          <QuickAction
            href="/admin/orders"
            icon={<Icon.Receipt size={20} />}
            label="Pesanan"
            badge={stats.pending > 0 ? stats.pending : null}
            color="blue"
          />
          <QuickAction
            href="/admin/settings"
            icon={<Icon.Tag size={20} />}
            label="Settings"
            color="purple"
          />
          <QuickAction
            href="/"
            icon={<Icon.ExternalLink size={20} />}
            label="Lihat Web"
            color="emerald"
            target="_blank"
          />
        </div>
      </div>

      {/* Recent orders */}
      <div>
        <div className="flex items-baseline justify-between mb-2">
          <h3 className="text-xs font-bold text-ink-700 uppercase tracking-wider">
            Pesanan Terbaru
          </h3>
          <Link
            href="/admin/orders"
            className="text-[11px] text-ink-500 hover:text-ink-900 inline-flex items-center gap-1"
          >
            Lihat semua <Icon.ChevronRight size={10} />
          </Link>
        </div>

        {recent.length === 0 ? (
          <div className="rounded-2xl bg-white border border-ink-200 p-8 text-center">
            <div className="w-12 h-12 mx-auto rounded-full bg-ink-100 grid place-items-center text-ink-400 mb-2">
              <Icon.Receipt size={20} />
            </div>
            <p className="text-xs text-ink-500">Belum ada pesanan hari ini</p>
          </div>
        ) : (
          <div className="rounded-2xl bg-white border border-ink-200 overflow-hidden divide-y divide-ink-100">
            {recent.map((order) => (
              <Link
                key={order.id}
                href={`/order/${order.id}`}
                className="flex items-center gap-3 p-3 hover:bg-ink-50 transition active:scale-[.99]"
              >
                <div className="w-11 h-11 rounded-xl bg-ink-100 overflow-hidden shrink-0">
                  {order.data?.items?.[0]?.image || order.data?.items?.[0]?.m ? (
                    <img
                      src={order.data.items[0].image || order.data.items[0].m}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full grid place-items-center text-ink-400">
                      <Icon.Coffee size={18} />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="text-sm font-bold text-ink-900 truncate">
                      {order.data?.customer?.name || 'Anonymous'}
                    </p>
                    <StatusBadge status={order.status} />
                  </div>
                  <p className="text-[11px] text-ink-500 truncate mt-0.5">
                    #{order.id} •{' '}
                    {(order.data?.items || []).reduce((a, b) => a + (b.qty || 0), 0)} item
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-bold text-ink-900">
                    {rupiah(order.data?.totalToPay || order.data?.total)}
                  </p>
                  <p className="text-[10px] text-ink-400 mt-0.5">
                    {timeAgo(order.created_at)}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatPill({ label, value, color, Ico }) {
  const colors = {
    amber: 'bg-amber-50 text-amber-600 border-amber-200',
    blue: 'bg-blue-50 text-blue-600 border-blue-200',
    emerald: 'bg-emerald-50 text-emerald-600 border-emerald-200',
    ink: 'bg-ink-100 text-ink-700 border-ink-200',
  };
  return (
    <div className={'rounded-2xl border p-3 text-center ' + (colors[color] || colors.ink)}>
      <Ico size={14} className="mx-auto opacity-70" />
      <p className="text-2xl font-extrabold mt-1.5 leading-none">{value}</p>
      <p className="text-[10px] font-bold mt-1 uppercase tracking-wider opacity-80">
        {label}
      </p>
    </div>
  );
}

function QuickAction({ href, icon, label, badge, color, target }) {
  const colors = {
    blue: 'bg-blue-50 text-blue-600 border-blue-200',
    emerald: 'bg-emerald-50 text-emerald-600 border-emerald-200',
    purple: 'bg-purple-50 text-purple-600 border-purple-200',
  };
  return (
    <Link
      href={href}
      target={target}
      className="rounded-2xl bg-white border border-ink-200 p-3 hover:border-ink-900 hover:shadow-card transition active:scale-[.97] group relative"
    >
      <div
        className={
          'w-10 h-10 rounded-xl border grid place-items-center transition ' +
          (colors[color] || colors.blue)
        }
      >
        {icon}
      </div>
      <p className="text-xs font-bold text-ink-900 mt-2.5">{label}</p>
      {badge && (
        <span className="absolute top-2 right-2 bg-red-500 text-white text-[10px] font-bold min-w-[18px] h-[18px] px-1 rounded-full grid place-items-center">
          {badge}
        </span>
      )}
    </Link>
  );
}

function StatusBadge({ status }) {
  const map = {
    pending: { label: 'Tunggu', cls: 'bg-amber-100 text-amber-700' },
    processing: { label: 'Proses', cls: 'bg-blue-100 text-blue-700' },
    ready: { label: 'Siap', cls: 'bg-emerald-100 text-emerald-700' },
    done: { label: 'Selesai', cls: 'bg-ink-100 text-ink-700' },
    cancelled: { label: 'Batal', cls: 'bg-red-100 text-red-700' },
  };
  const s = map[status] || map.pending;
  return (
    <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold shrink-0 ${s.cls}`}>
      {s.label}
    </span>
  );
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 11) return 'Selamat pagi';
  if (h < 15) return 'Selamat siang';
  if (h < 18) return 'Selamat sore';
  return 'Selamat malam';
}

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'Baru saja';
  if (m < 60) return `${m}m lalu`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}j lalu`;
  return new Date(dateStr).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' });
}
