#!/usr/bin/env node

/**
 * Feature Removal Tool
 *
 * Safely removes Signal features that aren't needed for Orbital.
 * Supports dry-run mode, backups, and rollback.
 *
 * Usage:
 *   node scripts/cleanup/tools/remove-feature.js --feature=calling --dry-run
 *   node scripts/cleanup/tools/remove-feature.js --feature=calling --execute
 *   node scripts/cleanup/tools/remove-feature.js --rollback=calling
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Parse command line arguments
const args = process.argv.slice(2);
const getArg = (name) => {
  const arg = args.find(a => a.startsWith(`--${name}=`));
  return arg ? arg.split('=')[1] : null;
};
const hasFlag = (name) => args.includes(`--${name}`);

const feature = getArg('feature');
const dryRun = hasFlag('dry-run');
const execute = hasFlag('execute');
const rollback = getArg('rollback');

// Paths
const ROOT_DIR = path.join(__dirname, '../../..');
const TS_DIR = path.join(ROOT_DIR, 'ts');
const BACKUPS_DIR = path.join(__dirname, '../backups');
const REPORTS_DIR = path.join(__dirname, '../reports');

// Ensure directories exist
[BACKUPS_DIR, REPORTS_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Feature definitions
const FEATURES = {
  calling: {
    directories: [
      'ts/calling',
    ],
    filePatterns: [
      /ts\/components\/Call.*\.tsx?$/,
      /ts\/components\/Calling.*\.tsx?$/,
      /ts\/state\/ducks\/calling.*\.ts$/,
      /ts\/util\/calling.*\.ts$/,
      /ts\/hooks\/useCall.*\.ts$/,
    ],
    dependencies: ['@signalapp/ringrtc'],
    description: 'Voice and video calling infrastructure',
  },
  stories: {
    directories: [],
    filePatterns: [
      /ts\/components\/Stories.*\.tsx?$/,
      /ts\/components\/Story.*\.tsx?$/,
      /ts\/state\/ducks\/stories.*\.ts$/,
      /ts\/util\/stories.*\.ts$/,
    ],
    dependencies: [],
    description: 'Stories feature (Instagram-style)',
  },
  payments: {
    directories: [],
    filePatterns: [
      /ts\/components\/Payment.*\.tsx?$/,
      /ts\/state\/ducks\/payments.*\.ts$/,
      /ts\/util\/payments.*\.ts$/,
    ],
    dependencies: [],
    description: 'MobileCoin payment integration',
  },
  stickers: {
    directories: [
      'sticker-creator',
    ],
    filePatterns: [
      /ts\/components\/stickers\/.*\.tsx?$/,
      /ts\/state\/ducks\/stickers.*\.ts$/,
    ],
    dependencies: [],
    description: 'Sticker creator and management',
  },
  'phone-auth': {
    directories: [],
    filePatterns: [
      /ts\/components\/PhoneNumber.*\.tsx?$/,
      /ts\/components\/RegistrationLinkScreen.*\.tsx?$/,
      /ts\/util\/phoneNumber.*\.ts$/,
    ],
    dependencies: [],
    description: 'Phone number verification system',
  },
  badges: {
    directories: [],
    filePatterns: [
      /ts\/components\/Badge.*\.tsx?$/,
      /ts\/badges\/.*\.tsx?$/,
    ],
    dependencies: [],
    description: 'Badge system (notification counts)',
  },
};

// Helper: Find all files matching patterns
function findFiles(patterns) {
  const files = [];

  function walkDir(dir) {
    if (!fs.existsSync(dir)) return;

    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      const relativePath = path.relative(ROOT_DIR, fullPath);

      if (entry.isDirectory()) {
        // Skip node_modules, build artifacts, etc.
        if (!['node_modules', 'build', 'dist', '.git'].includes(entry.name)) {
          walkDir(fullPath);
        }
      } else if (entry.isFile()) {
        if (patterns.some(pattern => pattern.test(relativePath))) {
          files.push(relativePath);
        }
      }
    }
  }

  walkDir(ROOT_DIR);
  return files;
}

// Helper: Get directory size
function getDirSize(dir) {
  if (!fs.existsSync(dir)) return 0;

  let size = 0;
  function walk(p) {
    const stats = fs.statSync(p);
    if (stats.isFile()) {
      size += stats.size;
    } else if (stats.isDirectory()) {
      fs.readdirSync(p).forEach(f => walk(path.join(p, f)));
    }
  }
  walk(dir);
  return size;
}

// Helper: Count lines in file
function countLines(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    return content.split('\n').length;
  } catch {
    return 0;
  }
}

// Command: Analyze feature removal
function analyzeFeature(featureName) {
  const feature = FEATURES[featureName];
  if (!feature) {
    console.error(`❌ Unknown feature: ${featureName}`);
    console.log(`\nAvailable features: ${Object.keys(FEATURES).join(', ')}`);
    process.exit(1);
  }

  console.log(`🔍 Analyzing feature: ${featureName}`);
  console.log(`   ${feature.description}\n`);

  const analysis = {
    feature: featureName,
    directories: [],
    files: [],
    dependencies: feature.dependencies,
    totalLines: 0,
    totalSizeKB: 0,
  };

  // Analyze directories
  for (const dir of feature.directories) {
    const fullPath = path.join(ROOT_DIR, dir);
    if (fs.existsSync(fullPath)) {
      const size = getDirSize(fullPath);
      analysis.directories.push({
        path: dir,
        sizeKB: (size / 1024).toFixed(2),
      });
      analysis.totalSizeKB += size / 1024;
    }
  }

  // Analyze files
  const matchingFiles = findFiles(feature.filePatterns);
  for (const file of matchingFiles) {
    const fullPath = path.join(ROOT_DIR, file);
    const stats = fs.statSync(fullPath);
    const lines = countLines(fullPath);

    analysis.files.push({
      path: file,
      lines,
      sizeKB: (stats.size / 1024).toFixed(2),
    });

    analysis.totalLines += lines;
    analysis.totalSizeKB += stats.size / 1024;
  }

  return analysis;
}

// Command: Remove feature
function removeFeature(featureName, analysis) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupDir = path.join(BACKUPS_DIR, `${featureName}-${timestamp}`);

  console.log(`\n📦 Creating backup: ${backupDir}`);
  fs.mkdirSync(backupDir, { recursive: true });

  // Backup and remove directories
  for (const dir of analysis.directories) {
    const sourcePath = path.join(ROOT_DIR, dir.path);
    const backupPath = path.join(backupDir, dir.path);

    console.log(`   Backing up: ${dir.path}`);
    fs.mkdirSync(path.dirname(backupPath), { recursive: true });
    execSync(`cp -r "${sourcePath}" "${backupPath}"`);

    console.log(`   Removing: ${dir.path}`);
    fs.rmSync(sourcePath, { recursive: true, force: true });
  }

  // Backup and remove files
  for (const file of analysis.files) {
    const sourcePath = path.join(ROOT_DIR, file.path);
    const backupPath = path.join(backupDir, file.path);

    if (fs.existsSync(sourcePath)) {
      fs.mkdirSync(path.dirname(backupPath), { recursive: true });
      fs.copyFileSync(sourcePath, backupPath);
      fs.unlinkSync(sourcePath);
    }
  }

  // Remove npm dependencies
  if (analysis.dependencies.length > 0) {
    console.log(`\n📦 Removing dependencies: ${analysis.dependencies.join(', ')}`);
    try {
      execSync(`pnpm remove ${analysis.dependencies.join(' ')}`, {
        cwd: ROOT_DIR,
        stdio: 'inherit',
      });
    } catch (error) {
      console.error('   ⚠️  Failed to remove some dependencies');
    }
  }

  // Save removal manifest
  const manifest = {
    feature: featureName,
    timestamp,
    analysis,
    backupDir,
  };
  fs.writeFileSync(
    path.join(backupDir, 'manifest.json'),
    JSON.stringify(manifest, null, 2)
  );

  console.log(`\n✅ Feature removed: ${featureName}`);
  console.log(`   Backup saved to: ${backupDir}`);
  console.log(`\n💡 To rollback: node scripts/cleanup/tools/remove-feature.js --rollback=${featureName}`);
}

// Command: Rollback removal
function rollbackFeature(featureName) {
  // Find latest backup
  const backups = fs.readdirSync(BACKUPS_DIR)
    .filter(dir => dir.startsWith(`${featureName}-`))
    .sort()
    .reverse();

  if (backups.length === 0) {
    console.error(`❌ No backup found for feature: ${featureName}`);
    process.exit(1);
  }

  const backupDir = path.join(BACKUPS_DIR, backups[0]);
  const manifestPath = path.join(backupDir, 'manifest.json');

  if (!fs.existsSync(manifestPath)) {
    console.error(`❌ Invalid backup: missing manifest.json`);
    process.exit(1);
  }

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));

  console.log(`\n🔄 Rolling back feature: ${featureName}`);
  console.log(`   From backup: ${backups[0]}\n`);

  // Restore directories
  for (const dir of manifest.analysis.directories) {
    const backupPath = path.join(backupDir, dir.path);
    const targetPath = path.join(ROOT_DIR, dir.path);

    if (fs.existsSync(backupPath)) {
      console.log(`   Restoring: ${dir.path}`);
      fs.mkdirSync(path.dirname(targetPath), { recursive: true });
      execSync(`cp -r "${backupPath}" "${targetPath}"`);
    }
  }

  // Restore files
  for (const file of manifest.analysis.files) {
    const backupPath = path.join(backupDir, file.path);
    const targetPath = path.join(ROOT_DIR, file.path);

    if (fs.existsSync(backupPath)) {
      fs.mkdirSync(path.dirname(targetPath), { recursive: true });
      fs.copyFileSync(backupPath, targetPath);
    }
  }

  console.log(`\n✅ Rollback complete: ${featureName}`);
}

// Main
if (rollback) {
  rollbackFeature(rollback);
} else if (!feature) {
  console.error('Usage: node remove-feature.js --feature=<name> [--dry-run|--execute]');
  console.log(`\nAvailable features:`);
  Object.entries(FEATURES).forEach(([name, f]) => {
    console.log(`  ${name.padEnd(15)} ${f.description}`);
  });
  process.exit(1);
} else {
  const analysis = analyzeFeature(feature);

  // Print analysis
  console.log('📊 Impact Analysis:\n');
  console.log(`   Directories to remove: ${analysis.directories.length}`);
  if (analysis.directories.length > 0) {
    analysis.directories.forEach(d => {
      console.log(`      - ${d.path} (${d.sizeKB} KB)`);
    });
  }

  console.log(`\n   Files to remove: ${analysis.files.length}`);
  if (analysis.files.length > 0) {
    analysis.files.slice(0, 10).forEach(f => {
      console.log(`      - ${f.path} (${f.lines} lines, ${f.sizeKB} KB)`);
    });
    if (analysis.files.length > 10) {
      console.log(`      ... and ${analysis.files.length - 10} more`);
    }
  }

  if (analysis.dependencies.length > 0) {
    console.log(`\n   Dependencies to remove: ${analysis.dependencies.join(', ')}`);
  }

  console.log(`\n   📉 Total reduction:`);
  console.log(`      Lines: ${analysis.totalLines.toLocaleString()}`);
  console.log(`      Size: ${analysis.totalSizeKB.toFixed(2)} KB`);

  // Save report
  const reportPath = path.join(REPORTS_DIR, `removal-${feature}-${Date.now()}.json`);
  fs.writeFileSync(reportPath, JSON.stringify(analysis, null, 2));
  console.log(`\n   📄 Report saved: ${reportPath}`);

  if (dryRun) {
    console.log(`\n✨ Dry-run complete. No changes made.`);
    console.log(`   To execute removal: node scripts/cleanup/tools/remove-feature.js --feature=${feature} --execute`);
  } else if (execute) {
    console.log(`\n⚠️  This will permanently remove the feature (backup will be created)`);
    removeFeature(feature, analysis);
  } else {
    console.log(`\n💡 Add --dry-run to preview or --execute to remove`);
  }
}
