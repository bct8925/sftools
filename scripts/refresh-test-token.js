#!/usr/bin/env node

/**
 * Refresh the access token in .env.test using Salesforce CLI
 * Usage: node scripts/refresh-test-token.js [org-alias]
 */

import { execSync } from 'child_process';
import { writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

const orgAlias = process.argv[2] || 'taylor.brian.1337@gmail.com';

try {
    console.log(`Fetching org info for: ${orgAlias}...`);

    const output = execSync(`sf org display --target-org ${orgAlias} --json`, {
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'inherit'],
    });

    const data = JSON.parse(output);

    if (data.status !== 0) {
        console.error('❌ Failed to get org info:', data.message);
        process.exit(1);
    }

    const { accessToken, instanceUrl } = data.result;

    if (!accessToken || !instanceUrl) {
        console.error('❌ Missing accessToken or instanceUrl in response');
        process.exit(1);
    }

    // Update .env.test file
    const envPath = join(projectRoot, '.env.test');
    const envContent = `SF_ACCESS_TOKEN=${accessToken}\nSF_INSTANCE_URL=${instanceUrl}\n`;

    writeFileSync(envPath, envContent, 'utf-8');

    console.log('✅ Updated .env.test:');
    console.log(`   Instance URL: ${instanceUrl}`);
    console.log(`   Access Token: ${accessToken.substring(0, 20)}...`);
} catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
}
