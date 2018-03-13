var path = require('path');
var packageJson = require('./package.json');

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

  var importOnce = require("node-sass-import-once");
  grunt.loadNpmTasks("grunt-sass");

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
          'libtextsecure/helpers.js',
          'libtextsecure/stringview.js',
          'libtextsecure/event_target.js',
          'libtextsecure/api.js',
          'libtextsecure/account_manager.js',
          'libtextsecure/websocket-resources.js',
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
      options: {
        sourceMap: true,
        importer: importOnce
      },
      dev: {
        files: {
          "stylesheets/manifest.css": "stylesheets/manifest.scss"
        }
      }
    },
    jshint: {
      files: [
        'Gruntfile.js',
        'js/**/*.js',
        '!js/jquery.js',
        '!js/libtextsecure.js',
        '!js/WebAudioRecorderMp3.js',
        '!js/Mp3LameEncoder.min.js',
        '!js/libsignal-protocol-worker.js',
        '!js/components.js',
        '!js/modules/**/*.js',
        '!js/signal_protocol_store.js',
        '_locales/**/*'
      ],
      options: { jshintrc: '.jshintrc' },
    },
    dist: {
      src: [
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
        'images/**/*',
        'fonts/*',
      ]
    },
    copy: {
      deps: {
        files: [{
          src: 'components/mp3lameencoder/lib/Mp3LameEncoder.js',
          dest: 'js/Mp3LameEncoder.min.js'
        }, {
          src: 'components/webaudiorecorder/lib/WebAudioRecorderMp3.js',
          dest: 'js/WebAudioRecorderMp3.js'
        }, {
          src: 'components/jquery/dist/jquery.js',
          dest: 'js/jquery.js'
        }],
      },
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
        '!js/modules/**/*.js',
        'test/**/*.js',
        '!test/blanket_mocha.js',
        '!test/modules/**/*.js',
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
    exec: {
      'tx-pull': {
        cmd: 'tx pull'
      }
    },
    'test-release': {
      osx: {
        archive: 'mac/' + packageJson.productName + '.app/Contents/Resources/app.asar',
        appUpdateYML: 'mac/' + packageJson.productName + '.app/Contents/Resources/app-update.yml',
        exe: 'mac/' + packageJson.productName + '.app/Contents/MacOS/' + packageJson.productName
      },
      mas: {
        archive: 'mas/Signal.app/Contents/Resources/app.asar',
        appUpdateYML: 'mac/Signal.app/Contents/Resources/app-update.yml',
        exe: 'mas/' + packageJson.productName + '.app/Contents/MacOS/' + packageJson.productName
      },
      linux: {
        archive: 'linux-unpacked/resources/app.asar',
        exe: 'linux-unpacked/' + packageJson.name
      },
      win: {
        archive: 'win-unpacked/resources/app.asar',
        appUpdateYML: 'win-unpacked/resources/app-update.yml',
        exe: 'win-unpacked/' + packageJson.productName + '.exe'
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

  grunt.registerTask('getExpireTime', function() {
      grunt.task.requires('gitinfo');
      var gitinfo = grunt.config.get('gitinfo');
      var commited = gitinfo.local.branch.current.lastCommitTime;
      var time = Date.parse(commited) + 1000 * 60 * 60 * 24 * 90;
      grunt.file.write('config/local-production.json',
        JSON.stringify({ buildExpiration: time }) + '\n');
  });

  grunt.registerTask('clean-release', function() {
    require('rimraf').sync('release');
    require('mkdirp').sync('release');
  });

  grunt.registerTask('fetch-release', function() {
    grunt.task.requires('gitinfo');
    require('mkdirp').sync('release');
    var fs = require('fs');
    var done = this.async();
    var gitinfo = grunt.config.get('gitinfo');
    var https = require('https');

    var urlBase = "https://s3-us-west-1.amazonaws.com/signal-desktop-builds";
    var keyBase = 'signalapp/Signal-Desktop';
    var sha = gitinfo.local.branch.current.SHA;
    var files = [{
      zip: packageJson.name + '-' + packageJson.version + '.zip',
      extractedTo: 'linux'
    }];

    var extract = require('extract-zip');
    var download = function(url, dest, extractedTo, cb) {
        var file = fs.createWriteStream(dest);
        var request = https.get(url, function(response) {
          if (response.statusCode !== 200) {
            cb(response.statusCode);
          } else {
            response.pipe(file);
            file.on('finish', function() {
              file.close(function() {
                extract(dest, {dir: path.join(__dirname, 'release', extractedTo)}, cb);
              });
            });
          }
        }).on('error', function(err) { // Handle errors
          fs.unlink(dest); // Delete the file async. (But we don't check the result)
          if (cb) cb(err.message);
        });
    };

    Promise.all(files.map(function(item) {
      var key = [ keyBase, sha, 'dist', item.zip].join('/');
      var url = [urlBase, key].join('/');
      var dest = 'release/' + item.zip;
      return new Promise(function(resolve) {
        console.log(url);
        download(url, dest, item.extractedTo, function(err) {
          if (err) {
            console.log('failed', dest, err);
            resolve(err);
          } else {
            console.log('done', dest);
            resolve();
          }
        });
      });
    })).then(function(results) {
      results.forEach(function(error) {
        if (error) {
          grunt.fail.warn('Failed to fetch some release artifacts');
        }
      });
      done();
    });
  });

  function runTests(environment, cb) {
    var failure;
    var Application = require('spectron').Application;
    var electronBinary = process.platform === 'win32' ? 'electron.cmd' : 'electron';
    var app = new Application({
      path: path.join(__dirname, 'node_modules', '.bin', electronBinary),
      args: [path.join(__dirname, 'main.js')],
      env: {
        NODE_ENV: environment
      }
    });

    function getMochaResults() {
      return window.mochaResults;
    }

    app.start().then(function() {
      return app.client.waitUntil(function() {
        return app.client.execute(getMochaResults).then(function(data) {
          return Boolean(data.value);
        });
      }, 10000, 'Expected to find window.mochaResults set!');
    }).then(function() {
      return app.client.execute(getMochaResults);
    }).then(function(data) {
      var results = data.value;
      if (results.failures > 0) {
        console.error(results.reports);
        failure = function() {
          grunt.fail.fatal('Found ' + results.failures + ' failing unit tests.');
        };
        return app.client.log('browser');
      } else {
        grunt.log.ok(results.passes + ' tests passed.');
      }
    }).then(function(logs) {
      if (logs) {
        console.error();
        console.error('Because tests failed, printing browser logs:');
        console.error(logs);
      }
    }).catch(function (error) {
      failure = function() {
        grunt.fail.fatal('Something went wrong: ' + error.message + ' ' + error.stack);
      };
    }).then(function () {
      // We need to use the failure variable and this early stop to clean up before
      // shutting down. Grunt's fail methods are the only way to set the return value,
      // but they shut the process down immediately!
      return app.stop();
    }).then(function() {
      if (failure) {
        failure();
      }
      cb();
    }).catch(function (error) {
      console.error('Second-level error:', error.message, error.stack);
      if (failure) {
        failure();
      }
      cb();
    });
  }

  grunt.registerTask('unit-tests', 'Run unit tests w/Electron', function() {
    var environment = grunt.option('env') || 'test';
    var done = this.async();

    runTests(environment, done);
  });

  grunt.registerTask('lib-unit-tests', 'Run libtextsecure unit tests w/Electron', function() {
    var environment = grunt.option('env') || 'test-lib';
    var done = this.async();

    runTests(environment, done);
  });

  grunt.registerMultiTask('test-release', 'Test packaged releases', function() {
      var dir = grunt.option('dir') || 'dist';
      var environment = grunt.option('env') || 'production';
      var asar = require('asar');
      var config = this.data;
      var archive = [dir, config.archive].join('/');
      var files = [
        'config/default.json',
        'config/' + environment + '.json',
        'config/local-' + environment + '.json'
      ];

      console.log(this.target, archive);
      var releaseFiles = files.concat(config.files || []);
      releaseFiles.forEach(function(fileName) {
        console.log(fileName);
        try {
          asar.statFile(archive, fileName);
          return true;
        } catch (e) {
          console.log(e);
          throw new Error("Missing file " + fileName);
        }
      });

      if (config.appUpdateYML) {
        var appUpdateYML = [dir, config.appUpdateYML].join('/');
        if (require('fs').existsSync(appUpdateYML)) {
          console.log("auto update ok");
        } else {
          throw new Error("Missing auto update config " + appUpdateYML);
        }
      }

      var done = this.async();
      // A simple test to verify a visible window is opened with a title
      var Application = require('spectron').Application;
      var assert = require('assert');

      var app = new Application({
        path: [dir, config.exe].join('/')
      });

      app.start().then(function () {
        return app.client.getWindowCount();
      }).then(function (count) {
        assert.equal(count, 1);
        console.log('window opened');
      }).then(function () {
        // Get the window's title
        return app.client.getTitle();
      }).then(function (title) {
        // Verify the window's title
        assert.equal(title, packageJson.productName);
        console.log('title ok');
      }).then(function () {
        assert(app.chromeDriver.logLines.indexOf('NODE_ENV ' + environment) > -1);
        console.log('environment ok');
      }).then(function () {
        // Successfully completed test
        return app.stop();
      }, function (error) {
        // Test failed!
        return app.stop().then(function() {
          grunt.fail.fatal('Test failed: ' + error.message + ' ' + error.stack);
        });
      }).then(done);
  });

  grunt.registerTask('tx', ['exec:tx-pull', 'locale-patch']);
  grunt.registerTask('dev', ['default', 'watch']);
  grunt.registerTask('test', ['jshint', 'jscs', 'unit-tests', 'lib-unit-tests']);
  grunt.registerTask('copy_dist', ['gitinfo', 'copy:res', 'copy:src']);
  grunt.registerTask('date', ['gitinfo', 'getExpireTime']);
  grunt.registerTask('prep-release', ['gitinfo', 'clean-release', 'fetch-release']);
  grunt.registerTask('default', ['concat', 'copy:deps', 'sass', 'date']);
};
