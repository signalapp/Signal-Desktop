#!/usr/bin/env node

/**
 * Fix syntax errors in story files after badge removal
 *
 * The badge line removal left some objects without closing braces/parens
 */

const fs = require('fs');
const { execSync } = require('child_process');

const BASE_DIR = '/Users/alexg/Documents/GitHub/Orbital-Desktop';

function getFilesWithErrors() {
  try {
    execSync('pnpm run check:types 2>&1', {
      cwd: BASE_DIR,
      encoding: 'utf8',
      maxBuffer: 10 * 1024 * 1024,
    });
    return [];
  } catch (error) {
    const output = error.stdout || '';
    const errorPattern = /^(ts\/[^(]+\.stories\.tsx)/gm;
    const files = new Set();

    let match;
    while ((match = errorPattern.exec(output)) !== null) {
      files.add(match[1]);
    }

    return Array.from(files);
  }
}

function fixStoryFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  const originalContent = content;

  // Pattern: createProps({ ...stuff, <newline>export
  // Should be: createProps({ ...stuff<newline>});<newline>export
  content = content.replace(
    /createProps\(\{([^\}]*?),\s*\n\s*export/g,
    'createProps({$1\n});\n\nexport'
  );

  // Pattern: getDefaultConversation({ ...stuff, <newline>});
  // with trailing comma before closing
  content = content.replace(
    /getDefaultConversation\(\{([^\}]*?),\s*\n\s*\}\)/g,
    'getDefaultConversation({$1\n})'
  );

  // Remove trailing commas before closing braces
  content = content.replace(/,(\s*\}\s*\))/g, '$1');

  if (content !== originalContent) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`✓ Fixed ${filePath}`);
    return true;
  }

  return false;
}

function main() {
  console.log('🔧 Fixing story file syntax errors...\n');

  const storyFiles = getFilesWithErrors();

  if (storyFiles.length === 0) {
    console.log('✅ No story files with errors found!');
    return;
  }

  console.log(`Found ${storyFiles.length} story files with errors:\n`);

  let fixed = 0;
  storyFiles.forEach(relPath => {
    const fullPath = `${BASE_DIR}/${relPath}`;
    if (fs.existsSync(fullPath)) {
      if (fixStoryFile(fullPath)) {
        fixed++;
      }
    }
  });

  console.log(`\n✅ Fixed ${fixed} story files`);
}

main();
