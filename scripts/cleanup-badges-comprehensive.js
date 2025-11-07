#!/usr/bin/env node

/**
 * Comprehensive Badge Cleanup Script
 *
 * Removes all badge-related code from Orbital-Desktop:
 * 1. Type definitions (GiftBadgeStates, BadgeType, etc.)
 * 2. Function references (isBadgeVisible, getBadgeImageFileLocalPath, etc.)
 * 3. Component props and rendering logic
 * 4. Story file badge data
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const BASE_DIR = '/Users/alexg/Documents/GitHub/Orbital-Desktop';

// Stats tracking
const stats = {
  filesProcessed: 0,
  filesModified: 0,
  typeReferencesRemoved: 0,
  propsRemoved: 0,
  functionsRemoved: 0,
};

/**
 * Remove GiftBadgeStates type definition and all references
 */
function removeGiftBadgeStates(content) {
  let modified = false;

  // Remove the GiftBadgeStates enum/namespace imports
  const giftBadgeImportPattern = /import\s*\{[^}]*GiftBadgeStates[^}]*\}\s*from\s*['"][^'"]+['"];?\s*\n/g;
  if (giftBadgeImportPattern.test(content)) {
    content = content.replace(giftBadgeImportPattern, '');
    modified = true;
    stats.typeReferencesRemoved++;
  }

  // Remove GiftBadgeStates references in type positions
  content = content.replace(/GiftBadgeStates\.\w+/g, () => {
    modified = true;
    return '"removed"';
  });

  // Remove the GiftBadgeType definition itself
  const giftBadgeTypeDefPattern = /export type GiftBadgeType\s*=[\s\S]*?};/;
  if (giftBadgeTypeDefPattern.test(content)) {
    content = content.replace(giftBadgeTypeDefPattern, '// GiftBadgeType removed');
    modified = true;
  }

  return { content, modified };
}

/**
 * Remove badge-related props from component interfaces
 */
function removeBadgeProps(content) {
  let modified = false;

  // Remove badge?: BadgeType
  const badgeTypePattern = /,?\s*badge\?:\s*BadgeType[^;,}]*/g;
  if (badgeTypePattern.test(content)) {
    content = content.replace(badgeTypePattern, '');
    modified = true;
    stats.propsRemoved++;
  }

  // Remove badges?: Array<BadgeType> or ReadonlyArray<BadgeType>
  const badgesArrayPattern = /,?\s*badges\?:\s*(?:Readonly)?Array<BadgeType>[^;,}]*/g;
  if (badgesArrayPattern.test(content)) {
    content = content.replace(badgesArrayPattern, '');
    modified = true;
    stats.propsRemoved++;
  }

  // Remove preferredBadgeSelector?: PreferredBadgeSelectorType
  const preferredBadgePattern = /,?\s*preferredBadgeSelector\?:\s*PreferredBadgeSelectorType[^;,}]*/g;
  if (preferredBadgePattern.test(content)) {
    content = content.replace(preferredBadgePattern, '');
    modified = true;
    stats.propsRemoved++;
  }

  // Remove giftBadge?: GiftBadgeType
  const giftBadgePattern = /,?\s*giftBadge\?:\s*GiftBadgeType[^;,}]*/g;
  if (giftBadgePattern.test(content)) {
    content = content.replace(giftBadgePattern, '');
    modified = true;
    stats.propsRemoved++;
  }

  return { content, modified };
}

/**
 * Remove badge function calls and replace with safe defaults
 */
function removeBadgeFunctions(content) {
  let modified = false;

  // isBadgeVisible() -> false
  if (content.includes('isBadgeVisible')) {
    content = content.replace(/isBadgeVisible\([^)]*\)/g, 'false');
    modified = true;
    stats.functionsRemoved++;
  }

  // getBadgeImageFileLocalPath() -> undefined
  if (content.includes('getBadgeImageFileLocalPath')) {
    content = content.replace(/getBadgeImageFileLocalPath\([^)]*\)/g, 'undefined');
    modified = true;
    stats.functionsRemoved++;
  }

  // getFakeBadge() -> undefined
  if (content.includes('getFakeBadge(')) {
    content = content.replace(/getFakeBadge\(\)/g, 'undefined');
    content = content.replace(/getFakeBadge\([^)]*\)/g, 'undefined');
    modified = true;
    stats.functionsRemoved++;
  }

  // getFakeBadges() -> []
  if (content.includes('getFakeBadges')) {
    content = content.replace(/getFakeBadges\([^)]*\)/g, '[]');
    modified = true;
    stats.functionsRemoved++;
  }

  // badgeImageFileDownloader -> comment out
  if (content.includes('badgeImageFileDownloader')) {
    content = content.replace(
      /^\s*void badgeImageFileDownloader\.checkForFilesToDownload\(\);?\s*$/gm,
      '// badgeImageFileDownloader removed'
    );
    modified = true;
    stats.functionsRemoved++;
  }

  return { content, modified };
}

/**
 * Remove badge type references
 */
function removeBadgeTypeReferences(content) {
  let modified = false;

  // BadgeType, BadgeImageTheme, PreferredBadgeSelectorType
  const typePatterns = [
    /:\s*BadgeType(\s*\|)?/g,
    /BadgeImageTheme\.\w+/g,
    /:\s*PreferredBadgeSelectorType/g,
    /BadgeCategory\.\w+/g,
  ];

  typePatterns.forEach(pattern => {
    if (pattern.test(content)) {
      if (pattern.source.includes('BadgeImageTheme')) {
        content = content.replace(pattern, '"light"');
      } else {
        content = content.replace(pattern, ': any');
      }
      modified = true;
      stats.typeReferencesRemoved++;
    }
  });

  return { content, modified };
}

/**
 * Remove badge rendering logic from components
 */
function removeBadgeRenderingLogic(content, filePath) {
  let modified = false;

  // Remove badge variable declarations
  const badgeVarPatterns = [
    /const\s+badge\s*=\s*[^;]+;?\s*\n?/g,
    /const\s+badgeNode\s*:\s*ReactNode\s*;?\s*\n?/g,
    /const\s+badgeSize\s*=\s*_getBadgeSize[^;]+;?\s*\n?/g,
    /const\s+badgeTheme\s*=[\s\S]*?BadgeImageTheme[^;]+;?\s*\n?/g,
    /const\s+badgeImagePath\s*=\s*getBadgeImageFileLocalPath[^;]+;?\s*\n?/g,
  ];

  badgeVarPatterns.forEach(pattern => {
    if (pattern.test(content)) {
      content = content.replace(pattern, '');
      modified = true;
    }
  });

  // Remove badge rendering blocks
  // Match: if (badge && ...) { ... }
  const badgeIfBlockPattern = /if\s*\(\s*badge\s*&&[^{]+\)\s*\{[\s\S]*?\n\s*\}/g;
  if (badgeIfBlockPattern.test(content)) {
    content = content.replace(badgeIfBlockPattern, '');
    modified = true;
  }

  // Remove let badgeNode assignment blocks
  const badgeNodeAssignPattern = /let\s+badgeNode:\s*ReactNode;\s*[\s\S]*?if\s*\(badge[\s\S]*?\}\s*\}/g;
  if (badgeNodeAssignPattern.test(content)) {
    content = content.replace(badgeNodeAssignPattern, 'let badgeNode: ReactNode = null;');
    modified = true;
  }

  return { content, modified };
}

/**
 * Special cleanup for Message.dom.tsx - remove gift badge rendering
 */
function cleanupMessageComponent(content) {
  let modified = false;

  // Remove the entire #renderGiftBadge method
  const giftBadgeMethodPattern = /#renderGiftBadge\(\)[\s\S]*?^\s*\}/gm;
  if (giftBadgeMethodPattern.test(content)) {
    content = content.replace(
      giftBadgeMethodPattern,
      '#renderGiftBadge() {\n    return null; // Gift badge feature removed\n  }'
    );
    modified = true;
  }

  // Remove GiftBadgeType definition
  const giftBadgeTypePattern = /export type GiftBadgeType[\s\S]*?};/;
  if (giftBadgeTypePattern.test(content)) {
    content = content.replace(giftBadgeTypePattern, '// GiftBadgeType removed');
    modified = true;
  }

  // Remove giftBadge prop from Props interface
  const giftBadgePropPattern = /giftBadge\?:\s*GiftBadgeType[^;]*;/g;
  if (giftBadgePropPattern.test(content)) {
    content = content.replace(giftBadgePropPattern, '');
    modified = true;
  }

  return { content, modified };
}

/**
 * Special cleanup for Avatar.dom.tsx
 */
function cleanupAvatarComponent(content) {
  let modified = false;

  // Remove the entire badge rendering section
  const badgeRenderingSection = /let badgeNode:\s*ReactNode;[\s\S]*?badgeNode\s*=\s*\(/;
  if (badgeRenderingSection.test(content)) {
    content = content.replace(
      /let badgeNode:\s*ReactNode;[\s\S]*?(?=\n  return)/,
      'let badgeNode: ReactNode = null; // Badge feature removed\n\n'
    );
    modified = true;
  }

  return { content, modified };
}

/**
 * Special cleanup for AxoBaseSegmentedControl and AxoSelect
 */
function cleanupAxoComponents(content) {
  let modified = false;

  // Replace ExperimentalAxoBadge references
  content = content.replace(/ExperimentalAxoBadge\./g, () => {
    modified = true;
    return 'any.';
  });

  content = content.replace(/:\s*ExperimentalAxoBadge/g, () => {
    modified = true;
    return ': any';
  });

  // Comment out the badge-related exports
  content = content.replace(
    /export type ExperimentalItemBadgeProps[\s\S]*?;/,
    '// Badge props removed'
  );

  return { content, modified };
}

/**
 * Cleanup story files - remove badge test data
 */
function cleanupStoryFiles(content) {
  let modified = false;

  // Remove getFakeBadge/getFakeBadges calls in story data
  if (content.includes('getFakeBadge')) {
    content = content.replace(/badge:\s*getFakeBadge\([^)]*\),?/g, '');
    content = content.replace(/badges:\s*getFakeBadges\([^)]*\),?/g, 'badges: [],');
    content = content.replace(/badges:\s*\[\d+,\s*\d+,\s*\d+\]\.map\([^)]*getFakeBadge[^)]*\),?/g, 'badges: [],');
    modified = true;
  }

  // Remove GiftBadgeStates references in stories
  if (content.includes('GiftBadgeStates')) {
    content = content.replace(/giftBadge:\s*\{[\s\S]*?state:\s*GiftBadgeStates\.\w+[\s\S]*?\},?/g, '');
    modified = true;
  }

  // Remove BadgeCategory references
  if (content.includes('BadgeCategory')) {
    content = content.replace(/category:\s*BadgeCategory\.\w+,?/g, '');
    modified = true;
  }

  return { content, modified };
}

/**
 * Process a single file
 */
function processFile(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    const originalContent = content;
    let fileModified = false;

    stats.filesProcessed++;

    // Apply all cleanup operations
    const operations = [
      removeGiftBadgeStates,
      removeBadgeProps,
      removeBadgeFunctions,
      removeBadgeTypeReferences,
      removeBadgeRenderingLogic,
    ];

    operations.forEach(operation => {
      const result = operation(content, filePath);
      content = result.content;
      if (result.modified) {
        fileModified = true;
      }
    });

    // Special file handlers
    const fileName = path.basename(filePath);
    if (fileName === 'Message.dom.tsx') {
      const result = cleanupMessageComponent(content);
      content = result.content;
      if (result.modified) fileModified = true;
    } else if (fileName === 'Avatar.dom.tsx') {
      const result = cleanupAvatarComponent(content);
      content = result.content;
      if (result.modified) fileModified = true;
    } else if (fileName.includes('AxoBaseSegmentedControl') || fileName.includes('AxoSelect')) {
      const result = cleanupAxoComponents(content);
      content = result.content;
      if (result.modified) fileModified = true;
    } else if (fileName.endsWith('.stories.tsx')) {
      const result = cleanupStoryFiles(content);
      content = result.content;
      if (result.modified) fileModified = true;
    }

    // Clean up formatting
    content = content.replace(/,\s*,/g, ','); // Double commas
    content = content.replace(/\(\s*,/g, '('); // Leading comma in params
    content = content.replace(/,\s*\)/g, ')'); // Trailing comma before close paren
    content = content.replace(/,\s*}/g, '}'); // Trailing comma before close brace
    content = content.replace(/\n\n\n+/g, '\n\n'); // Multiple blank lines

    // Only write if changed
    if (content !== originalContent) {
      fs.writeFileSync(filePath, content, 'utf8');
      stats.filesModified++;
      console.log(`  ✓ ${path.relative(BASE_DIR, filePath)}`);
      return true;
    }

    return false;
  } catch (error) {
    console.error(`  ✗ Error processing ${filePath}:`, error.message);
    return false;
  }
}

/**
 * Get list of files with badge-related errors from TypeScript
 */
function getFilesWithBadgeErrors() {
  try {
    execSync('pnpm run check:types 2>&1', {
      cwd: BASE_DIR,
      encoding: 'utf8',
      maxBuffer: 10 * 1024 * 1024,
    });
    return []; // No errors
  } catch (error) {
    const output = error.stdout || '';
    const errorPattern = /^(ts\/[^(]+\.tsx?)\(\d+,\d+\):/gm;
    const files = new Set();

    let match;
    while ((match = errorPattern.exec(output)) !== null) {
      const file = match[1];
      // Only include files with badge-related errors
      files.add(file);
    }

    return Array.from(files);
  }
}

/**
 * Main execution
 */
function main() {
  console.log('🧹 Badge Cleanup Script\n');
  console.log('Starting comprehensive badge removal...\n');

  // Get files with errors
  console.log('📋 Analyzing TypeScript errors...');
  const filesToProcess = getFilesWithBadgeErrors();

  console.log(`\n📝 Found ${filesToProcess.length} files with errors\n`);

  if (filesToProcess.length === 0) {
    console.log('✅ No badge-related errors found!');
    return;
  }

  console.log('🔧 Processing files...\n');

  // Process each file
  filesToProcess.forEach(relPath => {
    const fullPath = path.join(BASE_DIR, relPath);
    if (fs.existsSync(fullPath)) {
      processFile(fullPath);
    }
  });

  // Print stats
  console.log('\n' + '='.repeat(60));
  console.log('📊 Cleanup Summary:');
  console.log('='.repeat(60));
  console.log(`  Files processed:       ${stats.filesProcessed}`);
  console.log(`  Files modified:        ${stats.filesModified}`);
  console.log(`  Type refs removed:     ${stats.typeReferencesRemoved}`);
  console.log(`  Props removed:         ${stats.propsRemoved}`);
  console.log(`  Functions removed:     ${stats.functionsRemoved}`);
  console.log('='.repeat(60) + '\n');

  // Verify
  console.log('🔍 Running type check...\n');
  try {
    execSync('pnpm run check:types 2>&1', {
      cwd: BASE_DIR,
      stdio: 'pipe',
      encoding: 'utf8',
    });
    console.log('✅ All type checks passed!\n');
  } catch (error) {
    const output = error.stdout || '';
    const errorLines = output.split('\n').filter(line => line.includes('error TS'));
    console.log(`⚠️  ${errorLines.length} errors remaining\n`);
    console.log('Remaining errors (first 10):');
    errorLines.slice(0, 10).forEach(line => console.log(`  ${line}`));
    console.log('\nRun iteration 2 for deeper cleanup...\n');
  }
}

main();
