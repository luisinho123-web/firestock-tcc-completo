import qrcode from 'qrcode-generator';

/** Matriz do QR Code (true = módulo escuro) para o texto, com correção de erro nível M (boa para telas). */
export function qrMatrix(text: string): boolean[][] {
  const qr = qrcode(0, 'M'); // 0 = escolhe o menor tamanho que cabe o texto
  qr.addData(text);
  qr.make();
  const size = qr.getModuleCount();
  return Array.from({ length: size }, (_, row) => Array.from({ length: size }, (__, col) => qr.isDark(row, col)));
}

/** Trechos consecutivos de módulos escuros de uma linha: desenhar 1 retângulo por trecho gera bem menos views do que 1 por módulo. */
export function darkRuns(row: boolean[]): { start: number; length: number }[] {
  const runs: { start: number; length: number }[] = [];
  let start = -1;
  for (let col = 0; col <= row.length; col += 1) {
    const dark = col < row.length && row[col];
    if (dark && start < 0) start = col;
    if (!dark && start >= 0) {
      runs.push({ start, length: col - start });
      start = -1;
    }
  }
  return runs;
}
