'use client';

/**
 * V14 — Super Admin "Revenue HQ".
 *
 * Owner-tier dashboard showing live KPIs (today / week / month / year /
 * lifetime), the latest paid transactions, per-team workload, and a
 * snapshot of every Service Engineer on the floor.  Refreshes every
 * 15 s and pings on the {@code /topic/ops/inbox} STOMP channel when a
 * payment completes or a ticket changes hands.
 */
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  TrendingUp, Users, Wrench, RefreshCw, Crown, IndianRupee,
  Calendar, BarChart3, Briefcase, CircleDot, LogOut, Bell, ChevronRight,
} from 'lucide-react';
import { useAuth, defaultRouteForRole } from '@/context/AuthContext';
import { useNotifications } from '@/context/NotificationContext';
import { adminRevenue as revenueApi } from '@/lib/api';
import useStompTopic from '@/hooks/useStompTopic';
import Logo from '@/components/ui/Logo';

const PALETTE = {
  today:    { bg: 'linear-gradient(135deg,#0ea5e9 0%,#22d3ee 100%)', fg: '#fff' },
  week:     { bg: 'linear-gradient(135deg,#22c55e 0%,#10b981 100%)', fg: '#fff' },
  month:    { bg: 'linear-gradient(135deg,#a855f7 0%,#8b5cf6 100%)', fg: '#fff' },
  year:     { bg: 'linear-gradient(135deg,#f97316 0%,#f59e0b 100%)', fg: '#fff' },
  lifetime: { bg: 'linear-gradient(135deg,#0f172a 0%,#1e293b 100%)', fg: '#fff' },
};

function fmtINR(paise) {
  const v = Number(paise || 0);
  if (v >= 1_00_00_000) return `₹${(v / 1_00_00_000).toFixed(2)} Cr`;
  if (v >= 1_00_000)    return `₹${(v / 1_00_000).toFixed(2)} L`;
  if (v >= 1_000)       return `₹${(v / 1_000).toFixed(1)} K`;
  return `₹${v.toLocaleString('en-IN')}`;
}

function fmtTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleString('en-IN', {
    hour: '2-digit', minute: '2-digit',
    day: '2-digit', month: 'short',
  });
}

export default function RevenueDashboard() {
  const router = useRouter();
  const { user, loading: authLoading, logout } = useAuth();
  const { unread } = useNotifications();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.replace('/login?next=/admin/revenue'); return; }
    if (user.role !== 'SUPER_ADMIN' && user.role !== 'ADMIN') {
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

  // Live ping when any back-office event lands
  useStompTopic('/topic/ops/inbox', () => fetchData(true));

  const kpi = data?.kpi || {};
  const transactions = data?.transactions || [];
  const teams = data?.teams || [];
  const engineers = data?.engineers || [];

  const engineerStats = useMemo(() => {
    const total   = engineers.length;
    const onShift = engineers.filter((e) => e.onShift).length;
    const busy    = engineers.filter((e) => Number(e.activeJobs) > 0).length;
    return { total, onShift, busy, idle: onShift - busy };
  }, [engineers]);

  if (authLoading || !user) {
    return <div className="loading-page"><div className="spinner" /></div>;
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--surface-container-lowest, #f8fafc)',
      padding: '0 0 64px',
    }}>
      {/* ── Top bar ── */}
      <header style={{
        position: 'sticky', top: 0, zIndex: 30,
        background: 'var(--surface, #fff)',
        borderBottom: '1px solid var(--border-light)',
        padding: '12px 24px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: 16,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <Logo />
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '4px 10px', borderRadius: 999,
            background: 'linear-gradient(135deg,#facc15 0%,#fb923c 100%)',
            color: '#0f172a', fontSize: 12, fontWeight: 700, letterSpacing: 0.3,
          }}>
            <Crown size={14} /> Revenue HQ
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 12, color: 'var(--on-surface-variant)' }}>
            {refreshing ? 'Refreshing…' : lastUpdated ? `Updated ${fmtTime(lastUpdated.toISOString())}` : ''}
          </span>
          <button
            type="button"
            onClick={() => fetchData(true)}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '6px 10px', borderRadius: 8,
              border: '1px solid var(--border-light)',
              background: 'var(--surface)', cursor: 'pointer',
              color: 'var(--on-surface)',
            }}
          >
            <RefreshCw size={14} className={refreshing ? 'spin' : ''} />
            Refresh
          </button>
          <Link href="/notifications" aria-label="Notifications" style={{
            position: 'relative', display: 'inline-flex',
            width: 36, height: 36, alignItems: 'center', justifyContent: 'center',
            borderRadius: 8, border: '1px solid var(--border-light)',
            color: 'var(--on-surface)',
          }}>
            <Bell size={16} />
            {unread > 0 && <span style={{
              position: 'absolute', top: -4, right: -4,
              background: '#ef4444', color: '#fff', borderRadius: 999,
              fontSize: 10, fontWeight: 700, padding: '2px 6px',
            }}>{unread > 99 ? '99+' : unread}</span>}
          </Link>
          <button type="button" onClick={logout} aria-label="Sign out" style={{
            display: 'inline-flex', width: 36, height: 36,
            alignItems: 'center', justifyContent: 'center',
            borderRadius: 8, border: '1px solid var(--border-light)',
            background: 'var(--surface)', color: 'var(--on-surface)', cursor: 'pointer',
          }}>
            <LogOut size={16} />
          </button>
        </div>
      </header>

      {/* ── Hello ── */}
      <section style={{ padding: '20px 24px 4px' }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>
          Hi {user.name?.split(' ')[0] || 'there'} 👋
        </h1>
        <p style={{ margin: '4px 0 0', color: 'var(--on-surface-variant)', fontSize: 14 }}>
          Here&apos;s how AES is doing — updated live as payments land.
        </p>
      </section>

      {/* ── KPI tiles ── */}
      {loading ? (
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))',
          gap: 14, padding: '16px 24px',
        }}>
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="skeleton" style={{ height: 112, borderRadius: 16 }} />
          ))}
        </div>
      ) : (
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))',
          gap: 14, padding: '16px 24px',
        }}>
          <KpiTile theme={PALETTE.today}    label="Today"       value={fmtINR(kpi.today)}    icon={IndianRupee} />
          <KpiTile theme={PALETTE.week}     label="This Week"   value={fmtINR(kpi.thisWeek)} icon={TrendingUp} />
          <KpiTile theme={PALETTE.month}    label="This Month"  value={fmtINR(kpi.thisMonth)} icon={Calendar} />
          <KpiTile theme={PALETTE.year}     label="This Year"   value={fmtINR(kpi.thisYear)} icon={BarChart3} />
          <KpiTile theme={PALETTE.lifetime} label="Lifetime"    value={fmtINR(kpi.lifetime)} icon={Crown}
                   sub={`${(kpi.paidCount || 0).toLocaleString('en-IN')} paid tickets · avg ${fmtINR(kpi.avgTicket)}`} />
        </div>
      )}

      {/* ── Secondary stat row ── */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))',
        gap: 14, padding: '0 24px 16px',
      }}>
        <SmallStat label="Open tickets" value={data?.openTickets ?? '—'} icon={Briefcase} />
        <SmallStat label="Critical (P1) open" value={data?.criticalOpen ?? '—'} icon={CircleDot} tone="warn" />
        <SmallStat label="Engineers on shift" value={`${engineerStats.onShift} / ${engineerStats.total}`} icon={Users} />
        <SmallStat label="Engineers busy" value={engineerStats.busy} icon={Wrench} tone="ok" />
      </div>

      {/* ── Main grid: transactions + teams ── */}
      <section style={{
        display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr)',
        gap: 16, padding: '0 24px',
      }} className="rev-grid">
        {/* Transactions */}
        <div style={{
          background: 'var(--surface)', borderRadius: 16,
          border: '1px solid var(--border-light)',
          overflow: 'hidden',
        }}>
          <header style={{
            padding: '14px 18px', borderBottom: '1px solid var(--border-light)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <div>
              <h2 style={{ margin: 0, fontSize: 16 }}>Recent transactions</h2>
              <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--on-surface-variant)' }}>
                Latest 30 paid tickets · auto-updates
              </p>
            </div>
          </header>
          {transactions.length === 0 ? (
            <div style={{ padding: 32, textAlign: 'center', color: 'var(--on-surface-variant)' }}>
              No transactions yet today.
            </div>
          ) : (
            <div style={{ maxHeight: 520, overflowY: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead style={{ position: 'sticky', top: 0, background: 'var(--surface-container-low)' }}>
                  <tr>
                    <Th>Ticket</Th>
                    <Th>Customer</Th>
                    <Th>Method</Th>
                    <Th>Team</Th>
                    <Th align="right">Amount</Th>
                    <Th align="right">Paid</Th>
                  </tr>
                </thead>
                <tbody>
                  <AnimatePresence initial={false}>
                    {transactions.map((tx) => (
                      <motion.tr
                        key={`${tx.ticketNumber}-${tx.paidAt}`}
                        layout
                        initial={{ opacity: 0, backgroundColor: '#dcfce7' }}
                        animate={{ opacity: 1, backgroundColor: 'transparent' }}
                        transition={{ backgroundColor: { duration: 1.2 } }}
                        style={{ borderBottom: '1px solid var(--border-light)' }}
                      >
                        <Td>
                          <Link href={`/tickets/${tx.ticketNumber}`} style={{
                            color: 'var(--primary)', fontWeight: 600, textDecoration: 'none',
                          }}>
                            {tx.ticketNumber}
                          </Link>
                          {tx.priority && (
                            <span style={{
                              marginLeft: 6, fontSize: 10, fontWeight: 700,
                              padding: '1px 6px', borderRadius: 999,
                              background: tx.priority === 'P1' ? '#fee2e2' : tx.priority === 'P2' ? '#fef3c7' : '#e0f2fe',
                              color: tx.priority === 'P1' ? '#b91c1c' : tx.priority === 'P2' ? '#92400e' : '#075985',
                            }}>{tx.priority}</span>
                          )}
                        </Td>
                        <Td>
                          <div style={{ fontWeight: 500 }}>{tx.customerName || '—'}</div>
                          <div style={{ fontSize: 11, color: 'var(--on-surface-variant)' }}>{tx.customerPhone || ''}</div>
                        </Td>
                        <Td>
                          <span style={{ fontSize: 12, color: 'var(--on-surface-variant)' }}>
                            {tx.method || 'MOCK'}
                          </span>
                          {tx.reference && (
                            <div style={{ fontSize: 10, color: 'var(--on-surface-variant)' }}>
                              {String(tx.reference).slice(0, 18)}
                            </div>
                          )}
                        </Td>
                        <Td>{tx.team || '—'}</Td>
                        <Td align="right">
                          <span style={{ fontWeight: 700 }}>{fmtINR(tx.amount)}</span>
                        </Td>
                        <Td align="right">
                          <span style={{ fontSize: 12, color: 'var(--on-surface-variant)' }}>{fmtTime(tx.paidAt)}</span>
                        </Td>
                      </motion.tr>
                    ))}
                  </AnimatePresence>
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Teams */}
        <div style={{
          background: 'var(--surface)', borderRadius: 16,
          border: '1px solid var(--border-light)',
          overflow: 'hidden',
        }}>
          <header style={{
            padding: '14px 18px', borderBottom: '1px solid var(--border-light)',
          }}>
            <h2 style={{ margin: 0, fontSize: 16 }}>Team workload</h2>
            <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--on-surface-variant)' }}>
              Active tickets · resolved today · revenue today
            </p>
          </header>
          {teams.length === 0 ? (
            <div style={{ padding: 32, textAlign: 'center', color: 'var(--on-surface-variant)' }}>
              No team activity yet.
            </div>
          ) : (
            <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {teams.map((tm) => (
                <li key={tm.teamName} style={{
                  padding: '12px 18px', borderBottom: '1px solid var(--border-light)',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  gap: 12,
                }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>{tm.teamName}</div>
                    <div style={{ fontSize: 12, color: 'var(--on-surface-variant)' }}>
                      {tm.activeTickets} active · {tm.resolvedToday} resolved today
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 700, color: 'var(--success, #16a34a)' }}>
                      {fmtINR(tm.revenueToday)}
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--on-surface-variant)' }}>
                      revenue today
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* ── Engineer floor ── */}
      <section style={{
        padding: '16px 24px 32px', display: 'grid', gap: 12,
      }}>
        <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ margin: 0, fontSize: 16 }}>Service Engineers · live status</h2>
          <span style={{ fontSize: 12, color: 'var(--on-surface-variant)' }}>
            {engineerStats.onShift} on shift · {engineerStats.busy} on jobs
          </span>
        </header>
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(220px,1fr))',
          gap: 10,
        }}>
          {engineers.map((e) => (
            <div key={e.id} style={{
              padding: 12, borderRadius: 12,
              background: 'var(--surface)',
              border: `1px solid ${e.onShift ? 'var(--success, #86efac)' : 'var(--border-light)'}`,
              opacity: e.onShift ? 1 : 0.7,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{e.name}</div>
                <span style={{
                  fontSize: 10, fontWeight: 700,
                  padding: '2px 8px', borderRadius: 999,
                  background: e.onShift ? '#dcfce7' : '#f1f5f9',
                  color:     e.onShift ? '#15803d' : '#475569',
                }}>
                  {e.onShift ? 'ON' : 'OFF'}
                </span>
              </div>
              <div style={{ marginTop: 6, fontSize: 12, color: 'var(--on-surface-variant)' }}>
                {e.teamName || 'No team'} · {Number(e.activeJobs)} active job{Number(e.activeJobs) === 1 ? '' : 's'}
              </div>
            </div>
          ))}
        </div>
      </section>

      <style jsx>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        :global(.spin) { animation: spin 900ms linear infinite; }
        @media (max-width: 900px) {
          .rev-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}

function KpiTile({ theme, label, value, icon: Icon, sub }) {
  return (
    <motion.div
      whileHover={{ y: -2 }}
      style={{
        background: theme.bg, color: theme.fg,
        borderRadius: 16, padding: 18, position: 'relative', overflow: 'hidden',
        boxShadow: '0 10px 30px -12px rgba(0,0,0,.18)',
      }}
    >
      <div style={{
        position: 'absolute', right: -10, bottom: -10,
        opacity: 0.15,
      }}>
        <Icon size={84} strokeWidth={1.4} />
      </div>
      <div style={{ fontSize: 12, opacity: 0.9, letterSpacing: 0.3, textTransform: 'uppercase' }}>
        {label}
      </div>
      <div style={{ marginTop: 4, fontSize: 28, fontWeight: 800, lineHeight: 1.1 }}>
        {value}
      </div>
      {sub && (
        <div style={{ marginTop: 6, fontSize: 11, opacity: 0.85 }}>
          {sub}
        </div>
      )}
    </motion.div>
  );
}

function SmallStat({ label, value, icon: Icon, tone }) {
  const colour = tone === 'warn' ? '#b91c1c' : tone === 'ok' ? '#16a34a' : 'var(--on-surface)';
  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--border-light)',
      borderRadius: 12, padding: '12px 14px',
      display: 'flex', alignItems: 'center', gap: 10,
    }}>
      <div style={{
        width: 36, height: 36, borderRadius: 10,
        background: 'var(--surface-container-low)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: colour,
      }}>
        <Icon size={18} />
      </div>
      <div>
        <div style={{ fontSize: 11, color: 'var(--on-surface-variant)', letterSpacing: 0.2 }}>{label}</div>
        <div style={{ fontWeight: 700, fontSize: 16, color: colour }}>{value}</div>
      </div>
    </div>
  );
}

function Th({ children, align }) {
  return (
    <th style={{
      textAlign: align || 'left', padding: '10px 14px',
      fontSize: 11, fontWeight: 700, letterSpacing: 0.3,
      color: 'var(--on-surface-variant)', textTransform: 'uppercase',
      borderBottom: '1px solid var(--border-light)', whiteSpace: 'nowrap',
    }}>{children}</th>
  );
}

function Td({ children, align }) {
  return (
    <td style={{
      padding: '10px 14px', fontSize: 13,
      color: 'var(--on-surface)', textAlign: align || 'left',
      verticalAlign: 'top',
    }}>{children}</td>
  );
}
