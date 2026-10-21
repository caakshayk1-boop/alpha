// ESLint 9 flat config: the same rule set as before ("next/core-web-vitals"), now that next lint is gone (Next 16).
import coreWebVitals from 'eslint-config-next/core-web-vitals';

export default [
  { ignores: ['.next/**', 'out/**', 'node_modules/**', 'public/**', 'tests/visual/**', 'engines/**', '.wrangler/**'] },
  ...coreWebVitals,
  // React Compiler rules (react-hooks 6, new with eslint-config-next 16). This app does not use the compiler; the code they
  // flag (setState in an effect to read browser storage after mount, ref writes for stable callbacks) follows the
  // pre-compiler patterns the rest of the code relies on. Warnings, not errors, so they stay visible; adopting the
  // compiler is its own change.
  { rules: { 'react-hooks/set-state-in-effect': 'warn', 'react-hooks/refs': 'warn', 'react-hooks/preserve-manual-memoization': 'warn', 'react-hooks/use-memo': 'warn', 'react-hooks/purity': 'warn', 'react-hooks/immutability': 'warn', 'react-hooks/static-components': 'warn', 'react-hooks/incompatible-library': 'warn' } },
];
