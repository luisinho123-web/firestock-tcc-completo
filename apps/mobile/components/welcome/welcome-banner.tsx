import { Image } from 'expo-image';
import { StyleSheet } from 'react-native';

export function WelcomeBanner() {
  return (
    <Image
      source={require('@/assets/images/welcome-banner.png')}
      style={styles.banner}
      contentFit="cover"
      transition={200}
      accessibilityLabel="Ilustração de um carrinho de compras cheio de itens sob um céu estrelado"
    />
  );
}

const styles = StyleSheet.create({
  banner: {
    width: '100%',
    aspectRatio: 430 / 465,
    backgroundColor: '#0F174A',
  },
});
