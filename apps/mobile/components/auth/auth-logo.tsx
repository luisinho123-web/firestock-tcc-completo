import { Image, StyleSheet } from 'react-native';

const LOGO_ASPECT_RATIO = 368 / 136;
const LOGO_HEIGHT = 30;

export function AuthLogo() {
  return (
    <Image
      source={require('@/assets/images/splash-logo.png')}
      style={styles.logo}
      resizeMode="contain"
      accessibilityRole="image"
      accessibilityLabel="FireStock"
    />
  );
}

const styles = StyleSheet.create({
  logo: {
    height: LOGO_HEIGHT,
    width: LOGO_HEIGHT * LOGO_ASPECT_RATIO,
    marginBottom: 32,
  },
});
