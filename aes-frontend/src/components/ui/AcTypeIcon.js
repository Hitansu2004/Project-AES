import {
  Snowflake, LayoutGrid, Wind, Building2, Square, Fan,
} from 'lucide-react';

const MAP = {
  SPLIT: Snowflake,
  CASSETTE: LayoutGrid,
  CENTRAL: Wind,
  VRF_VRV: Building2,
  WINDOW: Square,
  PORTABLE: Fan,
};

/** Lucide icon for each AC type — used by the install-flow grid. */
export default function AcTypeIcon({ type, size = 22, color }) {
  const Icon = MAP[type] || Snowflake;
  return <Icon size={size} color={color} strokeWidth={1.8} />;
}
