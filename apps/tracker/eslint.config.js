import js from '@eslint/js'
import ts from 'typescript-eslint'
import sonarjs from 'eslint-plugin-sonarjs'

export default ts.config([
  js.configs.recommended,
  ts.configs.recommended,
  sonarjs.configs.recommended,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    ignores: ['lib/**', 'node_modules/**', 'src/emulator.global-setup.ts'],
  },
])
