import { useNavigation } from 'expo-router';
import { useEffect, type MutableRefObject } from 'react';
import { Platform } from 'react-native';

import { Alert } from '@/components/ui/alert';

/**
 * Pede confirmação antes de sair de um formulário com alterações não salvas (botão voltar, gesto, voltar do Android e
 * voltar do navegador); na web também avisa ao fechar ou recarregar a aba. Depois de salvar, marque
 * `leavingRef.current = true` antes de navegar para sair sem perguntar.
 */
export function useDiscardGuard(isDirty: boolean, leavingRef: MutableRefObject<boolean>) {
  const navigation = useNavigation();

  useEffect(
    () =>
      navigation.addListener('beforeRemove', (event) => {
        if (!isDirty || leavingRef.current) return;
        event.preventDefault();
        Alert.alert('Descartar alterações?', 'Você tem alterações que ainda não foram salvas. Deseja realmente sair desta tela?', [
          { text: 'Continuar editando', style: 'cancel' },
          { text: 'Sair sem salvar', style: 'destructive', onPress: () => navigation.dispatch(event.data.action) },
        ]);
      }),
    [navigation, isDirty, leavingRef],
  );

  useEffect(() => {
    if (Platform.OS !== 'web' || !isDirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      if (leavingRef.current) return;
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [isDirty, leavingRef]);
}
