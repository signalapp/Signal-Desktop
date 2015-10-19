var child_process = require('child_process');
var util = require('util');

module.exports = function(grunt) {
  'use strict';

  var bower = grunt.file.readJSON('bower.json');
  var components = [];
  for (var i in bower.concat.app) {
    components.push('components/' + bower.concat.app[i] + '/**/*.js');
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
      libtextsecurecomponents: {
        src: libtextsecurecomponents,
        dest: 'libtextsecure/components.js',
      },
      test: {
        src: [
          'components/mocha/mocha.js',
          'components/chai/chai.js',
          'test/_test.js'
        ],
        dest: 'test/test.js',
      },
      //TODO: Move errors back down?
      libtextsecure: {
        options: {
          banner: ";(function() {\n",
          footer: "})();\n",
        },
        src: [
          'libtextsecure/errors.js',
          'libtextsecure/libaxolotl.js',
          'libtextsecure/axolotl_wrapper.js',

          'libtextsecure/crypto.js',
          'libtextsecure/storage.js',
          'libtextsecure/storage/user.js',
          'libtextsecure/storage/devices.js',
          'libtextsecure/storage/groups.js',
          'libtextsecure/protobufs.js',
          'libtextsecure/websocket-resources.js',
          'libtextsecure/helpers.js',
          'libtextsecure/stringview.js',
          'libtextsecure/api.js',
          'libtextsecure/account_manager.js',
          'libtextsecure/message_receiver.js',
          'libtextsecure/sendmessage.js',
          'libtextsecure/contacts_parser.js',
        ],
        dest: 'js/libtextsecure.js',
      },
      libtextsecuretest: {
        src: [
          'components/jquery/dist/jquery.js',
          'components/mock-socket/dist/mock-socket.js',
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
                'stylesheets/manifest.css': 'stylesheets/manifest.scss',
                'stylesheets/options.css': 'stylesheets/options.scss'
            }
        }
    },
    jshint: {
      files: [
        'Gruntfile.js',
        'js/background.js',
        'js/chromium.js',
        'js/bimap.js',
        'js/conversation_panel.js',
        'js/database.js',
        'js/inbox_controller.js',
        'js/index.js',
        'js/libphonenumber-util.js',
        'js/options.js',
        'js/panel_controller.js',
        'js/models/*.js',
        'js/views/*.js',
      ],
      options: { jshintrc: '.jshintrc' },
    },
    dist: {
      src: [
        'manifest.json',
        'background.html',
        'index.html',
        'conversation.html',
        'options.html',
        'protos/*',
        'js/**',
        'stylesheets/*.css',
        '!js/register.js'
      ],
      res: [
        'images/**',
        'fonts/*',
      ]
    },
    copy: {
      res: {
        files: [{ expand: true, dest: 'dist/', src: ['<%= dist.res %>'] }],
      },
      src: {
        files: [{ expand: true, dest: 'dist/', src: ['<%= dist.src %>'] }],
        options: {
          process: function(content, srcpath) {
            if (srcpath.match('background.js')) {
              return content.replace(
                /textsecure-service-staging.whispersystems.org/g,
                'textsecure-service-ca.whispersystems.org:4433');
            } else {
              return content;
            }
          }
        }
      }
    },
    jscs: {
      all: {
        src: ['js/**/*.js', '!js/libtextsecure.js', '!js/libaxolotl-worker.js', '!js/components.js', 'test/**/*.js']
      }
    },
    watch: {
      scripts: {
        files: ['<%= jshint.files %>', './js/**/*.js'],
        tasks: ['jshint']
      },
      sass: {
        files: ['./stylesheets/*.scss'],
        tasks: ['sass']
      },
      libtextsecure: {
        files: ['./libtextsecure/*.js', './libtextsecure/storage/*.js'],
        tasks: ['concat:libtextsecure']
      },
      dist: {
        files: ['<%= dist.src %>', '<%= dist.res %>'],
        tasks: ['copy']
      },
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
          urls: [
            'http://127.0.0.1:9999/test/index.html',
            'http://127.0.0.1:9999/libtextsecure/test/index.html',
          ],
          build: process.env.TRAVIS_JOB_ID,
          browsers: [
            { browserName: 'chrome', version: '40' },
            { platform: 'linux', browserName: 'firefox', version: '34' }
          ],
          testname: 'TextSecure-Browser Tests',
          'max-duration': 300,
          statusCheckAttempts: 200
        }
      }
    },
  });

  Object.keys(grunt.config.get('pkg').devDependencies).forEach(function(key) {
    if (/^grunt(?!(-cli)?$)/.test(key)) {  // ignore grunt and grunt-cli
      grunt.loadNpmTasks(key);
    }
  });

  grunt.registerTask('dev', ['default', 'connect', 'watch']);
  grunt.registerTask('test', ['jshint', 'jscs', 'connect', 'saucelabs-mocha']);
  grunt.registerTask('default', ['concat', 'sass', 'copy']);

};
