import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ConfidentialClientApplication } from '@azure/msal-node';
import { authDiagnostic, ENTRA_PORTAL_CLIENT_ID, publicConfiguration, requiresReconnect, scopes } from '../integrations/onedrive/auth.ts';

test('configuration rejects portal Client ID, organizations and malformed callback origins without exposing secrets', () => {
  const valid = { MICROSOFT_CLIENT_ID: crypto.randomUUID(), MICROSOFT_CLIENT_SECRET: 'fixture-secret', TOKEN_ENCRYPTION_KEY: 'e'.repeat(64), BRIDGE_URL: 'https://bridge.example' };
  assert.equal(publicConfiguration(valid).configured, true);
  assert.equal(publicConfiguration(valid).authority, 'https://login.microsoftonline.com/consumers');
  assert.equal(publicConfiguration({ ...valid, MICROSOFT_TENANT: 'common' }).authority, 'https://login.microsoftonline.com/common');
  assert.ok(publicConfiguration({ ...valid, MICROSOFT_CLIENT_ID: ENTRA_PORTAL_CLIENT_ID }).issues.some(x => x.code === 'ENTRA_PORTAL_CLIENT_ID'));
  assert.ok(publicConfiguration({ ...valid, MICROSOFT_TENANT: 'organizations' }).issues.some(x => x.code === 'PERSONAL_ACCOUNTS_DISABLED'));
  assert.equal(publicConfiguration({ ...valid, MICROSOFT_TENANT: 'organizations' }).authority, 'https://login.microsoftonline.com/organizations', 'diagnosis shows the actual rejected authority');
  for (const address of ['https://bridge.example/', 'https://bridge.example/callback', 'https://user:password@bridge.example', 'https://bridge.example?token=secret', 'http://bridge.example']) assert.equal(publicConfiguration({ ...valid, BRIDGE_URL: address }).configured, false);
  const data = JSON.stringify(publicConfiguration({ ...valid, MICROSOFT_CLIENT_ID: 'accidentally-pasted-private-secret' }));
  assert.equal(data.includes('fixture-secret'), false); assert.equal(data.includes('accidentally-pasted-private-secret'), false);
});

test('diagnosis distinguishes revoked refresh token, portal/account errors and temporary failures with no provider details', () => {
  const error = { errorCode: 'invalid_grant', error_description: 'AADSTS50020 private-email@example.test authorization_code=secret access_token=secret refresh_token=secret' };
  const diagnostic = authDiagnostic(error, 'callback');
  assert.equal(diagnostic.code, 'AADSTS50020'); assert.equal(diagnostic.stage, 'callback'); assert.match(diagnostic.correlationId, /^[a-f0-9-]{36}$/);
  assert.equal(JSON.stringify(diagnostic).includes('secret'), false); assert.equal(JSON.stringify(diagnostic).includes('private-email'), false);
  assert.equal(requiresReconnect(authDiagnostic({ errorCode: 'invalid_grant' }, 'refresh')), true);
  assert.equal(requiresReconnect(authDiagnostic({ errorCode: 'invalid_grant', message: 'AADSTS65001 consent required' }, 'refresh')), true);
  assert.equal(requiresReconnect(authDiagnostic(new TypeError('private transport detail'), 'refresh')), false);
  assert.match(authDiagnostic({ message: 'AADSTS50011 redirect=private' }, 'token_exchange').message, /Web/);
  assert.match(authDiagnostic({ status: 404 }, 'graph_drive').message, /Откройте OneDrive/);
});

test('real MSAL SDK uses v2 consumers/common endpoints, PKCE, nonce and standard delegated scopes', async () => {
  for (const tenant of ['consumers', 'common']) {
    const authority = `https://login.microsoftonline.com/${tenant}`;
    const app = new ConfidentialClientApplication({ auth: {
      clientId: crypto.randomUUID(), clientSecret: 'fixture-secret', authority,
      cloudDiscoveryMetadata: JSON.stringify({ metadata: [{ preferred_network: 'login.microsoftonline.com', preferred_cache: 'login.windows.net', aliases: ['login.microsoftonline.com', 'login.windows.net'] }] }),
      authorityMetadata: JSON.stringify({ authorization_endpoint: `${authority}/oauth2/v2.0/authorize`, token_endpoint: `${authority}/oauth2/v2.0/token`, issuer: `${authority}/v2.0`, jwks_uri: `${authority}/discovery/v2.0/keys`, end_session_endpoint: `${authority}/oauth2/v2.0/logout` }),
    } });
    const url = new URL(await app.getAuthCodeUrl({ scopes, redirectUri: 'https://bridge.example/callback', state: 'fixture-state', nonce: 'fixture-nonce', codeChallenge: 'fixture-pkce-challenge', codeChallengeMethod: 'S256' }));
    assert.equal(url.origin + url.pathname, `${authority}/oauth2/v2.0/authorize`);
    for (const scope of ['User.Read', 'Files.ReadWrite', 'openid', 'profile', 'offline_access']) assert.ok(url.searchParams.get('scope')!.split(' ').includes(scope), scope);
    assert.equal(url.searchParams.get('nonce'), 'fixture-nonce'); assert.equal(url.searchParams.get('code_challenge_method'), 'S256'); assert.equal(url.searchParams.get('response_type'), 'code');
    assert.equal(url.searchParams.has('client_secret'), false);
  }
});
