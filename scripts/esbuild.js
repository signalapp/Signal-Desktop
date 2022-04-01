// // eslint-disable-next-line import/no-extraneous-dependencies
// const esbuild = require('esbuild');
// const path = require('path');
// const glob = require('glob');

// const ROOT_DIR = path.join(__dirname, '..');
// const DIST_DIR = path.join(ROOT_DIR, 'dist');

// const watch = process.argv.some(argv => argv === '-w' || argv === '--watch');
// const isProd = process.argv.some(argv => argv === '-prod' || argv === '--prod');

// const nodeDefaults = {
//   platform: 'node',
//   target: 'node16',
//   sourcemap: isProd ? false : 'inline',
//   // Otherwise React components get renamed
//   // See: https://github.com/evanw/esbuild/issues/1147
//   keepNames: true,
//   logLevel: 'info',
//   watch,
// };

// const defaultBundle = {
//   ...nodeDefaults,
//   //   define: {
//   //     'process.env.NODE_ENV': isProd ? '"production"' : '"development"',
//   //   },
//   bundle: true,
//   external: [
//     // Native libraries
//     // 'better-sqlite3',
//     'electron',
//     // 'sass',
//     //   'bytebuffer',
//     //   'lodash',
//     // 'react',
//     // 'react-dom',
//     // Things that don't bundle well
//     // 'backbone',
//     'got',
//     // 'jquery',
//     'node-fetch',
//     // 'proxy-agent',

//     'ip2country',
//     // 'react-redux',
//     // 'react-qr-svg',
//     // 'reselect',
//     // 'redux',
//     // '@reduxjs/toolkit',
//     'styled-components',
//     // 'react-contexify',
//     'filesize',
//     'redux-persist',
//     'redux-promise-middleware',
//     'emoji-mart',
//     'mic-recorder-to-mp3',
//     // 'react-intersection-observer',
//     // 'react-h5-audio-player',
//     'semver',
//     'os',
//     // 'react-toastify',
//     'libsodium-wrappers-sumo',
//     'fs-extra',
//     'blueimp-load-image',
//     'blob-util',
//     // 'redux-logger',
//     'rimraf',
//     'better-sqlite3',
//     'glob',
//     'rc-slider',
//     // 'react-virtualized',
//     'rc-slider',
//     // 'react-draggable',
//     // 'react-mentions',

//     // Large libraries
//     // See: https://esbuild.github.io/api/#analyze
//     'moment',
//   ],
// };

// // App, tests, and scripts
// esbuild.build({
//   ...nodeDefaults,
//   format: 'cjs',
//   mainFields: ['browser', 'main'],
//   entryPoints: glob
//     .sync('{app,ts}/**/*.{ts,tsx}', {
//       nodir: true,
//       root: ROOT_DIR,
//     })
//     .filter(file => !file.endsWith('.d.ts')),
//   outdir: path.join(DIST_DIR),
// });

// // App, tests, and scripts

// // build main renderer
// esbuild.build({
//   ...defaultBundle,
//   format: 'cjs',
//   platform: 'node',
//   mainFields: ['browser', 'main', 'module'],
//   inject: [path.join(ROOT_DIR, 'node_modules', 'jquery', 'dist', 'jquery.min.js')],
//   entryPoints: ['./ts/mains/main_renderer.ts'],
//   outfile: path.join(DIST_DIR, 'electron_renderer.js'),
// });

// // build main_node
// esbuild.build({
//   ...defaultBundle,
//   format: 'cjs',
//   mainFields: ['main'],
//   entryPoints: ['./ts/mains/main_node.ts'],
//   outfile: path.join(DIST_DIR, 'electron_main.js'),
// });

// // Preload bundle
// // eslint-disable-next-line more/no-then
// esbuild.buildSync({
//   ...defaultBundle,
//   format: 'cjs',
//   entryPoints: ['preload.ts'],
//   outdir: path.join(DIST_DIR),
// });
// esbuild.buildSync({
//   ...defaultBundle,
//   entryPoints: [path.join(ROOT_DIR, 'dist', 'preload.js')],
//   inject: [path.join(ROOT_DIR, 'libtextsecure', 'libsignal-protocol.js')],
//   outfile: path.join(DIST_DIR, 'preload.bundled.js'),
// });

// // HEIC worker
// // esbuild.build({
// //   ...bundleDefaults,
// //   entryPoints: [path.join(ROOT_DIR, 'ts', 'workers', 'heicConverterWorker.ts')],
// //   outfile: path.join(DIST_DIR, 'ts', 'workers', 'heicConverter.bundle.js'),
// // });

// // // SQL worker
// // const libDir = path.join('..', '..', 'node_modules', 'better-sqlite3');
// // const bindingFile = path.join(libDir, 'build', 'Release', 'better_sqlite3.node');

// // esbuild.build({
// //   ...nodeDefaults,
// //   bundle: true,

// //   plugins: [
// //     {
// //       name: 'bindings',
// //       setup(build) {
// //         build.onResolve({ filter: /^bindings$/ }, () => ({
// //           path: path.join(ROOT_DIR, 'ts', 'sql', 'mainWorkerBindings.ts'),
// //         }));

// //         build.onResolve({ filter: /^better_sqlite3\.node$/ }, () => ({
// //           path: bindingFile,
// //           external: true,
// //         }));
// //       },
// //     },
// //   ],

// //   entryPoints: [path.join(ROOT_DIR, 'ts', 'sql', 'mainWorker.ts')],
// //   outfile: path.join(DIST_DIR, 'ts', 'sql', 'mainWorker.bundle.js'),
// // });
