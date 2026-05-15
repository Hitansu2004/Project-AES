'use client';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { user as userApi, properties, acUnits, amc } from '@/lib/api';
import styles from './account.module.css';

export default function AccountPage() {
  const { user, loading: authLoading, logout, fetchUser } = useAuth();
  const router = useRouter();
  const [tab, setTab] = useState('profile');
  const [propList, setPropList] = useState([]);
  const [contracts, setContracts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [saving, setSaving] = useState(false);
  const [showPropertyForm, setShowPropertyForm] = useState(false);
  const [newPropLabel, setNewPropLabel] = useState('');
  const [newPropAddr, setNewPropAddr] = useState('');
  const [newPropCity, setNewPropCity] = useState('');

  const loadData = useCallback(async () => {
    try {
      const [props, amcData] = await Promise.allSettled([
        properties.list(),
        amc.myContracts(),
      ]);
      if (props.status === 'fulfilled') setPropList(Array.isArray(props.value) ? props.value : []);
      if (amcData.status === 'fulfilled') setContracts(Array.isArray(amcData.value) ? amcData.value : []);
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.replace('/login'); return; }
    setName(user.name || '');
    setEmail(user.email || '');
    loadData();
  }, [user, authLoading, router, loadData]);

  const handleSaveProfile = async () => {
    setSaving(true);
    try {
      await userApi.updateMe({ name, email });
      await fetchUser();
      setEditing(false);
    } catch { /* ignore */ }
    setSaving(false);
  };

  const handleAddProperty = async () => {
    try {
      await properties.create({ label: newPropLabel, addressLine1: newPropAddr, city: newPropCity });
      setNewPropLabel(''); setNewPropAddr(''); setNewPropCity('');
      setShowPropertyForm(false);
      await loadData();
    } catch { /* ignore */ }
  };

  const handleLogout = async () => {
    await logout();
    router.push('/login');
  };

  if (authLoading || loading) return <div className="loading-page"><div className="spinner"></div></div>;

  return (
    <div className={`page-enter ${styles.page}`}>
      <div className="container page-content">
        {/* Profile Header */}
        <div className={styles.profileHeader}>
          <div className={styles.avatar}>{(user?.name || 'U')[0]}</div>
          <div>
            <h1 className={styles.profileName}>{user?.name || 'User'}</h1>
            <p className={styles.profilePhone}>{user?.phoneNumber || user?.email}</p>
            <span className={`badge ${user?.role === 'CUSTOMER' ? 'badge-warranty' : user?.role === 'CRM_AGENT' ? 'badge-amc' : 'badge-paid'}`}>
              {user?.role?.replace(/_/g, ' ')}
            </span>
          </div>
        </div>

        {/* Tabs */}
        <div className={styles.tabs}>
          {[
            { id: 'profile', label: '👤 Profile' },
            { id: 'properties', label: '🏠 Properties' },
            { id: 'amc', label: '📋 AMC' },
          ].map(t => (
            <button key={t.id} className={`${styles.tab} ${tab === t.id ? styles.tabActive : ''}`} onClick={() => setTab(t.id)}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Profile Tab */}
        {tab === 'profile' && (
          <div className={styles.tabContent}>
            <div className={styles.card}>
              <div className={styles.cardHeader}>
                <h3>Personal Information</h3>
                {!editing && <button className="btn btn-ghost btn-sm" onClick={() => setEditing(true)}>Edit ✎</button>}
              </div>
              {editing ? (
                <div className={styles.formGrid}>
                  <div className="input-group">
                    <label>Full Name</label>
                    <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
                  </div>
                  <div className="input-group">
                    <label>Email</label>
                    <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
                  </div>
                  <div className={styles.formActions}>
                    <button className="btn btn-ghost" onClick={() => setEditing(false)}>Cancel</button>
                    <button className="btn btn-primary" disabled={saving} onClick={handleSaveProfile}>
                      {saving ? 'Saving...' : 'Save Changes'}
                    </button>
                  </div>
                </div>
              ) : (
                <div className={styles.infoGrid}>
                  <div className={styles.infoRow}><span>Name</span><p>{user?.name || '—'}</p></div>
                  <div className={styles.infoRow}><span>Phone</span><p>{user?.phoneNumber || '—'}</p></div>
                  <div className={styles.infoRow}><span>Email</span><p>{user?.email || '—'}</p></div>
                  <div className={styles.infoRow}><span>Role</span><p>{user?.role?.replace(/_/g, ' ')}</p></div>
                </div>
              )}
            </div>

            <button className="btn btn-danger btn-full" onClick={handleLogout}>
              Sign Out
            </button>
          </div>
        )}

        {/* Properties Tab */}
        {tab === 'properties' && (
          <div className={styles.tabContent}>
            {propList.map(prop => (
              <div key={prop.id} className={styles.propertyCard}>
                <div className={styles.propIcon}>🏠</div>
                <div className={styles.propInfo}>
                  <h3>{prop.label}</h3>
                  <p>{prop.addressLine1}{prop.city ? `, ${prop.city}` : ''}</p>
                  <span className={styles.propType}>{prop.propertyType || 'RESIDENTIAL'}</span>
                </div>
              </div>
            ))}

            {showPropertyForm ? (
              <div className={styles.card}>
                <h3 className={styles.formTitle}>Add New Property</h3>
                <div className={styles.formGrid}>
                  <div className="input-group"><label>Property Label</label><input className="input" placeholder="e.g., Villa #42" value={newPropLabel} onChange={(e) => setNewPropLabel(e.target.value)} /></div>
                  <div className="input-group"><label>Address</label><input className="input" placeholder="e.g., Plot 42, Road No. 10, Jubilee Hills" value={newPropAddr} onChange={(e) => setNewPropAddr(e.target.value)} /></div>
                  <div className="input-group"><label>City</label><input className="input" placeholder="e.g., Hyderabad" value={newPropCity} onChange={(e) => setNewPropCity(e.target.value)} /></div>
                  <div className={styles.formActions}>
                    <button className="btn btn-ghost" onClick={() => setShowPropertyForm(false)}>Cancel</button>
                    <button className="btn btn-primary" onClick={handleAddProperty}>Add Property</button>
                  </div>
                </div>
              </div>
            ) : (
              <button className="btn btn-outline btn-full" onClick={() => setShowPropertyForm(true)}>＋ Add New Property</button>
            )}
          </div>
        )}

        {/* AMC Tab */}
        {tab === 'amc' && (
          <div className={styles.tabContent}>
            {contracts.length === 0 ? (
              <div className={styles.emptyState}>
                <span>📋</span>
                <h3>No AMC Contracts</h3>
                <p>You don&apos;t have any active Annual Maintenance Contracts.</p>
              </div>
            ) : (
              contracts.map(c => (
                <div key={c.id} className={styles.amcCard}>
                  <div className={styles.amcHeader}>
                    <span className={`badge ${c.isActive ? 'badge-resolved' : 'badge-paid'}`}>{c.isActive ? 'ACTIVE' : 'EXPIRED'}</span>
                    <span className={styles.amcContract}>{c.contractNumber}</span>
                  </div>
                  <h3>Annual Maintenance Contract</h3>
                  <p>Coverage: {c.startDate} → {c.endDate}</p>
                  <p>Visits: {c.visitsCompleted || 0}/{c.visitsPerYear || 4} completed</p>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
