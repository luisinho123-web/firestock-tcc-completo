import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { darkRuns, qrMatrix } from '@/utils/qr';

/** Margem branca ao redor, em módulos: o padrão do QR Code exige 4, senão alguns leitores não reconhecem. */
const QUIET_ZONE = 4;

/**
 * QR Code de verdade (lido por qualquer câmera ou app de banco), desenhado só com Views: não usa módulo nativo,
 * então funciona no Expo Go, no navegador e no APK sem rebuild. Preto sobre branco, que é o que os leitores esperam.
 */
export function QrCode({ value, size = 200 }: { value: string; size?: number }) {
  const { rects, pixels } = useMemo(() => {
    const matrix = qrMatrix(value);
    const total = matrix.length + QUIET_ZONE * 2;
    // Módulo com tamanho inteiro em pixels: bordas nítidas, sem linhas finas entre os quadrados.
    const module = Math.max(1, Math.floor(size / total));
    const list: { key: string; left: number; top: number; width: number }[] = [];
    matrix.forEach((row, rowIndex) => {
      for (const run of darkRuns(row)) {
        list.push({
          key: `${rowIndex}-${run.start}`,
          left: (run.start + QUIET_ZONE) * module,
          top: (rowIndex + QUIET_ZONE) * module,
          width: run.length * module,
        });
      }
    });
    return { rects: list.map((rect) => ({ ...rect, height: module })), pixels: total * module };
  }, [value, size]);

  return (
    <View style={[styles.canvas, { width: pixels, height: pixels }]}>
      {rects.map((rect) => (
        <View key={rect.key} style={[styles.dark, { left: rect.left, top: rect.top, width: rect.width, height: rect.height }]} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  canvas: { backgroundColor: '#FFFFFF' },
  dark: { position: 'absolute', backgroundColor: '#000000' },
});
