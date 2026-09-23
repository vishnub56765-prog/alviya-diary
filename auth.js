/**
 * ALVIYA DAIRY - Authentication Controller
 * Unified login for Main Owner (ALVIYA-MAIN) and Center Owners.
 */

import { CONFIG, centerLoginEmail } from './config.js';
import { session, uiState, resetState } from './state.js';
import { getSupabase, loadCloudState } from './supabase.js';

export function setupAuth({ onLoginSuccess, onLogout, showToast, buildNav, renderAll, showPage, enterCenter }) {
  const sb = getSupabase();
  const loginForm = document.getElementById('loginForm');
  const forgotPasswordBtn = document.getElementById('forgotPasswordBtn');
  const cancelResetBtn = document.getElementById('cancelResetBtn');
  const resetPasswordForm = document.getElementById('resetPasswordForm');
  const resetPanel = document.getElementById('resetPanel');
  const logoutBtn = document.getElementById('logoutBtn');

  // Unified Login Form Submit
  loginForm.addEventListener('submit', async e => {
    e.preventDefault();
    const userIdInput = document.getElementById('loginUserId').value.trim().toUpperCase();
    const password = document.getElementById('loginPassword').value;

    if (password.length < 6) {
      return showToast('Password must be at least 6 characters.');
    }

    const isOwner = (userIdInput === CONFIG.OWNER_LOGIN_ID);
    const email = isOwner ? CONFIG.OWNER_EMAIL : centerLoginEmail(userIdInput);

    showToast('Authenticating...');

    let authResult = await sb.auth.signInWithPassword({ email, password });

    // First-time owner setup/activation check
    if (authResult.error && isOwner) {
      const activation = await sb.auth.signUp({ email: CONFIG.OWNER_EMAIL, password });
      const identities = activation.data?.user?.identities || [];
      if (!activation.error && identities.length > 0) {
        if (!activation.data.session) {
          return showToast('Activation email sent to ' + CONFIG.OWNER_EMAIL + '. Please verify and log in.');
        }
        authResult = { data: activation.data, error: null };
      }
    }

    if (authResult.error || !authResult.data?.session) {
      // If cloud auth fails, check if user is in offline development mode
      console.warn('Auth result:', authResult.error);
      return showToast('Invalid User ID / Center ID or password.');
    }

    session.accessToken = authResult.data.session.access_token;
    session.userId = authResult.data.session.user.id;
    session.email = authResult.data.session.user.email;

    try {
      await loadCloudState();
    } catch (err) {
      console.warn('Could not fully synchronize with Supabase on login:', err);
    }

    // Switch view to App
    document.getElementById('loginView').classList.add('hidden');
    document.getElementById('appView').classList.remove('hidden');

    buildNav();
    renderAll();

    if (session.role === 'main') {
      showPage('centersPage');
    } else {
      enterCenter(session.centerId);
    }

    showToast(`Welcome to ALVIYA DAIRY (${session.role === 'main' ? 'Main Owner' : 'Center Owner'})`);
    if (onLoginSuccess) onLoginSuccess();
  });

  // Toggle Forgot / Reset Password Panel
  forgotPasswordBtn.addEventListener('click', () => {
    resetPanel.classList.toggle('hidden');
    const current = document.getElementById('loginUserId').value.trim();
    if (current) document.getElementById('resetUserId').value = current;
  });

  cancelResetBtn.addEventListener('click', () => {
    resetPanel.classList.add('hidden');
    resetPasswordForm.reset();
  });

  // Reset Password Form Submit
  resetPasswordForm.addEventListener('submit', async e => {
    e.preventDefault();
    const userId = document.getElementById('resetUserId').value.trim().toUpperCase();
    const newPass = document.getElementById('resetNewPassword').value;
    const confirmPass = document.getElementById('resetConfirmPassword').value;

    if (newPass.length < 6) return showToast('Password must contain at least 6 characters.');
    if (newPass !== confirmPass) return showToast('New passwords do not match.');

    if (uiState.passwordRecoveryMode) {
      const { error } = await sb.auth.updateUser({ password: newPass });
      if (error) return showToast(error.message || 'Unable to update password.');
      uiState.passwordRecoveryMode = false;
      resetPanel.classList.add('hidden');
      resetPasswordForm.reset();
      return showToast('Main Owner password updated. You can continue.');
    }

    if (userId === CONFIG.OWNER_LOGIN_ID) {
      const { error } = await sb.auth.resetPasswordForEmail(CONFIG.OWNER_EMAIL, {
        redirectTo: window.location.origin + window.location.pathname
      });
      if (error) return showToast(error.message || 'Unable to send reset email.');
      resetPanel.classList.add('hidden');
      resetPasswordForm.reset();
      return showToast('Password reset email sent to ' + CONFIG.OWNER_EMAIL);
    }

    showToast('For security, Center Owner passwords are reset by the Main Owner from Edit Center.');
  });

  // Supabase Auth State Change listener for password recovery URL callbacks
  sb.auth.onAuthStateChange(event => {
    if (event === 'PASSWORD_RECOVERY') {
      uiState.passwordRecoveryMode = true;
      resetPanel.classList.remove('hidden');
      document.getElementById('resetUserId').value = CONFIG.OWNER_LOGIN_ID;
      document.getElementById('resetRecovery').value = 'EMAIL-VERIFIED';
      showToast('Enter a new Main Owner password.');
    }
  });

  // Secure Logout
  logoutBtn.addEventListener('click', async () => {
    try {
      await sb.auth.signOut();
    } catch (err) {
      console.warn('Sign out error:', err);
    }
    resetState();
    document.getElementById('appView').classList.add('hidden');
    document.getElementById('loginView').classList.remove('hidden');
    loginForm.reset();
    resetPanel.classList.add('hidden');
    showToast('Logged out securely.');
    if (onLogout) onLogout();
  });
}
