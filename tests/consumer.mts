import {
  createBrandKit,
  validateBrandUsage,
  type BrandAsset,
  type MetadataRule,
  type BrandKit,
  type BrandUsage,
  type BrandViolation,
  type BrandLimits,
} from '@lp-labs/brand-kit';
const asset: BrandAsset = { id: 'logo-id', label: 'Mark', mediaType: 'image/png' };
const rule: MetadataRule = { required: true, maxLength: 20 };
const limits: BrandLimits = { maxTokens: 5 };
const kit: BrandKit = createBrandKit(
  {
    colors: { ink: '#000000' },
    fonts: {},
    assets: { logo: asset },
    metadataRules: { campaign: rule },
  },
  limits,
);
const usage: BrandUsage = { assets: ['logo'], metadata: { campaign: 'Demo' } };
const result: BrandViolation[] = validateBrandUsage(kit, usage, limits);
void result;
// @ts-expect-error metadata values must be strings
validateBrandUsage(kit, { metadata: { campaign: 1 } });
