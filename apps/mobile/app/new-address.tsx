import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { toast } from '@/components/ui/toast';
import { useDiscardGuard } from '@/hooks/use-discard-guard';

import { AuthTextField } from '@/components/auth/auth-text-field';
import { Button } from '@/components/ui/button';
import { FormScreen } from '@/components/ui/form-screen';
import { IconSymbol, type IconSymbolName } from '@/components/ui/icon-symbol';
import { PressableScale } from '@/components/ui/pressable-scale';
import { ScreenHeader } from '@/components/ui/screen-header';
import { COLORS, FONT_SIZES, FONT_WEIGHTS, RADIUS, SPACING } from '@/components/ui/theme';
import { CASCAVEL_CENTER, useAddresses, type AddressTag } from '@/contexts/addresses-context';
import { geocodeAddress, staticMapUrl } from '@/services/mapbox';
import { lookupCep } from '@/services/viacep';
import { useIsCompact } from '@/hooks/use-is-compact';
import { maskCep } from '@/utils/masks';
import {
  INPUT_LIMITS,
  sanitizeAddressNumber,
  sanitizeAddressText,
  sanitizeCity,
  sanitizeLabel,
} from '@/utils/sanitize';
import { isValidAddressNumber, isValidCep } from '@/utils/validation';

const TAGS: { key: AddressTag; label: string; icon: IconSymbolName }[] = [
  { key: 'casa', label: 'Casa', icon: 'house.fill' },
  { key: 'trabalho', label: 'Trabalho', icon: 'building.fill' },
  { key: 'outro', label: 'Outro', icon: 'heart.fill' },
];

type FieldErrors = Partial<Record<'cep' | 'street' | 'number' | 'label', string>>;

export default function NewAddressScreen() {
  const router = useRouter();
  const compact = useIsCompact();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { addresses, addAddress, updateAddress } = useAddresses();
  const streetRef = useRef<TextInput>(null);
  const numberRef = useRef<TextInput>(null);
  const complementRef = useRef<TextInput>(null);
  const neighborhoodRef = useRef<TextInput>(null);
  const cityRef = useRef<TextInput>(null);

  const editingAddress = addresses.find((address) => address.id === id);
  const isFirstAddress = addresses.length === 0;

  const [cep, setCep] = useState(editingAddress?.cep ?? '');
  const [street, setStreet] = useState(editingAddress?.street ?? '');
  const [number, setNumber] = useState(editingAddress?.number ?? '');
  const [complement, setComplement] = useState(editingAddress?.complement ?? '');
  const [neighborhood, setNeighborhood] = useState(editingAddress?.neighborhood ?? '');
  const [city, setCity] = useState(editingAddress?.city ?? '');
  const [tag, setTag] = useState<AddressTag>(editingAddress?.tag ?? 'casa');
  const [customLabel, setCustomLabel] = useState(editingAddress && editingAddress.tag === 'outro' ? editingAddress.label : '');
  const [isDefault, setIsDefault] = useState(editingAddress?.isDefault ?? isFirstAddress);
  const [errors, setErrors] = useState<FieldErrors>({});
  const leavingRef = useRef(false);
  const formSnapshot = JSON.stringify({ cep, street, number, complement, neighborhood, city, tag, customLabel, isDefault });
  const initialSnapshot = useRef(formSnapshot);
  useDiscardGuard(formSnapshot !== initialSnapshot.current, leavingRef);
  const [cepStatus, setCepStatus] = useState<'idle' | 'loading' | 'network_error'>('idle');
  const [pin, setPin] = useState<{ lat: number; lng: number } | null>(
    editingAddress ? { lat: editingAddress.lat, lng: editingAddress.lng } : null,
  );

  const label = tag === 'casa' ? 'Casa' : tag === 'trabalho' ? 'Trabalho' : customLabel.trim() || 'Outro';

  const clearError = (field: keyof FieldErrors) => {
    if (errors[field]) setErrors((current) => ({ ...current, [field]: undefined }));
  };

  // Looks up the CEP 400ms after typing stops, and drops the response if the field changed meanwhile
  // (fast edits shouldn't let an older lookup overwrite what's on screen now).
  useEffect(() => {
    if (editingAddress) return; // don't fight an address that's just been loaded for editing
    const digits = cep.replace(/\D/g, '');
    if (digits.length !== 8) return;

    let cancelled = false;
    const timer = setTimeout(async () => {
      setCepStatus('loading');
      const result = await lookupCep(cep);
      if (cancelled) return;

      if (result.status === 'found') {
        setStreet(result.address.street);
        setNeighborhood(result.address.neighborhood);
        setCity(`${result.address.city}${result.address.state ? ` - ${result.address.state}` : ''}`);
        clearError('cep');
        setCepStatus('idle');
        // Best-effort preview pin, right after the CEP resolves — geocodeAddress already returns null on
        // any failure (see services/mapbox.ts), so this never blocks the form either.
        geocodeAddress(`${result.address.street}, ${result.address.city}`).then((coords) => {
          if (!cancelled && coords) setPin(coords);
        });
      } else if (result.status === 'not_found') {
        setErrors((current) => ({ ...current, cep: 'CEP não encontrado.' }));
        setCepStatus('idle');
      } else if (result.status === 'network_error') {
        setCepStatus('network_error');
      } else {
        setCepStatus('idle');
      }
    }, 400);

    return () => {
      cancelled = true;
      clearTimeout(timer);
      // Runs when `cep` changes again (or the field drops below 8 digits) before this lookup resolved —
      // don't leave a stale "buscando..."/"não encontrado" hint showing for a CEP that's no longer on screen.
      setCepStatus('idle');
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cep]);

  // Best-effort preview pin for a manually-edited address: only on leaving the Cidade field (never per
  // keystroke — burns through the Mapbox free tier and, worse, would re-geocode the moment an edit screen
  // opens, moving the pin away from the address that was actually saved).
  const geocodePreviewFromFields = () => {
    if (!street.trim() || !city.trim()) return;
    geocodeAddress(`${street}, ${number}, ${city}`.trim()).then((coords) => {
      if (coords) setPin(coords);
    });
  };

  const handleSave = async () => {
    const nextErrors: FieldErrors = {};
    if (cep && !isValidCep(cep)) nextErrors.cep = 'CEP incompleto.';
    if (!street.trim()) nextErrors.street = 'Informe a rua.';
    if (!number.trim()) nextErrors.number = 'Informe o número.';
    else if (!isValidAddressNumber(number)) nextErrors.number = 'Use apenas números e letras (ex: 123, 45-A, S/N).';
    if (tag === 'outro' && !customLabel.trim()) nextErrors.label = 'Dê um nome ao endereço, ex: "Casa da mãe".';
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    // Best-effort geocode of the final address; any failure (no token, offline, no match) falls back to
    // exactly what this screen already did before Mapbox existed.
    const geocoded = await geocodeAddress(`${street}, ${number}, ${city}`.trim());
    const { lat, lng } = geocoded ?? editingAddress ?? CASCAVEL_CENTER;
    const input = {
      label,
      tag,
      cep,
      street: street.trim(),
      number: number.trim(),
      complement: complement.trim(),
      neighborhood: neighborhood.trim(),
      city: city.trim(),
      lat,
      lng,
    };

    if (editingAddress) {
      // Only pass the flag when it changed, so un-toggling doesn't leave the list without a default.
      await updateAddress(editingAddress.id, input, isDefault && !editingAddress.isDefault ? true : undefined);
    } else {
      await addAddress(input, isDefault);
    }
    toast.success(editingAddress ? 'Endereço atualizado.' : 'Endereço salvo.');
    leavingRef.current = true;
    router.back();
  };

  return (
    <FormScreen
      header={<ScreenHeader title={editingAddress ? 'Editar endereço' : 'Novo endereço'} style={styles.header} />}
      footer={<Button label="Salvar endereço" onPress={handleSave} />}>
      <View style={styles.mapPlaceholder} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {pin ? (
          // staticMapUrl returns null without a Mapbox token; `pin` only gets a value from a successful
          // geocode, so this branch and a null URL can't happen together in the same render in practice,
          // but the fallback below still covers it if it ever does.
          <Image
            source={{ uri: staticMapUrl({ lat: pin.lat, lng: pin.lng, height: 160 }) ?? undefined }}
            style={styles.mapImage}
            contentFit="cover"
          />
        ) : (
          <View style={styles.mapGrid}>
            {[0, 1, 2, 3, 4, 5].map((tile) => (
              <View key={tile} style={[styles.mapTile, tile === 1 && styles.mapTileHighlight]} />
            ))}
          </View>
        )}
        <View style={styles.mapPin}>
          <IconSymbol name="location.fill" size={16} color={COLORS.onDark} />
        </View>
      </View>

      <AuthTextField
        label="CEP"
        icon="location.fill"
        keyboardType="number-pad"
        autoComplete="postal-code"
        textContentType="postalCode"
        maxLength={9}
        value={cep}
        onChangeText={(value) => {
          setCep(maskCep(value));
          clearError('cep');
        }}
        placeholder="00000-000"
        returnKeyType="next"
        submitBehavior="submit"
        onSubmitEditing={() => streetRef.current?.focus()}
        error={errors.cep}
        hint={
          cepStatus === 'loading'
            ? 'Buscando endereço...'
            : cepStatus === 'network_error'
              ? 'Não foi possível buscar o CEP. Preencha o endereço manualmente.'
              : undefined
        }
      />
      <AuthTextField
        ref={streetRef}
        label="Rua"
        value={street}
        onChangeText={(value) => {
          setStreet(sanitizeAddressText(value, INPUT_LIMITS.street));
          clearError('street');
        }}
        placeholder="Nome da rua"
        autoComplete="street-address"
        textContentType="streetAddressLine1"
        maxLength={INPUT_LIMITS.street}
        returnKeyType="next"
        submitBehavior="submit"
        onSubmitEditing={() => numberRef.current?.focus()}
        error={errors.street}
      />

      <View style={[styles.row, compact && styles.rowStacked]}>
        <View style={compact ? undefined : styles.rowFieldSmall}>
          <AuthTextField
            ref={numberRef}
            label="Número"
            autoCapitalize="characters"
            maxLength={INPUT_LIMITS.addressNumber}
            value={number}
            onChangeText={(value) => {
              setNumber(sanitizeAddressNumber(value));
              clearError('number');
            }}
            placeholder="Nº"
            returnKeyType="next"
            submitBehavior="submit"
            onSubmitEditing={() => complementRef.current?.focus()}
            error={errors.number}
          />
        </View>
        <View style={compact ? undefined : styles.rowField}>
          <AuthTextField
            ref={complementRef}
            label="Complemento"
            value={complement}
            maxLength={INPUT_LIMITS.complement}
            onChangeText={(value) => setComplement(sanitizeAddressText(value, INPUT_LIMITS.complement))}
            placeholder="Apto, bloco, casa"
            textContentType="streetAddressLine2"
            returnKeyType="next"
            submitBehavior="submit"
            onSubmitEditing={() => neighborhoodRef.current?.focus()}
          />
        </View>
      </View>

      <View style={[styles.row, compact && styles.rowStacked]}>
        <View style={compact ? undefined : styles.rowField}>
          <AuthTextField
            ref={neighborhoodRef}
            label="Bairro"
            value={neighborhood}
            maxLength={INPUT_LIMITS.neighborhood}
            onChangeText={(value) => setNeighborhood(sanitizeAddressText(value, INPUT_LIMITS.neighborhood))}
            placeholder="Bairro"
            returnKeyType="next"
            submitBehavior="submit"
            onSubmitEditing={() => cityRef.current?.focus()}
          />
        </View>
        <View style={compact ? undefined : styles.rowField}>
          <AuthTextField
            ref={cityRef}
            label="Cidade"
            value={city}
            maxLength={INPUT_LIMITS.city}
            onChangeText={(value) => setCity(sanitizeCity(value))}
            onBlur={geocodePreviewFromFields}
            placeholder="Cidade - UF"
            textContentType="addressCityAndState"
            returnKeyType="done"
          />
        </View>
      </View>

      <Text style={styles.label}>Salvar como</Text>
      <View style={styles.tagRow} accessibilityRole="radiogroup">
        {TAGS.map((item) => {
          const isActive = tag === item.key;
          return (
            <PressableScale
              key={item.key}
              style={[styles.tagChip, isActive && styles.tagChipActive]}
              onPress={() => {
                setTag(item.key);
                clearError('label');
              }}
              accessibilityRole="radio"
              accessibilityState={{ checked: isActive }}
              accessibilityLabel={item.label}>
              <IconSymbol name={item.icon} size={14} color={isActive ? COLORS.onDark : COLORS.navy} />
              <Text style={[styles.tagChipText, isActive && styles.tagChipTextActive]}>{item.label}</Text>
            </PressableScale>
          );
        })}
      </View>

      {tag === 'outro' ? (
        <AuthTextField
          label="Nome do endereço"
          value={customLabel}
          onChangeText={(value) => {
            setCustomLabel(sanitizeLabel(value));
            clearError('label');
          }}
          placeholder="Ex: Casa da mãe"
          maxLength={INPUT_LIMITS.addressLabel}
          error={errors.label}
        />
      ) : null}

      <View style={styles.switchRow}>
        <Text style={styles.switchLabel}>Usar como endereço padrão</Text>
        <Switch
          value={isDefault}
          onValueChange={setIsDefault}
          // The only address is always the default; turning it off would leave none.
          disabled={isFirstAddress || Boolean(editingAddress?.isDefault)}
          trackColor={{ false: COLORS.border, true: COLORS.navy }}
          thumbColor={COLORS.white}
          accessibilityLabel="Usar como endereço padrão"
        />
      </View>
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  header: {
    marginBottom: SPACING.lg,
  },
  mapPlaceholder: {
    height: 160,
    borderRadius: RADIUS.large,
    backgroundColor: COLORS.surface,
    overflow: 'hidden',
    marginBottom: SPACING.md,
  },
  mapGrid: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  mapImage: {
    ...StyleSheet.absoluteFill,
  },
  mapTile: {
    width: '33.33%',
    height: '50%',
    backgroundColor: COLORS.primarySoft,
    borderWidth: 1,
    borderColor: COLORS.surface,
  },
  mapTileHighlight: {
    backgroundColor: COLORS.successSoft,
  },
  mapPin: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginLeft: -18,
    marginTop: -18,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.orange,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: COLORS.onDark,
  },
  row: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  rowStacked: {
    flexDirection: 'column',
    gap: 0,
  },
  rowField: {
    flex: 1,
  },
  rowFieldSmall: {
    width: 100,
  },
  label: {
    fontSize: 13,
    fontWeight: FONT_WEIGHTS.semibold,
    color: COLORS.navy,
    marginBottom: 8,
  },
  tagRow: {
    flexDirection: 'row',
    gap: SPACING.xs,
    marginBottom: SPACING.md,
  },
  tagChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 38,
    paddingHorizontal: 14,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  tagChipActive: {
    backgroundColor: COLORS.navy,
    borderColor: COLORS.navy,
  },
  tagChipText: {
    color: COLORS.navy,
    fontSize: FONT_SIZES.small,
    fontWeight: FONT_WEIGHTS.bold,
  },
  tagChipTextActive: {
    color: COLORS.onDark,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: SPACING.sm,
  },
  switchLabel: {
    color: COLORS.navy,
    fontSize: FONT_SIZES.label,
    fontWeight: FONT_WEIGHTS.semibold,
  },
});
