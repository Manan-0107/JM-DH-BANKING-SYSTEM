import assert from 'assert';
import nextConfig from './next.config.mjs';

async function testHeaders() {
  console.log('Testing next.config.mjs Security Headers...');
  assert(typeof nextConfig.headers === 'function', 'nextConfig.headers must be an async function');
  const headersConfig = await nextConfig.headers();
  assert(Array.isArray(headersConfig), 'headers() must return an array');
  assert(headersConfig.length > 0, 'headers() array must not be empty');

  const rootRule = headersConfig.find(r => r.source === '/:path*');
  assert(rootRule, 'Must define a global /:path* security headers rule');

  const headers = rootRule.headers.reduce((acc, h) => {
    acc[h.key.toLowerCase()] = h.value;
    return acc;
  }, {});

  assert.strictEqual(headers['x-content-type-options'], 'nosniff');
  assert.strictEqual(headers['x-frame-options'], 'DENY');
  assert.strictEqual(headers['referrer-policy'], 'strict-origin-when-cross-origin');
  assert.strictEqual(headers['permissions-policy'], 'camera=(), microphone=(), geolocation=(), payment=()');
  assert.strictEqual(headers['x-xss-protection'], '1; mode=block');

  console.log('[PASS] All next.config.mjs security headers verified successfully.');
}

testHeaders().catch(err => {
  console.error(err);
  process.exit(1);
});

