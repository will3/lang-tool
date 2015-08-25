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

function TextWriter(output) {
  if (!output && !output.write)
    throw new Error('Must specify ouput');

  this.write = function(data, note, program) {
    output.write('');
    output.write('Translation to ' + program.language + ' for apps ' + JSON.stringify(program.application) + ', sections ' + JSON.stringify(program.section));
    output.write(note);
    output.write('');
    for (var i = 0; i < data.length; i++) {
      output.write(data[i].code + '\t' + data[i].text);
    }
    output.write('');
    output.write(data.length + ' items writted');
  };
}

function JsonWriter(output) {
  if (!output && !output.write)
    throw new Error('Must specify ouput');

  this.write = function(data, note, program) {
    output.write('');
    output.write('// Translation to ' + program.language + ' for apps ' + JSON.stringify(program.application) + ', sections ' + JSON.stringify(program.section));
    output.write('// ' + note);
    output.write('');
    output.write(data);
    output.write('');
    output.write('// ' +data.length + ' items writted');
  };
}

var builder = require('xmlbuilder');

function AndroidWriter(output) {
  if (!output && !output.write)
    throw new Error('Must specify ouput');

  this.write = function(data, note, program) {
    var root = builder.create('resources');
    root.comment('Last Update: ' + new Date().toLocaleString());
    root.comment('By: langtool-node v'+program.version());
    root.att('language', program.language || 'en');
    root.att('utcdategenerated', new Date().toISOString());
    root.att('note', note);

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
}

function IOSWriter(output) {
  if (!output && !output.write)
    throw new Error('Must specify ouput');

  function escape(s) {
    return s.replace('"', '\\"');
  }

  this.write = function(data, note, program) {
    output.write('/* Translation to ' + program.language + ' for apps ' + JSON.stringify(program.application) + ', sections ' + JSON.stringify(program.section) + ' */');
    output.write('/* Last Update: ' + new Date().toLocaleString() + ' */');
    output.write('/* By: langtool-node v' + program.version() + ' */');
    output.write('/* Language: ' + (program.language || 'en') + ' */');
    output.write('/* ' + note + ' */');
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
      output.write('"' + entry.code + '" = ' + JSON.stringify(escape(entry.text)));
    }
  };
}

module.exports = {
  ConsoleOutput: ConsoleOutput,
  FileOutput: FileOutput,
  CompositeOutput: CompositeOutput,
  text: TextWriter,
  json: JsonWriter,
  android: AndroidWriter,
  ios: IOSWriter
}