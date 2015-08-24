function TextWriter() {
  this.write = function(data, note, program) {
    console.log('');
    console.log("Translation to %j for apps '%j', sections '%j'", program.language, program.application, program.section);
    console.log(note);
    console.log('');
    for (var i = 0; i < data.length; i++) {
      console.log(data[i].code + '\t' + data[i].text);
    };
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

module.exports = {
  text: TextWriter,
  json: JsonWriter
}