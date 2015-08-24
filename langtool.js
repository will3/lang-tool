var program = require('commander');
var Q = require('q');


var LangAPI = require('./langapi');

var langApi;

var writers = require('./writers');

function list(val) {
  return val.split(',');
}
 
function collect(val, memo) {
  memo.push(val);
  return memo;
}

program
  .version('1.0.0')
  .command('apps', 'Gets application(s)')
  .command('sections [options]', 'Gets section(s)')
  .command('languages', 'Gets languages')
  .option('-a, --application [code]', 'Filters by application code', collect, [])
  .option('-s, --section [code]', 'Filters by section code', collect, [])
  .option('-v, --ver [version]', 'Version number to get entries for', /^(\d+\.\d+(\.\d+)?(\.\d+)?(\.\d+)?)$/, '')
  .option('-l, --language [code]', 'Language code to get translations for', /^([a-z]{2}(\-[a-z]{2})?)$/i, 'en')
  .option('-f, --format [fmt]', 'Format to output translations', /^(text|json|android|ios)$/i, 'text')
  .option('-t, --translated', 'Output translated items only')
  .option('-u, --untranslated', 'Output untranslated items only')
  .option('-p, --placeholders', 'Checks that the format placeholders are valid')
  .option('-o, --output [file]', 'Write output to a file')
  .option('-k, --token [token]', 'API authentication token', '')
  .action(function(cmd){
    
    if (program.translated && program.untranslated) {
      exitWithError('can only use one of translated or untranslated options at a time');
    }

    if (!program.token) {
      exitWithError('must specify API token');
    }

    langApi = new LangAPI(program.token);

    /*console.log('')
    console.log('program.application:',program.application);
    console.log('program.section:',program.section);
    console.log('program.ver',program.ver);
    console.log('program.format',program.format);
    console.log('')*/
  })
  .action(function(cmd){
    switch(cmd) {
      case "applications":
      case "apps":
        langApi.applications().on('complete', function(data) {
          console.log(data);
        });
        break;

      case "sections":
        if (program.application.length === 0) {
          exitWithError('must specify application filter');
        } else {
          langApi.sections(program.application).on('complete', function(data) {
            console.log(data);
          });
        }
        break;

      case "languages":
        langApi.languages().on('complete', function(data) {
          console.log(data);
        });
        break;

      case "entries":
        if (program.application.length === 0 && program.section.length === 0) {
          exitWithError('must specify application filter or section filter');
        } else {
          langApi.entries(program.application, program.section, null, program.ver).on('complete', function(data) {
            console.log('got %j entries', data.length);
          });
        }
        break;

      case "translations":
        if (program.application.length === 0 && program.section.length === 0) {
          exitWithError('must specify application filter or section filter');
        } else {

          var writer;

          if (!writers[program.format]) {
            exitWithError("unsupported translation format " + program.format);
          } else {
            writer = new writers[program.format]();
          }

          /*langApi.translations(program.language, program.application, program.section, null, program.ver).on('complete', function(data) {
            console.log('got %j translations', data.length);
          });*/

          Q.all([entriesPromise(), translationsPromise()])
            .spread(function(entries, translations) {
              //console.log("got it! %j entries, %j translations", entries.length, translations.length);
              if (program.untranslated) {
                return missingTranslations(entries, translations);
              } else if (program.translated) {
                return translationsOnly(entries, translations);
              } else {
                return mergeTranslations(entries, translations);
              }
            })
            .then(function(data) {
              var failedItems = [];
              if (program.placeholders) {
                for (var i = 0; i < data.length; i++) {
                  if (!verifyPlaceholders(data[i])) {
                    failedItems.push(data[i]);
                  }
                };
              }
              if (failedItems.length > 0) {
                throw new Error("some entries had problems in string format placeholders");
              }
              return data;
            })
            .then(function(data) {
              var note;
              if (program.untranslated) {
                note = "Untranslated only";
              } else if (program.translated) {
                note = "Translated only";
              } else {
                note = "Translation and Egnlish defaults";
              }

              writer.write(data, note, program);
            })
            .catch(function(error) {
              //throw new error;
              exitWithError(error);
            })
            .done();
        }
        break;

      default:
        exitWithError("unknown command " + cmd);
    }
  })
  .parse(process.argv);

function exitWithError(error) {
  program.outputHelp();
  if (error.Message) {
    console.error('Error:', error.Message);
  } else {
    console.error('Error:', error);
  }
  process.exit(1);  
}

function verifyPlaceholders(entry) {
  var placeholderRegex = /%()(s|f)/g;

  //entry.defaultText = 'first %s second %s';

  var matches = entry.defaultText.match(placeholderRegex);
  if (matches) {
    //console.log("entry %j has format", entry.code);
    //console.log(entry, matches);
    var translatedMatches = entry.text.match(placeholderRegex);
    if (!translatedMatches)
      return false;
    // ensure the placeholders are the same in English and translation text
    return translatedMatches.length == matches.length;
  } {
    // no format.
    return true;
  }
}

function missingTranslations(entries, translations) {
  var translationMap = {};
  for (var i = 0; i < translations.length; i++) {
    translationMap[translations[i].EntryId] = translations[i];
  };

  var result = [];

  return entries.filter(function(entry) {
    return !(translationMap[entry.Id] || false);
  }).map(function(entry) {
    return mapEntry(entry);
  });
}

function translationsOnly(entries, translations) {
  var translationMap = {};
  for (var i = 0; i < translations.length; i++) {
    translationMap[translations[i].EntryId] = translations[i];
  };

  var result = [];

  return entries.filter(function(entry) {
    return (translationMap[entry.Id] || false);
  }).map(function(entry) {
    var result = mapEntry(entry);
    result.text = translationMap[entry.Id].Text;
    result.language = translationMap[entry.Id].Language;
    return result;
  });
}

function mergeTranslations(entries, translations) {
  var translationMap = {};
  for (var i = 0; i < translations.length; i++) {
    translationMap[translations[i].EntryId] = translations[i];
  };
  return entries.map(function(entry) {
    var result = mapEntry(entry);

    if (translationMap[entry.Id]) {
      result.text = translationMap[entry.Id].Text;
      result.language = translationMap[entry.Id].Language;
    }
    return result;
  });
}

function mapEntry(entry, language) {
  return {
      id: entry.Id,
      section: entry.Section,
      code: entry.Code,
      text: entry.Text,
      defaultText: entry.Text,
      notes: entry.Notes,
      context: entry.Context,
      language: language || 'en'
    };
}

function entriesPromise() {
  return promiseRequest(langApi.entries(program.application, program.section, null, program.ver));
}

function translationsPromise() {
  return promiseRequest(langApi.translations(program.language, program.application, program.section, null, program.ver));
}

function promiseRequest(request) {
  var deferred = Q.defer();

  request.on('complete', function(data, response) {
    if (response.statusCode == 200) {
      deferred.resolve(data);
    } else {
      deferred.reject(data);
    }
  }).on('error', function(err) {
    deferred.reject(data);
  });

  return deferred.promise;
}