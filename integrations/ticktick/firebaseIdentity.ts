// Verify Firebase login using Google's public signing keys; no admin credential is required.
type SigningKey = JsonWebKey & { kid: string };
let cached: { keys: SigningKey[]; expires: number } | undefined;
const keyUrl = 'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com';
function bytes(value: string) {
  const decoded = atob(value.replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(decoded, c => c.charCodeAt(0));
}
export async function firebaseIdentity(token: string, project: string): Promise<string> {
  const invalid = () => { throw new Error('Войдите в аккаунт PLAY YOUR LIFE заново.'); };
  try {
    if (token.length > 10000) return invalid();
    const parts = token.split('.');
    if (parts.length !== 3) return invalid();
    const header = JSON.parse(new TextDecoder().decode(bytes(parts[0])));
    const claims = JSON.parse(new TextDecoder().decode(bytes(parts[1])));
    const now = Math.floor(Date.now() / 1000);
    if (header.alg !== 'RS256' || typeof header.kid !== 'string') return invalid();
    if (claims.aud !== project || claims.iss !== `https://securetoken.google.com/${project}` || typeof claims.sub !== 'string' || !claims.sub.length || claims.sub.length > 128) return invalid();
    if (typeof claims.exp !== 'number' || claims.exp <= now || typeof claims.iat !== 'number' || claims.iat > now + 60 || claims.iat >= claims.exp || typeof claims.auth_time !== 'number' || claims.auth_time > now + 60) return invalid();
    if (!cached || cached.expires <= Date.now() || !cached.keys.some(k => k.kid === header.kid)) {
      const response = await fetch(keyUrl, { signal: AbortSignal.timeout(10000) });
      if (!response.ok) throw new Error();
      const data = await response.json() as { keys: SigningKey[] };
      if (!Array.isArray(data.keys)) throw new Error();
      const age = Number(response.headers.get('cache-control')?.match(/max-age=(\d+)/)?.[1] ?? 3600);
      cached = { keys: data.keys, expires: Date.now() + Math.min(3600, age) * 1000 };
    }
    const jwk = cached.keys.find(k => k.kid === header.kid && k.kty === 'RSA');
    if (!jwk) return invalid();
    const key = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
    if (!await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, bytes(parts[2]), new TextEncoder().encode(`${parts[0]}.${parts[1]}`))) return invalid();
    return claims.sub;
  } catch {
    return invalid();
  }
}
