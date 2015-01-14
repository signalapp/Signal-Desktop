var child_process = require('child_process');
var util = require('util');

module.exports = function(grunt) {
  'use strict';

  var bower = grunt.file.readJSON('bower.json');
  var components = [];
  for (var i in bower.concat.app) {
    components.push('components/' + bower.concat.app[i] + '/**/*.js');
  }

  var libaxolotlcomponents = [];
  for (i in bower.concat.libaxolotl) {
    libaxolotlcomponents.push('components/' + bower.concat.libaxolotl[i] + '/**/*.js');
  }

  var libtextsecurecomponents = [];
  for (i in bower.concat.libtextsecure) {
    libtextsecurecomponents.push('components/' + bower.concat.libtextsecure[i] + '/**/*.js');
  }

  grunt.initConfig({
    pkg: grunt.file.readJSON('package.json'),
    concat: {
      components: {
        src: components,
        dest: 'js/components.js',
      },
      libaxolotlcomponents: {
        src: libaxolotlcomponents,
        dest: 'libaxolotl/components.js',
      },
      libtextsecurecomponents: {
        src: libtextsecurecomponents,
        dest: 'libtextsecure/components.js',
      },
      curve25519: {
        src: [
          'build/curve25519_compiled.js',
          'build/curve25519.js',
        ],
        dest: 'libaxolotl/curve25519_concat.js',
        options: {
          banner: ';(function(){\n',
          footer: '\n})();'
        }
      },
      webcrypto: {
        src: [
          'components/cryptojs/src/core.js',
          'components/cryptojs/src/sha256.js',
          'components/cryptojs/src/hmac.js',
          'components/cryptojs/src/enc-base64.js',
          'components/cryptojs/src/md5.js',
          'components/cryptojs/src/evpkdf.js',
          'components/cryptojs/src/cipher-core.js',
          'components/cryptojs/src/aes.js',
          'build/webcrypto.js'
        ],
        dest: 'libaxolotl/webcrypto_concat.js',
        options: {
          banner: ';(function(){\n',
          footer: '\n})();'
        }
      },
      test: {
        src: [
          'components/mocha/mocha.js',
          'components/chai/chai.js',
          'test/_test.js'
        ],
        dest: 'test/test.js',
      },
      libaxolotl: {
        src: [
          'libaxolotl/curve25519_concat.js',
          'libaxolotl/webcrypto_concat.js',
          'libaxolotl/components.js',

          'libaxolotl/groups_storage.js',
          'libaxolotl/crypto.js',
          'libaxolotl/protocol.js',
        ],
        dest: 'libtextsecure/libaxolotl_concat.js',
      },
      libtextsecure: {
        src: [
          'libtextsecure/axolotl_wrapper.js',
          'libtextsecure/libaxolotl_concat.js',

          'libtextsecure/storage.js',
          'libtextsecure/storage/devices.js',
          'libtextsecure/protobufs.js',
          'libtextsecure/websocket.js',
          'libtextsecure/websocket-resources.js',
          'libtextsecure/helpers.js',
          'libtextsecure/errors.js',
          'libtextsecure/stringview.js',
          'libtextsecure/api.js',
          'libtextsecure/sendmessage.js',
        ],
        dest: 'js/libtextsecure.js',
      },
      libtextsecuretest: {
        src: [
          'components/mocha/mocha.js',
          'components/chai/chai.js',
          'libtextsecure/test/_test.js'
        ],
        dest: 'libtextsecure/test/test.js',
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
              'native/ed25519/additions/*.c',
              'native/curve25519-donna.c',
              'native/ed25519/*.c',
              'native/ed25519/sha512/sha2big.c'
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
    },
    jshint: {
      files: ['Gruntfile.js'],  // add 'src/**/*.js', 'test/**/*.js'
      options: { jshintrc: '.jshintrc' },
    },
    jscs: {
      all: {
        src: ['js/**/*.js', '!js/components.js', 'test/**/*.js']
      }
    },
    watch: {
      files: ['<%= jshint.files %>'],
      tasks: ['jshint']
    },
    connect: {
      server: {
        options: {
          base: '.',
          port: 9999
        }
      }
    },
    'saucelabs-mocha': {
      all: {
        options: {
          urls: ['http://127.0.0.1:9999/test/index.html', 'http://127.0.0.1:9999/libtextsecure/test/index.html'],
          build: process.env.TRAVIS_JOB_ID,
          browsers: [{ browserName: 'chrome', version: '38' }, { browserName: 'firefox', version: '34' }],
          testname: 'TextSecure-Browser Tests'
        }
      }
    }
  });

  Object.keys(grunt.config.get('pkg').devDependencies).forEach(function(key) {
    if (/^grunt(?!(-cli)?$)/.test(key)) {  // ignore grunt and grunt-cli
      grunt.loadNpmTasks(key);
    }
  });

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
          '-Inative/ed25519/nacl_includes -Inative/ed25519 -Inative/ed25519/sha512',
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

  grunt.registerTask('dev', ['connect', 'watch']);
  grunt.registerTask('test', ['jshint', 'jscs', 'connect', 'saucelabs-mocha']);
  grunt.registerTask('default', ['preen', 'concat', 'sass']);
  grunt.registerTask('build', ['compile', 'concat:curve25519', 'concat:libtextsecure']);

};
