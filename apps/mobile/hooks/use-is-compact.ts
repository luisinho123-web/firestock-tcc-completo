import { useWindowDimensions } from 'react-native';

import { COMPACT_WIDTH } from '@/components/ui/theme';

/** Celular estreito (< 360dp): campos lado a lado cortariam o texto, então os formulários empilham. */
export function useIsCompact(): boolean {
  return useWindowDimensions().width < COMPACT_WIDTH;
}
