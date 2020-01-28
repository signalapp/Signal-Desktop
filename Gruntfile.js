const path = require('path');
const packageJson = require('./package.json');
const importOnce = require('node-sass-import-once');
const rimraf = require('rimraf');
const mkdirp = require('mkdirp');
const spectron = require('spectron');
const asar = require('asar');
const fs = require('fs');
const assert = require('assert');
const sass = require('node-sass');

/* eslint-disable more/no-then, no-console  */

module.exports = grunt => {
  const bower = grunt.file.readJSON('bower.json');
  const components = [];
  // eslint-disable-next-line guard-for-in, no-restricted-syntax
  for (const i in bower.concat.app) {
    components.push(bower.concat.app[i]);
  }

  const libtextsecurecomponents = [];
  // eslint-disable-next-line guard-for-in, no-restricted-syntax
  for (const i in bower.concat.libtextsecure) {
    libtextsecurecomponents.push(bower.concat.libtextsecure[i]);
  }

  const liblokicomponents = [];
  // eslint-disable-next-line guard-for-in, no-restricted-syntax
  for (const i in bower.concat.libloki) {
    liblokicomponents.push(bower.concat.libloki[i]);
  }

  grunt.loadNpmTasks('grunt-sass');

  grunt.initConfig({
    pkg: grunt.file.readJSON('package.json'),
    concat: {
      components: {
        src: components,
        dest: 'js/components.js',
      },
      util_worker: {
        src: [
          'components/bytebuffer/dist/ByteBufferAB.js',
          'components/JSBI/dist/jsbi.mjs',
          'libloki/proof-of-work.js',
          'components/long/dist/Long.js',
          'js/util_worker_tasks.js',
        ],
        dest: 'js/util_worker.js',
      },
      libtextsecurecomponents: {
        src: libtextsecurecomponents,
        dest: 'libtextsecure/components.js',
      },
      liblokicomponents: {
        src: liblokicomponents,
        dest: 'libloki/test/components.js',
      },
      test: {
        src: [
          'node_modules/mocha/mocha.js',
          'node_modules/chai/chai.js',
          'test/_test.js',
        ],
        dest: 'test/test.js',
      },
      // TODO: Move errors back down?
      libtextsecure: {
        options: {
          banner: ';(function() {\n',
          footer: '})();\n',
        },
        src: [
          'libtextsecure/errors.js',
          'libtextsecure/libsignal-protocol.js',
          'libtextsecure/protocol_wrapper.js',

          'libtextsecure/crypto.js',
          'libtextsecure/storage.js',
          'libtextsecure/storage/user.js',
          'libtextsecure/storage/groups.js',
          'libtextsecure/storage/unprocessed.js',
          'libtextsecure/protobufs.js',
          'libtextsecure/helpers.js',
          'libtextsecure/stringview.js',
          'libtextsecure/event_target.js',
          'libtextsecure/account_manager.js',
          'libtextsecure/websocket-resources.js',
          'libtextsecure/http-resources.js',
          'libtextsecure/message_receiver.js',
          'libtextsecure/outgoing_message.js',
          'libtextsecure/sendmessage.js',
          'libtextsecure/sync_request.js',
          'libtextsecure/contacts_parser.js',
          'libtextsecure/ProvisioningCipher.js',
          'libtextsecure/task_with_timeout.js',
        ],
        dest: 'js/libtextsecure.js',
      },
      libloki: {
        src: [
          'libloki/api.js',
          'libloki/friends.js',
          'libloki/crypto.js',
          'libloki/service_nodes.js',
          'libloki/storage.js',
        ],
        dest: 'js/libloki.js',
      },
      lokitest: {
        src: [
          'node_modules/mocha/mocha.js',
          'node_modules/chai/chai.js',
          'libloki/test/_test.js',
        ],
        dest: 'libloki/test/test.js',
      },
      libtextsecuretest: {
        src: [
          'node_modules/jquery/dist/jquery.js',
          'components/mock-socket/dist/mock-socket.js',
          'node_modules/mocha/mocha.js',
          'node_modules/chai/chai.js',
          'libtextsecure/test/_test.js',
        ],
        dest: 'libtextsecure/test/test.js',
      },
    },
    sass: {
      options: {
        implementation: sass,
        sourceMap: true,
        importer: importOnce,
      },
      dev: {
        files: {
          'stylesheets/manifest.css': 'stylesheets/manifest.scss',
        },
      },
    },
    copy: {
      deps: {
        files: [
          {
            src: 'components/mp3lameencoder/lib/Mp3LameEncoder.js',
            dest: 'js/Mp3LameEncoder.min.js',
          },
          {
            src: 'components/webaudiorecorder/lib/WebAudioRecorderMp3.js',
            dest: 'js/WebAudioRecorderMp3.js',
          },
        ],
      },
    },
    watch: {
      libtextsecure: {
        files: ['./libtextsecure/*.js', './libtextsecure/storage/*.js'],
        tasks: ['concat:libtextsecure'],
      },
      utilworker: {
        files: [
          'components/bytebuffer/dist/ByteBufferAB.js',
          'components/JSBI/dist/jsbi.mjs',
          'libloki/proof-of-work.js',
          'components/long/dist/Long.js',
          'js/util_worker_tasks.js',
        ],
        tasks: ['concat:util_worker'],
      },
      libloki: {
        files: ['./libloki/*.js'],
        tasks: ['concat:libloki'],
      },
      protobuf: {
        files: ['./protos/SignalService.proto'],
        tasks: ['exec:build-protobuf'],
      },
      sass: {
        files: ['./stylesheets/*.scss'],
        tasks: ['sass'],
      },
      transpile: {
        files: ['./ts/**/*.ts', './ts/**/*.tsx', './ts/**/**/*.tsx'],
        tasks: ['exec:transpile'],
      },
    },
    exec: {
      'tx-pull-new': {
        cmd: 'tx pull -a --minimum-perc=80',
      },
      'tx-pull': {
        cmd: 'tx pull',
      },
      transpile: {
        cmd: 'yarn transpile',
      },
      'build-protobuf': {
        cmd: 'yarn build-protobuf',
      },
    },
    'test-release': {
      osx: {
        archive: `mac/${
          packageJson.productName
        }.app/Contents/Resources/app.asar`,
        appUpdateYML: `mac/${
          packageJson.productName
        }.app/Contents/Resources/app-update.yml`,
        exe: `mac/${packageJson.productName}.app/Contents/MacOS/${
          packageJson.productName
        }`,
      },
      mas: {
        archive: 'mas/Signal.app/Contents/Resources/app.asar',
        appUpdateYML: 'mac/Signal.app/Contents/Resources/app-update.yml',
        exe: `mas/${packageJson.productName}.app/Contents/MacOS/${
          packageJson.productName
        }`,
      },
      linux: {
        archive: 'linux-unpacked/resources/app.asar',
        exe: `linux-unpacked/${packageJson.name}`,
      },
      win: {
        archive: 'win-unpacked/resources/app.asar',
        appUpdateYML: 'win-unpacked/resources/app-update.yml',
        exe: `win-unpacked/${packageJson.productName}.exe`,
      },
    },
    gitinfo: {}, // to be populated by grunt gitinfo
  });

  Object.keys(grunt.config.get('pkg').devDependencies).forEach(key => {
    if (/^grunt(?!(-cli)?$)/.test(key)) {
      // ignore grunt and grunt-cli
      grunt.loadNpmTasks(key);
    }
  });

  // Transifex does not understand placeholders, so this task patches all non-en
  // locales with missing placeholders
  grunt.registerTask('locale-patch', () => {
    const en = grunt.file.readJSON('_locales/en/messages.json');
    grunt.file.recurse('_locales', (abspath, rootdir, subdir, filename) => {
      if (subdir === 'en' || filename !== 'messages.json') {
        return;
      }
      const messages = grunt.file.readJSON(abspath);

      // eslint-disable-next-line no-restricted-syntax
      for (const key in messages) {
        if (en[key] !== undefined && messages[key] !== undefined) {
          if (
            en[key].placeholders !== undefined &&
            messages[key].placeholders === undefined
          ) {
            messages[key].placeholders = en[key].placeholders;
          }
        }
      }

      grunt.file.write(abspath, `${JSON.stringify(messages, null, 4)}\n`);
    });
  });

  function updateLocalConfig(update) {
    const environment = process.env.SIGNAL_ENV || 'development';
    const configPath = `config/local-${environment}.json`;
    let localConfig;
    try {
      localConfig = grunt.file.readJSON(configPath);
    } catch (e) {
      //
    }
    localConfig = {
      ...localConfig,
      ...update,
    };
    grunt.file.write(configPath, `${JSON.stringify(localConfig)}\n`);
  }

  grunt.registerTask('getExpireTime', () => {
    grunt.task.requires('gitinfo');
    const gitinfo = grunt.config.get('gitinfo');
    const committed = gitinfo.local.branch.current.lastCommitTime;
    const time = Date.parse(committed) + 1000 * 60 * 60 * 24 * 90;
    updateLocalConfig({ buildExpiration: time });
  });

  grunt.registerTask('getCommitHash', () => {
    grunt.task.requires('gitinfo');
    const gitinfo = grunt.config.get('gitinfo');
    const hash = gitinfo.local.branch.current.SHA;
    updateLocalConfig({ commitHash: hash });
  });

  grunt.registerTask('clean-release', () => {
    rimraf.sync('release');
    mkdirp.sync('release');
  });

  function runTests(environment, cb) {
    let failure;
    const { Application } = spectron;
    const electronBinary =
      process.platform === 'win32' ? 'electron.cmd' : 'electron';
    const app = new Application({
      path: path.join(__dirname, 'node_modules', '.bin', electronBinary),
      args: [path.join(__dirname, 'main.js')],
      env: {
        NODE_ENV: environment,
      },
      requireName: 'unused',
    });

    function getMochaResults() {
      // eslint-disable-next-line no-undef
      return window.mochaResults;
    }

    app
      .start()
      .then(() =>
        app.client.waitUntil(
          () =>
            app.client
              .execute(getMochaResults)
              .then(data => Boolean(data.value)),
          25000,
          'Expected to find window.mochaResults set!'
        )
      )
      .then(() => app.client.execute(getMochaResults))
      .then(data => {
        const results = data.value;
        if (results.failures > 0) {
          console.error(results.reports);
          failure = () =>
            grunt.fail.fatal(`Found ${results.failures} failing unit tests.`);
          return app.client.log('browser');
        }
        grunt.log.ok(`${results.passes} tests passed.`);
        return null;
      })
      .then(logs => {
        if (logs) {
          console.error();
          console.error('Because tests failed, printing browser logs:');
          console.error(logs);
        }
      })
      .catch(error => {
        failure = () =>
          grunt.fail.fatal(
            `Something went wrong: ${error.message} ${error.stack}`
          );
      })
      .then(() => {
        // We need to use the failure variable and this early stop to clean up before
        // shutting down. Grunt's fail methods are the only way to set the return value,
        // but they shut the process down immediately!
        if (failure) {
          console.log();
          console.log('Main process logs:');
          return app.client.getMainProcessLogs().then(logs => {
            logs.forEach(log => {
              console.log(log);
            });

            return app.stop();
          });
        }
        return app.stop();
      })
      .then(() => {
        if (failure) {
          failure();
        }
        cb();
      })
      .catch(error => {
        console.error('Second-level error:', error.message, error.stack);
        if (failure) {
          failure();
        }
        cb();
      });
  }

  grunt.registerTask(
    'unit-tests',
    'Run unit tests w/Electron',
    function thisNeeded() {
      const environment = grunt.option('env') || 'test';
      const done = this.async();

      runTests(environment, done);
    }
  );

  grunt.registerTask(
    'lib-unit-tests',
    'Run libtextsecure unit tests w/Electron',
    function thisNeeded() {
      const environment = grunt.option('env') || 'test-lib';
      const done = this.async();

      runTests(environment, done);
    }
  );

  grunt.registerTask(
    'loki-unit-tests',
    'Run loki unit tests w/Electron',
    function thisNeeded() {
      const environment = grunt.option('env') || 'test-loki';
      const done = this.async();

      runTests(environment, done);
    }
  );

  grunt.registerMultiTask(
    'test-release',
    'Test packaged releases',
    function thisNeeded() {
      const dir = grunt.option('dir') || 'release';
      const environment = grunt.option('env') || 'production';
      const config = this.data;
      const archive = [dir, config.archive].join('/');
      const files = [
        'config/default.json',
        `config/${environment}.json`,
        `config/local-${environment}.json`,
      ];

      console.log(this.target, archive);
      const releaseFiles = files.concat(config.files || []);
      releaseFiles.forEach(fileName => {
        console.log(fileName);
        try {
          asar.statFile(archive, fileName);
          return true;
        } catch (e) {
          console.log(e);
          throw new Error(`Missing file ${fileName}`);
        }
      });

      if (config.appUpdateYML) {
        const appUpdateYML = [dir, config.appUpdateYML].join('/');
        if (fs.existsSync(appUpdateYML)) {
          console.log('auto update ok');
        } else {
          throw new Error(`Missing auto update config ${appUpdateYML}`);
        }
      }

      const done = this.async();
      // A simple test to verify a visible window is opened with a title
      const { Application } = spectron;

      const app = new Application({
        path: [dir, config.exe].join('/'),
        requireName: 'unused',
      });

      app
        .start()
        .then(() => app.client.getWindowCount())
        .then(count => {
          assert.equal(count, 1);
          console.log('window opened');
        })
        .then(() =>
          // Get the window's title
          app.client.getTitle()
        )
        .then(title => {
          // TODO: restore once fixed on win
          if (this.target !== 'win') {
            // Verify the window's title
            assert.equal(title, packageJson.productName);
            console.log('title ok');
          }
        })
        .then(() => {
          assert(
            app.chromeDriver.logLines.indexOf(`NODE_ENV ${environment}`) > -1
          );
          console.log('environment ok');
        })
        .then(
          () =>
            // Successfully completed test
            app.stop(),
          error =>
            // Test failed!
            app.stop().then(() => {
              grunt.fail.fatal(`Test failed: ${error.message} ${error.stack}`);
            })
        )
        .then(done);
    }
  );

  grunt.registerTask('tx', [
    'exec:tx-pull-new',
    'exec:tx-pull',
    'locale-patch',
  ]);
  grunt.registerTask('dev', ['default', 'watch']);
  grunt.registerTask('test', [
    'unit-tests',
    'lib-unit-tests',
    'loki-unit-tests',
  ]);
  grunt.registerTask('date', ['gitinfo', 'getExpireTime']);
  grunt.registerTask('default', [
    'exec:build-protobuf',
    'exec:transpile',
    'concat',
    'copy:deps',
    'sass',
    'date',
    'getCommitHash',
  ]);
};
