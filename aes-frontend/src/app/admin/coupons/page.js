'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus,
  Tag,
  Power,
  Trash2,
  X,
  Calendar,
  Hash,
  Percent,
  Users,
  Wallet,
  CheckCircle2,
} from 'lucide-react';
import { useAuth, defaultRouteForRole } from '@/context/AuthContext';
import { coupons as couponsApi } from '@/lib/api';
import { useToast } from '@/components/ui/Toast';
import RoseShell from '@/components/rose/RoseShell';
import RoseSplash from '@/components/rose/RoseSplash';
import styles from './coupons.module.css';

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
    if (!['ADMIN', 'SERVICE_MANAGER', 'SUPER_ADMIN'].includes(user.role)) {
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
    } finally { setLoading(false); }
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

  if (authLoading || !user) return <RoseSplash message="Loading coupons…" />;

  const activeCount   = list.filter((c) => c.isActive).length;
  const redeemedCount = list.reduce((a, c) => a + (c.timesUsed || 0), 0);

  const hero = (
    <div className={styles.heroRow}>
      <div className={styles.heroText}>
        <h1 className={styles.heroTitle}>Discount Coupons</h1>
        <p className={styles.heroSub}>
          Create percent-off codes to hand to customers over the phone — Ops will see them
          apply at checkout for tickets and installations.
        </p>
      </div>
      <button type="button" className={styles.primaryBtn} onClick={() => setShowForm(true)}>
        <Plus size={15} /> New coupon
      </button>
    </div>
  );

  return (
    <RoseShell hero={hero}>
      {/* Summary tiles */}
      <section className={styles.tiles}>
        <Tile icon={Tag}         label="Total"    value={list.length} />
        <Tile icon={CheckCircle2} label="Active"   value={activeCount} tone="positive" />
        <Tile icon={Wallet}      label="Redeemed" value={redeemedCount} />
      </section>

      {/* List */}
      {loading ? (
        <div className={styles.list}>
          {[0, 1, 2].map((i) => <div key={i} className="skeleton" style={{ height: 110, borderRadius: 16 }} />)}
        </div>
      ) : list.length === 0 ? (
        <div className={styles.empty}>
          <div className={styles.emptyIcon}><Tag size={26} /></div>
          <h3>No coupons yet</h3>
          <p>Create your first percent-off code and share it with customers over the phone.</p>
          <button type="button" className={styles.primaryBtn} onClick={() => setShowForm(true)}>
            <Plus size={14} /> Create coupon
          </button>
        </div>
      ) : (
        <div className={styles.list}>
          {list.map((c) => (
            <CouponCard
              key={c.id}
              c={c}
              onToggle={() => handleToggle(c.id)}
              onDelete={() => handleDelete(c.id)}
            />
          ))}
        </div>
      )}

      <AnimatePresence>
        {showForm && (
          <NewCouponForm
            onClose={() => setShowForm(false)}
            onSaved={() => { setShowForm(false); reload(); }}
          />
        )}
      </AnimatePresence>
    </RoseShell>
  );
}

/* ─── Tiles ──────────────────────────────────────────────── */
function Tile({ icon: Icon, label, value, tone }) {
  return (
    <div className={`${styles.tile} ${tone === 'positive' ? styles.tilePositive : ''}`}>
      <span className={styles.tileIcon}><Icon size={14} /></span>
      <span className={styles.tileLabel}>{label}</span>
      <span className={styles.tileValue}>{value}</span>
    </div>
  );
}

/* ─── Coupon card ───────────────────────────────────────── */
function CouponCard({ c, onToggle, onDelete }) {
  const remaining = c.maxUses === -1 || !c.maxUses ? '∞' : Math.max(0, (c.maxUses || 0) - (c.timesUsed || 0));
  const expiry = c.validUntil ? new Date(c.validUntil).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : null;
  const isExpired = c.validUntil && new Date(c.validUntil) < new Date();
  const isOff = !c.isActive || isExpired;

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className={`${styles.card} ${isOff ? styles.cardOff : ''}`}
    >
      <span className={`${styles.cardAccent} ${isOff ? styles.accentOff : ''}`} aria-hidden="true" />

      <div className={styles.pctBadge}>
        <Percent size={14} />
        <span className={styles.pctValue}>{c.discountPct}</span>
      </div>

      <div className={styles.cardBody}>
        <div className={styles.cardHead}>
          <span className={styles.codePill}>{c.code}</span>
          <span className={styles.metaChip}>{(c.appliesTo || '').replace('_', ' ')}</span>
          {!c.isActive && <span className={`${styles.metaChip} ${styles.metaChipWarn}`}>Paused</span>}
          {isExpired && <span className={`${styles.metaChip} ${styles.metaChipDanger}`}>Expired</span>}
        </div>
        {c.description && <p className={styles.cardDesc}>{c.description}</p>}
        <div className={styles.metaGrid}>
          <span><Users size={11} /> {c.timesUsed || 0} used</span>
          <span><Hash size={11} /> {remaining} left</span>
          {expiry && <span><Calendar size={11} /> Until {expiry}</span>}
          {c.minAmount > 0 && <span><Wallet size={11} /> Min ₹{c.minAmount}</span>}
        </div>
      </div>

      <div className={styles.cardActions}>
        <button type="button" className={styles.iconBtn} onClick={onToggle} title={c.isActive ? 'Pause' : 'Activate'} aria-label="Toggle">
          <Power size={15} className={c.isActive ? styles.iconActive : styles.iconMuted} />
        </button>
        <button type="button" className={styles.iconBtn} onClick={onDelete} title="Delete" aria-label="Delete">
          <Trash2 size={15} className={styles.iconDanger} />
        </button>
      </div>
    </motion.article>
  );
}

/* ─── New coupon modal ──────────────────────────────────── */
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
      className={styles.backdrop}
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.form
        className={styles.modal}
        onClick={(e) => e.stopPropagation()}
        onSubmit={submit}
        initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 40, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 240, damping: 26 }}
      >
        <header className={styles.modalHead}>
          <h3>New discount coupon</h3>
          <button type="button" onClick={onClose} className={styles.iconBtn} aria-label="Close">
            <X size={16} />
          </button>
        </header>

        <div className={styles.field}>
          <label>Code (uppercase, no spaces)</label>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\s/g, '').toUpperCase())}
            placeholder="e.g. SUMMER15"
            autoFocus
          />
        </div>

        <div className={styles.field}>
          <label>Description</label>
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="e.g. Summer special — 15% off any service"
          />
        </div>

        <div className={styles.fieldRow}>
          <div className={styles.field}>
            <label>Discount %</label>
            <input
              type="number" min="1" max="100" value={discountPct}
              onChange={(e) => setDiscountPct(Number(e.target.value))}
            />
          </div>
          <div className={styles.field}>
            <label>Applies to</label>
            <select value={appliesTo} onChange={(e) => setAppliesTo(e.target.value)}>
              {APPLIES.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
            </select>
          </div>
        </div>

        <div className={styles.fieldRow}>
          <div className={styles.field}>
            <label>Max uses (blank = unlimited)</label>
            <input
              type="number" min="1" value={maxUses}
              onChange={(e) => setMaxUses(e.target.value)} placeholder="e.g. 100"
            />
          </div>
          <div className={styles.field}>
            <label>Min order ₹</label>
            <input
              type="number" min="0" value={minAmount}
              onChange={(e) => setMinAmount(e.target.value)} placeholder="0"
            />
          </div>
        </div>

        <div className={styles.field}>
          <label>Valid until (optional)</label>
          <input
            type="datetime-local" value={validUntil}
            onChange={(e) => setValidUntil(e.target.value)}
          />
        </div>

        <div className={styles.formActions}>
          <button type="button" className={styles.secondaryBtn} onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button type="submit" className={styles.primaryBtn} disabled={saving}>
            {saving ? 'Creating…' : 'Create coupon'}
          </button>
        </div>
      </motion.form>
    </motion.div>
  );
}
