var builder = require('xmlbuilder');
var crypto = require('crypto');

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

var textFormat = {
  writer: function(output) {
    if (!output || !output.write)
      throw new Error('Must specify ouput');

    this.write = function(data, note, program) {
      //output.write(program.rawArgs);
      output.write('Translation to ' + program.language + ' for apps ' + JSON.stringify(program.application) + ', sections ' + JSON.stringify(program.section));
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
      var json = {
        dateGenerated: new Date(),
        culture: program.language,
        apps: program.application,
        sections: program.section,
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
      var root = builder.create('resources');
      root.comment('Last Update: ' + new Date().toLocaleString());
      root.comment('By: langtool-node v'+program.version());
      root.att('language', program.language || 'en');
      root.att('utcdategenerated', new Date().toISOString());
      root.att('note', note);
      root.att('hash', hashTranslations(data));

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

        root.ele('string', {
          name: entry.code,
          comment: comment,
          section: entry.section
        }, '"' + entry.text.replace('\'', '\\\'') + '"');
      }

      output.write(root.end({ pretty: true}));
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
      output.write('/* Translation to ' + program.language + ' for apps ' + JSON.stringify(program.application) + ', sections ' + JSON.stringify(program.section) + ' */');
      output.write('/* Last Update: ' + new Date().toLocaleString() + ' */');
      output.write('/* By: langtool-node v' + program.version() + ' */');
      output.write('/* Language: ' + (program.language || 'en') + ' */');
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
        output.write('"' + entry.code + '" = ' + JSON.stringify(entry.text));
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
    md5sum.update(entry.text);
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