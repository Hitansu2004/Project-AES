'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import styles from './error.module.css';

const BRANDS = ['Daikin', 'LG', 'Voltas', 'Samsung', 'Carrier'];

const ERROR_CODES = {
  Daikin: [
    { code: 'E1', short: 'PCB Defect', severity: 'Requires Tech', desc: 'Main printed circuit board error. Communication breakdown between indoor and outdoor units.', tip: 'Power cycle the unit from the main breaker for 5 minutes. If code returns immediately, PCB replacement is necessary.' },
    { code: 'E3', short: 'High Pressure', severity: 'Try Reset First', desc: 'High pressure switch actuated. Typically caused by poor airflow or overcharged system.', tip: 'Check outdoor unit for debris (leaves, dirt) blocking the coil. Wash coil gently with a hose and reset.' },
    { code: 'E4', short: 'Low Pressure', severity: 'Requires Tech', desc: 'Low pressure drop due to potential refrigerant leak or sensor failure.', tip: 'Do not repeatedly reset. Continuous operation with low refrigerant can permanently damage the compressor.' },
    { code: 'E7', short: 'Fan Motor Error', severity: 'Requires Tech', desc: 'Outdoor DC fan motor anomaly. Motor may be locked or experiencing voltage irregularity.', tip: 'Verify if anything is physically obstructing the outdoor fan blades while the power is off.' },
    { code: 'F3', short: 'Discharge Pipe', severity: 'Try Reset First', desc: 'Abnormal discharge pipe temperature. Often related to extreme weather or partial blockage.', tip: 'Allow unit to rest for 30 minutes. Ensure indoor filters are clean to maintain proper airflow.' },
    { code: 'H6', short: 'No DC Current Detection', severity: 'Requires Tech', desc: 'Motor lock or wiring fault. Do not attempt to reset repeatedly.', tip: 'Motor lock or wiring fault. Do not attempt to reset repeatedly.' },
    { code: 'P1', short: 'Insufficient Voltage', severity: 'Try Reset First', desc: 'Voltage supply is unstable. Check power source.', tip: 'Check if voltage supply is stable. Use a stabilizer if needed.' },
    { code: 'U4', short: 'Communication Error', severity: 'Try Reset First', desc: 'Interconnection error between indoor and outdoor units.', tip: 'Turn off both indoor and outdoor units for 5 minutes, then restart.' }
  ],
  LG: [
    { code: 'CH01', short: 'Indoor Sensor Error', severity: 'Try Reset First', desc: 'Faulty reading from indoor air thermistor.', tip: 'Check if sensor wire is disconnected or short-circuited.' },
    { code: 'CH02', short: 'Outdoor Sensor Error', severity: 'Requires Tech', desc: 'Faulty reading from outdoor thermistor.', tip: 'Requires professional replacement of the outdoor sensor block.' },
    { code: 'CH05', short: 'Communication Error', severity: 'Try Reset First', desc: 'Lost signal between indoor and outdoor unit.', tip: 'Turn off power supply completely for 3 minutes. Reconnect and check if error clears.' },
    { code: 'CH38', short: 'Outdoor Unit Error', severity: 'Requires Tech', desc: 'Refrigerant leak detection triggered.', tip: 'Do not run unit. Turn off immediately to prevent compressor failure.' }
  ],
  Voltas: [
    { code: 'E1', short: 'Indoor PCB Fault', severity: 'Requires Tech', desc: 'Malfunction in the main indoor control board.', tip: 'Call for service. Do not attempt to repair PCB manually.' },
    { code: 'E5', short: 'Overload Protection', severity: 'Try Reset First', desc: 'Compressor overload triggered by high current or heat.', tip: 'Allow unit to cool down for 2 hours before attempting a restart.' },
    { code: 'E6', short: 'Communication Error', severity: 'Try Reset First', desc: 'Data transmission failure.', tip: 'Check for loose connection wires between indoor and outdoor units.' }
  ],
  Samsung: [
    { code: 'E2', short: 'Indoor PCB Error', severity: 'Requires Tech', desc: 'Control board failure detected.', tip: 'Technician required to diagnose voltage spike damage.' },
    { code: 'E4', short: 'High Pressure', severity: 'Try Reset First', desc: 'Excessive pressure in the compressor system.', tip: 'Clean filters and ensure outdoor unit has at least 2 feet of clearance.' },
    { code: 'C4', short: 'Outdoor Temp Sensor', severity: 'Requires Tech', desc: 'Outdoor temperature sensor malfunction.', tip: 'Service required to replace the thermistor.' }
  ],
  Carrier: [
    { code: 'E1', short: 'System Error', severity: 'Try Reset First', desc: 'General system fault.', tip: 'Reset system.' }
  ]
};

export default function ErrorCodeReferencePage() {
  const router = useRouter();
  const [activeBrand, setActiveBrand] = useState('Daikin');
  const [search, setSearch] = useState('');

  const codes = ERROR_CODES[activeBrand] || [];
  const filteredCodes = codes.filter(c => 
    c.code.toLowerCase().includes(search.toLowerCase()) || 
    c.short.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className={`page-enter ${styles.page}`}>
      <div className={styles.topBar}>
        <button className={styles.backBtn} onClick={() => router.back()}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6"/></svg>
        </button>
        <h1 className={styles.pageTitle}>Error Codes</h1>
        <div style={{width: 40}}></div>
      </div>

      <div className={styles.content}>
        <div className={styles.brandTabs}>
          {BRANDS.map(b => (
            <button
              key={b}
              className={`${styles.brandTab} ${activeBrand === b ? styles.brandTabActive : ''}`}
              onClick={() => setActiveBrand(b)}
            >
              {b}
            </button>
          ))}
        </div>

        <div className={styles.searchContainer}>
          <input 
            type="text" 
            className="input" 
            placeholder="Search error code (e.g. E1, H6, P1...)" 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className={styles.codeList}>
          {filteredCodes.map(c => (
            <div key={c.code} className={styles.codeCard}>
              <div className={styles.cardHeader}>
                <span className={styles.codeBadge}>{c.code}</span>
                <span className={`${styles.severityBadge} ${c.severity === 'Requires Tech' ? styles.sevRed : styles.sevOrange}`}>
                  {c.severity}
                </span>
              </div>
              <h3 className={styles.shortDesc}>{c.short}</h3>
              <p className={styles.longDesc}>{c.desc}</p>
              <div className={styles.tipBox}>
                <span className={styles.tipIcon}>💡</span>
                <p className={styles.tipText}>{c.tip}</p>
              </div>
            </div>
          ))}
          {filteredCodes.length === 0 && (
            <div className={styles.noResults}>No error codes found for &quot;{search}&quot;.</div>
          )}
        </div>
      </div>

      <div className={styles.actionArea}>
        <button className="btn btn-primary btn-full btn-lg" onClick={() => router.push('/services/ticket')}>Book Service →</button>
      </div>
    </div>
  );
}
