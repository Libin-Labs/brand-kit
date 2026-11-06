# @lp-labs/brand-kit

Immutable brand token snapshots and deterministic usage/metadata checks. No bundled fonts,
logos, copyrighted assets, file access, or remote loading.

## Install and quickstart

```sh
npm install @lp-labs/brand-kit
```

```js
import { createBrandKit, validateBrandUsage } from '@lp-labs/brand-kit';

const kit = createBrandKit({
  colors: { primary: '#123456' },
  fonts: { body: 'Your Licensed Font' },
  assets: { logo: { id: 'your-logo', label: 'Your logo', mediaType: 'image/png' } },
  metadataRules: {
    campaign: { required: true, maxLength: 20, allowedValues: ['launch', 'evergreen'] },
  },
});
console.log(kit.colors.primary); // #123456
console.log(
  validateBrandUsage(kit, {
    colors: ['primary'],
    fonts: ['body'],
    assets: ['logo'],
    metadata: { campaign: 'launch' },
  }),
); // []
```

## API and types

- `createBrandKit(input, limits?): BrandKit` validates, snapshots, and deeply freezes token records,
  asset references, rules, and enum arrays. Colors normalize to lowercase; other strings retain case.
- `validateBrandUsage(kit, usage, limits?): BrandViolation[]` revalidates the kit, reports unknown
  token references and metadata constraint failures. Structural errors throw instead.
- `BrandKit`: required `colors` (token to `#RRGGBB`/`#RRGGBBAA`), `fonts` (token to literal family
  name), `assets` (token to `BrandAsset`), `metadataRules` (key to `MetadataRule`). Empty records
  are legal.
- `BrandAsset`: identifier `id`, plain `label`, `mediaType` (`image/png`, `image/jpeg`,
  `image/svg+xml`). These are references/metadata, **not asset content** or license declarations.
- `MetadataRule`: boolean `required`, positive safe integer `maxLength` (required),
  optional nonempty unique string `allowedValues` array.
- `BrandUsage`: optional `colors`, `fonts`, `assets` token-name arrays, and `metadata` string record.
- `BrandViolation`: `code`, `path`, `message`. Codes: `unknown-token`, `unknown-metadata`,
  `missing-metadata`, `metadata-length`, `metadata-value`.
- `BrandLimits`: optional `maxTokens`, `maxMetadataRules`, `maxUsageItems`.

Violation order: colors/fonts/assets in array order (paths such as `colors.0`), metadata keys in
lexical order (length before enum failure), then missing required keys in lexical order.
Required metadata treats absent or empty strings as missing; empty values can also fail an enum.
Optional metadata may be absent. Unknown metadata keys are never silently accepted.

## Customization, errors, and limits

Use your own named tokens and metadata enums; only references registered in the kit are valid.
Consumers resolve IDs and load their own properly licensed assets. The checker does not inspect
actual rendered styles, calculate contrast, validate license rights, embed SVG, or enforce brand
rules outside submitted usage. All tokens/metadata keys and asset IDs are ASCII identifiers
starting with a letter, followed by letters, digits, `_`, `.`, `-`, maximum 128 characters.
Unsafe prototype identifiers are rejected. Plain/null-prototype own-data records only; no getters,
symbol keys, custom prototypes, or extra schema properties. Font names are at most 128 units,
labels at most 256; nonempty plain strings reject markup delimiters and C0 controls.
Usage metadata may be empty but is at most 4,096 UTF-16 units and also rejects markup/controls.

Defaults and ceilings: 1,000 total color/font/asset tokens, 100 metadata rules,
10,000 combined usage token entries and metadata fields; custom positive safe integer limits
can only lower these. Metadata `maxLength` is 1–4,096; enum arrays have 1–100 unique values that
fit the rule length. Invalid bounds/counts throw `RangeError`; malformed schemas, identifiers,
text, colors, enum duplicates, and unsafe records throw `TypeError`.

## Modules and development

Independent ESM/CJS plus declarations, zero runtime/peer dependencies.
CommonJS: `const { createBrandKit, validateBrandUsage } = require('@lp-labs/brand-kit')`.
TypeScript ^5.9.3 and Prettier ^3.6.2 are development-only.
Run `npm run build`, `npm run typecheck`, `npm test`, `npm run format`, `npm run format:check`.

## Support

If this library is useful to you, consider supporting its maintenance with a [donation via PayPal](https://www.paypal.me/LibinPrasanth).

## Author

Created by [Libin Prasanth](https://www.linkedin.com/in/libinprasanth/). Connect on LinkedIn for updates and discussion.
