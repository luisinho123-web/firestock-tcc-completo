import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

const GAP = 14;

/** Two equal columns with identical gutters. Pairs items into rows (an odd last item keeps half width)
 * instead of `width: '47%'` + wrap, which leaves a ragged right edge that varies with screen width.
 * For the small curated lists shown inside scroll views; a long catalog should use a FlatList. */
export function TwoColumnGrid<T>({
  items,
  keyOf,
  renderItem,
  trailing,
}: {
  items: T[];
  keyOf: (item: T) => string;
  renderItem: (item: T) => ReactNode;
  /** Extra cell appended after the items (e.g. a "descubra mais" card). */
  trailing?: ReactNode;
}) {
  const cells: { key: string; node: ReactNode }[] = items.map((item) => ({ key: keyOf(item), node: renderItem(item) }));
  if (trailing) cells.push({ key: '__trailing', node: trailing });

  const rows: (typeof cells)[] = [];
  for (let i = 0; i < cells.length; i += 2) rows.push(cells.slice(i, i + 2));

  return (
    <View style={styles.grid}>
      {rows.map((row) => (
        <View key={row.map((cell) => cell.key).join('|')} style={styles.row}>
          {row.map((cell) => (
            <View key={cell.key} style={styles.cell}>
              {cell.node}
            </View>
          ))}
          {row.length === 1 ? <View style={styles.cell} /> : null}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    gap: GAP,
  },
  row: {
    flexDirection: 'row',
    gap: GAP,
  },
  cell: {
    flex: 1,
  },
});
