'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, Plus, Tag, Power, Trash2, X, Calendar, Hash,
  Percent, Users, Wallet, CheckCircle2, AlertCircle,
} from 'lucide-react';
import { useAuth, defaultRouteForRole } from '@/context/AuthContext';
import { coupons as couponsApi } from '@/lib/api';
import { useToast } from '@/components/ui/Toast';

const APPLIES = [
  { id: 'TICKET',  label: 'Service tickets' },
  { id: 'INSTALL', label: 'New installations' },
  { id: 'BOTH',    label: 'Both' },
];

export default function AdminCouponsPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const toast = useToast();
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.replace('/login?next=/admin/coupons'); return; }
    if (!['ADMIN', 'SERVICE_MANAGER'].includes(user.role)) {
      router.replace(defaultRouteForRole(user.role));
    }
  }, [user, authLoading, router]);

  const reload = useCallback(async () => {
    try {
      setLoading(true);
      const data = await couponsApi.list();
      setList(Array.isArray(data) ? data : []);
    } catch (e) {
      toast.error(e?.message || 'Failed to load coupons');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { reload(); }, [reload]);

  const handleToggle = async (id) => {
    try { await couponsApi.toggle(id); reload(); }
    catch (e) { toast.error(e?.message || 'Failed'); }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this coupon? Customers who have used it earlier are not affected.')) return;
    try { await couponsApi.remove(id); toast.success('Coupon deleted'); reload(); }
    catch (e) { toast.error(e?.message || 'Failed'); }
  };

  if (authLoading || !user) {
    return <div className="loading-page"><div className="spinner" /></div>;
  }

  return (
    <div style={page}>
      {/* Header */}
      <header style={header}>
        <Link href="/admin" style={backBtn} aria-label="Back to admin">
          <ArrowLeft size={18} />
        </Link>
        <div style={{ flex: 1 }}>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 800, letterSpacing: -0.3 }}>
            Discount Coupons
          </h1>
          <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--on-surface-variant)' }}>
            Create percent-off codes you can hand to customers over the phone.
          </p>
        </div>
        <button style={primaryBtn} onClick={() => setShowForm(true)}>
          <Plus size={16} /> New coupon
        </button>
      </header>

      {/* Summary chips */}
      <section style={chipRow}>
        <Chip icon={<Tag size={14} />}   label="Total"   value={list.length} />
        <Chip icon={<CheckCircle2 size={14} />} label="Active"  value={list.filter(c => c.isActive).length} tone="positive" />
        <Chip icon={<Wallet size={14} />}      label="Redeemed" value={list.reduce((a, c) => a + (c.timesUsed || 0), 0)} />
      </section>

      {/* List */}
      <section style={list.length === 0 && !loading ? emptyBox : { display: 'flex', flexDirection: 'column', gap: 10 }}>
        {loading && (
          <p style={{ color: 'var(--on-surface-variant)' }}>Loading coupons…</p>
        )}
        {!loading && list.length === 0 && (
          <>
            <Tag size={40} color="var(--secondary)" />
            <h3 style={{ margin: '8px 0 4px' }}>No coupons yet</h3>
            <p style={{ color: 'var(--on-surface-variant)', fontSize: 13, marginBottom: 12 }}>
              Tap "New coupon" to create your first discount code.
            </p>
            <button style={primaryBtn} onClick={() => setShowForm(true)}>
              <Plus size={16} /> Create coupon
            </button>
          </>
        )}
        {!loading && list.map((c) => (
          <CouponCard key={c.id} c={c} onToggle={() => handleToggle(c.id)} onDelete={() => handleDelete(c.id)} />
        ))}
      </section>

      <AnimatePresence>
        {showForm && <NewCouponForm onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); reload(); }} />}
      </AnimatePresence>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────── */

function CouponCard({ c, onToggle, onDelete }) {
  const remaining = c.maxUses === -1 ? '∞' : Math.max(0, (c.maxUses || 0) - (c.timesUsed || 0));
  const expiry = c.validUntil ? new Date(c.validUntil).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : null;
  const isExpired = c.validUntil && new Date(c.validUntil) < new Date();

  return (
    <article style={{
      ...card,
      opacity: c.isActive && !isExpired ? 1 : 0.6,
      borderLeft: `4px solid ${c.isActive && !isExpired ? '#6366f1' : '#94a3b8'}`,
    }}>
      {/* Big % badge */}
      <div style={pctBadge}>
        <Percent size={16} />
        <span style={{ fontSize: 22, fontWeight: 800 }}>{c.discountPct}</span>
      </div>

      {/* Body */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={codePill}>{c.code}</span>
          <span style={metaChip}>{c.appliesTo.replace('_', ' ')}</span>
          {!c.isActive && <span style={{ ...metaChip, color: '#f97316' }}>Paused</span>}
          {isExpired && <span style={{ ...metaChip, color: '#ef4444' }}>Expired</span>}
        </div>
        <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--on-surface-variant)' }}>
          {c.description || '—'}
        </p>
        <div style={metaGrid}>
          <span><Users size={11} /> {c.timesUsed || 0} used</span>
          <span><Hash size={11} /> {remaining} left</span>
          {expiry && <span><Calendar size={11} /> Valid until {expiry}</span>}
          {c.minAmount > 0 && <span><Wallet size={11} /> Min ₹{c.minAmount}</span>}
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <button onClick={onToggle} title={c.isActive ? 'Pause' : 'Activate'} style={iconBtn}>
          <Power size={16} color={c.isActive ? '#16a34a' : '#94a3b8'} />
        </button>
        <button onClick={onDelete} title="Delete" style={iconBtn}>
          <Trash2 size={16} color="#ef4444" />
        </button>
      </div>
    </article>
  );
}

/* ─── New coupon modal form ────────────────────────────────── */
function NewCouponForm({ onClose, onSaved }) {
  const toast = useToast();
  const [code, setCode] = useState('');
  const [description, setDescription] = useState('');
  const [discountPct, setDiscountPct] = useState(10);
  const [maxUses, setMaxUses] = useState('');
  const [validUntil, setValidUntil] = useState('');
  const [appliesTo, setAppliesTo] = useState('TICKET');
  const [minAmount, setMinAmount] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!code.trim()) return toast.error('Code is required');
    if (discountPct < 1 || discountPct > 100) return toast.error('Discount must be 1–100');
    setSaving(true);
    try {
      await couponsApi.create({
        code: code.trim().toUpperCase(),
        description: description.trim() || null,
        discountPct,
        maxUses: maxUses ? Number(maxUses) : null,
        validUntil: validUntil ? new Date(validUntil).toISOString() : null,
        appliesTo,
        minAmount: minAmount ? Number(minAmount) : 0,
      });
      toast.success('Coupon created');
      onSaved();
    } catch (err) {
      toast.error(err.message || 'Failed to create coupon');
    } finally { setSaving(false); }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onClose}
      style={backdrop}
    >
      <motion.form
        onClick={(e) => e.stopPropagation()}
        onSubmit={submit}
        initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 40, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 240, damping: 26 }}
        style={modal}
      >
        <div style={modalHead}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>New discount coupon</h3>
          <button type="button" onClick={onClose} style={iconBtn} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div className="input-group">
          <label>Code* (uppercase, no spaces)</label>
          <input className="input" value={code} onChange={(e) => setCode(e.target.value.replace(/\s/g, '').toUpperCase())}
                 placeholder="e.g. SUMMER15" autoFocus />
        </div>

        <div className="input-group">
          <label>Description</label>
          <input className="input" value={description} onChange={(e) => setDescription(e.target.value)}
                 placeholder="e.g. Summer special — 15% off any service" />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div className="input-group">
            <label>Discount %*</label>
            <input className="input" type="number" min="1" max="100" value={discountPct}
                   onChange={(e) => setDiscountPct(Number(e.target.value))} />
          </div>
          <div className="input-group">
            <label>Applies to</label>
            <select className="input" value={appliesTo} onChange={(e) => setAppliesTo(e.target.value)}>
              {APPLIES.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
            </select>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div className="input-group">
            <label>Max uses (blank = unlimited)</label>
            <input className="input" type="number" min="1" value={maxUses}
                   onChange={(e) => setMaxUses(e.target.value)} placeholder="e.g. 100" />
          </div>
          <div className="input-group">
            <label>Minimum order ₹</label>
            <input className="input" type="number" min="0" value={minAmount}
                   onChange={(e) => setMinAmount(e.target.value)} placeholder="0" />
          </div>
        </div>

        <div className="input-group">
          <label>Valid until (optional)</label>
          <input className="input" type="datetime-local" value={validUntil}
                 onChange={(e) => setValidUntil(e.target.value)} />
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={saving} style={{ flex: 1 }}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={saving} style={{ flex: 2 }}>
            {saving ? 'Creating…' : 'Create coupon'}
          </button>
        </div>
      </motion.form>
    </motion.div>
  );
}

function Chip({ icon, label, value, tone }) {
  return (
    <div style={{
      ...chip,
      borderColor: tone === 'positive' ? '#16a34a40' : 'var(--border-light)',
    }}>
      {icon}
      <span style={{ fontSize: 11, color: 'var(--on-surface-variant)', textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</span>
      <span style={{ fontWeight: 800, fontSize: 14, color: tone === 'positive' ? '#16a34a' : 'var(--on-surface)' }}>{value}</span>
    </div>
  );
}

// ── inline styles ─────────────────────────────────────────────
const page = {
  minHeight: '100dvh', background: 'var(--surface, #f8fafc)',
  padding: '24px max(24px, env(safe-area-inset-left))',
  fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
};
const header = { display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 };
const backBtn = {
  width: 36, height: 36, borderRadius: 10, border: '1px solid var(--border-light)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--on-surface)',
  background: 'var(--surface)', textDecoration: 'none',
};
const primaryBtn = {
  display: 'inline-flex', alignItems: 'center', gap: 6,
  background: 'linear-gradient(135deg, #6366f1, #0ea5e9)', color: '#fff',
  padding: '9px 14px', borderRadius: 10, border: 'none', fontWeight: 600,
  fontSize: 13, cursor: 'pointer',
};
const iconBtn = {
  background: 'transparent', border: '1px solid var(--border-light)',
  borderRadius: 8, width: 32, height: 32, display: 'flex',
  alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
};
const chipRow = { display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 };
const chip = {
  display: 'inline-flex', alignItems: 'center', gap: 6,
  background: 'var(--surface-container-low, #f1f5f9)',
  padding: '6px 12px', borderRadius: 999, border: '1px solid var(--border-light)',
};
const card = {
  background: 'var(--surface, #fff)', borderRadius: 12,
  padding: '14px 16px', display: 'flex', gap: 14, alignItems: 'flex-start',
  border: '1px solid var(--border-light)',
};
const pctBadge = {
  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
  minWidth: 64, padding: '8px 4px', borderRadius: 10,
  background: 'linear-gradient(135deg, #6366f110, #0ea5e910)',
  color: '#6366f1',
};
const codePill = {
  fontFamily: 'monospace', fontWeight: 800, fontSize: 14,
  background: '#0f172a', color: '#fff', padding: '3px 8px', borderRadius: 6, letterSpacing: 1,
};
const metaChip = {
  fontSize: 10, fontWeight: 700, color: 'var(--on-surface-variant)',
  background: 'var(--surface-container-low, #f1f5f9)',
  padding: '2px 6px', borderRadius: 4, textTransform: 'uppercase', letterSpacing: 0.5,
};
const metaGrid = {
  display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 8,
  fontSize: 11, color: 'var(--on-surface-variant)',
};
const emptyBox = {
  background: 'var(--surface)', borderRadius: 12, padding: '40px 24px',
  border: '1px dashed var(--border-light)', textAlign: 'center',
  display: 'flex', flexDirection: 'column', alignItems: 'center',
};
const backdrop = {
  position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', zIndex: 100,
  display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
};
const modal = {
  background: 'var(--surface, #fff)', color: 'var(--on-surface, #0f172a)',
  borderRadius: 16, padding: 20, width: 'min(480px, 100%)',
  display: 'flex', flexDirection: 'column', gap: 12,
  boxShadow: '0 25px 60px rgba(0,0,0,0.3)',
  maxHeight: '90dvh', overflowY: 'auto',
};
const modalHead = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 };
