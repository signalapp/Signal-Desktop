'use strict';
var child_process = require('child_process');
var util = require('util');

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
      },
      curve25519: {
        src: [
          'build/curve25519_compiled.js',
          'build/curve25519.js',
        ],
        dest: 'js/curve25519_compiled.js',
        options: {
          banner: ';(function(){\n',
          footer: '\n})();'
        }
      }
    },
    sass: {
        stylesheets: {
            files: {
                'stylesheets/manifest.css': 'stylesheets/manifest.scss'
            }
        }
    },
    compile: {
        curve25519_compiled: {
            src_files: [
              'nacl/ed25519/additions/*.c',
              'nacl/curve25519-donna.c',
              'nacl/ed25519/*.c',
              'nacl/ed25519/sha512/sha2big.c'
            ],
            methods: [
              'curve25519_donna',
              'curve25519_sign',
              'curve25519_verify',
              'crypto_sign_ed25519_ref10_ge_scalarmult_base',
              'sph_sha512_init',
              'malloc'
            ]
        }
    }
  });
  grunt.loadNpmTasks('grunt-preen');
  grunt.loadNpmTasks('grunt-contrib-concat');
  grunt.loadNpmTasks('grunt-contrib-sass');

  grunt.registerMultiTask('compile', 'Compile the C libraries with emscripten.', function() {
      var callback = this.async();
      var outfile = 'build/' + this.target + '.js';

      var exported_functions = this.data.methods.map(function(name) {
        return "'_" + name + "'";
      });
      var flags = [
          '-O2',
          '-Qunused-arguments',
          '-o',  outfile,
          '-Inacl/ed25519/nacl_includes -Inacl/ed25519 -Inacl/ed25519/sha512',
          '-s', "EXPORTED_FUNCTIONS=\"[" + exported_functions.join(',') + "]\""];
      var command = [].concat('emcc', this.data.src_files, flags).join(' ');
      grunt.log.writeln('Compiling via emscripten to ' + outfile);

      var exitCode = 0;
      grunt.verbose.subhead(command);
      grunt.verbose.writeln(util.format('Expecting exit code %d', exitCode));

      var child = child_process.exec(command);
      child.stdout.on('data', function (d) { grunt.log.write(d); });
      child.stderr.on('data', function (d) { grunt.log.error(d); });
      child.on('exit', function(code) {
        if (code !== exitCode) {
          grunt.log.error(util.format('Exited with code: %d.', code));
          return callback(false);
        }

        grunt.verbose.ok(util.format('Exited with code: %d.', code));
        callback(true);
      });
  });

  grunt.registerTask('default', ['preen', 'concat', 'sass']);
  grunt.registerTask('build', ['compile', 'concat:curve25519']);
};
