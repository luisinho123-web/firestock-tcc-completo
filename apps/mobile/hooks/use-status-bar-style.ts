import { useCallback } from 'react';
import { useFocusEffect } from 'expo-router';
import { setStatusBarStyle, type StatusBarStyle } from 'expo-status-bar';

/** Status bar style for a screen with a dark header. Tied to focus rather than mount, because tab and
 * stack screens stay mounted underneath the current one — a `<StatusBar>` element would leak its style
 * onto whichever screen is on top. Restores the app default ("dark") on blur. */
export function useStatusBarStyle(style: StatusBarStyle) {
  useFocusEffect(
    useCallback(() => {
      setStatusBarStyle(style, true);
      return () => setStatusBarStyle('dark', true);
    }, [style])
  );
}
