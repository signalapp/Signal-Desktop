#!/usr/bin/env node

/**
 * Dependency Graph Generator
 *
 * Creates visual dependency graphs and identifies circular dependencies
 * using madge. Outputs both image files and JSON data.
 *
 * Usage:
 *   node scripts/cleanup/tools/generate-dep-graph.js
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const madge = require('madge');

// Paths
const ROOT_DIR = path.join(__dirname, '../../..');
const TS_DIR = path.join(ROOT_DIR, 'ts');
const REPORTS_DIR = path.join(__dirname, '../reports');

// Ensure reports directory exists
if (!fs.existsSync(REPORTS_DIR)) {
  fs.mkdirSync(REPORTS_DIR, { recursive: true });
}

console.log('🔍 Generating dependency graph...\n');

async function generateGraph() {
  try {
    // Analyze TypeScript dependencies
    console.log('⚙️  Analyzing TypeScript dependencies...');
    const result = await madge(TS_DIR, {
      fileExtensions: ['ts', 'tsx'],
      tsConfig: path.join(ROOT_DIR, 'tsconfig.json'),
      excludeRegExp: [
        /\.test\.ts$/,
        /\.spec\.ts$/,
        /__tests__/,
        /node_modules/,
      ],
    });

    // Get circular dependencies
    const circular = result.circular();
    console.log(`   Found ${circular.length} circular dependencies\n`);

    // Get dependency tree
    const tree = result.obj();
    const fileCount = Object.keys(tree).length;
    console.log(`   Analyzed ${fileCount} files\n`);

    // Calculate statistics
    const stats = {
      totalFiles: fileCount,
      circularDependencies: circular.length,
      orphanedFiles: [],
      heavilyDepended: [],
    };

    // Find orphaned files (no dependencies and not depended upon)
    const allDependencies = new Set();
    Object.values(tree).forEach(deps => {
      deps.forEach(dep => allDependencies.add(dep));
    });

    Object.keys(tree).forEach(file => {
      const hasDeps = tree[file].length > 0;
      const isDependedUpon = allDependencies.has(file);

      if (!hasDeps && !isDependedUpon) {
        stats.orphanedFiles.push(file);
      }
    });

    // Find heavily depended files
    const dependencyCounts = {};
    Object.values(tree).forEach(deps => {
      deps.forEach(dep => {
        dependencyCounts[dep] = (dependencyCounts[dep] || 0) + 1;
      });
    });

    stats.heavilyDepended = Object.entries(dependencyCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([file, count]) => ({ file, dependentCount: count }));

    // Save detailed report
    const report = {
      generatedAt: new Date().toISOString(),
      statistics: stats,
      circularDependencies: circular,
      dependencyTree: tree,
      orphanedFiles: stats.orphanedFiles,
      heavilyDependedFiles: stats.heavilyDepended,
    };

    const reportPath = path.join(REPORTS_DIR, 'dependency-graph.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`📄 Full report saved to: ${reportPath}\n`);

    // Generate visual graph (SVG)
    console.log('🎨 Generating visual dependency graph...');
    try {
      const imagePath = path.join(REPORTS_DIR, 'dependency-graph.svg');
      await result.image(imagePath);
      console.log(`   SVG saved to: ${imagePath}\n`);
    } catch (error) {
      console.warn('   ⚠️  Could not generate SVG (graphviz might not be installed)');
      console.warn('   Install with: brew install graphviz (macOS) or apt-get install graphviz (Linux)\n');
    }

    // Print summary
    console.log('✅ Analysis complete!\n');
    console.log('📊 Statistics:');
    console.log(`   Total files analyzed: ${stats.totalFiles}`);
    console.log(`   Circular dependencies: ${stats.circularDependencies}`);
    console.log(`   Orphaned files: ${stats.orphanedFiles.length}`);
    console.log(`   Heavily depended files: ${stats.heavilyDepended.length}\n`);

    // Print circular dependencies
    if (circular.length > 0) {
      console.log('🔄 Circular dependencies found:');
      circular.slice(0, 5).forEach((cycle, i) => {
        console.log(`   ${i + 1}. ${cycle.join(' → ')}`);
      });
      if (circular.length > 5) {
        console.log(`   ... and ${circular.length - 5} more (see report)`);
      }
      console.log();
    }

    // Print orphaned files
    if (stats.orphanedFiles.length > 0) {
      console.log('🗑️  Orphaned files (candidates for removal):');
      stats.orphanedFiles.slice(0, 10).forEach(file => {
        console.log(`   - ${file}`);
      });
      if (stats.orphanedFiles.length > 10) {
        console.log(`   ... and ${stats.orphanedFiles.length - 10} more (see report)`);
      }
      console.log();
    }

    // Print heavily depended files
    if (stats.heavilyDepended.length > 0) {
      console.log('⭐ Most depended upon files (top 10):');
      stats.heavilyDepended.slice(0, 10).forEach(({ file, dependentCount }) => {
        console.log(`   - ${file} (${dependentCount} dependents)`);
      });
      console.log();
    }

    console.log('💡 Tips:');
    console.log('   - Break circular dependencies before major refactoring');
    console.log('   - Review orphaned files for potential removal');
    console.log('   - Be careful when modifying heavily depended files\n');

  } catch (error) {
    console.error('❌ Error generating dependency graph:', error.message);
    process.exit(1);
  }
}

// Run
generateGraph().then(() => {
  process.exit(0);
}).catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
