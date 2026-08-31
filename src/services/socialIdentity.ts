import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';

const recoveryPhraseKey = 'explorepath.social.recovery-phrase.v1';

export function normalizeRecoveryPhrase(value: string) {
  return value.toUpperCase().replace(/[^A-F0-9]/g, '');
}

export async function generateRecoveryPhrase() {
  const bytes = await Crypto.getRandomBytesAsync(16);
  const hex = Array.from(bytes, (value) => value.toString(16).padStart(2, '0')).join('').toUpperCase();
  return hex.match(/.{1,4}/g)?.join('-') ?? hex;
}

export async function hashRecoveryPhrase(value: string) {
  return Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    normalizeRecoveryPhrase(value),
  );
}

export async function saveRecoveryPhrase(value: string, profileId: string) {
  await SecureStore.setItemAsync(recoveryPhraseKey, JSON.stringify({ profileId, phrase: value }), {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
}

export async function loadRecoveryPhrase(profileId: string) {
  const stored = await SecureStore.getItemAsync(recoveryPhraseKey);
  if (!stored) return null;
  try { const identity = JSON.parse(stored); return identity.profileId === profileId && typeof identity.phrase === 'string' ? identity.phrase : null; } catch { return null; }
}

export async function clearRecoveryPhrase() {
  await SecureStore.deleteItemAsync(recoveryPhraseKey);
}
