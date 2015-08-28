#! /usr/bin/env node

var program = require('commander');
var common = require('./lib/common');
var LangAPI = require('./lib/langapi');

program
  .version(require('./lib/version'))
  //.usage('[options]')
  .option('-k, --token [token]', 'API authentication token', '')
  .parse(process.argv);

if (!program.token) {
  common.exitWithError('must specify API token');
} else {

  var langApi = new LangAPI(program.token);

  langApi.languages().on('complete', function(data) {
    console.log(data);
  }).on('error', function(error) {
    common.exitWithError(error);
  });

}