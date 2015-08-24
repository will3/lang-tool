function TextWriter() {
  this.write = function(data, note, program) {
    console.log('');
    console.log("Translation to %j for apps '%j', sections '%j'", program.language, program.application, program.section);
    console.log(note);
    console.log('');
    for (var i = 0; i < data.length; i++) {
      console.log(data[i].code + '\t' + data[i].text);
    }
    console.log('');
    console.log("% items writted", data.length);
  };
}

function JsonWriter() {
  this.write = function(data, note, program) {
    console.log('');
    console.log("// Translation to %j for apps '%j', sections '%j'", program.language, program.application, program.section);
    console.log("//", note);
    console.log('');
    console.log(data);
    console.log('');
    console.log("// %j items writted", data.length);
  };
}

var builder = require('xmlbuilder');

function AndroidWriter() {
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
      }, entry.text);
    }

    console.log(root.end({ pretty: true}));
  };
}

module.exports = {
  text: TextWriter,
  json: JsonWriter,
  android: AndroidWriter
}