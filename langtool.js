#! /usr/bin/env node

var program = require('commander');

program
  .version(require('./lib/version'))
  //.description('Command line interface to Vista Language API with extra goodness!')
  .command('apps', 'Gets all applications')
  .command('sections [app-codes...]', 'Gets section(s) for one or more applications')
  .command('languages', 'Gets languages')
  .command('translations [culture]', 'Gets translations for specified culture')
  .parse(process.argv);


