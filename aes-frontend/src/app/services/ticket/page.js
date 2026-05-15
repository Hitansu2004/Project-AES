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
  { id: 'P1', label: 'P1 — AMC (Highest Priority)', desc: 'Active AMC — 4hr response, zero callout fee', color: '#7B2FBE' },
  { id: 'P2', label: 'P2 — Under Warranty', desc: 'Warranty coverage — 8hr response, labor covered', color: '#0099CC' },
  { id: 'P3', label: 'P3 — Paid Service', desc: 'Out of warranty — ₹299 minimum visit charge', color: '#E63946' },
];

export default function CreateTicketPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [step, setStep] = useState(1); // 1=select AC, 2=describe, 3=schedule, 4=success
  const [propList, setPropList] = useState([]);
  const [selectedProperty, setSelectedProperty] = useState(null);
  const [unitList, setUnitList] = useState([]);
  const [selectedUnit, setSelectedUnit] = useState(null);
  const [issueType, setIssueType] = useState('');
  const [errorCode, setErrorCode] = useState('');
  const [duration, setDuration] = useState('Today');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('P2');
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
        acUnitId: selectedUnit.id,
        problemCategory: issueType,
        errorCode: errorCode || null,
        problemDescription: description || null,
        scheduledDate: preferredDate || null,
        scheduledSlot: preferredTime || null,
      });
      setTicketResult(result);
      setStep(4);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (authLoading || loading) return <div className="loading-page"><div className="spinner"></div></div>;

  // Step 4: Success
  if (step === 4) {
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
              <div className={styles.timelineItem}><span className={styles.dotDone}>✓</span> Request received</div>
              <div className={styles.timelineItem}><span className={styles.dotActive}>●</span> Team reviews & confirms</div>
              <div className={styles.timelineItem}><span className={styles.dotPending}>○</span> Engineer visits your site</div>
              <div className={styles.timelineItem}><span className={styles.dotPending}>○</span> Service performed</div>
            </div>
            <button className="btn btn-primary btn-full btn-lg" onClick={() => router.push(`/tickets/${ticketResult?.ticketNumber}`)}>
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
      <div className="container page-content">
        {/* Header */}
        <div className={styles.topBar}>
          <button className={styles.backBtn} onClick={() => step > 1 ? setStep(step - 1) : router.back()}>← Back</button>
          <h1 className={styles.pageTitle}>Service Request</h1>
          <span className={styles.stepBadge}>{step}/3</span>
        </div>

        {/* Progress */}
        <div className={styles.progress}>
          <div className={styles.progressBar} style={{ width: `${(step / 3) * 100}%` }}></div>
        </div>

        {error && <div className={styles.error}>{error}</div>}

        {/* Step 1: Select AC Unit */}
        {step === 1 && (
          <div className={styles.stepContent}>
            {propList.length > 0 && (
              <div className={styles.propertySelect}>
                <select className="input select" value={selectedProperty?.id || ''} onChange={(e) => handlePropertyChange(e.target.value)}>
                  {propList.map(p => <option key={p.id} value={p.id}>🏠 {p.label}, {p.addressLine1}</option>)}
                </select>
              </div>
            )}
            <h2 className="headline-md">Which AC needs service?</h2>
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
                      <p>{unit.acType} {unit.tonnage}T</p>
                    </div>
                    <span className={`badge ${unit.warrantyStatus === 'IN_WARRANTY' ? 'badge-warranty' : unit.serviceStatus === 'P1_AMC' ? 'badge-amc' : 'badge-paid'}`}>
                      {unit.warrantyStatus === 'IN_WARRANTY' ? 'IN WARRANTY' : unit.serviceStatus === 'P1_AMC' ? 'AMC COVERED' : 'PAID SERVICE'}
                    </span>
                  </button>
                ))
              )}
            </div>
            {selectedUnit && (
              <button className="btn btn-primary btn-full btn-lg" onClick={() => setStep(2)}>Continue →</button>
            )}
          </div>
        )}

        {/* Step 2: Describe Problem */}
        {step === 2 && (
          <div className={styles.stepContent}>
            <div className={styles.selectedBanner}>
              🔧 {selectedUnit?.roomLabel} • {selectedUnit?.brand} {selectedUnit?.modelNumber} • {selectedUnit?.tonnage}T {selectedUnit?.acType}
            </div>
            <h2 className="headline-md">What&apos;s the problem?</h2>
            <p className={styles.stepDesc}>Select the issue that best matches your observation.</p>
            <div className={styles.issueGrid}>
              {ISSUE_TYPES.map(issue => (
                <button
                  key={issue.id}
                  className={`${styles.issueCard} ${issueType === issue.id ? styles.issueSelected : ''}`}
                  onClick={() => setIssueType(issue.id)}
                >
                  {issueType === issue.id && <span className={styles.checkMark}>✓</span>}
                  <span className={styles.issueIcon}>{issue.icon}</span>
                  <span className={styles.issueLabel}>{issue.label}</span>
                </button>
              ))}
            </div>

            <div className="input-group">
              <label>Error Code (if any)</label>
              <input className="input" placeholder="E.G. E4, U0" value={errorCode} onChange={(e) => setErrorCode(e.target.value)} />
            </div>

            <div className={styles.durationSection}>
              <label className={styles.fieldLabel}>How long has this been happening?</label>
              <div className={styles.durationOptions}>
                {DURATION_OPTIONS.map(d => (
                  <button key={d} className={`${styles.durationBtn} ${duration === d ? styles.durationActive : ''}`} onClick={() => setDuration(d)}>{d}</button>
                ))}
              </div>
            </div>

            <div className="input-group">
              <label>Additional Details</label>
              <textarea className="input textarea" placeholder="Describe any specific noises, smells, or patterns..." value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>

            <div className={styles.prioritySection}>
              <label className={styles.fieldLabel}>Service Type</label>
              {PRIORITY_OPTIONS.map(p => (
                <button
                  key={p.id}
                  className={`${styles.priorityCard} ${priority === p.id ? styles.prioritySelected : ''}`}
                  onClick={() => setPriority(p.id)}
                  style={{ '--pcolor': p.color }}
                >
                  <div className={styles.priorityDot}></div>
                  <div>
                    <h4>{p.label}</h4>
                    <p>{p.desc}</p>
                  </div>
                </button>
              ))}
            </div>

            {issueType && (
              <button className="btn btn-primary btn-full btn-lg" onClick={() => setStep(3)}>Continue →</button>
            )}
          </div>
        )}

        {/* Step 3: Schedule & Confirm */}
        {step === 3 && (
          <div className={styles.stepContent}>
            <div className={styles.priorityBanner} style={{ background: priority === 'P1' ? '#f3e8ff' : priority === 'P2' ? '#e0f7ff' : '#ffe4e6' }}>
              <strong>{priority} — {priority === 'P1' ? 'AMC Coverage' : priority === 'P2' ? 'Under Warranty' : 'Paid Service'}</strong>
              <p>{priority === 'P1' ? 'Parts and labor covered | Expected resolution: 4h' : priority === 'P2' ? 'Parts and labor covered | Expected resolution: 24h' : 'Service charges apply'}</p>
            </div>

            <div className={styles.summary}>
              <h3>Service Summary</h3>
              <div className={styles.summaryRow}><span>📍 Property</span><span>{selectedProperty?.label}</span></div>
              <div className={styles.summaryRow}><span>❄️ AC Unit</span><span>{selectedUnit?.brand} - {selectedUnit?.roomLabel}</span></div>
              <div className={styles.summaryRow}><span>⚠️ Problem</span><span>{issueType?.replace(/_/g, ' ')}{errorCode ? ` + ${errorCode}` : ''}</span></div>
            </div>

            <h2 className="headline-md">Select Date & Time</h2>
            <div className="input-group">
              <label>Preferred Date</label>
              <input className="input" type="date" value={preferredDate} onChange={(e) => setPreferredDate(e.target.value)}
                min={new Date().toISOString().split('T')[0]} />
            </div>
            <div className={styles.timeSlots}>
              {['09:00-11:00', '14:00-16:00', '16:00-18:00'].map(slot => (
                <button key={slot} className={`${styles.timeSlot} ${preferredTime === slot ? styles.timeSlotActive : ''}`} onClick={() => setPreferredTime(slot)}>
                  {slot}
                </button>
              ))}
            </div>

            <div className={styles.infoBox}>
              <h4>ℹ️ What Happens Next</h4>
              <ul>
                <li>Ticket generated & assigned to available technician.</li>
                <li>Technician confirms dispatch time via app.</li>
                <li>Service performed and documented.</li>
                <li>Review and closure.</li>
              </ul>
            </div>

            {priority !== 'P3' && (
              <div className={styles.freeNotice}>✓ No charges for this service ({priority} {priority === 'P1' ? 'AMC' : 'Warranty'})</div>
            )}

            <button className="btn btn-primary btn-full btn-lg" disabled={submitting} onClick={handleSubmit}>
              {submitting ? 'Submitting...' : 'Raise Service Ticket →'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
