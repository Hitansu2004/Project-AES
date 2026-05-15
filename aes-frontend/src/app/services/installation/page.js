'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { properties, installations } from '@/lib/api';
import styles from './installation.module.css';

const AC_TYPES = [
  { id: 'SPLIT', label: 'Split AC', desc: '1-3 rooms', range: '1T to 3T', icon: '❄️' },
  { id: 'CASSETTE', label: 'Cassette AC', desc: 'Ceiling mounted', range: '2T to 5T', icon: '🔲' },
  { id: 'CENTRAL_DUCTED', label: 'Central AC/Ducted', desc: 'Whole home', range: '3T to 20T', icon: '🌀' },
  { id: 'VRF_VRV', label: 'VRF/VRV', desc: 'Multi-unit premium', range: 'Commercial', icon: '🏢' },
  { id: 'WINDOW', label: 'Window AC', desc: 'Budget single room', range: '0.75T to 2T', icon: '🪟' },
  { id: 'PORTABLE', label: 'Portable AC', desc: 'No install', range: '1T to 1.5T', icon: '📦' },
];

const BRANDS = ['Daikin', 'Voltas', 'Blue Star', 'LG', 'SAMSUNG', 'Carrier', 'HITACHI', 'Panasonic', "O'General"];
const TONNAGES = ['0.75T', '1.0T', '1.5T', '2.0T', '2.5T', '3.0T'];
const ROOM_TYPES = ['Master Bedroom', 'Living Room', 'Guest Room', 'Study Room', 'Kitchen', 'Office', 'Other'];

const SUGGESTED_MODELS = [
  { brand: 'Daikin', tonnage: '1.5T', model: "FTKF35TV", price: "₹42,999", features: ["5 Star", "Wi-Fi", "Inverter"] },
  { brand: 'Daikin', tonnage: '1.5T', model: "FTKG35TV", price: "₹45,500", features: ["5 Star", "PM 2.5 Filter"] },
  { brand: 'Voltas', tonnage: '1.5T', model: "185V DZT", price: "₹34,999", features: ["5 Star", "Inverter"] },
  { brand: 'Blue Star', tonnage: '1.5T', model: "IC518YNUW", price: "₹38,500", features: ["5 Star", "Wi-Fi"] },
  { brand: 'LG', tonnage: '1.5T', model: "RS-Q18YNZE", price: "₹36,999", features: ["5 Star", "Dual Inverter"] }
];

const generateDays = () => {
  const days = [];
  for (let i = 0; i < 14; i++) {
    const d = new Date();
    d.setDate(d.getDate() + i);
    days.push({
      dateStr: d.toISOString().split('T')[0],
      dayName: d.toLocaleDateString('en-US', { weekday: 'short' }),
      dayNum: d.getDate(),
      disabled: i === 0 // Today greyed out
    });
  }
  return days;
};

export default function InstallationPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [step, setStep] = useState(1); // 1=type, 2=brand, 3=location, 4=schedule, 5=success
  const [acType, setAcType] = useState('');
  const [brand, setBrand] = useState('');
  const [tonnage, setTonnage] = useState('1.5T');
  const [selectedModel, setSelectedModel] = useState('');
  const [propList, setPropList] = useState([]);
  const [selectedProperty, setSelectedProperty] = useState(null);
  const [propertyType, setPropertyType] = useState('RESIDENTIAL');
  const [rooms, setRooms] = useState([{ roomType: 'Master Bedroom', sizeSqft: '', acType: 'Split AC' }]);
  const [notes, setNotes] = useState('');
  const [preferredDate, setPreferredDate] = useState('');
  const [preferredSlot, setPreferredSlot] = useState('MORNING');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.replace('/login'); return; }
    async function load() {
      try {
        const props = await properties.list();
        const arr = Array.isArray(props) ? props : [];
        setPropList(arr);
        if (arr.length > 0) setSelectedProperty(arr[0]);
      } catch { /* ignore */ }
      setLoading(false);
    }
    load();
  }, [user, authLoading, router]);

  const addRoom = () => setRooms([...rooms, { roomType: 'Living Room', sizeSqft: '', acType: 'Split AC' }]);
  const removeRoom = (i) => setRooms(rooms.filter((_, idx) => idx !== i));
  const updateRoom = (i, field, val) => {
    const updated = [...rooms];
    updated[i] = { ...updated[i], [field]: val };
    setRooms(updated);
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setError('');
    try {
      const res = await installations.create({
        propertyId: selectedProperty?.id,
        acType,
        brand,
        tonnage: parseFloat(tonnage),
        rooms,
        notes: notes || null,
        scheduledDate: preferredDate || null,
        scheduledSlot: preferredSlot,
      });
      setResult(res);
      setStep(5);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (authLoading || loading) return <div className="loading-page"><div className="spinner"></div></div>;

  // Success
  if (step === 5) {
    return (
      <div className={`page-enter ${styles.page}`}>
        <div className="container page-content">
          <div className={styles.success}>
            <div className={styles.successIcon}>✓</div>
            <h1 className="headline-lg">Request Submitted!</h1>
            <p className={styles.successRef}>Request No: <strong>{result?.requestNumber || 'N/A'}</strong></p>
            <div className={styles.successInfo}>
              <p>Our team will contact you within 2 hours to confirm your site visit on <strong>{preferredDate || 'TBD'}</strong>.</p>
            </div>
            <div className={styles.timeline}>
              <h3>WHAT HAPPENS NEXT</h3>
              <div className={`${styles.timelineItem} ${styles.active}`}><span className={styles.dotDone}>✓</span> Request received</div>
              <div className={`${styles.timelineItem} ${styles.active}`}><span className={styles.dotActive}>●</span> Team reviews & confirms</div>
              <div className={styles.timelineItem}><span className={styles.dotPending}>○</span> Engineer visits your site</div>
              <div className={styles.timelineItem}><span className={styles.dotPending}>○</span> Quote shared within 24h</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '32px', width: '100%' }}>
              <button className="btn btn-outline btn-full btn-lg" onClick={() => router.push('/tickets')}>Track This Request</button>
              <button className="btn btn-primary btn-full btn-lg" onClick={() => router.push('/dashboard')}>Back to Home</button>
            </div>
            <div style={{ marginTop: '24px', color: 'var(--on-surface-variant)', fontSize: '14px' }}>
              <p>Need to change or cancel?</p>
              <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', marginTop: '8px' }}>
                <a href="tel:+914023540000" style={{ color: 'var(--secondary)', fontWeight: '600', textDecoration: 'none' }}>📞 Call Us</a>
                <a href="https://wa.me/914023540000" style={{ color: '#25D366', fontWeight: '600', textDecoration: 'none' }}>💬 WhatsApp</a>
              </div>
            </div>
          </div>
        </div>
    );
  }

  return (
    <div className={`page-enter ${styles.page}`}>
      <div className={styles.topBar}>
        <button className={styles.backBtn} onClick={() => step > 1 ? setStep(step - 1) : router.back()}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6"/></svg>
        </button>
        <h1 className={styles.pageTitle}>New Installation</h1>
        <span className={styles.stepBadge}>{step} of 4</span>
      </div>
      <div className={styles.progress}><div className={styles.progressBar} style={{ width: `${(step / 4) * 100}%` }}></div></div>

      {error && <div className={styles.error}>{error}</div>}

      {/* Step 1: AC Type */}
      {step === 1 && (
        <>
          <div className={styles.stepContent}>
            <h2>What type of AC do you need?</h2>
            <p className={styles.stepDesc}>Choose based on your space requirements</p>
            <div className={styles.typeList}>
              {AC_TYPES.map(t => (
                <button key={t.id} className={`${styles.typeCard} ${acType === t.id ? styles.typeSelected : ''}`} onClick={() => setAcType(t.id)}>
                  {acType === t.id && <span className={styles.check}>✓</span>}
                  <div><span className={styles.typeIconWrapper}>{t.icon}</span></div>
                  <h3>{t.label}</h3>
                  <p>{t.desc}</p>
                  <div><span className={styles.typeRange}>{t.range}</span></div>
                </button>
              ))}
            </div>
          </div>
          <div className={styles.actionArea}>
            <div className={styles.actionAreaInner} style={{width:'100%'}}>
              <button className={styles.actionBtn} disabled={!acType} onClick={() => setStep(2)}>Continue →</button>
            </div>
          </div>
        </>
      )}

      {/* Step 2: Brand & Specs */}
      {step === 2 && (
        <>
          <div className={styles.stepContent}>
            <h2 className={styles.sectionTitle}>Select Brand</h2>
            <div className={styles.brandGrid}>
              {BRANDS.map(b => (
                <button key={b} className={`${styles.brandBtn} ${brand === b ? styles.brandSelected : ''}`} onClick={() => setBrand(b)}>
                  {brand === b && <span className={styles.checkSmall}>✓</span>}
                  {b}
                </button>
              ))}
            </div>

            <h2 className={styles.sectionTitle}>Capacity (Tonnage)</h2>
            <div className={styles.scrollRow}>
              {TONNAGES.map(t => (
                <button key={t} className={`${styles.pillBtn} ${tonnage === t ? styles.pillSelected : ''}`} onClick={() => setTonnage(t)}>
                  {t}
                </button>
              ))}
              <button className={styles.pillBtn}>Custom</button>
            </div>
            
            <h2 className={styles.sectionTitle}>Energy Rating</h2>
            <div className={styles.scrollRow}>
              <button className={styles.pillBtn}>3 Star ⭐⭐⭐</button>
              <button className={styles.pillBtn}>4 Star ⭐⭐⭐⭐</button>
              <button className={`${styles.pillBtn} ${styles.pillGold}`}>5 Star ⭐⭐⭐⭐⭐</button>
            </div>
            
            {brand && tonnage && (
              <>
                <h2 className={styles.sectionTitle}>Suggested Models</h2>
                <div className={styles.scrollRow}>
                  {SUGGESTED_MODELS.filter(m => m.brand === brand && m.tonnage === tonnage).length > 0 ? (
                    SUGGESTED_MODELS.filter(m => m.brand === brand && m.tonnage === tonnage).map(m => (
                      <div key={m.model} className={styles.modelCard}>
                        <h4>{m.model}</h4>
                        <p>{m.brand} • {m.tonnage} • Split AC</p>
                        <div className={styles.modelPrice}>{m.price} onwards</div>
                        <div className={styles.modelFeatures}>
                          {m.features.map(f => <span key={f} className={styles.modelFeature}>{f}</span>)}
                        </div>
                        <button 
                          className={selectedModel === m.model ? styles.modelSelectedBtn : styles.modelSelectBtn}
                          onClick={() => setSelectedModel(m.model)}
                        >
                          {selectedModel === m.model ? 'Selected' : 'Select Model'}
                        </button>
                      </div>
                    ))
                  ) : (
                    <div style={{padding: '0 20px', color: 'var(--outline)'}}>No exact matches. Our engineer will suggest the best option.</div>
                  )}
                </div>
              </>
            )}
          </div>
          <div className={styles.actionArea}>
            <div className={styles.actionAreaInner} style={{display:'flex', justifyContent:'space-between', width:'100%'}}>
              <button className={styles.skipBtn} onClick={() => setStep(3)}>Skip for now</button>
              <button className={styles.actionBtn} style={{width:'auto', padding:'0 32px'}} disabled={!brand} onClick={() => setStep(3)}>Continue →</button>
            </div>
          </div>
        </>
      )}

      {/* Step 3: Property & Rooms */}
      {step === 3 && (
        <>
          <div className={styles.stepContent}>
            <h2>Where do you need installation?</h2>
            <p className={styles.stepDesc}>Tell us about your property</p>
            
            <div className={styles.propTypeToggle}>
              <button className={`${styles.propTypeBtn} ${propertyType === 'RESIDENTIAL' ? styles.propTypeActive : ''}`} onClick={() => setPropertyType('RESIDENTIAL')}>Residential</button>
              <button className={`${styles.propTypeBtn} ${propertyType === 'COMMERCIAL' ? styles.propTypeActive : ''}`} onClick={() => setPropertyType('COMMERCIAL')}>Commercial/Office</button>
            </div>

            {propList.length > 0 && (
              <div style={{marginBottom: '24px'}}>
                <label className={styles.fieldLabel}>INSTALLATION ADDRESS</label>
                <select className="input select" value={selectedProperty?.id || ''} onChange={(e) => setSelectedProperty(propList.find(p => p.id === Number(e.target.value)))}>
                  {propList.map(p => <option key={p.id} value={p.id}>{p.label}, {p.addressLine1}</option>)}
                </select>
              </div>
            )}

            <label className={styles.fieldLabel}>ROOM DETAILS</label>
            {rooms.map((room, i) => (
              <div key={i} className={styles.roomCard}>
                {rooms.length > 1 && <button className={styles.removeRoom} onClick={() => removeRoom(i)}>✕</button>}
                <div className="input-group">
                  <label>Room Type</label>
                  <select className="input select" value={room.roomType} onChange={(e) => updateRoom(i, 'roomType', e.target.value)}>
                    {ROOM_TYPES.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
                <div className="input-group">
                  <label>Size (sq ft)</label>
                  <input className="input" type="number" placeholder="e.g. 200" value={room.sizeSqft} onChange={(e) => updateRoom(i, 'sizeSqft', e.target.value)} />
                </div>
              </div>
            ))}
            <button className={`btn btn-outline btn-full`} style={{marginBottom: '24px'}} onClick={addRoom}>＋ Add Another Room</button>

            <div className="input-group">
              <label className={styles.fieldLabel}>ADDITIONAL NOTES</label>
              <textarea className="input textarea" placeholder="Any specific requirements? (e.g., concealed wiring, specific unit placement...)" value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
          </div>
          
          <div className={styles.actionArea}>
            <div className={styles.actionAreaInner} style={{width:'100%'}}>
              <button className={styles.actionBtn} onClick={() => setStep(4)}>Continue →</button>
            </div>
          </div>
        </>
      )}

      {/* Step 4: Schedule */}
      {step === 4 && (
        <>
          <div className={styles.stepContent}>
            <h2>When should we visit?</h2>
            <div className={styles.visitInfo}>
              <span style={{fontSize:'20px'}}>ℹ️</span>
              <p>Free site visit. Our engineer will assess and provide a detailed quote within 24 hours.</p>
            </div>

            <label className={styles.fieldLabel}>PREFERRED DATE</label>
            <div className={styles.dayPicker}>
              {generateDays().map(day => (
                <button
                  key={day.dateStr}
                  disabled={day.disabled}
                  className={`${styles.dayCard} ${day.disabled ? styles.dayDisabled : ''} ${preferredDate === day.dateStr ? styles.daySelected : ''}`}
                  onClick={() => setPreferredDate(day.dateStr)}
                >
                  <span>{day.dayName}</span>
                  <span>{day.dayNum}</span>
                </button>
              ))}
            </div>

            <label className={styles.fieldLabel}>TIME SLOT</label>
            <div className={styles.slotList}>
              {[
                { id: 'MORNING', label: 'Morning', time: '9AM – 12PM', icon: '☀️' },
                { id: 'AFTERNOON', label: 'Afternoon', time: '12PM – 4PM', icon: '🌤️' },
                { id: 'EVENING', label: 'Evening', time: '4PM – 7PM', icon: '🌙' },
              ].map(s => (
                <button key={s.id} className={`${styles.slotCard} ${preferredSlot === s.id ? styles.slotActive : ''}`} onClick={() => setPreferredSlot(s.id)}>
                  <div className={`${styles.slotIcon} ${preferredSlot === s.id ? styles.slotSelectedIcon : ''}`}>{s.icon}</div>
                  <div style={{flex: 1}}><h4>{s.label}</h4><p>{s.time}</p></div>
                  {preferredSlot === s.id && <div className={styles.slotCheck}>✓</div>}
                </button>
              ))}
            </div>

            <div className={styles.installSummary}>
              <h3>Installation Summary</h3>
              <div className={styles.summaryRow}><span>Equipment</span><span>{acType?.replace(/_/g, ' ')} • {brand || 'Any'} • {tonnage}</span></div>
              <div className={styles.summaryRow}><span>Location</span><span>{rooms.length} Room{rooms.length > 1 ? 's' : ''} @ {selectedProperty?.label || 'TBD'}</span></div>
              <div className={styles.summaryRow}><span>Scheduled Visit</span><span>{preferredDate || 'TBD'}, {preferredSlot}</span></div>
            </div>
          </div>
          
          <div className={styles.actionArea}>
            <div className={styles.actionAreaInner} style={{width:'100%'}}>
              <button className={styles.actionBtn} disabled={submitting || !preferredDate} onClick={handleSubmit}>
                {submitting ? 'Submitting...' : 'Submit Request →'}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
