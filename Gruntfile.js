const importOnce = require('node-sass-import-once');
const sass = require('node-sass');

/* eslint-disable more/no-then, no-console  */

module.exports = grunt => {
  grunt.loadNpmTasks('grunt-sass');

  grunt.initConfig({
    pkg: grunt.file.readJSON('package.json'),
    sass: {
      options: {
        implementation: sass,
        sourceMap: true,
        importer: importOnce,
      },

      dist: {
        files: {
          'stylesheets/manifest.css': 'stylesheets/manifest.scss',
        },
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
    const environment = process.env.SIGNAL_ENV || 'production';
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

  grunt.registerTask('getCommitHash', () => {
    grunt.task.requires('gitinfo');
    const gitinfo = grunt.config.get('gitinfo');
    const hash = gitinfo.local.branch.current.SHA;
    updateLocalConfig({ commitHash: hash });
  });

  grunt.registerTask('date', ['gitinfo']);
  grunt.registerTask('default', [
    'exec:build-protobuf',
    'sass',
    'exec:transpile',
    'date',
    'getCommitHash',
  ]);
};
