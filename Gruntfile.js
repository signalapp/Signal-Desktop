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
      }
    }
  });
  grunt.loadNpmTasks('grunt-preen');
  grunt.loadNpmTasks('grunt-contrib-concat');

  grunt.registerTask('default', ['preen', 'concat']);
};
