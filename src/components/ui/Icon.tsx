import { MaterialIcons } from '@expo/vector-icons';
import { useColors } from '@/theme';
import type { Color } from '@/theme/tokens';
import { useMemo } from 'react';

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
  const colors = useColors();
  const resolved = useMemo(() => {
    const aliased = nameAliases[name];
    if (aliased) return aliased;
    const dashed = name.replace(/_/g, '-') as keyof typeof MaterialIcons.glyphMap;
    return MaterialIcons.glyphMap[dashed] !== undefined
      ? dashed
      : ('label' as keyof typeof MaterialIcons.glyphMap);
  }, [name]);

  return <MaterialIcons name={resolved} size={size} color={colors[color] as string} />;
}
