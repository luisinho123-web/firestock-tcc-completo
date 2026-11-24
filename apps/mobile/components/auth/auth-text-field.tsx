import { useState, type Ref } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';

import { IconSymbol, type IconSymbolName } from '@/components/ui/icon-symbol';
import { COLORS, FONT_SIZES, FONT_WEIGHTS, RADIUS, SIZES, SPACING } from '@/components/ui/theme';

type AuthTextFieldProps = TextInputProps & {
  label?: string;
  icon?: IconSymbolName;
  error?: string;
  /** Helper copy under the field when there's no error (e.g. format hints). */
  hint?: string;
  ref?: Ref<TextInput>;
};

/** The app's text input (used well beyond auth: account, address and card forms). */
export function AuthTextField({
  label,
  icon,
  error,
  hint,
  secureTextEntry,
  style,
  onFocus,
  onBlur,
  editable = true,
  ref,
  accessibilityLabel,
  ...props
}: AuthTextFieldProps) {
  const [isFocused, setIsFocused] = useState(false);
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);

  const isPasswordField = Boolean(secureTextEntry);
  const hasError = Boolean(error);

  const handleFocus: NonNullable<TextInputProps['onFocus']> = (event) => {
    setIsFocused(true);
    onFocus?.(event);
  };

  const handleBlur: NonNullable<TextInputProps['onBlur']> = (event) => {
    setIsFocused(false);
    onBlur?.(event);
  };

  const borderColor = hasError ? COLORS.error : isFocused ? COLORS.navy : COLORS.border;

  return (
    <View style={styles.wrapper}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View
        style={[
          styles.container,
          { borderColor, borderWidth: isFocused || hasError ? 1.5 : 1 },
          !editable && styles.containerDisabled,
        ]}>
        {icon ? <IconSymbol name={icon} size={20} color={hasError ? COLORS.error : COLORS.navy} /> : null}
        <TextInput
          ref={ref}
          style={[styles.input, style]}
          placeholderTextColor={COLORS.textFaint}
          maxFontSizeMultiplier={1.3}
          secureTextEntry={isPasswordField && !isPasswordVisible}
          onFocus={handleFocus}
          onBlur={handleBlur}
          editable={editable}
          accessibilityLabel={accessibilityLabel ?? label ?? props.placeholder}
          accessibilityHint={error || hint}
          {...props}
        />
        {isPasswordField ? (
          <Pressable
            onPress={() => setIsPasswordVisible((current) => !current)}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel={isPasswordVisible ? 'Ocultar senha' : 'Mostrar senha'}>
            <IconSymbol name={isPasswordVisible ? 'eye.slash.fill' : 'eye.fill'} size={20} color={COLORS.textTertiary} />
          </Pressable>
        ) : null}
      </View>
      {error ? (
        <Text style={styles.errorText} accessibilityLiveRegion="polite" accessibilityRole="alert">
          {error}
        </Text>
      ) : hint ? (
        <Text style={styles.hintText}>{hint}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    width: '100%',
    marginBottom: SPACING.md,
  },
  label: {
    fontSize: FONT_SIZES.label,
    fontWeight: FONT_WEIGHTS.semibold,
    color: COLORS.navy,
    marginBottom: SPACING.xs,
  },
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    width: '100%',
    minHeight: SIZES.inputHeight,
    borderRadius: RADIUS.input,
    backgroundColor: COLORS.surface,
    paddingHorizontal: SPACING.md,
  },
  containerDisabled: {
    backgroundColor: COLORS.background,
  },
  input: {
    flex: 1,
    minHeight: SIZES.inputHeight - 4,
    color: COLORS.navy,
    fontSize: FONT_SIZES.body,
  },
  errorText: {
    color: COLORS.error,
    fontSize: FONT_SIZES.label,
    lineHeight: 18,
    marginTop: SPACING.xxs,
    marginLeft: 4,
  },
  hintText: {
    color: COLORS.textTertiary,
    fontSize: FONT_SIZES.small,
    lineHeight: 17,
    marginTop: SPACING.xxs,
    marginLeft: 4,
  },
});
