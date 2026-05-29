'use client';
import { Suspense, useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import {
  user as userApi, properties, acUnits, amc,
  amcUpgrades as amcUpgradesApi,
} from '@/lib/api';
import { useToast } from '@/components/ui/Toast';
import LocationPicker from '@/components/ui/LocationPicker';
import { MapPin, Check } from 'lucide-react';
import styles from './account.module.css';

export default function AccountPageWrapper() {
  return (
    <Suspense fallback={<div className="loading-page"><div className="spinner" /></div>}>
      <AccountPage />
    </Suspense>
  );
}

function AccountPage() {
  const { user, loading: authLoading, logout, fetchUser } = useAuth();
  const router = useRouter();
  const search = useSearchParams();
  const toast = useToast();
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
  const [newPropPin, setNewPropPin]   = useState('');
  const [propSaving, setPropSaving]   = useState(false);
  // V12: pinned coordinates picked via Google Maps
  const [newPropPin_lat, setNewPropLat] = useState(null);
  const [newPropPin_lng, setNewPropLng] = useState(null);
  const [newPropPin_addr, setNewPropFmtAddr] = useState('');
  const [newPropPin_landmark, setNewPropLandmark] = useState('');
  const [newPropPin_secondary, setNewPropSecondary] = useState('');
  const [newPropPin_placeId, setNewPropPlaceId] = useState(null);
  const [showLocPicker, setShowLocPicker] = useState(false);

  // Add-AC-unit form state (per property)
  const [addAcFor, setAddAcFor] = useState(null); // property
  const [acRoom, setAcRoom]     = useState('');
  const [acType, setAcType]     = useState('SPLIT');
  const [acBrand, setAcBrand]   = useState('');
  const [acModel, setAcModel]   = useState('');
  const [acTon, setAcTon]       = useState('1.5');
  const [acStar, setAcStar]     = useState(3);
  const [acSaving, setAcSaving] = useState(false);

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

  // Allow deep-linking to /account?tab=properties or ?tab=properties&new=1
  useEffect(() => {
    const t = search.get('tab');
    if (t === 'profile' || t === 'properties' || t === 'amc') setTab(t);
    if (search.get('new') === '1' && t === 'properties') setShowPropertyForm(true);
  }, [search]);

  const handleSaveProfile = async () => {
    setSaving(true);
    try {
      await userApi.updateMe({ name, email });
      await fetchUser();
      setEditing(false);
      toast.success('Profile saved.');
    } catch (e) {
      toast.error(e?.message || 'Could not save profile.');
    }
    setSaving(false);
  };

  const handleAddProperty = async () => {
    if (!newPropLabel.trim()) { toast.warning('Property label is required.'); return; }
    if (!newPropAddr.trim())  { toast.warning('Address is required.'); return; }
    if (newPropPin && !/^\d{6}$/.test(newPropPin)) {
      toast.warning('PIN code must be 6 digits.'); return;
    }
    setPropSaving(true);
    try {
      await properties.create({
        label: newPropLabel.trim(),
        addressLine1: newPropAddr.trim(),
        city: newPropCity.trim() || 'Hyderabad',
        pincode: newPropPin.trim() || undefined,
        // V12 — only send coords if user actually picked a pin
        latitude:         newPropPin_lat ?? undefined,
        longitude:        newPropPin_lng ?? undefined,
        formattedAddress: newPropPin_addr || undefined,
        landmark:         newPropPin_landmark || undefined,
        secondaryPhone:   newPropPin_secondary || undefined,
        googlePlaceId:    newPropPin_placeId || undefined,
      });
      toast.success('Property added.');
      setNewPropLabel(''); setNewPropAddr(''); setNewPropCity(''); setNewPropPin('');
      setNewPropLat(null); setNewPropLng(null); setNewPropFmtAddr('');
      setNewPropLandmark(''); setNewPropSecondary(''); setNewPropPlaceId(null);
      setShowPropertyForm(false);
      await loadData();
    } catch (e) {
      toast.error(e?.message || 'Could not add property.');
    } finally {
      setPropSaving(false);
    }
  };

  const handleAddAcUnit = async () => {
    if (!addAcFor) return;
    if (!acRoom.trim())  { toast.warning('Room label is required.'); return; }
    if (!acBrand.trim()) { toast.warning('Brand is required.'); return; }
    const tonNum = Number(acTon);
    if (!Number.isFinite(tonNum) || tonNum < 0.5 || tonNum > 20) {
      toast.warning('Tonnage must be between 0.5 and 20.'); return;
    }
    setAcSaving(true);
    try {
      await acUnits.create(addAcFor.id, {
        roomLabel: acRoom.trim(),
        acType,
        brand: acBrand.trim(),
        modelNumber: acModel.trim() || undefined,
        tonnage: tonNum,
        energyStarRating: Number(acStar) || undefined,
      });
      toast.success(`AC added to ${addAcFor.label}.`);
      setAcRoom(''); setAcBrand(''); setAcModel(''); setAcTon('1.5'); setAcStar(3);
      setAddAcFor(null);
      await loadData();
    } catch (e) {
      toast.error(e?.message || 'Could not add AC unit.');
    } finally {
      setAcSaving(false);
    }
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
            {propList.length === 0 && !showPropertyForm && (
              <div className={styles.emptyState}>
                <span>🏠</span>
                <h3>No properties yet</h3>
                <p>Add a property and at least one AC unit before raising a service ticket.</p>
              </div>
            )}

            {propList.map(prop => {
              const units = prop.acUnits || [];
              return (
                <div key={prop.id} className={styles.card}>
                  <div className={styles.propertyCard} style={{ marginBottom: 0 }}>
                    <div className={styles.propIcon}>🏠</div>
                    <div className={styles.propInfo}>
                      <h3>{prop.label}</h3>
                      <p>{prop.addressLine1}{prop.city ? `, ${prop.city}` : ''}{prop.pincode ? ` · ${prop.pincode}` : ''}</p>
                      <span className={styles.propType}>{prop.propertyType || 'RESIDENTIAL'}</span>
                      <span className={styles.propType} style={{ marginLeft: 6 }}>
                        {units.length} AC unit{units.length === 1 ? '' : 's'}
                      </span>
                    </div>
                  </div>

                  {units.length > 0 && (
                    <ul style={{ listStyle: 'none', padding: 0, margin: '12px 0 0', display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {units.map((u) => (
                        <AcUnitRow key={u.id} unit={u} property={prop} />
                      ))}
                    </ul>
                  )}

                  {addAcFor?.id === prop.id ? (
                    <div className={styles.formGrid} style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--outline-variant)' }}>
                      <h3 className={styles.formTitle}>Add AC unit to {prop.label}</h3>
                      <div className="input-group"><label>Room label*</label><input className="input" placeholder="Living Room" value={acRoom} onChange={(e) => setAcRoom(e.target.value)} /></div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                        <div className="input-group"><label>AC type</label>
                          <select className="input" value={acType} onChange={(e) => setAcType(e.target.value)}>
                            <option value="SPLIT">Split</option>
                            <option value="WINDOW">Window</option>
                            <option value="CASSETTE">Cassette</option>
                            <option value="CENTRAL">Central</option>
                            <option value="VRF_VRV">VRF / VRV</option>
                          </select>
                        </div>
                        <div className="input-group"><label>Tonnage*</label>
                          <input className="input" type="number" min="0.5" max="20" step="0.5"
                                 value={acTon} onChange={(e) => setAcTon(e.target.value)} />
                        </div>
                      </div>
                      <div className="input-group"><label>Brand*</label><input className="input" placeholder="Daikin / LG / Voltas…" value={acBrand} onChange={(e) => setAcBrand(e.target.value)} /></div>
                      <div className="input-group"><label>Model number</label><input className="input" placeholder="FTKM50UV (optional)" value={acModel} onChange={(e) => setAcModel(e.target.value)} /></div>
                      <div className="input-group"><label>Energy rating</label>
                        <select className="input" value={acStar} onChange={(e) => setAcStar(Number(e.target.value))}>
                          {[1,2,3,4,5].map(n => <option key={n} value={n}>{n} star</option>)}
                        </select>
                      </div>
                      <div className={styles.formActions}>
                        <button className="btn btn-ghost" disabled={acSaving} onClick={() => setAddAcFor(null)}>Cancel</button>
                        <button className="btn btn-primary" disabled={acSaving} onClick={handleAddAcUnit}>
                          {acSaving ? 'Adding…' : 'Add AC unit'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button className="btn btn-outline btn-sm" style={{ marginTop: 10 }}
                            onClick={() => setAddAcFor(prop)}>
                      ＋ Add AC unit
                    </button>
                  )}
                </div>
              );
            })}

            {showPropertyForm ? (
              <div className={styles.card}>
                <h3 className={styles.formTitle}>Add New Property</h3>
                <div className={styles.formGrid}>
                  <div className="input-group"><label>Property Label*</label><input className="input" placeholder="e.g., Villa #42" value={newPropLabel} onChange={(e) => setNewPropLabel(e.target.value)} /></div>
                  <div className="input-group"><label>Address*</label><input className="input" placeholder="e.g., Plot 42, Road No. 10, Jubilee Hills" value={newPropAddr} onChange={(e) => setNewPropAddr(e.target.value)} /></div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <div className="input-group"><label>City</label><input className="input" placeholder="Hyderabad" value={newPropCity} onChange={(e) => setNewPropCity(e.target.value)} /></div>
                    <div className="input-group"><label>PIN code</label><input className="input" placeholder="500034" maxLength={6} value={newPropPin} onChange={(e) => setNewPropPin(e.target.value.replace(/\D/g,''))} /></div>
                  </div>

                  {/* V12 — Maps pin (recommended) */}
                  {newPropPin_lat && newPropPin_lng ? (
                    <button type="button"
                            onClick={() => setShowLocPicker(true)}
                            style={{
                              display:'flex', alignItems:'flex-start', gap:10,
                              width:'100%', textAlign:'left', cursor:'pointer',
                              padding:'10px 12px', borderRadius:10,
                              background:'linear-gradient(135deg, #16a34a15, #22c55e10)',
                              border:'1px solid #16a34a40',
                            }}>
                      <Check size={16} color="#16a34a" style={{ marginTop:2, flexShrink:0 }} />
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontSize:11, color:'#16a34a', fontWeight:700, letterSpacing:0.3, textTransform:'uppercase' }}>
                          Pinned on map · tap to change
                        </div>
                        <div style={{ fontSize:13, color:'var(--on-surface)', marginTop:2 }}>
                          {newPropPin_addr}
                        </div>
                      </div>
                    </button>
                  ) : (
                    <button type="button"
                            onClick={() => setShowLocPicker(true)}
                            style={{
                              display:'flex', alignItems:'center', gap:10,
                              width:'100%', textAlign:'left', cursor:'pointer',
                              padding:'10px 12px', borderRadius:10,
                              background:'var(--surface-container-low, #f8fafc)',
                              border:'1px dashed var(--border-light, #cbd5e1)',
                            }}>
                      <MapPin size={16} color="var(--secondary, #0ea5e9)" />
                      <div style={{ flex:1 }}>
                        <div style={{ fontSize:13, fontWeight:600, color:'var(--on-surface)' }}>
                          Pin on map (recommended)
                        </div>
                        <div style={{ fontSize:11, color:'var(--on-surface-variant)', marginTop:2 }}>
                          We&rsquo;ll use this for accurate distance pricing &amp; engineer routing.
                        </div>
                      </div>
                    </button>
                  )}

                  <div className={styles.formActions}>
                    <button className="btn btn-ghost" disabled={propSaving} onClick={() => setShowPropertyForm(false)}>Cancel</button>
                    <button className="btn btn-primary" disabled={propSaving} onClick={handleAddProperty}>
                      {propSaving ? 'Adding…' : 'Add Property'}
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <button className="btn btn-outline btn-full" onClick={() => setShowPropertyForm(true)}>＋ Add New Property</button>
            )}

            <LocationPicker
              open={showLocPicker}
              initial={newPropPin_lat ? {
                lat: newPropPin_lat,
                lng: newPropPin_lng,
                formattedAddress: newPropPin_addr,
                landmark: newPropPin_landmark,
                secondaryPhone: newPropPin_secondary,
              } : null}
              onClose={() => setShowLocPicker(false)}
              onSave={(loc) => {
                setNewPropLat(loc.lat);
                setNewPropLng(loc.lng);
                setNewPropFmtAddr(loc.formattedAddress);
                setNewPropLandmark(loc.landmark || '');
                setNewPropSecondary(loc.secondaryPhone || '');
                setNewPropPlaceId(loc.googlePlaceId || null);
                // Always overwrite the address line with the picked one
                // — the customer just confirmed it visually on the map.
                setNewPropAddr(loc.formattedAddress);
                // Auto-fill city + PIN from Google's addressComponents so
                // the customer doesn't have to retype what they just picked.
                if (loc.city)    setNewPropCity(loc.city);
                if (loc.pincode) setNewPropPin(loc.pincode);
                setShowLocPicker(false);
                toast.success('Pin saved.');
              }}
            />
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

/* ─── AC unit row (warranty status + Upgrade-to-AMC CTA) ───── */
function AcUnitRow({ unit, property }) {
  const toast = useToast();
  const [requesting, setRequesting] = useState(false);

  const badge = unit.warrantyBadge || 'No Warranty';
  const daysLeft = unit.warrantyDaysLeft;
  const isExpired = badge === 'Expired';
  const isExpiring = badge === 'Expiring soon';
  const inWarranty = badge === 'In Warranty';

  // Format expiry detail string
  let detail = 'No warranty info on file';
  if (unit.warrantyExpiry) {
    const dt = new Date(unit.warrantyExpiry);
    const dateStr = dt.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    if (daysLeft >= 0) detail = `Expires in ${daysLeft} day${daysLeft === 1 ? '' : 's'} · ${dateStr}`;
    else detail = `Expired ${Math.abs(daysLeft)} day${daysLeft === -1 ? '' : 's'} ago · ${dateStr}`;
  }

  const handleUpgrade = async () => {
    setRequesting(true);
    try {
      await amcUpgradesApi.create({
        propertyId: property.id,
        acUnitId:   unit.id,
        preferredPlan: 'PREMIUM',
        notes: `Customer requested AMC upgrade for ${unit.roomLabel} (${unit.brand} ${unit.modelNumber || ''})`,
      });
      toast.success("AMC upgrade request sent — we'll call you within 4 working hours.");
    } catch (e) {
      toast.error(e?.message || 'Could not send upgrade request');
    } finally { setRequesting(false); }
  };

  const tone =
    inWarranty   ? { bg: '#16a34a15', fg: '#15803d', border: '#16a34a40' }
  : isExpiring   ? { bg: '#f59e0b18', fg: '#b45309', border: '#f59e0b40' }
  : isExpired    ? { bg: '#ef444415', fg: '#b91c1c', border: '#ef444440' }
                 : { bg: '#94a3b820', fg: '#475569', border: '#cbd5e1' };

  return (
    <li style={{
      padding: '10px 12px',
      background: 'var(--surface-container-low)',
      borderRadius: 10,
      border: '1px solid var(--border-light)',
      display: 'flex', flexDirection: 'column', gap: 8,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <span style={{ fontWeight: 700, fontSize: 14 }}>{unit.roomLabel}</span>
        <span style={{ color: 'var(--on-surface-variant)', fontSize: 13 }}>
          · {unit.brand} {unit.modelNumber || ''} · {unit.tonnage || '?'}T · {unit.acType?.replace('_', '/')}
        </span>
        <span style={{
          marginLeft: 'auto',
          padding: '3px 9px', borderRadius: 999, fontSize: 11, fontWeight: 700,
          background: tone.bg, color: tone.fg, border: `1px solid ${tone.border}`,
          textTransform: 'uppercase', letterSpacing: 0.4,
        }}>
          {badge}
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
                    fontSize: 12, color: 'var(--on-surface-variant)' }}>
        <span>{detail}</span>
        {unit.purchasedFromAes && (
          <span style={{ fontStyle: 'italic' }}>· AES installed</span>
        )}
      </div>

      {(isExpired || (!unit.warrantyExpiry && !unit.amcContractId)) && (
        <button
          onClick={handleUpgrade}
          disabled={requesting}
          style={{
            alignSelf: 'flex-start',
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '7px 14px', borderRadius: 8,
            background: 'linear-gradient(135deg, #6366f1, #0ea5e9)', color: '#fff',
            border: 'none', fontWeight: 600, fontSize: 12, cursor: 'pointer',
          }}>
          {requesting ? 'Sending…' : '⭐ Upgrade to AMC'}
        </button>
      )}
    </li>
  );
}
