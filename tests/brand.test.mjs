import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createBrandKit, validateBrandUsage } from '../dist/esm/index.js';
const config = () => ({
  colors: { primary: '#AABBCC', ink: '#000000ff' },
  fonts: { body: 'Example Sans' },
  assets: { logo: { id: 'company-logo', label: 'Company mark', mediaType: 'image/svg+xml' } },
  metadataRules: {
    campaign: { required: true, maxLength: 8, allowedValues: ['spring', 'summer'] },
    note: { required: false, maxLength: 4 },
  },
});
test('kit normalizes colors and snapshots reference-only assets', () => {
  const kit = createBrandKit(config());
  assert.deepEqual({ ...kit.colors }, { primary: '#aabbcc', ink: '#000000ff' });
  assert.deepEqual(kit.assets.logo, {
    id: 'company-logo',
    label: 'Company mark',
    mediaType: 'image/svg+xml',
  });
  assert.equal(kit.fonts.body, 'Example Sans');
});
test('all nested snapshot structures are frozen and independent', () => {
  const input = config(),
    kit = createBrandKit(input);
  input.assets.logo.label = 'Changed';
  input.metadataRules.campaign.allowedValues.push('winter');
  assert.equal(kit.assets.logo.label, 'Company mark');
  assert.deepEqual(kit.metadataRules.campaign.allowedValues, ['spring', 'summer']);
  assert.throws(() => {
    kit.colors.primary = '#000000';
  }, TypeError);
  assert.throws(() => {
    kit.assets.logo.id = 'other';
  }, TypeError);
  assert.throws(() => kit.metadataRules.campaign.allowedValues.push('winter'), TypeError);
});
test('valid usage has no violations and optional metadata can be omitted', () => {
  assert.deepEqual(
    validateBrandUsage(createBrandKit(config()), {
      colors: ['primary'],
      fonts: ['body'],
      assets: ['logo'],
      metadata: { campaign: 'spring' },
    }),
    [],
  );
});
test('unknown tokens produce category/index paths in input order', () => {
  const result = validateBrandUsage(createBrandKit(config()), {
    colors: ['missing', 'primary'],
    fonts: ['unknown'],
    assets: ['other'],
    metadata: { campaign: 'summer' },
  });
  assert.deepEqual(
    result.map((v) => [v.code, v.path]),
    [
      ['unknown-token', 'colors.0'],
      ['unknown-token', 'fonts.0'],
      ['unknown-token', 'assets.0'],
    ],
  );
});
test('metadata failures return exact deterministic codes and paths', () => {
  const result = validateBrandUsage(config(), {
    metadata: { z: 'x', note: 'longer', campaign: 'not-valid' },
  });
  assert.deepEqual(
    result.map((v) => [v.code, v.path]),
    [
      ['metadata-length', 'metadata.campaign'],
      ['metadata-value', 'metadata.campaign'],
      ['metadata-length', 'metadata.note'],
      ['unknown-metadata', 'metadata.z'],
    ],
  );
  assert.deepEqual(
    validateBrandUsage(config(), {}).map((v) => [v.code, v.path]),
    [['missing-metadata', 'metadata.campaign']],
  );
  assert.deepEqual(
    validateBrandUsage(config(), { metadata: { campaign: '' } }).map((v) => v.code),
    ['metadata-value', 'missing-metadata'],
  );
});
test('closed schema and own-data records never invoke getters', () => {
  let calls = 0;
  const input = config();
  input.colors = {
    get primary() {
      calls++;
      return '#ffffff';
    },
  };
  assert.throws(() => createBrandKit(input), TypeError);
  assert.equal(calls, 0);
  assert.throws(() => createBrandKit({ ...config(), html: '<b>' }), TypeError);
  assert.throws(() => validateBrandUsage(config(), JSON.parse('{"__proto__":{}}')), TypeError);
  assert.throws(() => validateBrandUsage(config(), Object.create({ colors: [] })), TypeError);
});
test('invalid color font asset and metadata definitions reject', () => {
  const changes = [
    (c) => {
      c.colors.primary = 'red';
    },
    (c) => {
      c.fonts.body = '<style>';
    },
    (c) => {
      c.assets.logo.id = 'https://evil.test/x';
    },
    (c) => {
      c.assets.logo.mediaType = 'text/html';
    },
    (c) => {
      c.metadataRules.note.allowedValues = ['a', 'a'];
    },
    (c) => {
      c.metadataRules.note.required = 'yes';
    },
    (c) => {
      c.metadataRules.note.maxLength = null;
    },
  ];
  for (const change of changes) {
    const c = config();
    change(c);
    assert.throws(() => createBrandKit(c), TypeError);
  }
  assert.throws(() => validateBrandUsage(config(), { metadata: { campaign: '<b>' } }), TypeError);
  assert.throws(() => validateBrandUsage(config(), { colors: ['constructor'] }), TypeError);
});
test('token rules usage and enum work limits are bounded', () => {
  assert.throws(() => createBrandKit(config(), { maxTokens: 3 }), RangeError);
  assert.throws(() => createBrandKit(config(), { maxMetadataRules: 1 }), RangeError);
  assert.throws(
    () =>
      validateBrandUsage(config(), { colors: ['primary'], fonts: ['body'] }, { maxUsageItems: 1 }),
    RangeError,
  );
  const c = config();
  c.metadataRules.note.allowedValues = Array(101).fill('a');
  assert.throws(() => createBrandKit(c), RangeError);
  assert.throws(() => createBrandKit(config(), { maxTokens: 0 }), RangeError);
});
test('metadata boundary length allows exact maximum', () => {
  assert.deepEqual(
    validateBrandUsage(config(), { metadata: { campaign: 'spring', note: '1234' } }),
    [],
  );
  assert.equal(
    validateBrandUsage(config(), { metadata: { campaign: 'spring', note: '12345' } })[0].code,
    'metadata-length',
  );
});
test('token membership matches independent set oracle', () => {
  const names = ['primary', 'ink', 'unknown', 'extra'];
  for (const name of names) {
    const expected = new Set(['primary', 'ink']).has(name) ? [] : ['unknown-token'];
    assert.deepEqual(
      validateBrandUsage(config(), { colors: [name], metadata: { campaign: 'spring' } }).map(
        (v) => v.code,
      ),
      expected,
    );
  }
});
test('CommonJS produces same snapshot and rule violations', () => {
  const cjs = createRequire(import.meta.url)('../dist/cjs/index.js');
  assert.deepEqual(cjs.createBrandKit(config()), createBrandKit(config()));
  assert.deepEqual(
    cjs.validateBrandUsage(config(), { colors: ['unknown'] }),
    validateBrandUsage(config(), { colors: ['unknown'] }),
  );
});
