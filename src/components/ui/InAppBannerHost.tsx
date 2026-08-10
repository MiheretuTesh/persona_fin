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
 *
 * Each banner is absolutely positioned, so the offsets below have to account
 * for the full height of the banners above it — a previous revision used a
 * flat `i * 12`, which stacked three banners almost exactly on top of each
 * other and made all but the newest unreadable and untappable.
 */

/** Approximate rendered height of one banner (icon tile + 2 lines + padding). */
const BANNER_HEIGHT = 88;
const BANNER_GAP = 8;

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
          topOffset={i * (BANNER_HEIGHT + BANNER_GAP)}
        />
      ))}
    </View>
  );
}
