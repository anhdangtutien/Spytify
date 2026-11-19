// RFC 6238 TOTP (Time-based One-Time Password) Implementation for Google Authenticator / 2FA
// Uses Web Crypto API (supported natively by Webview2 / modern browsers)

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

/**
 * Generate a random Base32 secret key (16 or 32 uppercase characters)
 */
export function generateTotpSecret(length: number = 16): string {
  const bytes = new Uint8Array(length);
  if (typeof window !== 'undefined' && window.crypto && window.crypto.getRandomValues) {
    window.crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < length; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  let secret = '';
  for (let i = 0; i < length; i++) {
    secret += BASE32_ALPHABET[bytes[i] % BASE32_ALPHABET.length];
  }
  return secret;
}

/**
 * Decode Base32 string into Uint8Array
 */
function base32Decode(base32: string): Uint8Array {
  const clean = base32.toUpperCase().replace(/[\s=-]/g, '');
  let bits = '';
  for (let i = 0; i < clean.length; i++) {
    const val = BASE32_ALPHABET.indexOf(clean[i]);
    if (val === -1) continue;
    bits += val.toString(2).padStart(5, '0');
  }
  const bytes = new Uint8Array(Math.floor(bits.length / 8));
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(bits.substring(i * 8, (i + 1) * 8), 2);
  }
  return bytes;
}

/**
 * Generate 6-digit TOTP code for a given timestamp counter
 */
async function generateTotpForCounter(secret: string, counter: number): Promise<string> {
  const secretBytes = base32Decode(secret);
  if (secretBytes.length === 0) return '';

  const counterBuffer = new ArrayBuffer(8);
  const view = new DataView(counterBuffer);
  view.setBigUint64(0, BigInt(counter), false);

  const cryptoKey = await window.crypto.subtle.importKey(
    'raw',
    secretBytes.buffer as ArrayBuffer,
    { name: 'HMAC', hash: { name: 'SHA-1' } },
    false,
    ['sign']
  );

  const signature = await window.crypto.subtle.sign('HMAC', cryptoKey, counterBuffer);
  const hmac = new Uint8Array(signature);
  const offset = hmac[19] & 0x0f;
  const code = (
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff)
  ) % 1000000;

  return code.toString().padStart(6, '0');
}

/**
 * Generate current 6-digit code for a secret
 */
export async function getCurrentTotp(secret: string): Promise<string> {
  const timeStep = Math.floor(Date.now() / 1000 / 30);
  return generateTotpForCounter(secret, timeStep);
}

/**
 * Verify a 6-digit token against a secret with time window drift tolerance (+/- 1 step = 90s)
 */
export async function verifyTotp(
  token: string,
  secret: string,
  windowTolerance: number = 1
): Promise<boolean> {
  const cleanToken = token.trim().replace(/\s+/g, '');
  if (!cleanToken || cleanToken.length !== 6 || !/^\d{6}$/.test(cleanToken)) {
    return false;
  }
  if (!secret || secret.trim().length < 8) {
    return false;
  }

  const currentStep = Math.floor(Date.now() / 1000 / 30);
  for (let offset = -windowTolerance; offset <= windowTolerance; offset++) {
    try {
      const expected = await generateTotpForCounter(secret, currentStep + offset);
      if (expected === cleanToken) {
        return true;
      }
    } catch {
      // ignore calculation error
    }
  }
  return false;
}

/**
 * Generate otpauth URI for Google Authenticator / Microsoft Authenticator
 */
export function getOtpAuthUrl(
  username: string,
  secret: string,
  issuer: string = 'Spytify'
): string {
  const cleanUser = encodeURIComponent(username.trim() || 'user');
  const cleanIssuer = encodeURIComponent(issuer.trim());
  return `otpauth://totp/${cleanIssuer}:${cleanUser}?secret=${secret}&issuer=${cleanIssuer}&algorithm=SHA1&digits=6&period=30`;
}

/**
 * Generate a QR code image URL for the otpauth URI
 */
export function getQrCodeImageUrl(otpAuthUrl: string, size: number = 200): string {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&margin=8&data=${encodeURIComponent(otpAuthUrl)}`;
}
