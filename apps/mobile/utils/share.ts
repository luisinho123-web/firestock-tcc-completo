import { Share } from 'react-native';

/** Opens the native share sheet. Dismissing it is not an error, so failures are swallowed. */
export async function shareText(title: string, message: string) {
  try {
    await Share.share({ title, message });
  } catch {
    // The share sheet can reject when unavailable (e.g. some desktop browsers); nothing to recover.
  }
}
