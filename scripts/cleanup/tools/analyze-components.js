#!/usr/bin/env node

/**
 * Component Analysis Tool
 *
 * Analyzes all React components in the codebase to determine:
 * - Total component count
 * - Import/usage frequency
 * - Categorization (KEEP, REMOVE, ADAPT, UNKNOWN)
 * - Component dependencies
 *
 * Output: component-inventory.json in reports/ directory
 */

const fs = require('fs');
const path = require('path');
const { Project } = require('ts-morph');

// Paths
const TS_DIR = path.join(__dirname, '../../../ts');
const COMPONENTS_DIR = path.join(TS_DIR, 'components');
const REPORTS_DIR = path.join(__dirname, '../reports');

// Ensure reports directory exists
if (!fs.existsSync(REPORTS_DIR)) {
  fs.mkdirSync(REPORTS_DIR, { recursive: true });
}

// Features to remove (components matching these patterns should be flagged)
const REMOVE_PATTERNS = [
  /^Stories/,
  /^Story/,
  /^Payment/,
  /^Calling/,
  /^Call[A-Z]/,
  /^Sticker/,
  /^LinkDevice/,
  /^InstallScreen/,
  /^RegistrationLinkScreen/,
  /^PhoneNumber/,
  /Badge/,
];

// Features to keep (core messaging functionality)
const KEEP_PATTERNS = [
  /^Conversation/,
  /^Message/,
  /^Compose/,
  /^Timeline/,
  /^Media/,
  /^Avatar/,
  /^Button/,
  /^Input/,
  /^Modal/,
  /^Emoji/,
  /^Quote/,
  /^Attachment/,
];

console.log('🔍 Starting component analysis...\n');

// Initialize TypeScript project
console.log('⚙️  Initializing TypeScript project...');
const project = new Project({
  tsConfigFilePath: path.join(__dirname, '../../../tsconfig.json'),
  skipAddingFilesFromTsConfig: false,
});

console.log('📊 Analyzing components...\n');

// Find all component files
const componentFiles = fs.readdirSync(COMPONENTS_DIR)
  .filter(file => file.endsWith('.tsx') || file.endsWith('.ts'))
  .map(file => path.join(COMPONENTS_DIR, file));

const componentInventory = [];

// Analyze each component
for (const componentPath of componentFiles) {
  const filename = path.basename(componentPath);
  const componentName = filename.replace(/\.(tsx|ts)$/, '');

  let category = 'UNKNOWN';
  let reason = '';

  // Categorize based on patterns
  if (REMOVE_PATTERNS.some(pattern => pattern.test(componentName))) {
    category = 'REMOVE';
    reason = 'Matches feature removal pattern';
  } else if (KEEP_PATTERNS.some(pattern => pattern.test(componentName))) {
    category = 'KEEP';
    reason = 'Core messaging component';
  } else {
    category = 'UNKNOWN';
    reason = 'Needs manual review';
  }

  // Get file size
  const stats = fs.statSync(componentPath);
  const sizeKB = (stats.size / 1024).toFixed(2);

  // Count imports (rough usage estimate)
  let usageCount = 0;
  try {
    const sourceFile = project.getSourceFile(componentPath);
    if (sourceFile) {
      const exportedDeclarations = sourceFile.getExportedDeclarations();

      // Search for imports of this component in other files
      const allFiles = project.getSourceFiles();
      for (const file of allFiles) {
        const imports = file.getImportDeclarations();
        for (const importDecl of imports) {
          const importPath = importDecl.getModuleSpecifierValue();
          if (importPath.includes(componentName)) {
            usageCount++;
          }
        }
      }
    }
  } catch (error) {
    console.error(`  ⚠️  Error analyzing ${componentName}:`, error.message);
  }

  componentInventory.push({
    name: componentName,
    filename,
    path: componentPath.replace(path.join(__dirname, '../../..'), ''),
    category,
    reason,
    sizeKB: parseFloat(sizeKB),
    usageCount,
  });
}

// Sort by category, then by usage
componentInventory.sort((a, b) => {
  if (a.category !== b.category) {
    const order = { REMOVE: 0, UNKNOWN: 1, KEEP: 2 };
    return order[a.category] - order[b.category];
  }
  return b.usageCount - a.usageCount;
});

// Generate statistics
const stats = {
  total: componentInventory.length,
  byCategory: {
    REMOVE: componentInventory.filter(c => c.category === 'REMOVE').length,
    UNKNOWN: componentInventory.filter(c => c.category === 'UNKNOWN').length,
    KEEP: componentInventory.filter(c => c.category === 'KEEP').length,
  },
  totalSizeKB: componentInventory.reduce((sum, c) => sum + c.sizeKB, 0).toFixed(2),
  removableSizeKB: componentInventory
    .filter(c => c.category === 'REMOVE')
    .reduce((sum, c) => sum + c.sizeKB, 0)
    .toFixed(2),
};

// Output report
const report = {
  generatedAt: new Date().toISOString(),
  statistics: stats,
  components: componentInventory,
};

const reportPath = path.join(REPORTS_DIR, 'component-inventory.json');
fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

// Print summary
console.log('✅ Analysis complete!\n');
console.log('📈 Statistics:');
console.log(`   Total components: ${stats.total}`);
console.log(`   ${stats.byCategory.REMOVE} to REMOVE (${((stats.byCategory.REMOVE/stats.total)*100).toFixed(1)}%)`);
console.log(`   ${stats.byCategory.UNKNOWN} UNKNOWN (need review)`);
console.log(`   ${stats.byCategory.KEEP} to KEEP`);
console.log(`   Total size: ${stats.totalSizeKB} KB`);
console.log(`   Removable size: ${stats.removableSizeKB} KB (${((stats.removableSizeKB/stats.totalSizeKB)*100).toFixed(1)}%)\n`);

console.log(`📄 Full report saved to: ${reportPath}\n`);

// Print removable components
const removable = componentInventory.filter(c => c.category === 'REMOVE');
if (removable.length > 0) {
  console.log('🗑️  Components marked for removal:');
  removable.slice(0, 10).forEach(c => {
    console.log(`   - ${c.name} (${c.sizeKB} KB, used ${c.usageCount} times)`);
  });
  if (removable.length > 10) {
    console.log(`   ... and ${removable.length - 10} more (see report)`);
  }
  console.log();
}

// Print components needing review
const unknown = componentInventory.filter(c => c.category === 'UNKNOWN');
if (unknown.length > 0) {
  console.log('❓ Components needing manual review (top 10 by size):');
  unknown
    .sort((a, b) => b.sizeKB - a.sizeKB)
    .slice(0, 10)
    .forEach(c => {
      console.log(`   - ${c.name} (${c.sizeKB} KB)`);
    });
  if (unknown.length > 10) {
    console.log(`   ... and ${unknown.length - 10} more (see report)`);
  }
  console.log();
}

process.exit(0);
