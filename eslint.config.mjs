// ESLint flat config (ESLint 10 + typescript-eslint)
// 포매팅은 Prettier 담당 → eslint-config-prettier로 충돌 규칙 비활성화.
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';

export default tseslint.config(
  { ignores: ['dist', 'node_modules', 'coverage', 'src/types/database.types.ts'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.ts'],
    rules: {
      // TypeScript 컴파일러가 미정의 참조를 잡으므로 no-undef는 끔(권장 사항).
      'no-undef': 'off',
      // _ 접두어 인자/변수는 의도적 미사용으로 허용.
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  },
  // 테스트는 console 등 자유롭게.
  { files: ['**/__tests__/**', '**/*.test.ts'], rules: {} },
  prettier,
);
