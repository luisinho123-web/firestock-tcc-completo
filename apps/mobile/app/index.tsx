import { Redirect } from 'expo-router';

import { useProfile } from '@/contexts/profile-context';

/** Signed-in shoppers go straight to the storefront; everyone else starts at the welcome screen. */
export default function RootIndex() {
  const { isAuthenticated, isRestoringSession } = useProfile();
  if (isRestoringSession) return null;
  return <Redirect href={isAuthenticated ? '/home' : '/onboarding'} />;
}
