#!/usr/bin/env node
import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join, resolve } from 'path';
import { glob } from 'glob';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = resolve(__dirname, '..');

// Configuration
const TEST_SCENARIOS_PATH = join(ROOT, 'tests/TEST_SCENARIOS.md');
const TEST_ID_PATTERN = /([A-Z]{1,3}-[FIU]-\d{3})/g;

const TEST_TYPES = {
    frontend: {
        pattern: /-F-/,
        glob: 'tests/frontend/specs/**/*.test.ts',
    },
    integration: {
        pattern: /-I-/,
        glob: 'tests/integration/*.test.js',
    },
    unit: {
        pattern: /-U-/,
        glob: 'tests/unit/**/*.test.js',
    },
};

/**
 * Parse TEST_SCENARIOS.md to extract all test IDs and their file references
 * @returns {Map<string, {file: string, line?: number}>}
 */
function parseTestScenarios() {
    const content = readFileSync(TEST_SCENARIOS_PATH, 'utf-8');
    const scenarios = new Map();

    // Match table rows with test IDs
    // Format: | TEST_ID | ... | ... | `file/path.test.ts` |
    // OR:     | TEST_ID | ... | ... | `file/path.test.js:123` |
    const tableRowRegex = /^\|\s*([A-Z]{1,3}-[FIU]-\d{3})\s*\|[^|]+\|[^|]+\|\s*`([^`]+)`\s*\|/gm;

    let match;
    while ((match = tableRowRegex.exec(content)) !== null) {
        const testId = match[1];
        const fileRef = match[2];

        // Handle line number references (e.g., "query.test.js:28")
        const [file, line] = fileRef.split(':');

        scenarios.set(testId, {
            file: file.trim(),
            line: line ? parseInt(line, 10) : undefined,
        });
    }

    return scenarios;
}

/**
 * Extract test IDs from frontend test file's header comment block
 * @param {string} content - File content
 * @returns {Set<string>}
 */
function extractFromCommentBlock(content) {
    const ids = new Set();

    // Match JSDoc-style comment blocks with "Test IDs:" line
    const commentBlockRegex = /\/\*\*[\s\S]*?\*\//;
    const match = content.match(commentBlockRegex);

    if (match) {
        const comment = match[0];
        // Look for "Test IDs: X-F-001, X-F-002, ..." pattern
        const idsLine = comment.match(/Test IDs?:\s*([A-Z-\d,\s]+)/i);

        if (idsLine) {
            const idMatches = idsLine[1].matchAll(TEST_ID_PATTERN);
            for (const idMatch of idMatches) {
                ids.add(idMatch[1]);
            }
        }
    }

    return ids;
}

/**
 * Extract test IDs from integration/unit test descriptions
 * @param {string} content - File content
 * @returns {Set<string>}
 */
function extractFromTestDescriptions(content) {
    const ids = new Set();

    // Match it('TEST_ID: description', ...), test('TEST_ID: description', ...),
    // or describe('TEST_ID: description', ...)
    const testDescRegex = /(?:it|test|describe)\s*\(\s*['"`]([A-Z]{1,3}-[IU]-\d{3})[:\s]/g;

    let match;
    while ((match = testDescRegex.exec(content)) !== null) {
        ids.add(match[1]);
    }

    return ids;
}

/**
 * Parse test files for a specific test type
 * @param {string} type - Test type ('frontend', 'integration', 'unit')
 * @returns {Map<string, Set<string>>} Map of file path to set of test IDs
 */
async function parseTestFiles(type) {
    const config = TEST_TYPES[type];
    const files = await glob(config.glob, { cwd: ROOT });
    const fileTestIds = new Map();

    for (const file of files) {
        const fullPath = join(ROOT, file);
        const content = readFileSync(fullPath, 'utf-8');

        // Use appropriate extractor based on test type
        const ids =
            type === 'frontend'
                ? extractFromCommentBlock(content)
                : extractFromTestDescriptions(content);

        if (ids.size > 0) {
            fileTestIds.set(file, ids);
        }
    }

    return fileTestIds;
}

/**
 * Validate cross-references and return errors/warnings
 * @param {Map} scenarios - From parseTestScenarios()
 * @param {Object} allTestFiles - { frontend: Map, integration: Map, unit: Map }
 * @returns {{ errors: string[], warnings: string[] }}
 */
function validate(scenarios, allTestFiles) {
    const errors = [];
    const warnings = [];
    const seenTestIds = new Map(); // Track duplicates across files

    // Helper to determine test type from ID
    function getTypeFromId(testId) {
        if (testId.includes('-F-')) return 'frontend';
        if (testId.includes('-I-')) return 'integration';
        if (testId.includes('-U-')) return 'unit';
        return null;
    }

    // Helper to determine expected directory from type
    function getExpectedPath(type) {
        if (type === 'frontend') return 'tests/frontend/specs/';
        if (type === 'integration') return 'tests/integration/';
        if (type === 'unit') return 'tests/unit/';
        return null;
    }

    // Check forward references (TEST_SCENARIOS.md → files)
    for (const [testId, { file, line }] of scenarios) {
        // Find which test type this file belongs to
        const type = getTypeFromId(testId);
        if (!type) {
            warnings.push(`${testId} has unknown type pattern (expected -F-, -I-, or -U-)`);
            continue;
        }

        // Construct full path based on test type
        // Frontend: TEST_SCENARIOS.md has relative paths from frontend/specs/ (e.g., "query/basic-query.test.ts")
        // Integration: TEST_SCENARIOS.md has full paths (e.g., "tests/integration/query.test.js")
        // Unit: TEST_SCENARIOS.md has relative paths from unit/ (e.g., "lib/query-utils.test.js")
        let fullPath;
        let fileKey;

        if (type === 'frontend') {
            fullPath = join(ROOT, 'tests', 'frontend', 'specs', file);
            fileKey = `tests/frontend/specs/${file}`;
        } else if (type === 'integration') {
            // Integration paths include full path from root
            fullPath = join(ROOT, file);
            fileKey = file;
        } else if (type === 'unit') {
            // Unit paths are relative to tests/unit/
            fullPath = join(ROOT, 'tests', 'unit', file);
            fileKey = `tests/unit/${file}`;
        }

        // Check if file exists
        if (!existsSync(fullPath)) {
            errors.push(`${testId} references \`${file}\` which does not exist`);
            continue;
        }

        const testFiles = allTestFiles[type];

        // Check if file contains the test ID
        if (!testFiles.has(fileKey)) {
            errors.push(`${testId} references \`${file}\` but file has no documented test IDs`);
            continue;
        }

        const fileIds = testFiles.get(fileKey);
        if (!fileIds.has(testId)) {
            errors.push(`${testId} references \`${file}\` but file doesn't contain this ID`);
        }

        // For integration tests, validate line numbers
        if (type === 'integration' && line) {
            const content = readFileSync(fullPath, 'utf-8');
            const lineCount = content.split('\n').length;

            if (line > lineCount) {
                errors.push(
                    `${testId} references \`${file}:${line}\` but file only has ${lineCount} lines`
                );
            }
        }
    }

    // Check reverse references (files → TEST_SCENARIOS.md)
    for (const [type, testFiles] of Object.entries(allTestFiles)) {
        for (const [file, ids] of testFiles) {
            for (const testId of ids) {
                // Check if test ID is in TEST_SCENARIOS.md
                if (!scenarios.has(testId)) {
                    errors.push(`${testId} in \`${file}\` is not documented in TEST_SCENARIOS.md`);
                }

                // Track duplicates
                if (seenTestIds.has(testId)) {
                    const prevFile = seenTestIds.get(testId);
                    errors.push(`${testId} appears in both \`${prevFile}\` and \`${file}\``);
                } else {
                    seenTestIds.set(testId, file);
                }

                // Check convention: ID suffix should match file location
                const idType = getTypeFromId(testId);
                const expectedPath = getExpectedPath(idType);

                if (idType !== type) {
                    warnings.push(
                        `${testId} (${idType} ID) found in ${type} test file \`${file}\``
                    );
                }

                if (expectedPath && !file.startsWith(expectedPath)) {
                    warnings.push(
                        `${testId} in \`${file}\` doesn't match expected path \`${expectedPath}\``
                    );
                }
            }
        }
    }

    return { errors, warnings };
}

/**
 * Print colored output
 */
function printReport(scenarios, allTestFiles, { errors, warnings }) {
    console.log('🔍 Validating test ID cross-references...\n');

    // Count test IDs by type
    const counts = { frontend: 0, integration: 0, unit: 0 };
    for (const [testId] of scenarios) {
        if (testId.includes('-F-')) counts.frontend++;
        else if (testId.includes('-I-')) counts.integration++;
        else if (testId.includes('-U-')) counts.unit++;
    }

    console.log('Parsing TEST_SCENARIOS.md...');
    console.log(`  - ${counts.frontend} frontend tests (-F-)`);
    console.log(`  - ${counts.integration} integration tests (-I-)`);
    console.log(`  - ${counts.unit} unit tests (-U-)\n`);

    console.log('Scanning test files...');
    for (const [type, files] of Object.entries(allTestFiles)) {
        console.log(
            `  - ${type.charAt(0).toUpperCase() + type.slice(1)}: ${files.size} files in tests/${type === 'frontend' ? 'frontend/specs' : type}/`
        );
    }
    console.log('');

    // Print results
    if (errors.length === 0 && warnings.length === 0) {
        console.log('✅ All validations passed!\n');
        return 0;
    }

    if (errors.length > 0) {
        console.log('❌ ERRORS:\n');

        // Group errors by type
        const errorsByType = { frontend: [], integration: [], unit: [], other: [] };
        for (const error of errors) {
            if (error.includes('-F-')) errorsByType.frontend.push(error);
            else if (error.includes('-I-')) errorsByType.integration.push(error);
            else if (error.includes('-U-')) errorsByType.unit.push(error);
            else errorsByType.other.push(error);
        }

        if (errorsByType.frontend.length > 0) {
            console.log('  Frontend (-F-) issues:');
            errorsByType.frontend.forEach(e => console.log(`    - ${e}`));
            console.log('');
        }

        if (errorsByType.integration.length > 0) {
            console.log('  Integration (-I-) issues:');
            errorsByType.integration.forEach(e => console.log(`    - ${e}`));
            console.log('');
        }

        if (errorsByType.unit.length > 0) {
            console.log('  Unit (-U-) issues:');
            errorsByType.unit.forEach(e => console.log(`    - ${e}`));
            console.log('');
        }

        if (errorsByType.other.length > 0) {
            console.log('  Other issues:');
            errorsByType.other.forEach(e => console.log(`    - ${e}`));
            console.log('');
        }
    }

    if (warnings.length > 0) {
        console.log('⚠️  WARNINGS:\n');
        console.log('  Convention violations:');
        warnings.forEach(w => console.log(`    - ${w}`));
        console.log('');
    }

    console.log(`${errors.length} error(s), ${warnings.length} warning(s)\n`);
    return errors.length > 0 ? 1 : 0;
}

/**
 * Main entry point
 */
async function main() {
    try {
        const scenarios = parseTestScenarios();

        const allTestFiles = {
            frontend: await parseTestFiles('frontend'),
            integration: await parseTestFiles('integration'),
            unit: await parseTestFiles('unit'),
        };

        const result = validate(scenarios, allTestFiles);
        const exitCode = printReport(scenarios, allTestFiles, result);

        process.exit(exitCode);
    } catch (error) {
        console.error('❌ Fatal error:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

main();
