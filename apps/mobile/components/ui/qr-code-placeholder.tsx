import { StyleSheet, View } from 'react-native';

const GRID_SIZE = 12;

function seededPattern(seed: string): boolean[] {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }

  const cells: boolean[] = [];
  for (let i = 0; i < GRID_SIZE * GRID_SIZE; i += 1) {
    hash = (hash * 1103515245 + 12345) >>> 0;
    cells.push((hash >>> 16) % 2 === 0);
  }
  return cells;
}

function isFinderCell(row: number, col: number): boolean {
  const corners = [
    { row: 0, col: 0 },
    { row: 0, col: GRID_SIZE - 3 },
    { row: GRID_SIZE - 3, col: 0 },
  ];
  return corners.some(
    (corner) => row >= corner.row && row < corner.row + 3 && col >= corner.col && col < corner.col + 3,
  );
}

export function QrCodePlaceholder({ seed, size = 160 }: { seed: string; size?: number }) {
  const cells = seededPattern(seed);
  const cellSize = size / GRID_SIZE;

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      {Array.from({ length: GRID_SIZE }).map((_, row) => (
        <View key={row} style={styles.row}>
          {Array.from({ length: GRID_SIZE }).map((__, col) => {
            const filled = isFinderCell(row, col) ? (row % 2 === 0 || col % 2 === 0) : cells[row * GRID_SIZE + col];
            return (
              <View
                key={col}
                style={[
                  { width: cellSize, height: cellSize },
                  filled ? styles.cellFilled : styles.cellEmpty,
                ]}
              />
            );
          })}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
  },
  row: {
    flexDirection: 'row',
  },
  cellFilled: {
    backgroundColor: '#0F172A',
  },
  cellEmpty: {
    backgroundColor: '#FFFFFF',
  },
});
