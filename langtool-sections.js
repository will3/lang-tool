#! /usr/bin/env node

var program = require('commander');
var common = require('./lib/common');
var LangAPI = require('./lib/langapi');

program
  .version(require('./lib/version'))
  .usage('[app-codes...] [options]')
  //.option('-a, --application [code]', 'Filters sections or translations by application code.', collect, [])
  .option('-k, --token [token]', 'API authentication token', '')
  .parse(process.argv);

var apps = program.args;

if (apps.length === 0) {
	common.exitWithError('must specify at least one application code');
} else if (!program.token) {
	common.exitWithError('must specify API token');
} else {	

	var langApi = new LangAPI(program.token);

	langApi.sections(apps).on('complete', function(data) {
	  console.log(data);
	}).on('error', function(error) {
		common.exitWithError(error);
	});
	  
}