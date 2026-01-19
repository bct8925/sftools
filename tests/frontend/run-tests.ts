import dotenv from 'dotenv';
import { glob } from 'glob';
import path from 'path';

// Load .env.test from project root
dotenv.config({ path: path.resolve(process.cwd(), '.env.test') });
import { TestRunner } from './framework/runner';
import type { TestResult } from './framework/types';

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  // Parse --filter argument
  const filterArg = args.find((a) => a.startsWith('--filter=') || a.startsWith('--filter'));
  let filter: string | undefined;
  if (filterArg) {
    if (filterArg.includes('=')) {
      filter = filterArg.split('=')[1];
    } else {
      const filterIndex = args.indexOf(filterArg);
      filter = args[filterIndex + 1];
    }
  }

  console.log('');
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║                   sftools Test Runner                      ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log('');

  // Find all test files
  const pattern = 'tests/frontend/specs/**/*.test.ts';
  let testFiles = await glob(pattern);

  if (testFiles.length === 0) {
    console.log('❌ No test files found matching pattern:', pattern);
    process.exit(1);
  }

  // Apply filter if provided
  if (filter) {
    const beforeCount = testFiles.length;
    testFiles = testFiles.filter((f) => f.includes(filter));
    console.log(`📋 Filter "${filter}" applied: ${testFiles.length}/${beforeCount} tests match`);
  } else {
    console.log(`📋 Found ${testFiles.length} test file(s)`);
  }

  if (testFiles.length === 0) {
    console.log('❌ No tests match the filter');
    process.exit(1);
  }

  // Convert to absolute paths
  testFiles = testFiles.map((f) => path.resolve(process.cwd(), f));

  console.log('');
  testFiles.forEach((f) => {
    const relative = path.relative(process.cwd(), f);
    console.log(`   • ${relative}`);
  });

  // Run tests
  const runner = new TestRunner();
  let results: TestResult[];

  try {
    results = await runner.runAll(testFiles);
  } catch (error) {
    console.error('\n❌ Test runner error:', (error as Error).message);
    if (process.env.DEBUG) {
      console.error((error as Error).stack);
    }
    process.exit(1);
  }

  // Print summary
  printSummary(results);

  // Exit with appropriate code
  const failed = results.filter((r) => !r.success).length;
  process.exit(failed > 0 ? 1 : 0);
}

function printSummary(results: TestResult[]): void {
  console.log('');
  console.log('════════════════════════════════════════════════════════════');
  console.log('                       TEST RESULTS                          ');
  console.log('════════════════════════════════════════════════════════════');
  console.log('');

  const passed = results.filter((r) => r.success).length;
  const failed = results.filter((r) => !r.success).length;
  const totalDuration = results.reduce((sum, r) => sum + r.duration, 0);

  for (const result of results) {
    const icon = result.success ? '✅' : '❌';
    const duration = formatDuration(result.duration);
    console.log(`${icon} ${result.name} (${duration})`);

    if (result.error) {
      console.log(`   Error: ${result.error.message}`);
      if (process.env.DEBUG && result.error.stack) {
        const stackLines = result.error.stack.split('\n').slice(1, 4);
        stackLines.forEach((line) => console.log(`   ${line.trim()}`));
      }
    }
  }

  console.log('');
  console.log('────────────────────────────────────────────────────────────');

  const passedColor = passed > 0 ? '\x1b[32m' : '';
  const failedColor = failed > 0 ? '\x1b[31m' : '';
  const reset = '\x1b[0m';

  console.log(
    `${passedColor}Passed: ${passed}${reset} | ` +
    `${failedColor}Failed: ${failed}${reset} | ` +
    `Total: ${results.length} | ` +
    `Duration: ${formatDuration(totalDuration)}`
  );
  console.log('');
}

function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${ms}ms`;
  }
  const seconds = (ms / 1000).toFixed(1);
  return `${seconds}s`;
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
