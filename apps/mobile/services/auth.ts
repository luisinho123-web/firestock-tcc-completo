import { createAuthService } from './auth-core';
import { supabase } from './supabase';

export { ApiError, errorMessage } from './auth-core';
export type { AuthResponse } from './auth-core';

const auth = createAuthService(supabase);

export const registerUser = auth.registerUser;
export const loginUser = auth.loginUser;
export const signOutUser = auth.signOutUser;
export const restoreSession = auth.restoreSession;
export const requestPasswordReset = auth.requestPasswordReset;
export const startRecoverySession = auth.startRecoverySession;
export const updatePassword = auth.updatePassword;
