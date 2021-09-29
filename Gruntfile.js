const importOnce = require('node-sass-import-once');
const rimraf = require('rimraf');
const mkdirp = require('mkdirp');
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

  const utilWorkerComponents = [
    'node_modules/bytebuffer/dist/bytebuffer.js',
    'js/curve/curve25519_compiled.js',
    'js/curve/curve25519_wrapper.js',
    'node_modules/libsodium/dist/modules/libsodium.js',
    'node_modules/libsodium-wrappers/dist/modules/libsodium-wrappers.js',

    'libtextsecure/libsignal-protocol.js',
    'js/util_worker_tasks.js',
  ];

  grunt.loadNpmTasks('grunt-sass');

  grunt.initConfig({
    pkg: grunt.file.readJSON('package.json'),
    concat: {
      components: {
        src: components,
        dest: 'js/components.js',
      },
      util_worker: {
        src: utilWorkerComponents,
        dest: 'js/util_worker.js',
      },
      libtextsecurecomponents: {
        src: libtextsecurecomponents,
        dest: 'libtextsecure/components.js',
      },
      libtextsecure: {
        options: {
          banner: ';(function() {\n',
          footer: '})();\n',
        },
        src: [
          'libtextsecure/errors.js',
          'libtextsecure/libsignal-protocol.js',
          'libtextsecure/crypto.js',
          'libtextsecure/storage.js',
          'libtextsecure/storage/user.js',
          'libtextsecure/storage/groups.js',
          'libtextsecure/helpers.js',
          'libtextsecure/stringview.js',
          'libtextsecure/event_target.js',
          'libtextsecure/http-resources.js',
          'libtextsecure/message_receiver.js',
        ],
        dest: 'js/libtextsecure.js',
      },
      libtextsecuretest: {
        src: [
          'node_modules/jquery/dist/jquery.js',
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
    watch: {
      libtextsecure: {
        files: ['./libtextsecure/*.js', './libtextsecure/storage/*.js'],
        tasks: ['concat:libtextsecure'],
      },
      utilworker: {
        files: utilWorkerComponents,
        tasks: ['concat:util_worker'],
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
        files: ['./ts/**/*.ts', './ts/**/*.tsx', './ts/**/**/*.tsx', './test/ts/**.ts'],
        tasks: ['exec:transpile'],
      },
    },
    exec: {
      transpile: {
        cmd: 'yarn transpile',
      },
      'build-protobuf': {
        cmd: 'yarn build-protobuf',
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

  grunt.registerTask('dev', ['default', 'watch']);
  grunt.registerTask('date', ['gitinfo', 'getExpireTime']);
  grunt.registerTask('default', [
    'exec:build-protobuf',
    'exec:transpile',
    'concat',
    'sass',
    'date',
    'getCommitHash',
  ]);
};
