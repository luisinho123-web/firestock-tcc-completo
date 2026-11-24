import test from 'node:test';
import assert from 'node:assert/strict';

import { buildPixPayload } from './pix.ts';
import { darkRuns, qrMatrix } from './qr.ts';

test('darkRuns junta módulos escuros vizinhos em um só trecho', () => {
  assert.deepEqual(darkRuns([true, true, false, true, false, false, true, true, true]), [
    { start: 0, length: 2 },
    { start: 3, length: 1 },
    { start: 6, length: 3 },
  ]);
  assert.deepEqual(darkRuns([false, false]), []);
  assert.deepEqual(darkRuns([true, true]), [{ start: 0, length: 2 }]);
});

test('os trechos reconstroem exatamente a matriz original', () => {
  const matrix = qrMatrix(buildPixPayload({ key: 'maria@example.com', name: 'FireStock', city: 'Cascavel', amount: 42.5, txid: 'ABC123' }));
  matrix.forEach((row) => {
    const rebuilt = Array(row.length).fill(false);
    for (const run of darkRuns(row)) for (let i = 0; i < run.length; i += 1) rebuilt[run.start + i] = true;
    assert.deepEqual(rebuilt, row);
  });
});

test('a matriz é quadrada e tem os três cantos de localização do QR Code', () => {
  const matrix = qrMatrix('teste');
  const n = matrix.length;
  assert.ok(matrix.every((row) => row.length === n));
  // Cada canto de localização começa com uma borda escura de 7 módulos.
  for (const [r, c] of [[0, 0], [0, n - 7], [n - 7, 0]]) {
    for (let i = 0; i < 7; i += 1) {
      assert.equal(matrix[r][c + i], true);
      assert.equal(matrix[r + i][c], true);
    }
  }
  // O quarto canto (embaixo à direita) não tem esse padrão.
  assert.equal(matrix[n - 1][n - 1] && matrix[n - 1][n - 2] && matrix[n - 2][n - 1], false);
});
