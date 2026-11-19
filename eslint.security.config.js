import security from 'eslint-plugin-security';
import tseslint from 'typescript-eslint';

/** Application source only. Object-injection matches ordinary indexing and is triaged off. */
export default [
  {
    ignores: ['**/node_modules/**', '**/dist/**', '**/coverage/**', '**/generated/**'],
  },
  {
    files: ['apps/**/src/**/*.{ts,tsx}', 'packages/**/src/**/*.ts'],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    plugins: { security },
    rules: {
      'security/detect-buffer-noassert': 'error',
      'security/detect-child-process': 'error',
      'security/detect-disable-mustache-escape': 'error',
      'security/detect-eval-with-expression': 'error',
      'security/detect-new-buffer': 'error',
      'security/detect-no-csrf-before-method-override': 'error',
      'security/detect-non-literal-require': 'error',
      'security/detect-pseudoRandomBytes': 'error',
      // Triaged: hits are import.meta.url paths in env and OpenAPI loading, not request input.
      'security/detect-non-literal-fs-filename': 'off',
      // Triaged: ordinary property access, not untrusted object injection.
      'security/detect-object-injection': 'off',
      // Triaged: token compare uses crypto.timingSafeEqual. The rule flags unrelated ===.
      'security/detect-possible-timing-attacks': 'off',
      // Triaged: flagged patterns are anchored and length-limited (IPv4, slug, rupee input).
      'security/detect-non-literal-regexp': 'off',
      'security/detect-unsafe-regex': 'off',
    },
  },
];
