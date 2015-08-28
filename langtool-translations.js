#! /usr/bin/env node

var program = require('commander');
var Q = require('q');
var fs = require('fs');
var common = require('./lib/common');
var formats = require('./lib/formats');
var LangAPI = require('./lib/langapi');

program
  .version(require('./lib/version'))
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
  .option('-o, --output [path]', 'Ouput translations to a file instead of console. If path is omitted, will generate file a name based on application, format and language. Add -h to not ovewrite file when translation has not changed')
  .option('-d, --searchDefault [text]', 'Searches translations by default English text containing text')
  .option('-x, --searchTranslated [text]', 'Searches translations by translated text containing text')
  .option('-h, --hash', 'When -o is used this will check exiting file and only overwrite when translations changed')
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

program.language = language;

if (!/^([a-z]{2}(\-[a-z0-9]{2,3})?)$/i.test(language)) {
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

var output = new formats.ConsoleOutput();
  var stream;

  var writer;
  var format = formats[program.format];

  if (!format) {
    common.exitWithError("unsupported output format " + program.format);
  }

  //console.log('getting data from API');

  Q.all([entriesPromise(), translationsPromise(), languagesPromise()])
    .spread(function(entries, translations, languageMap) {
      //console.log("got it! %j entries, %j translations", entries.length, translations.length);

      program.languageDetail = languageMap[language];

      if (program.untranslated) {
        return missingTranslations(entries, translations);
      } else if (program.translated) {
        return translationsOnly(entries, translations);
      } else {
        return mergeTranslations(entries, translations);
      }
    })
    .then(function(data) {
      if (program.placeholders) {
        return data.filter(function(entry) {
          return getPlaceholders(entry).placeholders;
        });
      } else {
		var failed = data.filter(function(entry) {
	  		return !getPlaceholders(entry).ok;
	  	});
	  	if (failed.length > 0) {
	  		console.log('these entries had problems in string format placeholders');
	  		console.log(failed);
      		common.exitWithError('some entries had problems in string format placeholders');
      	}

        return data;
      }
    })
    .then(function(data) {
      var note;
      if (program.untranslated) {
        note = "Untranslated only";
      } else if (program.translated) {
        note = "Translated only";
      } else if (language == 'en') {
        note = "";
      } else {
        note = "Translation and English defaults";
      }

	  if (program.output) {
	    setDefaultTranslationOutputName();

	    if (program.hash && fs.existsSync(program.output)) {
	    	// outpu exists. check if text has changed
		    var fileContent = fs.readFileSync(program.output, "utf8");
			var hash = format.extractHash(fileContent);

			if (formats.hashTranslations(data) == hash) {
				console.log('Will not output, since strings have not changed in', program.output, '(hash: '+hash+')');
		    	process.exit(0);  
		    }
		}

	    stream = fs.createWriteStream(program.output);
	    output = new formats.FileOutput(stream);	    
	  }

	  writer = new format.writer(output);

      writer.write(data, note, program);

      if (stream) {
        stream.end();
      }
    })
    .catch(function(error) {
      if (stream) {
        stream.end();
      }

      throw error;
      //common.exitWithError(error);
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
      code: entry.Code.replace(' ' , ''),
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

function languagesPromise() {
	return common.promiseRequest(langApi.languages())
  	.then(function(data) {
  		var map = {}
  		for (var i = 0; i < data.length; i++) {
        map[data[i].CultureCode] = data[i];
  		};
      return map;
  	});
}

function entriesPromise() {
	return common.promiseRequest(langApi.entries(program.application, program.section, null, program.ver, program.searchDefault))
  	.then(function(data) {
      	return data.sort(function(a, b) {
      		var result = a.Code.localeCompare(b.Code);
      		if (result === 0) {
      			return a.Section.localeCompare(b.Section);
      		} else {
      			return result;
      		}
      	});
  	});
}

function translationsPromise() {
  return common.promiseRequest(langApi.translations(language, program.application, program.section, null, program.ver, program.searchDefault, program.searchTranslated))
  	.then(function(data) {
  		// remove any translation entries with null text
      	return data.filter(function(entry) {
      		return entry.Text !== null;
      	});
  	});
}