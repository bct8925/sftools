import globals from 'globals';
import eslintPluginImport from 'eslint-plugin-import';
import eslintConfigPrettier from 'eslint-config-prettier';

export default [
    // Global ignores
    {
        ignores: [
            'dist/**',
            'node_modules/**',
            'sftools-proxy/node_modules/**',
            'coverage/**',
            '*.min.js',
        ],
    },

    // Main source files
    {
        files: ['src/**/*.js', 'scripts/**/*.js'],
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: 'module',
            globals: {
                ...globals.browser,
                chrome: 'readonly',
            },
        },
        plugins: {
            import: eslintPluginImport,
        },
        rules: {
            // Possible errors
            'no-console': 'off', // Allow console for extension debugging
            'no-debugger': 'warn',
            'no-duplicate-imports': 'error',
            'no-template-curly-in-string': 'warn',
            'no-unreachable': 'error',

            // Best practices
            'curly': ['error', 'multi-line'],
            'default-case-last': 'error',
            'dot-notation': 'error',
            'eqeqeq': ['error', 'always', { null: 'ignore' }],
            'no-else-return': 'error',
            'no-empty-function': 'warn',
            'no-eval': 'error',
            'no-implied-eval': 'error',
            'no-multi-spaces': 'error',
            'no-return-await': 'error',
            'no-throw-literal': 'error',
            'no-unused-expressions': 'error',
            'no-useless-concat': 'error',
            'no-useless-return': 'error',
            'prefer-promise-reject-errors': 'error',
            'require-await': 'warn',

            // Variables
            'no-shadow': 'warn',
            'no-unused-vars': ['warn', {
                argsIgnorePattern: '^_',
                varsIgnorePattern: '^_',
            }],
            'no-use-before-define': ['error', { functions: false }],

            // ES6+
            'arrow-body-style': ['error', 'as-needed'],
            'no-var': 'error',
            'prefer-arrow-callback': 'error',
            'prefer-const': 'error',
            'prefer-destructuring': ['warn', { object: true, array: false }],
            'prefer-rest-params': 'error',
            'prefer-spread': 'error',
            'prefer-template': 'error',

            // Import rules
            'import/first': 'error',
            'import/no-duplicates': 'error',
            'import/order': ['warn', {
                groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index'],
                'newlines-between': 'never',
            }],
        },
    },

    // Test files - more relaxed rules
    {
        files: ['tests/**/*.js', '**/*.test.js', '**/*.spec.js'],
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: 'module',
            globals: {
                ...globals.browser,
                ...globals.node,
                chrome: 'readonly',
                vi: 'readonly',
                describe: 'readonly',
                it: 'readonly',
                test: 'readonly',
                expect: 'readonly',
                beforeEach: 'readonly',
                afterEach: 'readonly',
                beforeAll: 'readonly',
                afterAll: 'readonly',
            },
        },
        rules: {
            'no-unused-expressions': 'off', // Allow expect().toBe() chains
            'no-empty-function': 'off',
        },
    },

    // Node.js files (scripts, configs, proxy)
    {
        files: ['*.config.js', 'scripts/**/*.js', 'sftools-proxy/**/*.js'],
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: 'module',
            globals: {
                ...globals.node,
            },
        },
    },

    // Disable rules that conflict with Prettier
    eslintConfigPrettier,
];
