module.exports = function(grunt) {
  'use strict';

  var bower = grunt.file.readJSON('bower.json');
  var components = [];
  for (var i in bower.concat.app) {
    components.push('components/' + bower.concat.app[i] + '/**/*.js');
  }
  components.push('components/' + 'webaudiorecorder/lib/WebAudioRecorder.js');

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
          'libtextsecure/libsignal-protocol.js',
          'libtextsecure/protocol_wrapper.js',

          'libtextsecure/crypto.js',
          'libtextsecure/storage.js',
          'libtextsecure/storage/user.js',
          'libtextsecure/storage/groups.js',
          'libtextsecure/storage/unprocessed.js',
          'libtextsecure/protobufs.js',
          'libtextsecure/websocket-resources.js',
          'libtextsecure/helpers.js',
          'libtextsecure/stringview.js',
          'libtextsecure/event_target.js',
          'libtextsecure/api.js',
          'libtextsecure/account_manager.js',
          'libtextsecure/message_receiver.js',
          'libtextsecure/outgoing_message.js',
          'libtextsecure/sendmessage.js',
          'libtextsecure/sync_request.js',
          'libtextsecure/contacts_parser.js',
          'libtextsecure/ProvisioningCipher.js',
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
        'js/**/*.js',
        '!js/libtextsecure.js',
        '!js/WebAudioRecorderMp3.js',
        '!js/Mp3LameEncoder.min.js',
        '!js/libsignal-protocol-worker.js',
        '!js/components.js',
        '!js/signal_protocol_store.js',
        '_locales/**/*'
      ],
      options: { jshintrc: '.jshintrc' },
    },
    dist: {
      src: [
        'manifest.json',
        'background.html',
        'index.html',
        'options.html',
        '_locales/**',
        'protos/*',
        'js/**',
        'stylesheets/*.css',
        '!js/register.js'
      ],
      res: [
        'audio/**',
        'images/**/*',
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
                'textsecure-service-ca.whispersystems.org');
            } else if (srcpath.match('expire.js')) {
              var gitinfo = grunt.config.get('gitinfo');
              var commited = gitinfo.local.branch.current.lastCommitTime;
              var time = Date.parse(commited) + 1000 * 60 * 60 * 24 * 90;
              return content.replace(
                /var BUILD_EXPIRATION = 0/,
                "var BUILD_EXPIRATION = " + time
              );
            } else {
              return content;
            }
          }
        }
      }
    },
    jscs: {
      all: {
        src: [
        'Gruntfile',
        'js/**/*.js',
        '!js/libtextsecure.js',
        '!js/WebAudioRecorderMp3.js',
        '!js/Mp3LameEncoder.min.js',
        '!js/libsignal-protocol-worker.js',
        '!js/components.js',
        'test/**/*.js',
        '!test/blanket_mocha.js',
        '!test/test.js',
        ]
      }
    },
    watch: {
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
        tasks: ['copy_dist']
      },
      scripts: {
        files: ['<%= jshint.files %>', './js/**/*.js'],
        tasks: ['jshint']
      },
      style: {
        files: ['<%= jscs.all.src %>', './js/**/*.js'],
        tasks: ['jscs']
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
            { browserName: 'chrome', version: '41' },
          ],
          testname: 'TextSecure-Browser Tests',
          'max-duration': 300,
          statusCheckAttempts: 200
        }
      }
    },
    exec: {
      'tx-pull': {
        cmd: 'tx pull'
      }
    },
    gitinfo: {} // to be populated by grunt gitinfo
  });

  Object.keys(grunt.config.get('pkg').devDependencies).forEach(function(key) {
    if (/^grunt(?!(-cli)?$)/.test(key)) {  // ignore grunt and grunt-cli
      grunt.loadNpmTasks(key);
    }
  });

  // Transifex does not understand placeholders, so this task patches all non-en
  // locales with missing placeholders
  grunt.registerTask('locale-patch', function(){
    var en = grunt.file.readJSON('_locales/en/messages.json');
    grunt.file.recurse('_locales', function(abspath, rootdir, subdir, filename){
      if (subdir === 'en' || filename !== 'messages.json'){
        return;
      }
      var messages = grunt.file.readJSON(abspath);

      for (var key in messages){
        if (en[key] !== undefined && messages[key] !== undefined){
          if (en[key].placeholders !== undefined && messages[key].placeholders === undefined){
            messages[key].placeholders = en[key].placeholders;
          }
        }
      }

      grunt.file.write(abspath, JSON.stringify(messages, null, 4) + '\n');
    });
  });

  grunt.registerTask('tx', ['exec:tx-pull', 'locale-patch']);
  grunt.registerTask('dev', ['default', 'connect', 'watch']);
  grunt.registerTask('test', ['jshint', 'jscs', 'connect', 'saucelabs-mocha']);
  grunt.registerTask('copy_dist', ['gitinfo', 'copy']);
  grunt.registerTask('default', ['concat', 'sass', 'copy_dist']);

};
