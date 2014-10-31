module.exports = function(grunt) {

  var bower = grunt.file.readJSON('bower.json');
  var components = [];
  for (i in bower.concat.app) {
    components.push('components/' + bower.concat.app[i] + '/**/*.js');
  }

  grunt.initConfig({
    concat: {
      components: {
        src: components,
        dest: 'js/components.js',
      },
      test: {
        src: [
          'components/mocha/mocha.js',
          'components/chai/chai.js',
          'test/_test.js'
        ],
        dest: 'test/test.js',
      },
    clean: {
      options: {
          'no-write': false,
          'force': false
      },
      node_modules: ['./node_modules/*', './node_modules/']
    }
    }
  });
  grunt.loadNpmTasks('grunt-preen');
  grunt.loadNpmTasks('grunt-contrib-concat');
  grunt.loadNpmTasks('grunt-contrib-clean');

  grunt.registerTask('default', ['preen', 'concat']);
  grunt.registerTask('setup', ['preen', 'concat', 'clean']);
};
