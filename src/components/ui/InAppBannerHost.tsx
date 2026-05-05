import { View, StyleSheet } from 'react-native';
import { useBanners } from '@/features/notifications/store';
import { InAppBanner } from './InAppBanner';

/**
 * Renders the active in-app banner stack above the navigator. Mounted once at
 * the root, sits absolute over everything but lets touches pass through where
 * no banner is rendered (`pointerEvents="box-none"`).
 *
 * Stack policy: most recent on top. We cap visible to 3 to avoid covering the
 * UI; older banners stay in the queue and surface as the top one is dismissed.
 */
export function InAppBannerHost() {
  const banners = useBanners((s) => s.banners);
  const dismiss = useBanners((s) => s.dismiss);

  // Most-recent first, cap at 3 visible.
  const visible = [...banners].slice(-3).reverse();

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {visible.map((b, i) => (
        <InAppBanner
          key={b.id}
          banner={b}
          onDismiss={dismiss}
          // Stack each subsequent banner ~12px down so the user can see they exist.
          topOffset={i * 12}
        />
      ))}
    </View>
  );
}
