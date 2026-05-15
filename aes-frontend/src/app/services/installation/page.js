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

export default function InstallationPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [step, setStep] = useState(1); // 1=type, 2=brand, 3=location, 4=schedule, 5=success
  const [acType, setAcType] = useState('');
  const [brand, setBrand] = useState('');
  const [tonnage, setTonnage] = useState('1.5T');
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
              <div className={styles.timelineItem}><span className={styles.dotDone}>✓</span> Request received</div>
              <div className={styles.timelineItem}><span className={styles.dotActive}>●</span> Team reviews & confirms</div>
              <div className={styles.timelineItem}><span className={styles.dotPending}>○</span> Engineer visits your site</div>
              <div className={styles.timelineItem}><span className={styles.dotPending}>○</span> Quote shared within 24h</div>
            </div>
            <button className="btn btn-primary btn-full btn-lg" onClick={() => router.push('/dashboard')}>Back to Home</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`page-enter ${styles.page}`}>
      <div className="container page-content">
        <div className={styles.topBar}>
          <button className={styles.backBtn} onClick={() => step > 1 ? setStep(step - 1) : router.back()}>← Back</button>
          <h1 className={styles.pageTitle}>New Installation</h1>
          <span className={styles.stepBadge}>{step} of 4</span>
        </div>
        <div className={styles.progress}><div className={styles.progressBar} style={{ width: `${(step / 4) * 100}%` }}></div></div>

        {error && <div className={styles.error}>{error}</div>}

        {/* Step 1: AC Type */}
        {step === 1 && (
          <div className={styles.stepContent}>
            <h2 className="headline-md">What type of AC do you need?</h2>
            <p className={styles.stepDesc}>Choose based on your space requirements</p>
            <div className={styles.typeList}>
              {AC_TYPES.map(t => (
                <button key={t.id} className={`${styles.typeCard} ${acType === t.id ? styles.typeSelected : ''}`} onClick={() => setAcType(t.id)}>
                  {acType === t.id && <span className={styles.check}>✓</span>}
                  <span className={styles.typeIcon}>{t.icon}</span>
                  <h3>{t.label}</h3>
                  <p>{t.desc}</p>
                  <span className={styles.typeRange}>{t.range}</span>
                </button>
              ))}
            </div>
            {acType && <button className="btn btn-primary btn-full btn-lg" onClick={() => setStep(2)}>Continue →</button>}
          </div>
        )}

        {/* Step 2: Brand & Specs */}
        {step === 2 && (
          <div className={styles.stepContent}>
            <h2 className="headline-md">Select Brand</h2>
            <div className={styles.brandGrid}>
              {BRANDS.map(b => (
                <button key={b} className={`${styles.brandBtn} ${brand === b ? styles.brandSelected : ''}`} onClick={() => setBrand(b)}>
                  {brand === b && <span className={styles.checkSmall}>✓</span>}
                  {b}
                </button>
              ))}
            </div>

            <h2 className="headline-md">Capacity (Tonnage)</h2>
            <div className={styles.tonnageRow}>
              {TONNAGES.map(t => (
                <button key={t} className={`${styles.tonnageBtn} ${tonnage === t ? styles.tonnageActive : ''}`} onClick={() => setTonnage(t)}>
                  {t}
                </button>
              ))}
            </div>

            <div className={styles.actions}>
              <button className="btn btn-ghost" onClick={() => setStep(3)}>Skip for now</button>
              <button className="btn btn-primary btn-lg" onClick={() => setStep(3)}>Continue →</button>
            </div>
          </div>
        )}

        {/* Step 3: Property & Rooms */}
        {step === 3 && (
          <div className={styles.stepContent}>
            <h2 className="headline-md">Where do you need installation?</h2>
            <div className={styles.propTypeToggle}>
              <button className={`${styles.propTypeBtn} ${propertyType === 'RESIDENTIAL' ? styles.propTypeActive : ''}`} onClick={() => setPropertyType('RESIDENTIAL')}>Residential</button>
              <button className={`${styles.propTypeBtn} ${propertyType === 'COMMERCIAL' ? styles.propTypeActive : ''}`} onClick={() => setPropertyType('COMMERCIAL')}>Commercial/Office</button>
            </div>

            {propList.length > 0 && (
              <>
                <label className={styles.fieldLabel}>INSTALLATION ADDRESS</label>
                <select className="input select" value={selectedProperty?.id || ''} onChange={(e) => setSelectedProperty(propList.find(p => p.id === Number(e.target.value)))}>
                  {propList.map(p => <option key={p.id} value={p.id}>{p.label}, {p.addressLine1}</option>)}
                </select>
              </>
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
            <button className={`btn btn-outline btn-full`} onClick={addRoom}>＋ Add Another Room</button>

            <div className="input-group">
              <label>ADDITIONAL NOTES</label>
              <textarea className="input textarea" placeholder="Any specific requirements? (e.g., concealed wiring, specific unit placement...)" value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>

            <button className="btn btn-primary btn-full btn-lg" onClick={() => setStep(4)}>Continue →</button>
          </div>
        )}

        {/* Step 4: Schedule */}
        {step === 4 && (
          <div className={styles.stepContent}>
            <h2 className="headline-md">When should we visit?</h2>
            <div className={styles.visitInfo}>
              <p>ℹ️ Free site visit. Our engineer will assess and provide a detailed quote within 24 hours.</p>
            </div>

            <div className="input-group">
              <label>Preferred Date</label>
              <input className="input" type="date" value={preferredDate} onChange={(e) => setPreferredDate(e.target.value)}
                min={new Date().toISOString().split('T')[0]} />
            </div>

            <div className={styles.slotList}>
              {[
                { id: 'MORNING', label: 'Morning', time: '9AM – 12PM', icon: '☀️' },
                { id: 'AFTERNOON', label: 'Afternoon', time: '12PM – 4PM', icon: '🌤️' },
                { id: 'EVENING', label: 'Evening', time: '4PM – 7PM', icon: '🌙' },
              ].map(s => (
                <button key={s.id} className={`${styles.slotCard} ${preferredSlot === s.id ? styles.slotActive : ''}`} onClick={() => setPreferredSlot(s.id)}>
                  <span className={styles.slotIcon}>{s.icon}</span>
                  <div><h4>{s.label}</h4><p>{s.time}</p></div>
                  {preferredSlot === s.id && <span className={styles.slotCheck}>✓</span>}
                </button>
              ))}
            </div>

            <div className={styles.installSummary}>
              <h3>Installation Summary</h3>
              <div className={styles.summaryRow}><span>Equipment</span><span>{acType?.replace(/_/g, ' ')} • {brand || 'Any'} • {tonnage}</span></div>
              <div className={styles.summaryRow}><span>Location</span><span>{rooms.length} Room{rooms.length > 1 ? 's' : ''} @ {selectedProperty?.label || 'TBD'}</span></div>
              <div className={styles.summaryRow}><span>Scheduled Visit</span><span>{preferredDate || 'TBD'}, {preferredSlot}</span></div>
            </div>

            <button className="btn btn-primary btn-full btn-lg" disabled={submitting} onClick={handleSubmit}>
              {submitting ? 'Submitting...' : 'Submit Request →'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
