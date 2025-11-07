// Test to verify that the ESM format fix works correctly
// This simulates what happens when the preload bundle is loaded

const { Script, constants } = require('node:vm');

// Simulate an ESM bundle that imports an external ES module
const esmCode = `
import { Aci } from '@signalapp/libsignal-client';
console.log('ESM code executed successfully');
console.log('Aci type:', typeof Aci);
`;

console.log('Testing ESM format with dynamic imports...');

const script = new Script(esmCode, {
  filename: 'test-bundle.js',
  importModuleDynamically: constants.USE_MAIN_CONTEXT_DEFAULT_LOADER,
});

try {
  script.runInThisContext({
    filename: 'test-bundle.js',
    displayErrors: true,
    importModuleDynamically: constants.USE_MAIN_CONTEXT_DEFAULT_LOADER,
  });
  console.log('✓ Test passed: ESM code with external imports can be executed');
} catch (error) {
  console.error('✗ Test failed:', error.message);
  process.exit(1);
}
