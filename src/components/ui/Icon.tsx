import { MaterialIcons } from '@expo/vector-icons';
import { palette, type Color } from '@/theme';
import { useMemo } from 'react';

// The Stitch design calls out "Material Symbols Outlined" icon names. Those
// names map cleanly onto MaterialIcons (which ships with Expo via
// @expo/vector-icons). A few Symbols names use snake_case vs. the Icons set's
// dashed names — we normalize here.
const nameAliases: Record<string, keyof typeof MaterialIcons.glyphMap> = {
  account_balance_wallet: 'account-balance-wallet',
  shopping_bag: 'shopping-bag',
  shopping_cart: 'shopping-cart',
  flight_takeoff: 'flight-takeoff',
  trending_up: 'trending-up',
  trending_down: 'trending-down',
  pie_chart: 'pie-chart',
  add_circle: 'add-circle',
  add_circle_outline: 'add-circle-outline',
  directions_car: 'directions-car',
  health_and_safety: 'health-and-safety',
  receipt_long: 'receipt-long',
  swap_horiz: 'swap-horiz',
  more_horiz: 'more-horiz',
  north_east: 'north-east',
  south_west: 'south-west',
  laptop_mac: 'laptop-mac',
  face_id: 'face',
};

export type IconName = string;

type Props = {
  name: IconName;
  size?: number;
  color?: Color;
};

export function Icon({ name, size = 24, color = 'onSurface' }: Props) {
  const resolved = useMemo(() => {
    const aliased = nameAliases[name];
    if (aliased) return aliased;
    // Fall back to the raw name (with underscores → dashes) if not explicitly aliased.
    const dashed = name.replace(/_/g, '-') as keyof typeof MaterialIcons.glyphMap;
    return MaterialIcons.glyphMap[dashed] !== undefined ? dashed : ('label' as keyof typeof MaterialIcons.glyphMap);
  }, [name]);

  return <MaterialIcons name={resolved} size={size} color={palette[color]} />;
}
