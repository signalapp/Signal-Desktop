// Copyright 2014-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

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

  grunt.loadNpmTasks('grunt-sass');

  grunt.initConfig({
    pkg: grunt.file.readJSON('package.json'),
    concat: {
      components: {
        src: components,
        dest: 'js/components.js',
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
          'stylesheets/manifest_bridge.css': 'stylesheets/manifest_bridge.scss',
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
      protobuf: {
        files: ['./protos/SignalService.proto'],
        tasks: ['exec:build-protobuf'],
      },
      sass: {
        files: ['./stylesheets/*.scss', './stylesheets/**/*.scss'],
        tasks: ['sass'],
      },
    },
    exec: {
      'tx-pull-mostly-translated': {
        cmd: 'tx pull --all --use-git-timestamps --minimum-perc=80',
      },
      'tx-pull-any-existing-translation': {
        cmd: 'tx pull --use-git-timestamps',
      },
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

  grunt.registerTask('getExpireTime', () => {
    grunt.task.requires('gitinfo');
    const gitinfo = grunt.config.get('gitinfo');
    const committed = gitinfo.local.branch.current.lastCommitTime;
    const buildCreation = Date.parse(committed);
    const buildExpiration = buildCreation + 1000 * 60 * 60 * 24 * 90;
    grunt.file.write(
      'config/local-production.json',
      `${JSON.stringify({ buildCreation, buildExpiration })}\n`
    );
  });

  grunt.registerTask('clean-release', () => {
    rimraf.sync('release');
    mkdirp.sync('release');
  });

  grunt.registerTask('tx', [
    'exec:tx-pull-mostly-translated',
    'exec:tx-pull-any-existing-translation',
    'locale-patch',
  ]);
  grunt.registerTask('dev', ['default', 'watch']);
  grunt.registerTask('date', ['gitinfo', 'getExpireTime']);
  grunt.registerTask('default', [
    'exec:build-protobuf',
    'exec:transpile',
    'concat',
    'copy:deps',
    'sass',
    'date',
  ]);
};
