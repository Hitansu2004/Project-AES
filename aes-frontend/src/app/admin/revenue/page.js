'use client';

/**
 * Super Admin "Revenue HQ" — Rose Luxury redesign.
 *
 * Owner-tier dashboard showing live KPIs (today / week / month / year /
 * lifetime), the latest paid transactions, per-team workload, and a
 * snapshot of every Service Engineer on the floor. Refreshes every 15s
 * and pings on the /topic/ops/inbox STOMP channel when a payment lands.
 */
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CalendarDays,
  TrendingUp,
  BarChart3,
  Calendar,
  Diamond,
  RefreshCw,
  Crown,
  ChevronRight,
} from 'lucide-react';
import { useAuth, defaultRouteForRole } from '@/context/AuthContext';
import { adminRevenue as revenueApi } from '@/lib/api';
import useStompTopic from '@/hooks/useStompTopic';
import RoseShell from '@/components/rose/RoseShell';
import RoseSplash from '@/components/rose/RoseSplash';
import styles from './revenue.module.css';

function fmtINR(paise) {
  const v = Number(paise || 0);
  if (v >= 1_00_00_000) return { num: (v / 1_00_00_000).toFixed(2), unit: 'Cr' };
  if (v >= 1_00_000)    return { num: (v / 1_00_000).toFixed(2),    unit: 'L'  };
  if (v >= 1_000)       return { num: (v / 1_000).toFixed(1),       unit: 'K'  };
  return { num: v.toLocaleString('en-IN'), unit: '' };
}

function fmtAmount(paise) {
  const { num, unit } = fmtINR(paise);
  return `₹${num}${unit ? ' ' + unit : ''}`;
}

function relTime(iso) {
  if (!iso) return '—';
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.floor(ms / 60000);
  if (m < 1)  return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function greetingFor(h = new Date().getHours()) {
  if (h < 12) return 'Good Morning';
  if (h < 17) return 'Good Afternoon';
  return 'Good Evening';
}

const greetingDeltas = (kpi) => ({
  today:    pct(kpi.todayPctVsYesterday),
  thisWeek: pct(kpi.thisWeekPctVsLastWeek),
  thisMonth: pct(kpi.thisMonthPctVsLastMonth),
  thisYear:  pct(kpi.thisYearPctVsLastYear),
});
function pct(v) {
  if (v == null) return null;
  const sign = v >= 0 ? '+' : '';
  return `${sign}${Number(v).toFixed(1)}%`;
}

export default function RevenueDashboard() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.replace('/login?next=/admin/revenue'); return; }
    if (!['SUPER_ADMIN', 'ADMIN'].includes(user.role)) {
      router.replace(defaultRouteForRole(user.role));
    }
  }, [user, authLoading, router]);

  const fetchData = async (background = false) => {
    if (background) setRefreshing(true); else setLoading(true);
    try {
      const res = await revenueApi.fetch();
      setData(res || null);
      setLastUpdated(new Date());
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (!user) return;
    fetchData();
    const id = setInterval(() => fetchData(true), 15000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  useStompTopic('/topic/ops/inbox', () => fetchData(true));

  const kpi = data?.kpi || {};
  const transactions = data?.transactions || [];
  const teams = data?.teams || [];
  const engineers = data?.engineers || [];
  const deltas = greetingDeltas(kpi);

  const engineerStats = useMemo(() => {
    const total   = engineers.length;
    const onShift = engineers.filter((e) => e.onShift).length;
    const busy    = engineers.filter((e) => Number(e.activeJobs) > 0).length;
    return { total, onShift, busy };
  }, [engineers]);

  if (authLoading || !user || (loading && !data)) {
    return <RoseSplash message="Loading Revenue HQ…" />;
  }

  const firstName = user.name?.split(' ')[0] || 'there';

  const hero = (
    <div className={styles.hero}>
      <div className={styles.heroText}>
        <span className={styles.heroChip}>
          <Crown size={12} /> OWNER · REVENUE HQ
        </span>
        <h1 className={styles.heroTitle}>{greetingFor()}, {firstName}.</h1>
        <p className={styles.heroSub}>
          Here&apos;s how AES is doing — updated live as payments land.
        </p>
      </div>
      <div className={styles.heroActions}>
        <span className={styles.heroMeta}>
          {refreshing ? 'Refreshing…' : lastUpdated && `Updated ${relTime(lastUpdated.toISOString())}`}
        </span>
        <button
          type="button"
          className={styles.refreshBtn}
          onClick={() => fetchData(true)}
          disabled={refreshing}
          aria-label="Refresh"
        >
          <RefreshCw size={16} className={refreshing ? styles.spin : ''} />
        </button>
      </div>
    </div>
  );

  return (
    <RoseShell hero={hero}>
      {/* ── Revenue tiles (5) ───────────────────────────── */}
      <section className={styles.revTiles}>
        <RevTile label="Today"      amount={kpi.today}     icon={CalendarDays} delta={deltas.today}    deltaNote="vs yesterday" />
        <RevTile label="This Week"  amount={kpi.thisWeek}  icon={Calendar}     delta={deltas.thisWeek} deltaNote="vs last week" />
        <RevTile label="This Month" amount={kpi.thisMonth} icon={BarChart3}    delta={deltas.thisMonth} deltaNote="vs last month" />
        <RevTile label="This Year"  amount={kpi.thisYear}  icon={TrendingUp}   delta={deltas.thisYear}  deltaNote="vs last year" />
        <RevTile
          label="Lifetime"
          amount={kpi.lifetime}
          icon={Diamond}
          dark
          sub={`${(kpi.paidCount || 0).toLocaleString('en-IN')} paid tickets · avg ${fmtAmount(kpi.avgTicket)}`}
        />
      </section>

      {/* ── Secondary stat strip ────────────────────────── */}
      <section className={styles.statStrip}>
        <Stat label="Open Tickets"   value={data?.openTickets ?? '—'} />
        <Stat label="Critical (P1)"  value={data?.criticalOpen ?? '—'} danger />
        <Stat label="Eng On Shift"   value={`${engineerStats.onShift}`} />
        <Stat label="Eng Busy"       value={`${engineerStats.busy}`} />
      </section>

      {/* ── Transactions + Teams ────────────────────────── */}
      <section className={styles.duo}>
        <Panel
          title="Recent Transactions"
          subtitle="Latest paid tickets — auto-updates"
          action={{ href: '/admin', label: 'VIEW ALL' }}
        >
          {transactions.length === 0 ? (
            <EmptyRow>No transactions yet today.</EmptyRow>
          ) : (
            <div className={styles.txWrap}>
              <table className={styles.txTable}>
                <thead>
                  <tr>
                    <th>Ticket</th>
                    <th>Customer</th>
                    <th>Method</th>
                    <th>Team</th>
                    <th align="right">Amount</th>
                    <th align="right">Paid</th>
                  </tr>
                </thead>
                <tbody>
                  <AnimatePresence initial={false}>
                    {transactions.slice(0, 12).map((tx) => (
                      <motion.tr
                        key={`${tx.ticketNumber}-${tx.paidAt}`}
                        layout
                        initial={{ opacity: 0, backgroundColor: 'rgba(255,217,224,0.6)' }}
                        animate={{ opacity: 1, backgroundColor: 'rgba(0,0,0,0)' }}
                        transition={{ backgroundColor: { duration: 1.4 } }}
                      >
                        <td>
                          <Link href={`/tickets/${tx.ticketNumber}`} className={styles.txTicket}>
                            #{tx.ticketNumber}
                          </Link>
                        </td>
                        <td className={styles.txCustomer}>
                          {tx.customerName || '—'}
                        </td>
                        <td>
                          <span className={styles.methodChip}>
                            {(tx.method || 'MOCK').toString().toUpperCase()}
                          </span>
                        </td>
                        <td className={styles.txTeam}>{tx.team || '—'}</td>
                        <td align="right" className={styles.txAmount}>
                          {fmtAmount(tx.amount)}
                        </td>
                        <td align="right" className={styles.txMeta}>
                          {relTime(tx.paidAt)}
                        </td>
                      </motion.tr>
                    ))}
                  </AnimatePresence>
                </tbody>
              </table>
            </div>
          )}
        </Panel>

        <Panel title="Revenue by Team" subtitle="Today">
          {teams.length === 0 ? (
            <EmptyRow>No team activity yet.</EmptyRow>
          ) : (
            <ul className={styles.teamList}>
              {teams.map((tm) => (
                <li key={tm.teamName} className={styles.teamRow}>
                  <div className={styles.teamHead}>
                    <p className={styles.teamName}>{tm.teamName}</p>
                    <p className={styles.teamMeta}>
                      {tm.activeTickets} active · {tm.resolvedToday} solved
                    </p>
                  </div>
                  <p className={styles.teamRev}>{fmtAmount(tm.revenueToday)}</p>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </section>

      {/* ── Engineers floor ─────────────────────────────── */}
      <section className={styles.floor}>
        <header className={styles.floorHead}>
          <h2 className={styles.floorTitle}>Service Engineers Floor</h2>
          <span className={styles.floorMeta}>
            {engineerStats.onShift} on shift · {engineerStats.busy} on jobs
          </span>
        </header>
        {engineers.length === 0 ? (
          <EmptyRow>No engineer roster.</EmptyRow>
        ) : (
          <div className={styles.engRow}>
            {engineers.map((e) => (
              <EngineerChip key={e.id} eng={e} />
            ))}
          </div>
        )}
      </section>
    </RoseShell>
  );
}

/* ─── Tiles & subcomponents ────────────────────────────── */

function RevTile({ label, amount, icon: Icon, dark, sub, delta, deltaNote }) {
  const { num, unit } = fmtINR(amount);
  const positive = delta && delta.startsWith('+');
  return (
    <motion.div
      whileHover={{ y: -3 }}
      className={`${styles.revTile} ${dark ? styles.revTileDark : ''}`}
    >
      <div className={styles.revTileHead}>
        <span className={styles.revTileLabel}>{label}</span>
        <Icon size={16} strokeWidth={2} />
      </div>
      <div className={styles.revTileBody}>
        <span className={styles.revCurrency}>₹</span>
        <span className={styles.revAmount}>{num}</span>
        {unit && <span className={styles.revUnit}>{unit}</span>}
      </div>
      {delta && !dark && (
        <p className={`${styles.revDelta} ${positive ? styles.revDeltaUp : styles.revDeltaDown}`}>
          {delta} <span className={styles.revDeltaNote}>{deltaNote}</span>
        </p>
      )}
      {sub && <p className={styles.revSub}>{sub}</p>}
    </motion.div>
  );
}

function Stat({ label, value, danger }) {
  return (
    <div className={styles.stat}>
      <span className={`${styles.statLabel} ${danger ? styles.statLabelDanger : ''}`}>
        {label}
      </span>
      <span className={`${styles.statValue} ${danger ? styles.statValueDanger : ''}`}>
        {value}
      </span>
    </div>
  );
}

function Panel({ title, subtitle, action, children }) {
  return (
    <section className={styles.panel}>
      <header className={styles.panelHead}>
        <div>
          <h2 className={styles.panelTitle}>{title}</h2>
          {subtitle && <p className={styles.panelSub}>{subtitle}</p>}
        </div>
        {action && (
          <Link href={action.href} className={styles.panelAction}>
            {action.label} <ChevronRight size={14} />
          </Link>
        )}
      </header>
      <div className={styles.panelBody}>{children}</div>
    </section>
  );
}

function EmptyRow({ children }) {
  return <div className={styles.empty}>{children}</div>;
}

function EngineerChip({ eng }) {
  const onShift = !!eng.onShift;
  return (
    <div
      className={`${styles.engChip} ${onShift ? styles.engChipOn : styles.engChipOff}`}
      title={`${eng.name} · ${eng.teamName || 'No team'} · ${Number(eng.activeJobs)} active job(s)`}
    >
      <span className={styles.engDot} />
      <span className={styles.engName}>
        {(eng.name || '').split(' ').slice(0, 2).map((p, i) => i === 0 ? `${p[0]}.` : p).join(' ')}
      </span>
    </div>
  );
}
