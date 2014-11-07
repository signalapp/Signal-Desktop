'use strict';

module.exports = function(grunt) {

  var bower = grunt.file.readJSON('bower.json');
  var components = [];
  for (var i in bower.concat.app) {
    components.push('components/' + bower.concat.app[i] + '/**/*.js');
  }

  grunt.initConfig({
    concat: {
      components: {
        src: components,
        dest: 'js/components.js',
      },
      cryptojs: {
        src: [
          "components/cryptojs/src/core.js",
          "components/cryptojs/src/sha256.js",
          "components/cryptojs/src/hmac.js",
          "components/cryptojs/src/enc-base64.js",
          "components/cryptojs/src/md5.js",
          "components/cryptojs/src/evpkdf.js",
          "components/cryptojs/src/cipher-core.js",
          "components/cryptojs/src/aes.js"
        ],
        dest: 'js-deps/CryptoJS.js'
      },
      test: {
        src: [
          'components/mocha/mocha.js',
          'components/chai/chai.js',
          'test/_test.js'
        ],
        dest: 'test/test.js',
      }
    },
    sass: {
        stylesheets: {
            files: {
                'stylesheets/manifest.css': 'stylesheets/manifest.scss'
            }
        }
    }
  });
  grunt.loadNpmTasks('grunt-preen');
  grunt.loadNpmTasks('grunt-contrib-concat');
  grunt.loadNpmTasks('grunt-contrib-sass');


  grunt.registerTask('default', ['preen', 'concat', 'sass']);
};
