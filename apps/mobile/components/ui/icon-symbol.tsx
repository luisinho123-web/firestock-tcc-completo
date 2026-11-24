// Fallback for using MaterialIcons/MaterialCommunityIcons on Android and web.

import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { ComponentProps } from 'react';
import { OpaqueColorValue, type StyleProp, type TextStyle } from 'react-native';

/**
 * Add your SF Symbols to Material Icons mappings here.
 * - see Material Icons in the [Icons Directory](https://icons.expo.fyi).
 * - see SF Symbols in the [SF Symbols](https://developer.apple.com/sf-symbols/) app.
 * - value is `"material-icon-name"`, or `"community:material-community-icon-name"` when
 *   MaterialIcons has no good match (e.g. specific foods/produce).
 */
const MAPPING = {
  'house.fill': 'home',
  magnifyingglass: 'search',
  'chevron.right': 'chevron-right',
  'chevron.left': 'chevron-left',
  'person.fill': 'person',
  'envelope.fill': 'email',
  'lock.fill': 'lock',
  'cart.fill': 'shopping-cart',
  'bag.fill': 'shopping-basket',
  ellipsis: 'more-horiz',
  'gearshape.fill': 'settings',
  'questionmark.circle.fill': 'help-outline',
  'slider.horizontal.3': 'tune',
  'leaf.fill': 'grass',
  plus: 'add',
  minus: 'remove',
  'trash.fill': 'delete',
  'location.fill': 'location-on',
  'heart.fill': 'favorite',
  'doc.text.fill': 'description',
  pencil: 'edit',
  receipt: 'receipt-long',
  'rectangle.portrait.and.arrow.right': 'logout',
  qrcode: 'qr-code',
  'creditcard.fill': 'credit-card',
  'banknote.fill': 'payments',
  'checkmark.circle.fill': 'check-circle',
  checkmark: 'check',
  'bubble.left.fill': 'chat',
  'exclamationmark.triangle.fill': 'warning',
  'phone.fill': 'phone',
  'chevron.down': 'expand-more',
  'chevron.up': 'expand-less',
  'eye.fill': 'visibility',
  'eye.slash.fill': 'visibility-off',
  'bell.fill': 'notifications',
  'star.fill': 'star',
  star: 'star-border',
  'bolt.fill': 'bolt',
  'square.and.arrow.up': 'share',
  'clock.fill': 'schedule',
  'storefront.fill': 'storefront',
  'fork.knife': 'restaurant',
  'shippingbox.fill': 'inventory-2',
  'basket.fill': 'community:basket',
  'carrot.fill': 'community:carrot',
  'cup.and.saucer.fill': 'community:cup',
  'square.grid.2x2.fill': 'community:view-grid',
  'tag.fill': 'local-offer',
  percent: 'percent',
  'truck.fill': 'local-shipping',
  xmark: 'close',
  'building.fill': 'community:office-building',
  'shield.fill': 'community:shield-check',
  'camera.fill': 'photo-camera',
  'map.fill': 'community:map',
} as const;

export type IconSymbolName = keyof typeof MAPPING;
type MaterialIconName = ComponentProps<typeof MaterialIcons>['name'];
type CommunityIconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

export function IconSymbol({
  name,
  size = 24,
  color,
  style,
}: {
  name: IconSymbolName;
  size?: number;
  color: string | OpaqueColorValue;
  style?: StyleProp<TextStyle>;
}) {
  const glyph = MAPPING[name];

  if (glyph.startsWith('community:')) {
    return (
      <MaterialCommunityIcons
        color={color}
        size={size}
        name={glyph.slice('community:'.length) as CommunityIconName}
        style={style}
      />
    );
  }

  return <MaterialIcons color={color} size={size} name={glyph as MaterialIconName} style={style} />;
}
