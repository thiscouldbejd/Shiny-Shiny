(function (extension) {
  'use strict';
  // UML - Universal Module Loader
  // This enables the extension to be loaded in different environments
  if (typeof showdown !== 'undefined') {
    // global (browser or nodejs global)
    extension(showdown);
  } else if (typeof define === 'function' && define.amd) {
    // AMD
    define(['showdown'], extension);
  } else if (typeof exports === 'object') {
    // Node, CommonJS-like
    module.exports = extension(require('showdown'));
  } else {
    // showdown was not found so we throw
    throw Error('Could not find showdown library');
  }
}(function (showdown) {
  'use strict';
  // Initialize a showdown converter to be used in the extension core
  var converter = new showdown.Converter();
  // The following method will register the extension with showdown
  showdown.extension("classify", function () {
    var x = 0;
    var ext = {
      type: "lang",
      filter: function(text, converter, options) {
          
        var _classes = text.match(/\[(.*)--]/g),
            _text = text;
            
        if (x < 3 && _classes && _classes.length) {
          
          ++x;
          
          for (var i = 0; i < _classes.length; i++) {
              
            var _class = _classes[i].match(/\[(.*)--]/)[1];
            if (_class) {
              var _regex = new RegExp("\\[" + _class + "--]([\\s\\S]*?)\\[--" + _class + "]"),
                  _split = _text.match(_regex);
              if (_split !== null) {
                _text = _text.replace(_regex, "<div class=\"" + _class + "\">" + converter.makeHtml(_split[1]) + "</div>");
              }
            }
            
          }
          
        }
        x = 0;
        return _text;
      }
    };
    return [ext];
  });
}));