#!/usr/bin/env node

/**
 * Automated Badge Cleanup Script
 *
 * Removes all remaining badge-related code from the codebase:
 * - Badge type references
 * - Badge function calls
 * - Badge props from components
 * - Gift badge rendering logic
 * - Badge-related Redux selectors
 */

const fs = require('fs');
const path = require('path');

// Badge-related patterns to remove
const BADGE_PATTERNS = {
  // Type imports and references
  BadgeType: /badge\?:\s*BadgeType[^;]*/g,
  BadgeTypeArray: /badges\?:\s*(?:ReadonlyArray|Array)<BadgeType>[^;]*/g,
  PreferredBadgeSelectorType: /preferredBadgeSelector[^:]*:\s*PreferredBadgeSelectorType[^;]*/g,
  BadgeImageTheme: /BadgeImageTheme/g,
  GiftBadgeStates: /GiftBadgeStates/g,
  BadgeCategory: /BadgeCategory/g,

  // Function references
  isBadgeVisible: /isBadgeVisible/g,
  getBadgeImageFileLocalPath: /getBadgeImageFileLocalPath/g,
  getFakeBadge: /getFakeBadge/g,
  getFakeBadges: /getFakeBadges/g,
  badgeImageFileDownloader: /badgeImageFileDownloader/g,

  // Props
  badgeProp: /,?\s*badge[,\s]/g,
  badgesProp: /,?\s*badges[,\s]/g,
};

// Files that need special handling
const SPECIAL_FILES = {
  'ts/components/conversation/Message.dom.tsx': cleanupMessageComponent,
  'ts/background.preload.ts': cleanupBackground,
  'ts/axo/_internal/AxoBaseSegmentedControl.dom.tsx': cleanupAxoComponent,
  'ts/axo/AxoSelect.dom.tsx': cleanupAxoComponent,
};

function cleanupAxoComponent(filePath, content) {
  console.log(`  Special cleanup: ${filePath}`);

  // Remove ExperimentalAxoBadge namespace references
  content = content.replace(/ExperimentalAxoBadge\./g, '');
  content = content.replace(/: ExperimentalAxoBadge/g, ': any');

  return content;
}

function cleanupBackground(filePath, content) {
  console.log(`  Special cleanup: ${filePath}`);

  // Remove badgeImageFileDownloader initialization
  const lines = content.split('\n');
  const filteredLines = lines.filter(line => {
    return !line.includes('badgeImageFileDownloader');
  });

  return filteredLines.join('\n');
}

function cleanupMessageComponent(filePath, content) {
  console.log(`  Special cleanup: Message.dom.tsx - removing gift badge rendering`);

  // Remove GiftBadgeStates namespace references
  content = content.replace(/GiftBadgeStates\./g, '');

  // Remove gift badge type guards
  content = content.replace(/giftBadge\?.state === ['"](\w+)['"]/g, 'false');

  // Remove gift badge props from interfaces
  const giftBadgePropsPattern = /giftBadge\?:\s*GiftBadgeType[^;]*;?\s*/g;
  content = content.replace(giftBadgePropsPattern, '');

  // Remove gift badge rendering blocks - look for sections that check giftBadge
  const giftBadgeBlockPattern = /if\s*\(giftBadge[^}]*?\{[\s\S]*?\n\s*\}/g;
  content = content.replace(giftBadgeBlockPattern, '');

  // Remove gift badge variable declarations
  const giftBadgeVarPattern = /const\s+giftBadge\s*=[\s\S]*?;/g;
  content = content.replace(giftBadgeVarPattern, '');

  return content;
}

function removeTypeReferences(content) {
  // Remove badge type annotations
  content = content.replace(/:\s*BadgeType(\[\])?\s*/g, ': any ');
  content = content.replace(/:\s*(?:ReadonlyArray|Array)<BadgeType>\s*/g, ': any[] ');
  content = content.replace(/:\s*PreferredBadgeSelectorType\s*/g, ': any ');

  // Remove badge props with optional chaining
  content = content.replace(/,?\s*badge\?:\s*BadgeType[^,;]*/g, '');
  content = content.replace(/,?\s*badges\?:\s*(?:ReadonlyArray|Array)<BadgeType>[^,;]*/g, '');

  return content;
}

function removeFunctionCalls(content) {
  // Replace isBadgeVisible with false
  content = content.replace(/isBadgeVisible\([^)]*\)/g, 'false');

  // Replace getBadgeImageFileLocalPath with undefined
  content = content.replace(/getBadgeImageFileLocalPath\([^)]*\)/g, 'undefined');

  // Replace getFakeBadge/getFakeBadges with undefined
  content = content.replace(/getFakeBadge\([^)]*\)/g, 'undefined');
  content = content.replace(/getFakeBadges\([^)]*\)/g, '[]');

  return content;
}

function removeStoryBadgeUsage(content) {
  // Remove badge-related story variations
  const storyBadgePattern = /const\s+\w+\s*=\s*\{[\s\S]*?badge:[\s\S]*?\}/g;
  content = content.replace(storyBadgePattern, (match) => {
    return match.replace(/,?\s*badge:[^,}]*/g, '');
  });

  // Remove getFakeBadge array maps
  const badgeMapPattern = /\[\d+,\s*\d+,\s*\d+\]\.map\([^)]*getFakeBadge[^)]*\)/g;
  content = content.replace(badgeMapPattern, '[]');

  return content;
}

function cleanupFile(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    const originalContent = content;

    // Check if this file needs special handling
    if (SPECIAL_FILES[filePath.replace(/^.*\/Orbital-Desktop\//, '')]) {
      const cleanupFn = SPECIAL_FILES[filePath.replace(/^.*\/Orbital-Desktop\//, '')];
      content = cleanupFn(filePath, content);
    }

    // Apply general cleanup
    content = removeTypeReferences(content);
    content = removeFunctionCalls(content);

    // Story-specific cleanup
    if (filePath.includes('.stories.tsx')) {
      content = removeStoryBadgeUsage(content);
    }

    // Remove unused variables that might be left behind
    content = content.replace(/const\s+badge\s*=\s*[^;]+;\s*\n/g, '');
    content = content.replace(/const\s+badges\s*=\s*[^;]+;\s*\n/g, '');

    // Clean up multiple consecutive blank lines
    content = content.replace(/\n\n\n+/g, '\n\n');

    // Only write if content changed
    if (content !== originalContent) {
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`✓ Cleaned: ${filePath}`);
      return true;
    }

    return false;
  } catch (error) {
    console.error(`✗ Error cleaning ${filePath}:`, error.message);
    return false;
  }
}

function findFilesWithBadgeErrors() {
  const { execSync } = require('child_process');

  try {
    const output = execSync('pnpm run check:types 2>&1', {
      cwd: '/Users/alexg/Documents/GitHub/Orbital-Desktop',
      encoding: 'utf8',
      maxBuffer: 10 * 1024 * 1024
    });

    // Extract file paths from TypeScript errors
    const errorPattern = /^(ts\/[^(]+\.tsx?)\(\d+,\d+\):/gm;
    const files = new Set();

    let match;
    while ((match = errorPattern.exec(output)) !== null) {
      files.add(match[1]);
    }

    return Array.from(files);
  } catch (error) {
    // Type check will fail, but we can still parse the output
    const output = error.stdout || error.stderr || '';
    const errorPattern = /^(ts\/[^(]+\.tsx?)\(\d+,\d+\):/gm;
    const files = new Set();

    let match;
    while ((match = errorPattern.exec(output)) !== null) {
      files.add(match[1]);
    }

    return Array.from(files);
  }
}

function main() {
  console.log('🧹 Starting automated badge cleanup...\n');

  const baseDir = '/Users/alexg/Documents/GitHub/Orbital-Desktop';

  // Find all files with badge-related errors
  console.log('📋 Analyzing TypeScript errors...');
  const filesToClean = findFilesWithBadgeErrors();

  console.log(`\n📝 Found ${filesToClean.length} files with badge-related errors:\n`);
  filesToClean.forEach(f => console.log(`  - ${f}`));

  console.log('\n🔧 Cleaning up files...\n');

  let cleanedCount = 0;
  filesToClean.forEach(relPath => {
    const fullPath = path.join(baseDir, relPath);
    if (fs.existsSync(fullPath)) {
      if (cleanupFile(fullPath)) {
        cleanedCount++;
      }
    }
  });

  console.log(`\n✅ Cleanup complete! Modified ${cleanedCount} files.`);
  console.log('\n🔍 Running type check to verify...\n');

  // Run type check again
  try {
    execSync('pnpm run check:types', {
      cwd: baseDir,
      stdio: 'inherit'
    });
    console.log('\n✅ Type check passed!');
  } catch (error) {
    console.log('\n⚠️  Some errors remain. Running detailed check...');
    // Show remaining errors
  }
}

main();
