import { Button } from '@/components/ui/button';

type AuthPrimaryButtonProps = {
  label: string;
  onPress?: () => void;
  disabled?: boolean;
  loading?: boolean;
};

export function AuthPrimaryButton({ label, onPress, disabled, loading }: AuthPrimaryButtonProps) {
  return <Button label={label} onPress={onPress} disabled={disabled} loading={loading} style={{ marginTop: 4 }} />;
}
