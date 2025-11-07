// Test to see what esbuild generates for ESM format with external modules
const esbuild = require('esbuild');
const fs = require('fs');

// Create a test input file
fs.writeFileSync('/tmp/test-input.js', `
import { Aci } from '@signalapp/libsignal-client';
console.log('Test', Aci);
`);

// Build with ESM format
esbuild.buildSync({
  entryPoints: ['/tmp/test-input.js'],
  bundle: true,
  format: 'esm',
  external: ['@signalapp/libsignal-client'],
  outfile: '/tmp/test-output-esm.js',
  platform: 'node',
});

console.log('ESM output:');
console.log(fs.readFileSync('/tmp/test-output-esm.js', 'utf8'));

// Build with CJS format
esbuild.buildSync({
  entryPoints: ['/tmp/test-input.js'],
  bundle: true,
  format: 'cjs',
  external: ['@signalapp/libsignal-client'],
  outfile: '/tmp/test-output-cjs.js',
  platform: 'node',
});

console.log('\nCJS output:');
console.log(fs.readFileSync('/tmp/test-output-cjs.js', 'utf8'));
