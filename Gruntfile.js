module.exports = function(grunt) {

  // build the concat config from the preen config
  var components = [];
  for (component in grunt.file.readJSON('bower.json').preen) {
    components.push('bower_components/' + component + '/**/*.js');
  }

  grunt.initConfig({
    concat: {
      components: {
        src: components,
        dest: 'js-deps/bower_components.js',
      },
    },
  });
  grunt.loadNpmTasks('grunt-preen');
  grunt.loadNpmTasks('grunt-contrib-concat');

  grunt.registerTask('default', ['preen', 'concat']);
};
