#! /usr/bin/env node

var program = require('commander');
var Q = require('q');
var fs = require('fs');
var common = require('./lib/common');
var writers = require('./lib/writers');
var LangAPI = require('./lib/langapi');

program
  .version('1.0.0')
  .usage('[culture] [options]')
  .description('(e.g. \'ru-ru\' run langtool languages to see available. if culture is not specified will default to \'en\')')
  .option('-a, --application [code]', 'Filters sections or translations by application code.', common.collect, [])
  .option('-s, --section [code]', 'Filters translation by section code', common.collect, [])
  .option('-v, --ver [version]', 'Version number to get translations for', /^(\d+\.\d+(\.\d+)?(\.\d+)?(\.\d+)?)$/, '')
  //.option('-l, --language [code]', 'Language code to get translations for. Default \'en\'', /^([a-z]{2}(\-[a-z]{2})?)$/i, 'en')
  .option('-f, --format [fmt]', 'Format to output translations in. Supported formats are: text, json, android, ios. Default \'text\'', /^(text|json|android|ios)$/i, 'text')
  .option('-t, --translated', 'Output translated items only')
  .option('-u, --untranslated', 'Output untranslated items only')
  .option('-p, --placeholders', 'Filters translations to only include strings with format placeholders.', false)
  .option('-o, --output [path]', 'Ouput translations to a file instead of console. If path is omitted, will generate file a name based on application, format and language.')
  .option('-d, --searchDefault [text]', 'Searches translations by default English text containing text')
  .option('-x, --searchTranslated [text]', 'Searches translations by translated text containing text')
  .option('-k, --token [token]', 'API authentication token', '')
  .parse(process.argv);

var languages = program.args;
if (languages.length > 1) {
	common.exitWithError('only one culture at a time can be specified');
}

var language = 'en';
if (languages.length > 0) {
	language = languages[0];
}

if (!/^([a-z]{2}(\-[a-z]{2})?)$/i.test(language)) {
	common.exitWithError(language + ' is not a valid culture code');
}

if (program.application.length === 0 && program.section.length === 0) {
	common.exitWithError('must specify application filter or section filter');
}

if (!program.token) {
	common.exitWithError('must specify API token');
} 

program.format = program.format.toLowerCase();

var langApi = new LangAPI(program.token);

var output = new writers.ConsoleOutput();
  var stream;

  if (program.output) {
    setDefaultTranslationOutputName();

    stream = fs.createWriteStream(program.output);
    output = new writers.FileOutput(stream);
  }

  var writer;

  if (!writers[program.format]) {
    common.exitWithError("unsupported output format " + program.format);
  } else {
    writer = new writers[program.format](output);
  }

  //console.log('getting data from API');

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
    .then(verifyPlaceholdersInTranslation)
    .then(function(data) {
      if (program.placeholders) {
        return data.filter(function(entry) {
          return getPlaceholders(entry).placeholders;
        });
      } else {
        return data;
      }
    })
    .then(function(data) {
      var note;
      if (program.untranslated) {
        note = "Untranslated only";
      } else if (program.translated) {
        note = "Translated only";
      } else {
        note = "Translation and English defaults";
      }

      writer.write(data, note, program);

      if (stream) {
        stream.end();
      }
    })
    .catch(function(error) {
      if (stream) {
        stream.end();
      }

      common.exitWithError(error);
    })
    .done();


function setDefaultTranslationOutputName() {
  if (program.output === true) {
    var name = '';

    for (var i = 0; i < program.application.length; i++) {
      name += '+' + program.application[i];
    };

    for (var i = 0; i < program.section.length; i++) {
      name += '+' + program.section[i];
    };

    if (name.length === 0) {
      name = 'Translations';
    } else {
      name = name.substring(1);
    }

    // construct output name
    switch (program.format) {
      case 'text':              
        program.output = name + '-' + (language || 'en') + '.txt';
        break;

      case 'json':
        program.output = name + '-' + (language || 'en') + '.json';
        break;

      case 'android':
        program.output = name + '-' + (language || 'en') + '.xml';
        break;

      case 'ios':
        program.output = name + '-' + (language || 'en') + '.strings';
        break;

      default:
        common.exitWithError("unsupported output format " + program.format);
    }
  }
}

function verifyPlaceholdersInTranslation(data) {
  for (var i = 0; i < data.length; i++) {
    if (!getPlaceholders(data[i]).ok) {
      throw new Error("some entries had problems in string format placeholders");
    }
  };
  return data;
}

function getPlaceholders(entry) {
  // refer to https://docs.oracle.com/javase/tutorial/essential/io/formatting.html
  // https://developer.apple.com/library/mac/documentation/Cocoa/Conceptual/Strings/Articles/formatSpecifiers.html
  var placeholderRegex = /%(\d+\$)?(\d+)?(\.\d+)?(d|f|n|x|s|@|D|u|U|X|o|O|e|E|g|G|c|C|S|a|A|F)/g;

  var result = {
    placeholders: null,
    matches: null,
    ok: true
  };

  result.placeholders = entry.defaultText.match(placeholderRegex);
  if (result.placeholders) {
    result.matches = entry.text.match(placeholderRegex);
    if (!result.matches) {
      result.ok = false;
      return result;
    }
    
    // ensure the placeholders are the same in English and translation text
    result.ok = result.matches.length == result.placeholders.length;
    return result;
  } else {
    // no format.
    return result;
  }
}

function getTranslationsMap(translations) {
  var translationMap = {};
  for (var i = 0; i < translations.length; i++) {
    translationMap[translations[i].EntryId] = translations[i];
  };

  return translationMap;
}

function missingTranslations(entries, translations) {
  var translationMap = getTranslationsMap(translations);

  return entries.filter(function(entry) {
    return !(translationMap[entry.Id] || false);
  }).map(function(entry) {
    return mapEntry(entry);
  });
}

function translationsOnly(entries, translations) {
  var translationMap = getTranslationsMap(translations);

  return entries.filter(function(entry) {
    return (translationMap[entry.Id] || false);
  }).map(function(entry) {
    return mapEntry(entry, translationMap[entry.Id]);
  });
}

function mergeTranslations(entries, translations) {
  var translationMap = getTranslationsMap(translations);

  return entries.map(function(entry) {
    return mapEntry(entry, translationMap[entry.Id]);
  });
}

function mapEntry(entry, translation) {
  var result = {
      id: entry.Id,
      section: entry.Section,
      code: entry.Code,
      text: entry.Text,
      defaultText: entry.Text,
      notes: entry.Notes,
      context: entry.Context,
      language: 'en'
    };
    if (translation) {
      result.text = translation.Text;
      result.language = translation.Language;
    }
    return result;
}

function entriesPromise() {
  return common.promiseRequest(langApi.entries(program.application, program.section, null, program.ver, program.searchDefault));
}

function translationsPromise() {
  return common.promiseRequest(langApi.translations(language, program.application, program.section, null, program.ver, program.searchDefault, program.searchTranslated));
}