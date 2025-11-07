#!/usr/bin/env node

/**
 * Analyzes remaining Signal features that need removal for Orbital
 * Issue #3: Remove unnecessary features
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const REPO_ROOT = path.join(__dirname, '..', '..');

const FEATURES = {
  calling: {
    patterns: ['calling', 'call', 'ringrtc', 'video.*call', 'voice.*call', 'group.*call'],
    directories: [
      'ts/calling/',
      'ts/components/Call*.tsx',
      'ts/components/Calling*.tsx',
      'ts/components/GroupCall*.tsx',
      'ts/components/DirectCall*.tsx',
      'ts/state/ducks/calling.preload.ts',
      'ts/state/selectors/calling.std.ts',
      'ts/state/smart/Call*.tsx',
      'ts/services/calling.preload.ts',
      'ts/jobs/*call*.ts',
      'ts/jobs/helpers/sendCallingMessage.preload.ts',
      'ts/util/*call*.ts',
      'ts/test-*/calling/',
      'ts/test-*/*call*.ts',
      'ts/sql/server/callLinks.node.ts',
      'calling_tools.html'
    ],
    dependencies: ['@signalapp/ringrtc'],
    dbTables: ['callsHistory', 'callLinks'],
    migrations: ['89-call-history.node.ts']
  },
  stories: {
    patterns: ['stories', 'story', 'distribution.*list'],
    directories: [
      'ts/components/Stories*.tsx',
      'ts/components/Story*.tsx',
      'ts/state/ducks/stories.preload.ts',
      'ts/state/ducks/storyDistributionLists.preload.ts',
      'ts/state/selectors/stories*.ts',
      'ts/state/smart/Stories*.tsx',
      'ts/state/smart/Story*.tsx',
      'ts/services/storyLoader.preload.ts',
      'ts/services/distributionListLoader.preload.ts',
      'ts/util/*story*.ts',
      'ts/util/*Story*.ts',
      'ts/util/downloadOnboardingStory.preload.ts',
      'ts/util/deleteAllMyStories.preload.ts',
      'ts/types/Stories.std.ts',
      'ts/types/StoryDistributionId.std.ts',
      'ts/jobs/helpers/*story*.ts'
    ],
    dependencies: [],
    dbTables: ['storyReads', 'storyDistributions', 'storyDistributionMembers'],
    migrations: []
  },
  payments: {
    patterns: ['payment', 'donation', 'stripe', 'receipt'],
    directories: [
      'ts/components/*Payment*.tsx',
      'ts/components/*Donation*.tsx',
      'ts/components/PreferencesDonations.dom.tsx',
      'ts/state/ducks/donations.preload.ts',
      'ts/state/smart/PreferencesDonations.preload.tsx',
      'ts/services/donations*.ts',
      'ts/sql/server/donationReceipts.std.ts',
      'ts/types/Payment.std.ts',
      'ts/types/Donations.std.ts',
      'ts/util/*donation*.ts',
      'ts/util/currency.dom.ts',
      'ts/messages/payments.std.ts'
    ],
    dependencies: ['card-validator', 'credit-card-type', 'parsecurrency'],
    dbTables: ['donationReceipts'],
    migrations: ['1380-donation-receipts.std.ts', '1400-simplify-receipts.std.ts']
  },
  badges: {
    patterns: ['badge(?!.*unread)', '(?<!unread.*)badge'],
    directories: [
      'ts/badges/',
      'ts/state/ducks/badges.preload.ts',
      'ts/state/selectors/badges.preload.ts',
      'ts/services/badgeLoader.preload.ts',
      'ts/types/GiftBadgeStates.std.ts',
      'ts/test-helpers/getFakeBadge.std.ts',
      'ts/axo/AxoBadge.dom.tsx'
    ],
    dependencies: [],
    dbTables: ['badges', 'badgeImageFiles'],
    migrations: []
  }
};

function checkPath(pattern) {
  try {
    const result = execSync(`find ${REPO_ROOT} -path "*${pattern}*" -type f 2>/dev/null | grep -v node_modules | grep -v .git | head -100`, {
      encoding: 'utf-8',
      maxBuffer: 10 * 1024 * 1024
    }).trim();
    return result ? result.split('\n') : [];
  } catch (e) {
    return [];
  }
}

function grepPattern(pattern, caseSensitive = false) {
  try {
    const flags = caseSensitive ? '' : '-i';
    const result = execSync(`grep -r ${flags} -l "${pattern}" ${REPO_ROOT}/ts ${REPO_ROOT}/app 2>/dev/null | grep -v node_modules | head -100`, {
      encoding: 'utf-8',
      maxBuffer: 10 * 1024 * 1024
    }).trim();
    return result ? result.split('\n') : [];
  } catch (e) {
    return [];
  }
}

function analyzeFeature(featureName, config) {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`Analyzing Feature: ${featureName.toUpperCase()}`);
  console.log('='.repeat(80));

  const found = {
    files: new Set(),
    components: new Set(),
    directories: new Set()
  };

  // Check directories
  console.log('\n--- Checking Directories ---');
  config.directories.forEach(dir => {
    const matches = checkPath(dir);
    matches.forEach(match => {
      found.files.add(match);
      if (match.includes('/components/')) {
        found.components.add(path.basename(match));
      }
      const dirPath = path.dirname(match);
      if (dirPath.includes(featureName)) {
        found.directories.add(dirPath);
      }
    });
    if (matches.length > 0) {
      console.log(`  ${dir}: ${matches.length} files`);
    }
  });

  // Check patterns
  console.log('\n--- Checking Code Patterns ---');
  config.patterns.forEach(pattern => {
    const matches = grepPattern(pattern);
    matches.forEach(match => found.files.add(match));
    if (matches.length > 0) {
      console.log(`  "${pattern}": ${matches.length} files`);
    }
  });

  // Check dependencies
  console.log('\n--- Checking Dependencies ---');
  const packageJson = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'package.json'), 'utf-8'));
  config.dependencies.forEach(dep => {
    if (packageJson.dependencies[dep] || packageJson.devDependencies?.[dep]) {
      console.log(`  ✓ ${dep} - PRESENT in package.json`);
    }
  });

  // Summary
  console.log('\n--- Summary ---');
  console.log(`Total files found: ${found.files.size}`);
  console.log(`Components found: ${found.components.size}`);
  console.log(`Directories found: ${found.directories.size}`);

  if (found.files.size === 0) {
    console.log(`\n✅ ${featureName.toUpperCase()} appears to be ALREADY REMOVED`);
  } else {
    console.log(`\n⚠️  ${featureName.toUpperCase()} still has code present`);
  }

  return {
    feature: featureName,
    filesCount: found.files.size,
    files: Array.from(found.files).sort(),
    components: Array.from(found.components).sort(),
    directories: Array.from(found.directories).sort(),
    dependencies: config.dependencies,
    dbTables: config.dbTables,
    migrations: config.migrations
  };
}

function generateReport(results) {
  console.log('\n\n');
  console.log('█'.repeat(80));
  console.log('FINAL REMOVAL REPORT');
  console.log('█'.repeat(80));

  const stillPresent = results.filter(r => r.filesCount > 0);
  const alreadyRemoved = results.filter(r => r.filesCount === 0);

  console.log('\n✅ ALREADY REMOVED:');
  if (alreadyRemoved.length === 0) {
    console.log('  None - all features still present');
  } else {
    alreadyRemoved.forEach(r => {
      console.log(`  - ${r.feature}`);
    });
  }

  console.log('\n⚠️  STILL PRESENT (NEEDS REMOVAL):');
  if (stillPresent.length === 0) {
    console.log('  None - all features already removed!');
  } else {
    stillPresent.forEach(r => {
      console.log(`  - ${r.feature}: ${r.filesCount} files`);
    });
  }

  console.log('\n📊 RECOMMENDED REMOVAL ORDER:');
  const sorted = [...stillPresent].sort((a, b) => a.filesCount - b.filesCount);
  sorted.forEach((r, i) => {
    console.log(`  ${i + 1}. ${r.feature} (${r.filesCount} files)`);
    console.log(`     Reason: ${i === 0 ? 'Smallest footprint, lowest risk' : i === sorted.length - 1 ? 'Largest footprint, most integrated' : 'Medium complexity'}`);
  });

  // Save detailed JSON report
  const reportPath = path.join(REPO_ROOT, 'scripts/cleanup/removal-analysis.json');
  fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));
  console.log(`\n📄 Detailed report saved to: ${reportPath}`);

  return results;
}

// Main execution
console.log('Analyzing Signal-Desktop codebase for Orbital cleanup...');
console.log(`Repository: ${REPO_ROOT}\n`);

const results = [];
for (const [featureName, config] of Object.entries(FEATURES)) {
  const result = analyzeFeature(featureName, config);
  results.push(result);
}

generateReport(results);

console.log('\n✅ Analysis complete!\n');
