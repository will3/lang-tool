var crypto = require('crypto');
var Entities = require('html-entities').XmlEntities;

function ConsoleOutput() {
  this.write = function(text) {
    console.log(text);
  }
}

function FileOutput(stream) {
  this.write = function(text) {
    stream.write(text);
    stream.write('\n');
  }
}

function CompositeOutput() {
  this.write = function(text) {
    for (var i = 0; i < arguments.length; i++) {
      arguments[i].write(text);
    };
  }
}

function reconstructCommandLine(program) {
  var options = program.rawArgs;

  options.splice(0, 2);

  return 'langtool translations ' + options.join(' ');
}

var textFormat = {
  writer: function(output) {
    if (!output || !output.write)
      throw new Error('Must specify ouput');

    this.write = function(data, note, program) {
      //output.write(program.rawArgs);
      var lang = program.languageDetail;
      output.write('Translation to ' + lang.Name + ' (' + program.language + ').');
      output.write('Command: ' + reconstructCommandLine(program));
      output.write(note);
      output.write('Hash: ' + hashTranslations(data));
      output.write('');
      for (var i = 0; i < data.length; i++) {
        output.write(data[i].code + '\t' + data[i].text);
      }
      console.log('');
      console.log(data.length + ' items written');
    };
  },

  extractHash: function(content) {
    var regex = /Hash\: ([0-9a-f]+)/i;
    var matches = content.match(regex);
    if (!matches)
      return null;
    return matches[1];
  }
};

var jsonFormat = {
  writer: function(output) {
    if (!output || !output.write)
      throw new Error('Must specify ouput');

    this.write = function(data, note, program) {
      var lang = program.languageDetail;

      var json = {
        culture: program.language,
        language: lang.Name,
        dateGenerated: new Date(),
        generator: 'langtool-node '+program.version(),
        command: reconstructCommandLine(program),
        note: note,
        hash: hashTranslations(data),
        data: data
      }
      output.write(JSON.stringify(json, null, 2));
      //console.log('');
      //console.log(data.length + ' items written');
    };
  },

  extractHash: function(content) {
    if (!content)
      return null;
    var json = JSON.parse(content);
    if (!json)
      return null;
    return json.hash;
  }
}

var androidFormat = {
  writer: function(output) {
    if (!output || !output.write)
      throw new Error('Must specify ouput');

    this.write = function(data, note, program) {
      var lang = program.languageDetail;

      var entities = new Entities();

      output.write('<?xml version="1.0" encoding="utf-8" standalone="yes"?>');
      output.write('<resources ');
      output.write('  culture="' + program.language + '"');
      output.write('  language="' + lang.Name + '"');
      output.write('  generator="langtool-node '+program.version() + '"');
      output.write('  command="' + entities.encode(reconstructCommandLine(program)) + '"');
      output.write('  utcdategenerated="' + new Date().toISOString() + '"');
      output.write('  note="' + entities.encode(note) + '"');
      output.write('  hash="' + hashTranslations(data) + '"');
      output.write('>');

      for (var i = 0; i < data.length; i++) {
        var entry = data[i];
        var comment = '';
        if (entry.comment) {
          comment = entry.comment;
        }

        if (entry.note) {
          if (comment)
            comment += '.  ';
          comment = entry.note;
        }

        output.write('  <string name="' + entry.code + '" comment="' + entities.encode(comment) + '" section="' + entry.section + '">"' + entry.text.replace('\'', '\\\'') + '"</string>');
      }

      output.write('</resources>');
    };
  },

  extractHash: function(content) {
    var regex = /hash=\"([0-9a-f]+)\"/i;
    var matches = content.match(regex);
    if (!matches)
      return null;
    return matches[1];
  }
}

var iosFormat = {
  writer: function(output) {
    if (!output || !output.write)
      throw new Error('Must specify ouput');

    this.write = function(data, note, program) {
      var lang = program.languageDetail;

      //output.write('/* Translation to ' + lang.Name + ' (' + program.language + ') for apps ' + JSON.stringify(program.application) + ', sections ' + JSON.stringify(program.section) + ' */');
      output.write('/* Last Update: ' + new Date().toLocaleString() + ' */');
      output.write('/* By: langtool-node ' + program.version() + ' */');
      output.write('/* Command: ' + reconstructCommandLine(program) + ' */');
      output.write('/* Culture: ' + program.language + ' */');
      output.write('/* Language: ' + lang.Name + ' */');
      output.write('/* ' + note + ' */');
      output.write('/* Hash: ' + hashTranslations(data) + ' */');
      output.write('');
      for (var i = 0; i < data.length; i++) {
        var entry = data[i];

        var comment = '';
        if (entry.comment) {
          comment = entry.comment;
        }

        if (entry.note) {
          if (comment)
            comment += '.  ';
          comment = entry.note;
        }

        output.write('/* Section: ' + entry.section + '. Comment: ' + comment + '*/');
        output.write('"' + entry.code + '" = ' + JSON.stringify(entry.text) + ';');
      }
    };
  }, 

  extractHash: function(content) {
    var regex = /Hash: ([0-9a-f]+)/i;
    var matches = content.match(regex);
    if (!matches)
      return null;
    return matches[1];
  }
}

/**
 Creates a hash of entry keys and text. Can be used to detect if any text has changed.
*/
function hashTranslations(data) {
  var md5sum = crypto.createHash('md5');
  for (var i = 0; i < data.length; i++) {
    var entry = data[i];
    md5sum.update(entry.code);
    if (entry.text) {
      md5sum.update(entry.text);
    }
  };
  return md5sum.digest('hex');
}

module.exports = {
  ConsoleOutput: ConsoleOutput,
  FileOutput: FileOutput,
  CompositeOutput: CompositeOutput,
  text: textFormat,
  json: jsonFormat,
  android: androidFormat,
  ios: iosFormat,
  hashTranslations: hashTranslations
}