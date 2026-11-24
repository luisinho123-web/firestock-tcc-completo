import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';

import { Button } from '@/components/ui/button';
import { SPACING } from '@/components/ui/theme';

type WelcomeActionsProps = {
  onRegister?: () => void;
  onSignIn?: () => void;
};

export function WelcomeActions({ onRegister, onSignIn }: WelcomeActionsProps) {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <Button label="Criar minha conta" variant="inverse" onPress={onRegister ?? (() => router.push('/register'))} />
      <Button label="Já tenho uma conta" variant="outlineInverse" onPress={onSignIn ?? (() => router.push('/login'))} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    gap: SPACING.sm,
    marginTop: SPACING.xl,
  },
});
