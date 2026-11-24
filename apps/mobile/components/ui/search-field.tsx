import type { Ref } from 'react';
import { StyleSheet, TextInput, View, type StyleProp, type TextInputProps, type ViewStyle } from 'react-native';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { PressableScale } from '@/components/ui/pressable-scale';
import { COLORS, FONT_SIZES, RADIUS, SIZES, SPACING } from '@/components/ui/theme';
import { INPUT_LIMITS, sanitizeSearch } from '@/utils/sanitize';

type SearchFieldProps = Omit<TextInputProps, 'style' | 'onChangeText' | 'value'> & {
  value: string;
  onChangeText: (value: string) => void;
  /** Filled grey look for use inside white sheets; default is a bordered white field on grey pages. */
  tone?: 'outlined' | 'filled' | 'focused';
  style?: StyleProp<ViewStyle>;
  ref?: Ref<TextInput>;
};

export function SearchField({ value, onChangeText, tone = 'outlined', style, placeholder, ref, ...props }: SearchFieldProps) {
  return (
    <View style={[styles.field, styles[tone], style]}>
      <IconSymbol name="magnifyingglass" size={18} color={tone === 'focused' ? COLORS.navy : COLORS.textFaint} />
      <TextInput
        ref={ref}
        value={value}
        onChangeText={(text) => onChangeText(sanitizeSearch(text))}
        maxLength={INPUT_LIMITS.search}
        placeholder={placeholder}
        placeholderTextColor={COLORS.textFaint}
        style={styles.input}
        maxFontSizeMultiplier={1.3}
        returnKeyType="search"
        autoCorrect={false}
        clearButtonMode="never"
        accessibilityLabel={placeholder}
        {...props}
      />
      {value.length > 0 ? (
        <PressableScale
          style={styles.clearButton}
          onPress={() => onChangeText('')}
          hitSlop={11}
          accessibilityRole="button"
          accessibilityLabel="Limpar busca">
          <IconSymbol name="xmark" size={12} color={COLORS.white} />
        </PressableScale>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    minHeight: SIZES.searchHeight,
    borderRadius: RADIUS.input,
    paddingHorizontal: SPACING.md,
  },
  outlined: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  filled: {
    backgroundColor: COLORS.background,
  },
  focused: {
    backgroundColor: COLORS.surface,
    borderWidth: 1.5,
    borderColor: COLORS.navy,
  },
  input: {
    flex: 1,
    minHeight: SIZES.searchHeight - 4,
    fontSize: FONT_SIZES.body,
    color: COLORS.navy,
  },
  clearButton: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: COLORS.textFaint,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
