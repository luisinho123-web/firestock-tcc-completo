import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Alert } from '@/components/ui/alert';
import { toast } from '@/components/ui/toast';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BottomBar } from '@/components/ui/bottom-bar';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { IconSymbol, type IconSymbolName } from '@/components/ui/icon-symbol';
import { PressableScale } from '@/components/ui/pressable-scale';
import { ScreenContainer } from '@/components/ui/screen-container';
import { ScreenHeader } from '@/components/ui/screen-header';
import { SearchField } from '@/components/ui/search-field';
import { COLORS, FONT_SIZES, FONT_WEIGHTS, RADIUS, SPACING, TYPOGRAPHY } from '@/components/ui/theme';
import { useAddresses, type Address, type AddressTag } from '@/contexts/addresses-context';
import { normalizeSearch } from '@/utils/format';

const TAG_ICON: Record<AddressTag, IconSymbolName> = {
  casa: 'house.fill',
  trabalho: 'building.fill',
  outro: 'heart.fill',
};

function addressLines(address: Address): [string, string] {
  const line1 = [address.street + (address.number ? `, ${address.number}` : ''), address.complement].filter(Boolean).join(' · ');
  const line2 = [address.neighborhood, address.city].filter(Boolean).join(', ') + (address.cep ? ` · ${address.cep}` : '');
  return [line1, line2];
}

export default function AddressesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { addresses, selectedAddressId, selectAddress, removeAddress, setDefaultAddress } = useAddresses();
  const [query, setQuery] = useState('');

  const term = normalizeSearch(query);
  const filtered = term
    ? addresses.filter((address) => normalizeSearch(`${address.label} ${address.street} ${address.cep}`).includes(term))
    : addresses;

  const handleRemove = (address: Address) => {
    Alert.alert('Remover endereço?', `"${address.label}" será removido dos seus endereços.`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Remover', style: 'destructive', onPress: async () => {
          await removeAddress(address.id);
          toast.success('Endereço removido.');
        },
      },
    ]);
  };

  return (
    <View style={styles.page}>
      <ScreenContainer style={[styles.container, { paddingTop: insets.top + SPACING.md }]}>
        <ScreenHeader title="Endereços" />

        {addresses.length > 3 ? <SearchField value={query} onChangeText={setQuery} placeholder="Buscar endereço ou CEP" /> : null}

        <Text style={styles.sectionLabel} accessibilityRole="header">
          ENDEREÇOS SALVOS
        </Text>

        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {addresses.length === 0 ? (
            <EmptyState
              compact
              icon="location.fill"
              title="Nenhum endereço salvo"
              subtitle="Adicione onde você quer receber suas compras."
            />
          ) : filtered.length === 0 ? (
            <EmptyState
              compact
              icon="magnifyingglass"
              title="Nenhum endereço encontrado"
              subtitle="Tente buscar pelo nome, rua ou CEP."
            />
          ) : null}

          {filtered.map((address) => {
            const isActive = address.id === selectedAddressId;
            const [line1, line2] = addressLines(address);
            return (
              <View key={address.id} style={[styles.card, isActive && styles.cardActive]}>
                <PressableScale
                  style={styles.cardTopRow}
                  onPress={() => selectAddress(address.id)}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: isActive }}
                  accessibilityLabel={`${address.label}${address.isDefault ? ', padrão' : ''}. ${line1}. ${line2}`}>
                  <View style={[styles.cardIcon, isActive && styles.cardIconActive]}>
                    <IconSymbol name={TAG_ICON[address.tag]} size={18} color={isActive ? COLORS.onDark : COLORS.navy} />
                  </View>
                  <View style={styles.cardInfo}>
                    <View style={styles.cardLabelRow}>
                      <Text style={styles.cardLabel}>{address.label}</Text>
                      {address.isDefault ? (
                        <View style={styles.defaultBadge}>
                          <Text style={styles.defaultBadgeText}>Padrão</Text>
                        </View>
                      ) : null}
                    </View>
                    <Text style={styles.cardDetail}>{line1}</Text>
                    <Text style={styles.cardDetail}>{line2}</Text>
                  </View>
                  <View style={[styles.radioOuter, isActive && styles.radioOuterActive]}>
                    {isActive ? <View style={styles.radioInner} /> : null}
                  </View>
                </PressableScale>

                {isActive ? (
                  <View style={styles.cardActions}>
                    <PressableScale
                      style={styles.actionButton}
                      onPress={() => router.push({ pathname: '/new-address', params: { id: address.id } })}
                      hitSlop={8}
                      accessibilityRole="button"
                      accessibilityLabel={`Editar ${address.label}`}>
                      <IconSymbol name="pencil" size={14} color={COLORS.navy} />
                      <Text style={styles.actionText}>Editar</Text>
                    </PressableScale>
                    {!address.isDefault ? (
                      <PressableScale
                        style={styles.actionButton}
                        onPress={() => setDefaultAddress(address.id)}
                        hitSlop={8}
                        accessibilityRole="button"
                        accessibilityLabel={`Tornar ${address.label} o endereço padrão`}>
                        <IconSymbol name="star.fill" size={14} color={COLORS.navy} />
                        <Text style={styles.actionText}>Tornar padrão</Text>
                      </PressableScale>
                    ) : null}
                    <PressableScale
                      style={styles.actionButton}
                      onPress={() => handleRemove(address)}
                      hitSlop={8}
                      accessibilityRole="button"
                      accessibilityLabel={`Remover ${address.label}`}>
                      <IconSymbol name="trash.fill" size={14} color={COLORS.error} />
                      <Text style={[styles.actionText, styles.actionTextDanger]}>Remover</Text>
                    </PressableScale>
                  </View>
                ) : null}
              </View>
            );
          })}

          <PressableScale style={styles.addButton} onPress={() => router.push('/new-address')} accessibilityRole="button">
            <IconSymbol name="plus" size={18} color={COLORS.navy} />
            <Text style={styles.addButtonText}>Adicionar novo endereço</Text>
          </PressableScale>
        </ScrollView>
      </ScreenContainer>

      <BottomBar>
        <Button
          label="Confirmar endereço"
          disabled={!selectedAddressId}
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/home'))}
        />
      </BottomBar>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  container: {
    paddingHorizontal: SPACING.lg,
    gap: SPACING.md,
  },
  sectionLabel: {
    ...TYPOGRAPHY.overline,
    marginTop: SPACING.xs,
    marginBottom: -SPACING.xxs,
  },
  scrollContent: {
    gap: SPACING.sm,
    paddingBottom: SPACING.lg,
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.large,
    borderWidth: 1,
    borderColor: COLORS.borderSoft,
  },
  cardActive: {
    borderWidth: 1.5,
    borderColor: COLORS.navy,
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 14,
  },
  cardIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: COLORS.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardIconActive: {
    backgroundColor: COLORS.navy,
  },
  cardInfo: {
    flex: 1,
    gap: 3,
  },
  cardLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cardLabel: {
    color: COLORS.navy,
    fontSize: FONT_SIZES.label,
    fontWeight: FONT_WEIGHTS.bold,
  },
  defaultBadge: {
    backgroundColor: COLORS.primarySoft,
    borderRadius: RADIUS.pill,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  defaultBadgeText: {
    color: COLORS.navy,
    fontSize: FONT_SIZES.caption,
    fontWeight: FONT_WEIGHTS.bold,
  },
  cardDetail: {
    color: COLORS.textTertiary,
    fontSize: FONT_SIZES.small,
  },
  radioOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: COLORS.textFaint,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  radioOuterActive: {
    borderColor: COLORS.navy,
  },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: COLORS.navy,
  },
  cardActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: SPACING.lg,
    rowGap: SPACING.xs,
    paddingHorizontal: 14,
    paddingBottom: 14,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderSoft,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  actionText: {
    color: COLORS.navy,
    fontSize: FONT_SIZES.small,
    fontWeight: FONT_WEIGHTS.bold,
  },
  actionTextDanger: {
    color: COLORS.error,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 52,
    borderRadius: RADIUS.medium,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primarySoft,
  },
  addButtonText: {
    color: COLORS.navy,
    fontSize: FONT_SIZES.label,
    fontWeight: FONT_WEIGHTS.bold,
  },
});
