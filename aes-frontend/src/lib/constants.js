/**
 * Shared constants — single source of truth for enum-backed dropdowns,
 * brand catalogs, and demo seed data used across wizards.
 *
 * Backend enum mirrors:
 *   AcType         → SPLIT | CASSETTE | CENTRAL | VRF_VRV | WINDOW | PORTABLE
 *   TimeSlot       → MORNING | AFTERNOON | EVENING
 *   PropertyType   → RESIDENTIAL | COMMERCIAL | HOSPITAL | HOTEL
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
  { value: 'RESIDENTIAL', label: 'Residential' },
  { value: 'COMMERCIAL',  label: 'Commercial / Office' },
  { value: 'HOSPITAL',    label: 'Hospital' },
  { value: 'HOTEL',       label: 'Hotel' },
];

export const BRANDS = [
  'Daikin', 'Voltas', 'Blue Star',
  'LG', 'Samsung', 'Carrier',
  'Hitachi', 'Panasonic', "O'General",
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

/** Demo-only suggested-models catalog used in the install wizard. */
export const SUGGESTED_MODELS = [
  // Daikin
  { brand: 'Daikin', tonnage: '1.0', model: 'FTKM30TV',   price: '₹38,499', features: ['5 Star', 'Inverter', 'Wi-Fi'] },
  { brand: 'Daikin', tonnage: '1.5', model: 'FTKF35TV',   price: '₹42,999', features: ['5 Star', 'Wi-Fi', 'Inverter'] },
  { brand: 'Daikin', tonnage: '1.5', model: 'FTKG35TV',   price: '₹45,500', features: ['5 Star', 'PM 2.5 Filter'] },
  { brand: 'Daikin', tonnage: '2.0', model: 'FTKM50TV',   price: '₹54,990', features: ['5 Star', 'Inverter', 'Copper'] },
  // Voltas
  { brand: 'Voltas', tonnage: '1.0', model: '125V DZX',   price: '₹31,499', features: ['5 Star', 'Inverter'] },
  { brand: 'Voltas', tonnage: '1.5', model: '185V DZT',   price: '₹34,999', features: ['5 Star', 'Inverter'] },
  { brand: 'Voltas', tonnage: '2.0', model: '245V DZT',   price: '₹46,500', features: ['5 Star', 'Inverter'] },
  // Blue Star
  { brand: 'Blue Star', tonnage: '1.0', model: 'IC312YNUW', price: '₹33,990', features: ['5 Star', 'Wi-Fi'] },
  { brand: 'Blue Star', tonnage: '1.5', model: 'IC518YNUW', price: '₹38,500', features: ['5 Star', 'Wi-Fi'] },
  // LG
  { brand: 'LG', tonnage: '1.0', model: 'RS-Q12YNZE',     price: '₹33,499', features: ['5 Star', 'Dual Inverter'] },
  { brand: 'LG', tonnage: '1.5', model: 'RS-Q18YNZE',     price: '₹36,999', features: ['5 Star', 'Dual Inverter'] },
  { brand: 'LG', tonnage: '2.0', model: 'RS-Q24YNZE',     price: '₹48,990', features: ['4 Star', 'Dual Inverter'] },
  // Samsung
  { brand: 'Samsung', tonnage: '1.5', model: 'AR18CYLAQWK', price: '₹39,990', features: ['5 Star', 'Wind-Free'] },
  // Carrier
  { brand: 'Carrier', tonnage: '1.5', model: 'ESTER NEO',  price: '₹37,999', features: ['5 Star', 'Inverter'] },
  // Hitachi
  { brand: 'Hitachi', tonnage: '1.5', model: 'RSOG518HCEA', price: '₹41,999', features: ['5 Star', 'Inverter'] },
  // Panasonic
  { brand: 'Panasonic', tonnage: '1.5', model: 'CS/CU-NU18YKYW', price: '₹40,499', features: ['5 Star', 'Wi-Fi'] },
];

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
