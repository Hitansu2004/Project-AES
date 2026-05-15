'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { properties, acUnits, tickets } from '@/lib/api';
import styles from './ticket.module.css';

const ISSUE_TYPES = [
  { id: 'NOT_COOLING', label: 'Not Cooling', icon: '❄️' },
  { id: 'NOISE', label: 'Noise', icon: '🔊' },
  { id: 'LEAKING', label: 'Leaking', icon: '💧' },
  { id: 'NOT_TURNING_ON', label: 'Not Turning On', icon: '⚡' },
  { id: 'NO_AIRFLOW', label: 'No Airflow', icon: '🌀' },
  { id: 'REMOTE_WIFI', label: 'Remote/Wi-Fi', icon: '📡' },
];

const DURATION_OPTIONS = ['Today', '2-3 Days', 'This Week', 'Over a Week'];

const PRIORITY_OPTIONS = [
  { 
    id: 'P1', 
    label: 'AMC — Annual Maintenance Contract', 
    desc: 'You have an active AMC on your registered equipment...', 
    style: 'priorityCardP1',
    badge: 'P1 — HIGHEST PRIORITY',
    icon: '🛡️',
    chips: ['✓ 4hr Response', '✓ Zero Callout Fee', '✓ Parts Covered'],
    linkText: 'Check AMC Status →'
  },
  { 
    id: 'P2', 
    label: 'Under Warranty', 
    desc: 'Your AC is within manufacturer warranty...', 
    style: 'priorityCardP2',
    badge: 'P2 — WARRANTY COVERED',
    icon: '🏆',
    chips: ['✓ 8hr Response', '✓ Free Labor', '✓ Defect Covered'],
    linkText: 'Check Warranty →'
  },
  { 
    id: 'P3', 
    label: 'Paid Service / Out of Warranty', 
    desc: 'Service charges apply for inspection and repair...', 
    style: 'priorityCardP3',
    badge: 'P3 — PAID SERVICE',
    icon: '🔧',
    chips: ['💳 ₹299 minimum visit charge', 'ℹ Estimate Provided', 'ℹ Pay on Completion'],
    linkText: 'View Service Charges →'
  },
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
      disabled: false // allow today for service
    });
  }
  return days;
};

export default function CreateTicketPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [step, setStep] = useState(1); // 1=priority, 2=select AC, 3=describe, 4=schedule, 5=success
  const [propList, setPropList] = useState([]);
  const [selectedProperty, setSelectedProperty] = useState(null);
  const [unitList, setUnitList] = useState([]);
  const [selectedUnit, setSelectedUnit] = useState(null);
  const [issueType, setIssueType] = useState('');
  const [errorCode, setErrorCode] = useState('');
  const [duration, setDuration] = useState('Today');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('');
  const [preferredDate, setPreferredDate] = useState('');
  const [preferredTime, setPreferredTime] = useState('14:00-16:00');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [ticketResult, setTicketResult] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.replace('/login'); return; }
    async function load() {
      try {
        const props = await properties.list();
        const propArr = Array.isArray(props) ? props : [];
        setPropList(propArr);
        if (propArr.length > 0) {
          setSelectedProperty(propArr[0]);
          const units = await acUnits.list(propArr[0].id);
          setUnitList(Array.isArray(units) ? units : []);
        }
      } catch { /* ignore */ }
      setLoading(false);
    }
    load();
  }, [user, authLoading, router]);

  const handlePropertyChange = async (propId) => {
    const prop = propList.find(p => p.id === Number(propId));
    setSelectedProperty(prop);
    setSelectedUnit(null);
    if (prop) {
      try {
        const units = await acUnits.list(prop.id);
        setUnitList(Array.isArray(units) ? units : []);
      } catch { setUnitList([]); }
    }
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setError('');
    try {
      const result = await tickets.create({
        propertyId: selectedProperty.id,
        acUnitId: selectedUnit.id,
        priority: priority,
        serviceType: priority === 'P1' ? 'AMC' : priority === 'P2' ? 'WARRANTY' : 'PAID',
        problemCategory: issueType,
        errorCode: errorCode || null,
        problemDescription: description || null,
        scheduledDate: preferredDate || null,
        scheduledSlot: preferredTime || null,
      });
      setTicketResult(result);
      setStep(5);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (authLoading || loading) return <div className="loading-page"><div className="spinner"></div></div>;

  // Step 5: Success
  if (step === 5) {
    return (
      <div className={`page-enter ${styles.page}`}>
        <div className="container page-content">
          <div className={styles.success}>
            <div className={styles.successIcon}>✓</div>
            <h1 className="headline-lg">Request Submitted!</h1>
            <p className={styles.successRef}>Request No: <strong>{ticketResult?.ticketNumber || 'N/A'}</strong></p>
            <div className={styles.successInfo}>
              <p>Our team will contact you within 2 hours to confirm your service visit.</p>
            </div>
            <div className={styles.successTimeline}>
              <h3>WHAT HAPPENS NEXT</h3>
              <div className={`${styles.timelineItem} ${styles.active}`}><span className={styles.dotDone}>✓</span> Request received</div>
              <div className={`${styles.timelineItem} ${styles.active}`}><span className={styles.dotActive}>●</span> Team reviews & confirms</div>
              <div className={styles.timelineItem}><span className={styles.dotPending}>○</span> Engineer visits your site</div>
              <div className={styles.timelineItem}><span className={styles.dotPending}>○</span> Service performed</div>
            </div>
            <button className="btn btn-primary btn-full btn-lg" style={{marginTop: '32px'}} onClick={() => router.push(`/tickets/${ticketResult?.ticketNumber}`)}>
              Track This Request
            </button>
            <button className="btn btn-outline btn-full" onClick={() => router.push('/dashboard')}>
              Back to Home
            </button>
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
        <h1 className={styles.pageTitle}>Service Request</h1>
        <span className={styles.stepBadge}>{step} of 4</span>
      </div>

      <div className={styles.progress}>
        <div className={styles.progressBar} style={{ width: `${(step / 4) * 100}%` }}></div>
      </div>

      {error && <div className={styles.error}>{error}</div>}

      {/* Step 1: Priority Selection */}
      {step === 1 && (
        <>
          <div className={styles.stepContent}>
            <h2>What type of service do you have?</h2>
            <p className={styles.stepDesc}>Select the option that best describes your situation.</p>
            
            <div className={styles.prioritySection}>
              {PRIORITY_OPTIONS.map(p => (
                <button
                  key={p.id}
                  className={`${styles.priorityCard} ${styles[p.style]}`}
                  onClick={() => { setPriority(p.id); setStep(2); }}
                >
                  <div className={styles.priorityBadge}>{p.badge}</div>
                  <div className={styles.priorityContent}>
                    <div className={styles.priorityIcon}>{p.icon}</div>
                    <div className={styles.priorityInfo}>
                      <h4>{p.label}</h4>
                      <p>{p.desc}</p>
                      <div className={styles.priorityChips}>
                        {p.chips.map(c => <span key={c} className={styles.priorityChip}>{c}</span>)}
                      </div>
                      <div className={styles.priorityLink}>{p.linkText}</div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
            
            <p style={{textAlign: 'center', color: 'var(--on-surface-variant)', fontSize: '14px', marginTop: '24px'}}>
              Not sure? Our team will verify your contract status upon assignment.
            </p>
          </div>
        </>
      )}

      {/* Step 2: Select AC Unit */}
      {step === 2 && (
        <>
          <div className={styles.stepContent}>
            {propList.length > 0 && (
              <div className={styles.propertySelect}>
                <label className={styles.fieldLabel}>PROPERTY</label>
                <select className="input select" value={selectedProperty?.id || ''} onChange={(e) => handlePropertyChange(e.target.value)}>
                  {propList.map(p => <option key={p.id} value={p.id}>🏠 {p.label}, {p.addressLine1}</option>)}
                </select>
              </div>
            )}
            
            <h2>Which AC needs service?</h2>
            <p className={styles.stepDesc}>Select the unit experiencing issues</p>
            
            <div className={styles.unitList}>
              {unitList.length === 0 ? (
                <div className={styles.emptyState}>
                  <p>No AC units registered for this property.</p>
                  <button className="btn btn-outline" onClick={() => router.push('/account')}>+ Add AC Unit</button>
                </div>
              ) : (
                unitList.map(unit => (
                  <button
                    key={unit.id}
                    className={`${styles.unitCard} ${selectedUnit?.id === unit.id ? styles.unitSelected : ''}`}
                    onClick={() => setSelectedUnit(unit)}
                  >
                    <div className={styles.unitIcon}>❄️</div>
                    <div className={styles.unitInfo}>
                      <h3>{unit.roomLabel}</h3>
                      <p>{unit.brand} {unit.modelNumber}</p>
                      <p style={{fontSize: '12px'}}>{unit.acType} • {unit.tonnage}T</p>
                    </div>
                    <span className={`badge ${unit.warrantyStatus === 'IN_WARRANTY' ? 'badge-warranty' : unit.serviceStatus === 'P1_AMC' ? 'badge-amc' : 'badge-paid'}`}>
                      {unit.warrantyStatus === 'IN_WARRANTY' ? 'IN WARRANTY' : unit.serviceStatus === 'P1_AMC' ? 'AMC COVERED' : 'PAID SERVICE'}
                    </span>
                  </button>
                ))
              )}
              {unitList.length > 0 && (
                <button
                  className={styles.unitCard}
                  onClick={() => router.push('/account')}
                  style={{ justifyContent: 'center', color: 'var(--primary)', borderStyle: 'dashed', padding: '24px' }}
                >
                  <span style={{ fontSize: '16px', fontWeight: '600' }}>＋ Add a new AC unit</span>
                </button>
              )}
            </div>
          </div>
          <div className={styles.actionArea}>
            <div className={styles.actionAreaInner} style={{width:'100%'}}>
              <button className={styles.actionBtn} disabled={!selectedUnit} onClick={() => setStep(3)}>Continue →</button>
            </div>
          </div>
        </>
      )}

      {/* Step 3: Describe Problem */}
      {step === 3 && (
        <>
          <div className={styles.stepContent}>
            <div className={styles.selectedBanner}>
              <span className={`badge ${priority === 'P1' ? 'badge-amc' : priority === 'P2' ? 'badge-warranty' : 'badge-paid'}`} style={{ marginRight: '8px' }}>
                {priority}
              </span>
              🔧 {selectedUnit?.roomLabel} • {selectedUnit?.brand} {selectedUnit?.modelNumber} • {selectedUnit?.tonnage}T {selectedUnit?.acType}
            </div>
            
            <h2>What&apos;s the problem?</h2>
            <p className={styles.stepDesc}>Select the issue that best matches your observation.</p>
            
            <div className={styles.issueGrid}>
              {ISSUE_TYPES.map(issue => (
                <button
                  key={issue.id}
                  className={`${styles.issueCard} ${issueType === issue.id ? styles.issueSelected : ''}`}
                  onClick={() => setIssueType(issue.id)}
                >
                  {issueType === issue.id && <span className={styles.checkMark}>✓</span>}
                  <div className={styles.issueIcon}>{issue.icon}</div>
                  <span className={styles.issueLabel}>{issue.label}</span>
                </button>
              ))}
            </div>

            <div className="input-group" style={{marginBottom: '24px'}}>
              <label className={styles.fieldLabel}>ERROR CODE (IF ANY)</label>
              <div style={{display:'flex', gap:'12px', alignItems:'center'}}>
                <input className="input" placeholder="e.g. E1, H6..." value={errorCode} onChange={(e) => setErrorCode(e.target.value)} style={{flex: 1}} />
                <button className="btn btn-outline" onClick={() => router.push('/services/error-codes')} style={{flexShrink: 0, padding: '0 16px', height: '52px'}}>ℹ View Codes</button>
              </div>
            </div>

            <div className={styles.durationSection}>
              <label className={styles.fieldLabel}>How long has this been happening?</label>
              <div className={styles.durationOptions}>
                {DURATION_OPTIONS.map(d => (
                  <button key={d} className={`${styles.durationBtn} ${duration === d ? styles.durationActive : ''}`} onClick={() => setDuration(d)}>{d}</button>
                ))}
              </div>
            </div>

            <div className="input-group" style={{marginBottom: '32px'}}>
              <label className={styles.fieldLabel}>ADDITIONAL DETAILS</label>
              <textarea className="input textarea" placeholder="Describe any specific noises, smells, or patterns..." value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>

            <h2 className={styles.sectionTitle}>Attach Photos (Optional)</h2>
            <div className={styles.photoGrid}>
              {[0, 1, 2, 3].map(i => (
                <div key={i} className={styles.photoSlot}>
                  ＋
                </div>
              ))}
            </div>
            <div className={styles.photoCount}>0/4</div>
          </div>
          <div className={styles.actionArea}>
            <div className={styles.actionAreaInner} style={{width:'100%'}}>
              <button className={styles.actionBtn} disabled={!issueType} onClick={() => setStep(4)}>Continue →</button>
            </div>
          </div>
        </>
      )}

      {/* Step 4: Schedule & Confirm */}
      {step === 4 && (
        <>
          <div className={styles.stepContent}>
            <div className={`${styles.priorityBanner} ${priority === 'P1' ? styles.priorityBannerP1 : priority === 'P2' ? styles.priorityBannerP2 : styles.priorityBannerP3}`}>
              <strong>{priority} — {priority === 'P1' ? 'AMC Coverage' : priority === 'P2' ? 'Under Warranty' : 'Paid Service'}</strong>
              <p>{priority === 'P1' ? 'Parts and labor covered | Expected resolution: 4h' : priority === 'P2' ? 'Parts and labor covered | Expected resolution: 8h' : 'Service charges apply'}</p>
            </div>

            <div className={styles.summary}>
              <h3>Service Summary</h3>
              <div className={styles.summaryRow}><span>Property</span><span onClick={() => setStep(2)} style={{cursor:'pointer', color:'var(--secondary)'}}>{selectedProperty?.label} ✎</span></div>
              <div className={styles.summaryRow}><span>AC Unit</span><span onClick={() => setStep(2)} style={{cursor:'pointer', color:'var(--secondary)'}}>{selectedUnit?.brand} - {selectedUnit?.roomLabel} ✎</span></div>
              <div className={styles.summaryRow}><span>Problem</span><span onClick={() => setStep(3)} style={{cursor:'pointer', color:'var(--secondary)'}}>{issueType?.replace(/_/g, ' ')}{errorCode ? ` + ${errorCode}` : ''} ✎</span></div>
            </div>

            <h2>Select Date & Time</h2>
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
            <div className={styles.timeSlots}>
              {['09:00-11:00', '14:00-16:00', '16:00-18:00'].map(slot => (
                <button key={slot} className={`${styles.timeSlot} ${preferredTime === slot ? styles.timeSlotActive : ''}`} onClick={() => setPreferredTime(slot)}>
                  {slot}
                </button>
              ))}
            </div>

            <div className={styles.infoBox}>
              <h4>What Happens Next</h4>
              <ul>
                <li>Ticket generated & assigned to available technician</li>
                <li>Technician confirms dispatch time via app</li>
                <li>Service performed and documented</li>
                <li>Review and closure</li>
              </ul>
            </div>

            {priority === 'P1' && <div className={styles.freeNotice}>✓ No charges (AMC Covered)</div>}
            {priority === 'P2' && <div className={styles.freeNotice}>✓ No charges for this service (P2 Warranty)</div>}
            {priority === 'P3' && <div className={styles.freeNotice} style={{color: 'var(--primary)', background: 'var(--surface-container-low)', borderColor: 'var(--border-light)'}}>₹299 minimum visit charge. Final estimate provided before work begins.</div>}
          </div>
          
          <div className={styles.actionArea}>
            <div className={styles.actionAreaInner} style={{width:'100%'}}>
              <button className={styles.actionBtn} disabled={submitting || !preferredDate || !preferredTime} onClick={handleSubmit}>
                {submitting ? 'Submitting...' : 'Raise Service Ticket →'}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
