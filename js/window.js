// -- DEFAULT Values -- //
var DEFAULTS = {
  font: {
    size: 18,
    delta: 1
  },
  line: {
    height: 1,
    delta: 0.2,
    numbers: ".ace_gutter .ace_gutter-cell"
  },
  theme: {
    dark: "ace/theme/twilight",
    blue: "ace/theme/cobalt",
    light: "ace/theme/tomorrow"
  },
  mode: {
    markdown: "ace/mode/markdown",
    text: "ace/mode/plain_text"
  },
  file: {
    accepts: [{
      extensions: ["txt"]
    }],
    type: "text/plain"
  }
};
// -- DEFAULT Values -- //

// -- STATE / Mutable Values -- //
var STATE = {
  file: {
    id: null,
    recovery: false,
    autosave: 0,
    timeout: 0,
    saved: false,
  },
  print: {
    font: {
      size: 12
    },
    line: {
      height: 2,
      header: 1.2
    },
    margins: [0, 0, 0, 0]
  }
};
// -- STATE / Mutable Values -- //

// -- ACTION Commands -- //
var ACTION = {

  focus: function() {
    var editor = ace.edit("editor");
    editor.focus();
  },

  open: function(path) {
    var screenWidth = screen.availWidth;
    var screenHeight = screen.availHeight;
    var width = screenWidth / 1.5;
    var height = screenHeight / 1.5;

    chrome.app.window.create(path, {
      bounds: {
        width: Math.round(width),
        height: Math.round(height),
        left: Math.round((screenWidth - width) / 2),
        top: Math.round((screenHeight - height) / 2)
      }
    });
  },

};
// -- ACTION Commands -- //

// -- INSERT Commands -- //
var INSERT = {

  characters: function(editor) {
    editor.insert("é è à ù â ê î ô û ë ï ç   ä Ä ö Ö ü Ü ß   í ó ú ñ ¡ ¿");
  },

  markdown: function(editor) {
    request("/documentation/EXAMPLE.md").then(function(value) {
      editor.insert(value);
    });
  },

  header: function(editor) {
    request("/templates/UK-EXAM.md").then(function(value) {
      editor.gotoLine(1, 0, true);
      editor.insert(value);
    });
  },
  
  count: function(editor) {
    var document = editor.getSession().getDocument(),
        row = document.getLength(),
        column = document.getLine(row - 1).length;
    
    editor.gotoLine(row, column, true);
    editor.insert("\n\n@@#WORD_COUNT#@@");
    
    row = document.getLength();
    column = document.getLine(row - 1).length;
    editor.gotoLine(row, column, true);
	}

};
// -- INSERT Commands -- //

// -- SAVE Commands -- //
var SAVE = {

  auto: function(editor) {
    
    var create = function() {
      return (STATE.file.id && STATE.file.autosave > 0) ? 
        setTimeout(function() {
          if (STATE.file.id && STATE.file.autosave > 0) {
            if (editor.getValue()) {
              SAVE.silently(editor, function() {
                STATE.file.timeout = create();
              });
            } else {
            	STATE.file.timeout = create();
            }
          }
        }, STATE.file.autosave * 60 * 1000) : 0;
    };
    
    if (STATE.file.timeout !== 0) {
      clearTimeout(STATE.file.timeout);
    }
    STATE.file.timeout = create();
    
  },
  
  complete: function(callback) {
    return function() {
      STATE.file.saved = new Date();
    	(callback || ACTION.focus)();
    }
  },
  
  initial: function(editor) {
    var _config = {
      type: "saveFile",
      suggestedName: "output.txt",
      accepts: DEFAULTS.file.accepts
    };

    chrome.fileSystem.chooseEntry(_config, function(writableEntry) {
      if (!chrome.runtime.lastError) {
        STATE.file.id = chrome.fileSystem.retainEntry(writableEntry);
        var blob = new Blob([editor.getValue()], {
          type: DEFAULTS.file.type
        });
        writeFileEntry(writableEntry, blob, SAVE.complete());
        SAVE.auto(editor);
      }
    });
    return chrome.runtime.lastError ? false : true;
  },

  silently: function(editor, callback) {
    if (STATE.file.id) {
      chrome.fileSystem.isRestorable(STATE.file.id, function(isRestorable) {
        if (isRestorable) {
          chrome.fileSystem.restoreEntry(STATE.file.id, function(writableEntry) {
            var blob = new Blob([editor.getValue()], {
              type: DEFAULTS.file.type
            });
            writeFileEntry(writableEntry, blob, SAVE.complete(callback));
          });
        }
      });
    }
  },
  
  recovery: function(editor) {
    
    var timestamp = new Date().toISOString(),
          filename = "autosave_" + timestamp.split(".")[0] + ".txt";

    var element = document.createElement("a");
    	element.setAttribute("href", 
                         "data:text/plain;charset=utf-8," + encodeURIComponent(editor.getValue()));
    	element.setAttribute("download", filename);
    	element.click();
    
  }

};
// -- SAVE Commands -- //

// -- OPEN Commands -- //
var OPEN = {

  initial: function() {

    var _config = {
      type: "openFile",
      accepts: DEFAULTS.file.accepts
    };

    chrome.fileSystem.chooseEntry(_config, function(readableEntry) {
      if (!readableEntry) {
        return;
      }
      chrome.storage.local.set({
        "chosenFile": chrome.fileSystem.retainEntry(readableEntry)
      });
      loadFileEntry(readableEntry);
      ACTION.focus();
    });

  },

};
// -- OPEN Commands -- //

// -- PRINT Commands -- //
var PRINT = {

  close: function() {
    document.body.removeChild(this.__container__);
  },

  set: function(css) {
    return function() {

      if (css) {
        var head = this.contentDocument.head || this.contentDocument.getElementsByTagName("head")[0],
          style = this.contentDocument.createElement("style");

        style.type = "text/css";
        if (style.styleSheet) {
          style.styleSheet.cssText = css;
        } else {
          style.appendChild(this.contentDocument.createTextNode(css));
        }

        head.appendChild(style);
      }

      this.contentWindow.__container__ = this;
      this.contentWindow.onbeforeunload = PRINT.close;
      this.contentWindow.onafterprint = PRINT.close;
      this.contentWindow.print();

    };
  },

  html: function(html, css) {
    var _frame = document.createElement("iframe");
    _frame.onload = PRINT.set(css);
    _frame.style.visibility = "hidden";
    _frame.style.position = "fixed";
    _frame.style.right = "0";
    _frame.style.bottom = "0";

    _frame.srcdoc = html;

    document.body.appendChild(_frame);
  },

  print: function(text, extra_Formatting, strict) {
    if (text) {
      
      
      // == Process Actions == //
      var pattern = RegExp("^\@\@\#([A-Z_\-]+)\#\@\@$","gm"),
          match,
          actions = [];

      var word_Count = text.match(/\S+/g).length.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");

      // -- Match Actions -- //
      while ((match = pattern.exec(text))) {
        if (match[1] == "WORD_COUNT") {
          actions.push((function (m) {
            return function(text) {
              return text.substr(0, m.index) + "Words: " + word_Count + text.substr(m.index + m[0].length);
            }
          })(match));
        }
      }

      // -- Run Actions -- //
      if (actions.length > 0) {
        actions.reverse().forEach(function(fn) {
          text = fn(text);
        });
      }
      
      
      // -- Extract Title -- //
      var title = text.match(new RegExp("^\@.+\@"));
      if (title && title.length == 1) {
        document.title = title[0].slice(1, title[0].length - 1);
        text = text.replace(title[0], "");
      }
      
      // Remove whitespace at the start of lines, to avoid converted to 'pre' elements that overflow the page
      text = text.replace(/^\t+|^ +/gm, "");
    }

    var css = function(header) {
      var _header = "margin: " + STATE.print.margins.map(function(margin) {
        return margin + "mm";
      }).join(" ") + ";";
      return extra_Formatting ? [
        "body {font-size: " + STATE.print.font.size + "pt !important;" + (header ? "" : " " + _header) + "}",
        "body p, body li {line-height: " + STATE.print.line.height + ";}",
        "body > table:first-child > thead {display: table-header-group; color: #888;}",
        "body > table:first-child > thead ul li {line-height: " + STATE.print.line.header + " !important;}",
        "body > table:first-child > tbody {" + (header ? (_header + " display: table;") : "") + "}",
        "body > table:first-child > tfoot {display: table-footer-group; color: #888;}"
      ].join(" ") : false;
    };

    try {

      if (!strict) {

        // If not strict, try to clean up common mistakes
        var _regexes = [{
          match: /^[0-9]+(\.{1})\s/mig, // Match dots after numerical line starts, which will be parsed as OL > LI
          replace: function(match, p1) {
            var _reversed = match.split("").reverse().join("");
            var _replaced = _reversed.replace(p1, ". ");
            var _return = _replaced.split("").reverse().join("");
            return _return;
          }
        }, ];

        $.each(_regexes, function(i, regex) {
          text = text.replace(regex.match, regex.replace);
        });
      }

      // Try to print Markdown Parsed Document
      var converter = new showdown.Converter({
        tables: true
      });
      var html = converter.makeHtml(text),
        _header;

      if (extra_Formatting) {

        var _nodes = $.parseHTML(html),
          _headers = [],
          _content = [];

        $.each(_nodes, function(i, el) {

          if (el.nodeName !== "META" && !(el.nodeName == "#text" && !el.textContent.trim())) {

            if (_content.length === 0 && (el.nodeName == "HR" || el.nodeName == "UL")) {

              _headers.push(el);

            } else {

              _content.push(el);

            }

          }

        });

        if (_headers.length === 3) {

          _header = true;

          var _html = ["<table>", "<thead>", "<tr>", "<td>"];
          $.each(_headers, function(i, el) {
            _html.push(el.outerHTML);
          });
          _html = _html.concat(["</td>", "</tr>", "</thead>", "<tbody>", "<tr>", "<td>"]);
          $.each(_content, function(i, el) {
            _html.push(el.outerHTML);
          });
          _html = _html.concat(["</td>", "</tr>", "</tbody>", "<table>"]);
          html = _html.join("\n");

        }

      }

      PRINT.html(html, css(_header));

    } catch (e) {
      // Fall back to printing plain text
      PRINT.html(text, css());
    }
  }

};
// -- PRINT Commands -- //

// -- Startup Function -- //
$(document).ready(function() {

  var editor = ace.edit("editor");
  editor.setTheme(DEFAULTS.theme.light);
  editor.getSession().setMode(DEFAULTS.mode.markdown);
  editor.getSession().setUseWrapMode(true);
  editor.setFontSize(DEFAULTS.font.size);
  STATE.value = function() {
    return editor.getValue();
  };


  editor.commands.addCommand({
    name: "Show Controls",
    bindKey: {
      win: "Esc",
      mac: "Esc"
    },
    exec: function(editor) {
      request("/pages/control.html").then(function(value) {
        $("#settings").empty().append(value);
        var _modal = $("#settings .modal").on("hidden.bs.modal", ACTION.focus);

        // -- Set Current Values & Update Handles -- //
        _modal.find("#fontSize")
          .val(parseInt(editor.getFontSize(), 10) || DEFAULTS.font.size)
          .on("change", function(e) {
            editor.setFontSize(Math.max($(e.currentTarget).val() || 1));
          })
          .on("dblclick", function(e) {
            $(e.currentTarget).val(DEFAULTS.font.size).trigger("change");
          });

        _modal.find("#lineHeight")
          .val(parseFloat(editor.container.style.lineHeight, 10) || DEFAULTS.line.height)
          .on("change", function(e) {
            editor.container.style.lineHeight = $(e.currentTarget).val();
          })
          .on("dblclick", function(e) {
            $(e.currentTarget).val(DEFAULTS.line.height).trigger("change");
          });

        _modal.find("#lineNumbers")
          .prop("checked", editor.renderer.getShowGutter())
          .on("change", function(e) {
            editor.renderer.setShowGutter($(e.currentTarget).prop("checked"));
          });

        ["dark", "blue", "light"].forEach(function(value) {
          _modal.find("#" + value + "Mode")
            .prop("checked", editor.getTheme() == DEFAULTS.theme[value])
            .on("change", function(e) {
            	if ($(e.currentTarget).prop("checked")) editor.setTheme(DEFAULTS.theme[value]);
            });
        });

        _modal.find("#markdownMode")
          .prop("checked", editor.getSession().getMode().$id == DEFAULTS.mode.markdown)
          .on("change", function(e) {
            editor.getSession().setMode($(e.currentTarget).prop("checked") ?
              DEFAULTS.mode.markdown : DEFAULTS.mode.text);
          });

        _modal.find("#overwriteMode")
          .prop("checked", editor.getOverwrite())
          .on("change", function(e) {
            editor.setOverwrite($(e.currentTarget).prop("checked"));
          });

        _modal.find("#commonCharacters")
          .on("click", function() {
            INSERT.characters(editor);
          });

        _modal.find("#exampleMarkdown")
          .on("click", function() {
            INSERT.markdown(editor);
          });

        _modal.find("#headerTemplate")
          .on("click", function() {
            INSERT.header(editor);
          });
        
        _modal.find("#wordCounter")
        	.on("click", function() {
            INSERT.count(editor);
          });

        _modal.find("#extraFormatting")
          .prop("checked", true);

        _modal.find("#save")
          .on("click", function() {
            SAVE.initial(editor);
          });

        _modal.find("#print")
          .on("click", function() {
            PRINT.print(editor.getSession().getValue(),
              $("#extraFormatting").prop("checked"),
              $("#strictParsing").prop("checked"));
          });

        _modal.find("#printLineHeight")
          .val(STATE.print.line.height)
          .on("change", function(e) {
            STATE.print.line.height = $(e.currentTarget).val();
          });

        _modal.find("#printTableLineHeight")
          .val(STATE.print.line.header)
          .on("change", function(e) {
            STATE.print.line.header = $(e.currentTarget).val();
          });

        _modal.find("#printFontSize")
          .val(STATE.print.font.size)
          .on("change", function(e) {
            STATE.print.font.size = $(e.currentTarget).val();
          });

        ["Top", "Right", "Bottom", "Left"].forEach(function(name, index) {
          _modal.find("#printMargin" + name)
            .val(STATE.print.margins[index])
            .on("change", function(e) {
              STATE.print.margins[index] = $(e.currentTarget).val();
            });
        });
        
        _modal.find("#recovery")
        	.prop("checked", STATE.file.recovery)
          .on("change", function(e) {
            STATE.file.recovery = $(e.currentTarget).prop("checked");
          });
        
				_modal.find("#autosave")
            .val(STATE.file.autosave)
            .on("change", function(e) {
              STATE.file.autosave = parseInt($(e.currentTarget).val(), 10);
          		SAVE.auto(editor);
            });
        
        _modal.find("#autosaveClear")
        	.on("click", function() {
            _modal.find("#autosave").val(0).trigger("change");
          });
        
        // -- Display Counts -- //
        var _format = /\B(?=(\d{3})+(?!\d))/g,
        		_lines = editor.getSession().getDocument().getLength().toString().replace(_format, ","),
            _words = editor.getValue().match(/\S+/g).length.toString().replace(_format, ","),
						_chars = editor.getValue().length.toString().replace(_format, ",");
        
        _modal.find("#lastSaved").text(STATE.file.saved ? STATE.file.saved.toLocaleString() : "Never");
        _modal.find("#lineCount").text(_lines);
        _modal.find("#wordCount").text(_words);
        _modal.find("#characterCount").text(_chars);
        
        // -- Show Modal -- //
        _modal.modal("show");

      });
    },
    readOnly: true
  }); // -- Show Options Dialog -- //


  // -- Save Commands -- //
  editor.commands.addCommand({
    name: "Save Locally",
    bindKey: {
      win: "Ctrl-S",
      mac: "Command-S"
    },
    exec: SAVE.initial,
    readOnly: true
  }); // -- Save -- //

  editor.commands.addCommand({
    name: "Save Silently",
    bindKey: {
      win: "Ctrl-Shift-S",
      mac: "Command-Shift-S"
    },
    exec: SAVE.silently,
    readOnly: true
  }); // -- Save Silently -- //
  
  editor.commands.addCommand({
    name: "Save Recovery",
    bindKey: {
      win: "Ctrl-Alt-S",
      mac: "Command-Alt-S"
    },
    exec: SAVE.recovery,
    readOnly: true
  }); // -- Save Silently -- //
  // -- Save Commands -- //


  // -- Open Commands -- //
  editor.commands.addCommand({
    name: "Open Locally",
    bindKey: {
      win: "Ctrl-Shift-O",
      mac: "Option-Shift-O"
    },
    exec: OPEN.initial,
    readOnly: true
  }); // -- Open -- //
  // -- Open Commands -- //


  // -- Print Commands -- //
  editor.commands.addCommand({
    name: "Print Locally (using Markdown)",
    bindKey: {
      win: "Ctrl-P",
      mac: "Command-P"
    },
    exec: function(editor) {
      PRINT.print(editor.getSession().getValue(), true);
    },
    readOnly: true
  }); // -- Print -- //

  editor.commands.addCommand({
    name: "Print Locally (no extra formatting) (using Markdown)",
    bindKey: {
      win: "Ctrl-Shift-P",
      mac: "Command-Shift-P"
    },
    exec: function(editor) {
      PRINT.print(editor.getSession().getValue(), false);
    },
    readOnly: true
  }); // -- Print without Extra Formatting -- //

  editor.commands.addCommand({
    name: "Print Locally (using Strict Markdown)",
    bindKey: {
      win: "Ctrl-Alt-P",
      mac: "Command-Alt-P"
    },
    exec: function(editor) {
      PRINT.print(editor.getSession().getValue(), true, true);
    },
    readOnly: true
  }); // -- Print Strict Markdown -- //
  // -- Print Commands -- //


  // -- Editor Commands -- //
  editor.commands.addCommand({
    name: "Show/Hide Line Numbers",
    bindKey: {
      win: "Ctrl-G",
      mac: "Command-G"
    },
    exec: function(editor) {
      editor.renderer.setShowGutter(!editor.renderer.getShowGutter());
    },
    readOnly: true
  }); // -- Show/Hide Line Numbers -- //

  editor.commands.addCommand({
    name: "Toggle Insert/Overwrite",
    bindKey: {
      win: "Ctrl-I",
      mac: "Command-I"
    },
    exec: function(editor) {
      editor.setOverwrite(!editor.getOverwrite());
    },
    readOnly: true
  }); // -- Toggle Insert/Overwrite -- //
  // -- Editor Commands -- //


  // -- Syntax Commands -- //
  editor.commands.addCommand({
    name: "Markdown Syntax",
    bindKey: {
      win: "Ctrl-M",
      mac: "Command-M"
    },
    exec: function(editor) {
      editor.getSession().setMode(DEFAULTS.mode.markdown);
    },
    readOnly: true
  }); // -- Markdown -- //

  editor.commands.addCommand({
    name: "Plain Text Syntax",
    bindKey: {
      win: "Ctrl-E",
      mac: "Command-E"
    },
    exec: function(editor) {
      editor.getSession().setMode(DEFAULTS.mode.text);
    },
    readOnly: true
  }); // -- Plain Text -- //
  // -- Syntax Commands -- //


  // -- Font Commands -- //
  editor.commands.addCommand({
    name: "Increase Font Size",
    bindKey: {
      win: "Ctrl+=",
      mac: "Command+="
    },
    exec: function(editor) {
      var size = parseInt(editor.getFontSize(), 10) || DEFAULTS.font.size;
      editor.setFontSize(size + DEFAULTS.font.delta);
    },
    readOnly: true
  }); // -- Increase Font Size -- //

  editor.commands.addCommand({
    name: "Decrease Font Size",
    bindKey: {
      win: "Ctrl+-",
      mac: "Command+-"
    },
    exec: function(editor) {
      var size = parseInt(editor.getFontSize(), 10) || DEFAULTS.font.size;
      editor.setFontSize(Math.max(size - DEFAULTS.font.delta || 1));
    },
    readOnly: true
  }); // -- Decrease Font Size -- //

  editor.commands.addCommand({
    name: "Reset Font Size",
    bindKey: {
      win: "Ctrl+0",
      mac: "Command+0"
    },
    exec: function(editor) {
      editor.setFontSize(DEFAULTS.font.size);
    },
    readOnly: true
  }); // -- Reset Font Size -- //
  // -- Font Commands -- //


  // -- Line Commands -- //
  editor.commands.addCommand({
    name: "Increase Line Spacing/Height",
    bindKey: {
      win: "Ctrl+9",
      mac: "Command+9"
    },
    exec: function(editor) {
      var size = parseFloat(editor.container.style.lineHeight, 10) || DEFAULTS.line.height;
      editor.container.style.lineHeight = size + DEFAULTS.line.delta;
    },
    readOnly: true
  }); // -- Increase Line Spacing -- //

  editor.commands.addCommand({
    name: "Decrease Line Spacing/Height",
    bindKey: {
      win: "Ctrl+8",
      mac: "Command+8"
    },
    exec: function(editor) {
      var size = parseFloat(editor.container.style.lineHeight, 10) || DEFAULTS.line.height;
      editor.container.style.lineHeight = Math.max(size - DEFAULTS.line.delta || DEFAULTS.line.height);
    },
    readOnly: true
  }); // -- Decrease Line Spacing -- //

  editor.commands.addCommand({
    name: "Reset Line Spacing/Height",
    bindKey: {
      win: "Ctrl+7",
      mac: "Command+7"
    },
    exec: function(editor) {
      editor.container.style.lineHeight = DEFAULTS.line.height;
    },
    readOnly: true
  }); // -- Reset Line Spacing -- //
  // -- Line Commands -- //


  // -- Theme Commands -- //
  editor.commands.addCommand({
    name: "Dark Theme",
    bindKey: {
      win: "Ctrl-D",
      mac: "Command-D"
    },
    exec: function(editor) {
      editor.setTheme(DEFAULTS.theme.dark);
    },
    readOnly: true
  }); // -- Dark Mode -- //

  editor.commands.addCommand({
    name: "Blue Theme",
    bindKey: {
      win: "Ctrl-B",
      mac: "Command-B"
    },
    exec: function(editor) {
      editor.setTheme(DEFAULTS.theme.blue);
    },
    readOnly: true
  }); // -- Dark Mode -- //
  
  editor.commands.addCommand({
    name: "Light Theme",
    bindKey: {
      win: "Ctrl-L",
      mac: "Command-L"
    },
    exec: function(editor) {
      editor.setTheme(DEFAULTS.theme.light);
    },
    readOnly: true
  }); // -- Light Mode -- //
  // -- Theme Commands -- //


  // -- Show Commands -- //
  editor.commands.addCommand({
    name: "Show Help",
    bindKey: {
      win: "Ctrl-/",
      mac: "Command-/"
    },
    exec: function() {
      ACTION.open("pages/help.html?path=/documentation/INSTRUCTIONS.md");
    },
    readOnly: true
  }); // -- Show Help -- //

  editor.commands.addCommand({
    name: "List Foreign Characters",
    bindKey: {
      win: "Ctrl-Shift-/",
      mac: "Command-Shift-/"
    },
    exec: function() {
      ACTION.open("pages/help.html?path=/documentation/CHARACTERS.md");
    },
    readOnly: true
  }); // -- Show Foreign / International Characters -- //
  // -- Show Commands -- //


  // -- Insertion Commands -- //
  editor.commands.addCommand({
    name: "Insert Common Foreign Characters",
    bindKey: {
      win: "Ctrl-Q",
      mac: "Command-Q"
    },
    exec: INSERT.characters,
    readOnly: true
  }); // -- Insert Foreign / Internation Characters -- //

  editor.commands.addCommand({
    name: "Insert Example Markdown",
    bindKey: {
      win: "Ctrl-Shift-T",
      mac: "Command-Shift-T"
    },
    exec: INSERT.markdown,
    readOnly: true
  }); // -- Insert Example Markdown -- //
  
  editor.commands.addCommand({
    name: "Insert Word Count",
    bindKey: {
      win: "Ctrl-Shift-C",
      mac: "Command-Shift-C"
    },
    exec: INSERT.count,
    readOnly: true
  }); // -- Insert Word Count -- //

  editor.commands.addCommand({
    name: "Insert Template",
    bindKey: {
      win: "Ctrl-T",
      mac: "Command-T"
    },
    exec: INSERT.header,
    readOnly: true
  }); // -- Insert Header Template -- //
  // -- Insertion Commands -- //

  
  // -- Focus, ready to go! -- //
  ACTION.focus();

});