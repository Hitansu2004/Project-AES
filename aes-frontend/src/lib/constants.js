/**
 * Shared constants — single source of truth for enum-backed dropdowns,
 * brand catalogs, and demo seed data used across wizards.
 *
 * Backend enum mirrors:
 *   AcType         → SPLIT | CASSETTE | CENTRAL | VRF_VRV | WINDOW | PORTABLE
 *   TimeSlot       → MORNING | AFTERNOON | EVENING
 *   PropertyType   → RESIDENTIAL | COMMERCIAL | INDUSTRIAL |
 *                    HOSPITAL | HOTEL | INSTITUTIONAL
 *   ProblemCategory → NOT_COOLING | NOISE | LEAKING | NOT_TURNING_ON
 *                     NO_AIRFLOW | REMOTE_WIFI | OTHER
 */

export const AC_TYPES = [
  { value: 'SPLIT',    label: 'Split AC',       desc: '1-3 rooms',           range: '1T to 3T' },
  { value: 'CASSETTE', label: 'Cassette AC',    desc: 'Ceiling mounted',     range: '2T to 5T' },
  { value: 'CENTRAL',  label: 'Central / Ducted', desc: 'Whole home',         range: '3T to 20T' },
  { value: 'VRF_VRV',  label: 'VRF / VRV',      desc: 'Multi-unit premium',  range: 'Commercial' },
  { value: 'WINDOW',   label: 'Window AC',      desc: 'Budget single room',  range: '0.75T to 2T' },
  { value: 'PORTABLE', label: 'Portable AC',    desc: 'No installation needed', range: '1T to 1.5T' },
];

export const acTypeLabel = (value) =>
  AC_TYPES.find((t) => t.value === value)?.label || value;

export const TIME_SLOTS = [
  { value: 'MORNING',   label: 'Morning',   range: '9 AM – 12 PM' },
  { value: 'AFTERNOON', label: 'Afternoon', range: '12 PM – 4 PM' },
  { value: 'EVENING',   label: 'Evening',   range: '4 PM – 7 PM', tag: 'Limited slots' },
];

export const slotLabel = (value) =>
  TIME_SLOTS.find((s) => s.value === value)?.label || value;

export const PROPERTY_TYPES = [
  { value: 'RESIDENTIAL',   label: 'Residential' },
  { value: 'COMMERCIAL',    label: 'Commercial / Office' },
  { value: 'INDUSTRIAL',    label: 'Industrial' },
  { value: 'HOSPITAL',      label: 'Hospital / Pharma / Lab' },
  { value: 'HOTEL',         label: 'Hotel / Restaurant' },
  { value: 'INSTITUTIONAL', label: 'Educational / Institutional' },
];

/**
 * Brand list — first five mirror Arial Engineering Services' authorised
 * partners (Mitsubishi, LG, Hisense/Toshiba, Hitachi, O-General); the
 * remaining entries cover other popular OEMs the customer may already own.
 */
export const BRANDS = [
  'Mitsubishi Electric', 'LG', 'Hisense', 'Toshiba', 'Hitachi', "O'General",
  'Daikin', 'Voltas', 'Blue Star', 'Samsung', 'Carrier', 'Panasonic',
];

export const TONNAGES = ['0.75', '1.0', '1.5', '2.0', '2.5', '3.0'];

export const ENERGY_RATINGS = [
  { value: 3, label: '3 Star' },
  { value: 4, label: '4 Star' },
  { value: 5, label: '5 Star' },
];

export const ROOM_TYPES = [
  'Master Bedroom', 'Bedroom', 'Living Room', 'Guest Room',
  'Study Room', 'Kitchen', 'Dining Room', 'Office', 'Conference Room', 'Other',
];

// AES product photo CDN — used to give each model card a visually distinct
// reference photo without us hosting any image. We rotate through the AES
// `split*` and `cassette*` variants below.
const AES_PIC = 'https://www.arialengineering.com/pictures/products';
const SPLIT_PHOTOS = [
  `${AES_PIC}/split1.jpg`, `${AES_PIC}/split2.jpg`, `${AES_PIC}/split3.jpg`,
  `${AES_PIC}/split4.jpg`, `${AES_PIC}/split5.jpg`,
];
const CASSETTE_PHOTOS = [`${AES_PIC}/cassette1.jpg`, `${AES_PIC}/cassette2.jpg`];

/**
 * Demo suggested-models catalog used in the install wizard.
 *
 * Prices reflect typical 2025 India MRP / online-offer pricing for
 * 5-star inverter splits + 4-star variants — kept *near-equal* across
 * brands on purpose so the demo highlights features and warranty
 * terms rather than absolute price.
 *
 * Each entry is keyed (brand, tonnage). Where a brand's MRP / offer is
 * equal across the major retailers we use the rounded median; the EMI
 * is computed at runtime on the card. Photo URLs come from
 * arialengineering.com so we don't host any images locally.
 */
const m = (brand, tonnage, model, mrp, offer, rating, features, photoIndex = 0) => ({
  brand,
  tonnage,
  model,
  mrp,
  offer,
  rating,
  features,
  photo: SPLIT_PHOTOS[photoIndex % SPLIT_PHOTOS.length],
});

export const SUGGESTED_MODELS = [
  // ─── Mitsubishi Electric ─── premium positioning ───────────
  m('Mitsubishi Electric', '1.0', 'MSY-FV10VF',  52990, 46990, 5, ['Hyper Inverter', 'Plasma Quad+', 'Made in Japan'], 0),
  m('Mitsubishi Electric', '1.5', 'MSY-FV13VF',  62990, 56990, 5, ['Hyper Inverter', 'Plasma Quad+', '10Y Compressor'], 0),
  m('Mitsubishi Electric', '1.5', 'MSY-JR18VF',  56990, 51990, 4, ['Inverter', 'Eco Mode', 'Self-clean'], 1),
  m('Mitsubishi Electric', '2.0', 'MSY-FV24VF',  79990, 72990, 5, ['Hyper Inverter', '4-way Swing', '10Y Compressor'], 0),
  m('Mitsubishi Electric', '2.5', 'MSY-FV30VF',  92990, 84990, 5, ['Hyper Inverter', 'Twin Rotary', 'Heavy Duty'], 0),

  // ─── LG ─── popular dual-inverter range ───────────────────
  m('LG', '0.75', 'RS-H09VNXE', 32990, 28990, 3, ['Dual Inverter', 'HD Filter'], 1),
  m('LG', '1.0', 'RS-Q12YNZE',  44990, 39990, 5, ['Dual Inverter', 'AI Convertible 6-in-1', 'Wi-Fi'], 1),
  m('LG', '1.5', 'RS-Q18YNZE',  52990, 46990, 5, ['Dual Inverter', 'AI Convertible 6-in-1', '4-way Swing'], 1),
  m('LG', '1.5', 'RS-Q19RNYE',  46990, 42490, 4, ['Dual Inverter', 'HD Filter', 'Anti Virus'], 2),
  m('LG', '2.0', 'RS-Q24YNZE',  64990, 58490, 5, ['Dual Inverter', 'AI Convertible', 'Auto Cleaning'], 1),

  // ─── Hisense ─── value play ───────────────────────────────
  m('Hisense', '1.0', 'AS-12TW4RYRTBH00', 40990, 35990, 5, ['Inverter', 'Wi-Fi', 'I-Feel Smart'], 2),
  m('Hisense', '1.5', 'AS-18TW4RYRTBH00', 47990, 41990, 5, ['Inverter', 'Wi-Fi', 'Self-clean'], 2),
  m('Hisense', '1.5', 'AS-18ER4RXMUH',    42990, 37990, 4, ['Inverter', 'Anti-Dust Filter'], 3),
  m('Hisense', '2.0', 'AS-24TW4RYRTBH00', 62990, 55990, 5, ['Inverter', 'Wi-Fi', 'Eco Mode'], 2),

  // ─── Toshiba ─── Japanese reliability ─────────────────────
  m('Toshiba', '1.0', 'RAS-13NCV2KCV',  47990, 41990, 5, ['Inverter', 'Hadron Plasma', 'Self-clean'], 3),
  m('Toshiba', '1.5', 'RAS-18NCV2KCV',  56990, 49990, 5, ['Inverter', 'Hadron Plasma', '8-way Air Direction'], 3),
  m('Toshiba', '2.0', 'RAS-24N3KCV',    72990, 64990, 5, ['Inverter', 'Hadron Plasma', 'Heavy Duty'], 3),

  // ─── Hitachi ─── Indian classic ───────────────────────────
  m('Hitachi', '1.0', 'RSOS512HCEA',    47990, 42490, 5, ['Inverter', 'Frost Wash', 'Wi-Fi'], 4),
  m('Hitachi', '1.5', 'RSOS518HCEA',    58990, 52490, 5, ['Inverter', 'Frost Wash', 'iSee Sensor'], 4),
  m('Hitachi', '1.5', 'RSOG518HCEA',    52490, 47990, 4, ['Inverter', 'Anti-Dust Filter'], 0),
  m('Hitachi', '2.0', 'RSOS524HCEA',    72990, 65490, 5, ['Inverter', 'Frost Wash', '4-way Swing'], 4),

  // ─── O'General ─── premium import ─────────────────────────
  m("O'General", '1.0', 'ASGA12FUTC',   57990, 49490, 5, ['Inverter', 'Made in Thailand', 'High Ambient'], 4),
  m("O'General", '1.5', 'ASGA18FUTC',   69990, 59990, 5, ['Inverter', 'Made in Thailand', 'High Ambient'], 4),
  m("O'General", '2.0', 'ASGA24FUTC',   89990, 78990, 5, ['Inverter', 'Heavy Duty', 'Anti-Corrosion'], 4),

  // ─── Daikin ─── professional choice ───────────────────────
  m('Daikin', '0.75', 'FTKL28U',        36990, 31990, 3, ['Inverter', 'Coanda Airflow'], 0),
  m('Daikin', '1.0', 'FTKM35U',         48990, 42490, 5, ['Inverter', 'PM 2.5 Filter', 'Coanda Airflow'], 0),
  m('Daikin', '1.5', 'FTKM50UV',        58990, 52490, 5, ['Inverter', 'PM 2.5 Filter', 'Coanda Airflow'], 1),
  m('Daikin', '1.5', 'FTKF50TV',        51990, 45990, 4, ['Inverter', 'Power Chill', 'Eco Mode'], 2),
  m('Daikin', '2.0', 'FTKM60U',         74990, 67490, 5, ['Inverter', 'PM 2.5 Filter', 'Wide Angle'], 0),

  // ─── Voltas ─── volume leader ─────────────────────────────
  m('Voltas', '0.75', '085V Vectra',    27990, 24990, 3, ['Inverter', 'Anti-Dust Filter'], 2),
  m('Voltas', '1.0', '125V Vectra',     39990, 35990, 5, ['Inverter', 'High Ambient', 'Self-clean'], 2),
  m('Voltas', '1.5', '185V Vectra',     45990, 42490, 5, ['Inverter', 'High Ambient 52°C', 'Stabilizer Free'], 3),
  m('Voltas', '2.0', '245V Vectra',     57990, 51490, 5, ['Inverter', 'Heavy Duty', 'Wi-Fi'], 3),
  m('Voltas', '2.5', '305V CZH',        77990, 70990, 4, ['Inverter', 'Heavy Duty'], 4),

  // ─── Blue Star ─── solid mid-tier ─────────────────────────
  m('Blue Star', '1.0', 'IC312YNUA',    41990, 37490, 5, ['Inverter', 'Tropical Cooling', 'Wi-Fi'], 2),
  m('Blue Star', '1.5', 'IC518YNUA',    49990, 44990, 5, ['Inverter', 'Tropical Cooling', '4-way Swing'], 2),
  m('Blue Star', '1.5', 'IC318YNUA',    44990, 40490, 4, ['Inverter', 'Tropical Cooling'], 3),
  m('Blue Star', '2.0', 'IC524YNUA',    64990, 58990, 5, ['Inverter', 'Tropical Cooling', 'Heavy Duty'], 2),

  // ─── Samsung ─── feature-rich ─────────────────────────────
  m('Samsung', '1.0', 'AR12CYLAQWK',    44990, 38990, 5, ['Wind-Free', 'Convertible 5-in-1', 'Wi-Fi'], 3),
  m('Samsung', '1.5', 'AR18CYLAQWK',    52990, 46990, 5, ['Wind-Free', 'Convertible 5-in-1', 'Wi-Fi'], 3),
  m('Samsung', '2.0', 'AR24CYLAQWK',    66990, 59990, 5, ['Wind-Free', 'Convertible 5-in-1'], 3),

  // ─── Carrier ─── Indian make ──────────────────────────────
  m('Carrier', '1.0', 'Ester Neo Plus', 42990, 38490, 5, ['Inverter', 'Hybridjet', 'Wi-Fi'], 4),
  m('Carrier', '1.5', 'Ester Neo',      50990, 45490, 5, ['Inverter', 'Hybridjet', 'Self-clean'], 4),
  m('Carrier', '2.0', 'Ester Neo XL',   64990, 58990, 5, ['Inverter', 'Hybridjet', 'Heavy Duty'], 4),

  // ─── Panasonic ─── premium air-quality ────────────────────
  m('Panasonic', '1.0', 'CS/CU-NU12YKYW', 45990, 40490, 5, ['Inverter', 'PM 2.5 Filter', 'Wi-Fi'], 0),
  m('Panasonic', '1.5', 'CS/CU-NU18YKYW', 53990, 47990, 5, ['Inverter', 'PM 2.5 Filter', 'Nanoe X'], 0),
  m('Panasonic', '1.5', 'CS/CU-KU18YKYW', 49990, 43990, 4, ['Inverter', 'Eco Mode', 'Auto Restart'], 1),
  m('Panasonic', '2.0', 'CS/CU-NU24YKYW', 67990, 61990, 5, ['Inverter', 'PM 2.5 Filter', 'Nanoe X'], 0),
];

/**
 * Helper used by the wizard to render the header "savings" badge.
 * Returns the integer % off (rounded).
 */
export const modelDiscount = ({ mrp, offer }) =>
  mrp && offer ? Math.max(0, Math.round(((mrp - offer) / mrp) * 100)) : 0;

/**
 * Approximate no-cost EMI a customer would see at checkout — shown only
 * as a hint to make pricing feel concrete during the demo.
 */
export const modelEmi = ({ offer }, months = 9) =>
  offer ? Math.round(offer / months / 10) * 10 : 0;

export const PROBLEM_CATEGORIES = [
  { value: 'NOT_COOLING',    label: 'Not Cooling',     iconName: 'snowflake' },
  { value: 'NOISE',          label: 'Noise',           iconName: 'volume2' },
  { value: 'LEAKING',        label: 'Water Leak',      iconName: 'droplet' },
  { value: 'NOT_TURNING_ON', label: 'Not Turning On',  iconName: 'power' },
  { value: 'NO_AIRFLOW',     label: 'No Airflow',      iconName: 'wind' },
  { value: 'REMOTE_WIFI',    label: 'Remote / Wi-Fi',  iconName: 'remote' },
  { value: 'OTHER',          label: 'Other',           iconName: 'more' },
];

export const PRIORITY_META = {
  P1: { label: 'AMC',      tone: 'amc',      description: 'Annual Maintenance Contract' },
  P2: { label: 'Warranty', tone: 'warranty', description: 'Manufacturer warranty' },
  P3: { label: 'Paid',     tone: 'paid',     description: 'Paid service' },
};
