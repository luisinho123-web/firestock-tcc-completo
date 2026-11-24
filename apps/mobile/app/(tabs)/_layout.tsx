import { Tabs } from 'expo-router';

import { BottomNav } from '@/components/ui/bottom-nav';

/** The five primary destinations share one persistent tab bar, so switching tabs keeps each tab's
 * scroll position and never piles duplicate screens onto the navigation history. */
export default function TabsLayout() {
  return (
    <Tabs tabBar={(props) => <BottomNav {...props} />} screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="home" />
      <Tabs.Screen name="markets" />
      <Tabs.Screen name="cart" />
      <Tabs.Screen name="orders" />
      <Tabs.Screen name="profile" />
    </Tabs>
  );
}
