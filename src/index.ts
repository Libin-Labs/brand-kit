export interface BrandAsset {
  id: string;
  label: string;
  mediaType: 'image/png' | 'image/jpeg' | 'image/svg+xml';
}
export interface MetadataRule {
  required: boolean;
  maxLength: number;
  allowedValues?: readonly string[];
}
export interface BrandKit {
  colors: Readonly<Record<string, string>>;
  fonts: Readonly<Record<string, string>>;
  assets: Readonly<Record<string, BrandAsset>>;
  metadataRules: Readonly<Record<string, MetadataRule>>;
}
export interface BrandUsage {
  colors?: readonly string[];
  fonts?: readonly string[];
  assets?: readonly string[];
  metadata?: Readonly<Record<string, string>>;
}
export interface BrandViolation {
  code:
    | 'unknown-token'
    | 'unknown-metadata'
    | 'missing-metadata'
    | 'metadata-length'
    | 'metadata-value';
  path: string;
  message: string;
}
export interface BrandLimits {
  maxTokens?: number;
  maxMetadataRules?: number;
  maxUsageItems?: number;
}
function record(input: unknown): Record<string, unknown> {
  if (
    !input ||
    typeof input !== 'object' ||
    Array.isArray(input) ||
    ![Object.prototype, null].includes(Object.getPrototypeOf(input))
  )
    throw new TypeError('Expected plain record');
  const result: Record<string, unknown> = Object.create(null) as Record<string, unknown>;
  if (Object.getOwnPropertySymbols(input).length) throw new TypeError('Unexpected symbol');
  for (const key of Object.getOwnPropertyNames(input)) {
    identifier(key);
    const descriptor = Object.getOwnPropertyDescriptor(input, key)!;
    if (!('value' in descriptor)) throw new TypeError('Accessors are unsupported');
    result[key] = descriptor.value;
  }
  return result;
}
function identifier(value: unknown): string {
  if (
    typeof value !== 'string' ||
    !/^[A-Za-z][A-Za-z0-9_.-]{0,127}$/.test(value) ||
    ['constructor', 'prototype', '__proto__'].includes(value)
  )
    throw new TypeError('Invalid token identifier');
  return value;
}
function text(value: unknown, max = 256): string {
  if (typeof value !== 'string' || !value || value.length > max || /[<>\u0000-\u001f]/u.test(value))
    throw new TypeError('Invalid plain text');
  return value;
}
function limit(value: number | undefined, fallback: number, ceiling: number): number {
  const n = value === undefined ? fallback : value;
  if (!Number.isSafeInteger(n) || n < 1 || n > ceiling) throw new RangeError('Invalid brand limit');
  return n;
}
function keysOnly(input: Record<string, unknown>, keys: readonly string[]): void {
  if (Object.keys(input).some((key) => !keys.includes(key)))
    throw new TypeError('Unknown schema property');
}
/** Brand references and rules only; this never loads a font, image, SVG, or licensed asset. */
export function createBrandKit(input: BrandKit, limits: BrandLimits = {}): BrandKit {
  const maxTokens = limit(limits.maxTokens, 1000, 1000);
  const maxRules = limit(limits.maxMetadataRules, 100, 100);
  limit(limits.maxUsageItems, 10_000, 10_000);
  const config = record(input);
  keysOnly(config, ['colors', 'fonts', 'assets', 'metadataRules']);
  const colors = record(config.colors),
    fonts = record(config.fonts),
    assets = record(config.assets);
  if (
    Object.keys(colors).length + Object.keys(fonts).length + Object.keys(assets).length >
    maxTokens
  )
    throw new RangeError('Token limit exceeded');
  const normalizedColors: Record<string, string> = Object.create(null) as Record<string, string>;
  const normalizedFonts: Record<string, string> = Object.create(null) as Record<string, string>;
  const normalizedAssets: Record<string, BrandAsset> = Object.create(null) as Record<
    string,
    BrandAsset
  >;
  for (const [key, value] of Object.entries(colors)) {
    if (typeof value !== 'string' || !/^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/.test(value))
      throw new TypeError('Invalid hex color');
    normalizedColors[key] = value.toLowerCase();
  }
  for (const [key, value] of Object.entries(fonts)) normalizedFonts[key] = text(value, 128);
  for (const [key, value] of Object.entries(assets)) {
    const asset = record(value);
    keysOnly(asset, ['id', 'label', 'mediaType']);
    const mediaType = asset.mediaType;
    if (mediaType !== 'image/png' && mediaType !== 'image/jpeg' && mediaType !== 'image/svg+xml')
      throw new TypeError('Invalid asset media type');
    normalizedAssets[key] = Object.freeze({
      id: identifier(asset.id),
      label: text(asset.label),
      mediaType,
    });
  }
  const metadataRules = record(config.metadataRules);
  if (Object.keys(metadataRules).length > maxRules)
    throw new RangeError('Metadata rule limit exceeded');
  const normalizedRules: Record<string, MetadataRule> = Object.create(null) as Record<
    string,
    MetadataRule
  >;
  for (const [key, value] of Object.entries(metadataRules)) {
    const rule = record(value);
    keysOnly(rule, ['required', 'maxLength', 'allowedValues']);
    if (typeof rule.required !== 'boolean') throw new TypeError('Expected required boolean');
    if (typeof rule.maxLength !== 'number') throw new TypeError('maxLength must be a number');
    const maxLength = limit(rule.maxLength, 256, 4096);
    if (rule.allowedValues !== undefined) {
      if (
        !Array.isArray(rule.allowedValues) ||
        !rule.allowedValues.length ||
        rule.allowedValues.length > 100
      )
        throw new RangeError('Invalid allowed values');
      const allowedValues = rule.allowedValues.map((value: unknown) => text(value, maxLength));
      if (new Set(allowedValues).size !== allowedValues.length)
        throw new TypeError('Duplicate allowed value');
      normalizedRules[key] = Object.freeze({
        required: rule.required,
        maxLength,
        allowedValues: Object.freeze(allowedValues),
      });
    } else normalizedRules[key] = Object.freeze({ required: rule.required, maxLength });
  }
  return Object.freeze({
    colors: Object.freeze(normalizedColors),
    fonts: Object.freeze(normalizedFonts),
    assets: Object.freeze(normalizedAssets),
    metadataRules: Object.freeze(normalizedRules),
  });
}
export function validateBrandUsage(
  kit: BrandKit,
  input: BrandUsage,
  limits: BrandLimits = {},
): BrandViolation[] {
  const brand = createBrandKit(kit, limits);
  const max = limit(limits.maxUsageItems, 10_000, 10_000);
  const usage = record(input);
  keysOnly(usage, ['colors', 'fonts', 'assets', 'metadata']);
  const violations: BrandViolation[] = [];
  let count = 0;
  for (const category of ['colors', 'fonts', 'assets'] as const) {
    const values = usage[category] ?? [];
    if (!Array.isArray(values) || values.length > max) throw new RangeError('Invalid usage list');
    count += values.length;
    if (count > max) throw new RangeError('Usage limit exceeded');
    for (const [index, token] of values.entries()) {
      identifier(token);
      if (!Object.hasOwn(brand[category], token))
        violations.push({
          code: 'unknown-token',
          path: `${category}.${index}`,
          message: `Unknown ${category} token: ${token}`,
        });
    }
  }
  const metadata = record(usage.metadata ?? {});
  count += Object.keys(metadata).length;
  if (count > max) throw new RangeError('Usage limit exceeded');
  for (const key of Object.keys(metadata).sort()) {
    const value = metadata[key];
    if (typeof value !== 'string' || value.length > 4096 || /[<>\u0000-\u001f]/u.test(value))
      throw new TypeError('Invalid metadata text');
    const rule = brand.metadataRules[key];
    if (!rule)
      violations.push({
        code: 'unknown-metadata',
        path: `metadata.${key}`,
        message: 'Metadata key is not allowed',
      });
    else {
      if (value.length > rule.maxLength)
        violations.push({
          code: 'metadata-length',
          path: `metadata.${key}`,
          message: 'Metadata exceeds maximum length',
        });
      if (rule.allowedValues && !rule.allowedValues.includes(value))
        violations.push({
          code: 'metadata-value',
          path: `metadata.${key}`,
          message: 'Metadata value is not allowed',
        });
    }
  }
  for (const key of Object.keys(brand.metadataRules).sort()) {
    if (
      brand.metadataRules[key]!.required &&
      (!Object.hasOwn(metadata, key) || metadata[key] === '')
    ) {
      violations.push({
        code: 'missing-metadata',
        path: `metadata.${key}`,
        message: 'Required metadata is missing',
      });
    }
  }
  return violations;
}
