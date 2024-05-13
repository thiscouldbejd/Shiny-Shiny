// -- DEFAULT Values -- //
var DEFAULTS = {
  font: {
    family: "default",
    size: 18,
    delta: 1
  },
  line: {
    height: 1,
    delta: 0.2,
    numbers: ".ace_gutter .ace_gutter-cell"
  },
  theme: {
    muted_dark: "ace/theme/pastel_on_dark",
    dark: "ace/theme/twilight",
    blue: "ace/theme/cobalt",
    muted_light: "ace/theme/kuroir",
    light: "ace/theme/tomorrow"
  },
  mode: {
    markdown: "ace/mode/markdown",
    text: "ace/mode/plain_text"
  },
  html: {
    accepts: [{
      extensions: ["html","htm"]
    }],
    type: "text/html"
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
  editor: null,
  session: null,
  value: null,
  debug: false,
  file: {
    id: null,
    recovery: false,
    autosave: 0,
    timeout: 0,
    saved: false,
  },
  print: {
    font: {
      family: "default",
      size: 12
    },
    line: {
      breaks: false,
      height: 2,
      header: 1.2
    },
    margins: [0, 0, 0, 0],
    mode: "iframe",
  },
  options: {
    autocorrect : null,
    spellcheck: null,
    highlight: false,
    suggest: false,
    dictionary: "en_GB",
  },
  show: {
    spelling: () => STATE.loaded.highlight === true,
  },
  loaded: {
    highlight: false,
    spellcheck: false,
  },
  templates: [],
};
// -- STATE / Mutable Values -- //


// -- GOTO Commands -- //
var GOTO = {
  
  start: function(editor) {
    editor.gotoLine(1, 0, true);
  },
  
  end: function(editor) {
    var document = editor.getSession().getDocument(),
        row = document.getLength(),
        column = document.getLine(row - 1).length;

    editor.gotoLine(row, column, true);
  },
  
};
// -- GOTO Commands -- //


// -- ACTION Commands -- //
var ACTION = {

  focus: function() {
    (STATE.window ? STATE.window() : window).focus();
    var editor = STATE.editor ? STATE.editor() : ace.edit("editor");
    editor.focus();
    editor.setReadOnly(false); 
    if (STATE && STATE.debug) console.log("Editor Focus Set:", editor);
  },

  open: function(path, id) {
    var screenWidth = screen.availWidth;
    var screenHeight = screen.availHeight;
    var width = screenWidth / 1.5;
    var height = screenHeight / 1.5;

    return new Promise((resolve, reject) => {
      chrome.app.window.create(path, {
        id : id || "help",
        bounds: {
          width: Math.round(width),
          height: Math.round(height),
          left: Math.round((screenWidth - width) / 2),
          top: Math.round((screenHeight - height) / 2)
        }
      }, function(created) {
        DEBUG.window(created);
        if (created) {
          resolve(created.contentWindow);
        } else {
          reject(chrome.runtime.lastError);
        }
      });
    })
  },

  instructions: function() {
    return ACTION.open("pages/help.html?path=/documentation/INSTRUCTIONS.md")
      .then((window) => {
        DEBUG.window(window);
      })
      .catch((e) => {
        DEBUG.error(e, "SHOWING INSTRUCTIONS HELP ERROR");
        return null;
      });
  },

  characters: function() {
    return ACTION.open("pages/help.html?path=/documentation/CHARACTERS.md")
      .then((window) => {
        DEBUG.window(window);
        window.addEventListener("load", () => {
          window.document.querySelectorAll("tr").forEach((el) => {
            el.style.cursor = "pointer";
            el.addEventListener("click", e => {
              INSERT.arbitary(STATE.editor(), el.getElementsByTagName("td")[1].textContent);
            });
          });
        });
      })
      .catch((e) => {
        DEBUG.error(e, "SHOWING CHARACTERS HELP ERROR");
        return null;
      });
  },

};
// -- ACTION Commands -- //


// -- INSERT Commands -- //
var INSERT = {

  arbitary: function(editor, text, top) {
    if (top) GOTO.start(editor);
    editor.insert(text);
  },

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
      GOTO.start(editor);
      editor.insert(value);
    });
  },

  header_internal: function(editor) {
    request("/templates/INTERNAL-EXAM.md").then(function(value) {
      GOTO.start(editor);
      editor.insert(value);
    });
  },
  
  alignments: function(editor, specific) {
    request(specific  ? "/templates/ALIGNMENT-" + specific.toUpperCase() + ".md" : "/templates/ALIGNMENTS.md")
    .then(function(value) {
      if (!specific) {
          GOTO.start(editor);
      } else if (editor.getSelectedText()) {
          var _lines = value.split("\n");
          _lines[1] = editor.getSelectedText();
          value = _lines.join("\n");
      }
      editor.insert(value);
    });
  },
  
  table: function(editor, columns, rows) {
    var _table = [];
    _table.push(`| ${Array(columns).fill().map(function() {
        return "Header";
    }).join(" | ")} |`);
    _table.push(`|${Array(columns).fill().map(function() {
        return ":------:";
    }).join("|")}|`);
    for (var i = 0; i < rows; i++) {
        _table.push(`|${Array(columns).fill().map(function() {
            return "  Text  ";
        }).join("|")}|`);
    }
    _table.push("");
    editor.insert(_table.join("\n"));
  },

  break: function(editor) {
    editor.insert("\n\n@@#PAGE_BREAK#@@\n\n");
  },

  count: function(editor) {
    GOTO.end(editor);
    editor.insert("\n\n@@#WORD_COUNT#@@");
		GOTO.end(editor);
  },

  numbers: function(editor) {
    GOTO.end(editor);
    editor.insert("\n\n@@#PAGE_NUMBERS#@@");
		GOTO.end(editor);
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
            if (editor && editor.getValue()) {
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
      (callback && typeof callback === "function" ? callback : ACTION.focus)();
    };
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
        (window.writeFileEntry || writeFileEntry)(writableEntry, blob, SAVE.complete());
        SAVE.auto(editor);
      }
    });
    return chrome.runtime.lastError ? false : true;
  },

  manually: function(editor) {

    if (!editor) editor = STATE.value();
    if (!editor) return;

    var _text = (typeof editor === "string" || editor instanceof String) ? editor : editor.getValue();

    var timestamp = new Date().toISOString(),
      filename = "save_" + timestamp.split(".")[0] + ".txt";

    var element = document.createElement("a");
    element.setAttribute("href", "data:text/plain;charset=utf-8," + encodeURIComponent(_text));
    element.setAttribute("download", filename);
    element.click();

  },

  silently: function(editor, callback) {
    if (STATE.file.id) {
      chrome.fileSystem.isRestorable(STATE.file.id, function(isRestorable) {
        if (isRestorable) {
          chrome.fileSystem.restoreEntry(STATE.file.id, function(writableEntry) {
            var blob = new Blob([editor.getValue()], {
              type: DEFAULTS.file.type
            });
            (window.writeFileEntry || writeFileEntry)(writableEntry, blob, SAVE.complete(callback));
          });
        }
      });
    }
  },

  html: function(editor) {
    var _config = {
      type: "saveFile",
      suggestedName: "output.html",
      accepts: DEFAULTS.html.accepts
    };

    chrome.fileSystem.chooseEntry(_config, function(writableEntry) {
      if (!chrome.runtime.lastError) {

        var _output = PRINT.generate(editor.getValue(), true, true, STATE.print.line.breaks);

        request("/outputs/html.html").then(function(value) {
          value = value
            .replace(/{{{\s*CSS\s*}}}/i, _output.css.full || _output.css.plain)
            .replace(/{{{\s*BODY\s*}}}/i, _output.html || _output.text);

          var blob = new Blob([value], {
            type: DEFAULTS.html.type
          });
          (window.writeFileEntry || writeFileEntry)(writableEntry, blob, ACTION.focus);
        });

      }
    });
    return chrome.runtime.lastError ? false : true;
  },

};
// -- SAVE Commands -- //


// -- OPEN Commands -- //
var OPEN = {

  initial: function(editor) {

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

      if (editor && !editor.getValue().trim()) {
        loadFileEntry(readableEntry, false);
      } else {
        request("/pages/open.html").then(function(value) {
          $("#modal").empty().append(value);
          var _modal = $("#modal .modal").on("hidden.bs.modal", ACTION.focus);

          _modal.find("#openOverwrite")
            .on("click", function() {
              loadFileEntry(readableEntry, true);
            });

          _modal.find("#openInsert")
            .on("click", function() {
              loadFileEntry(readableEntry, false);
            });

          // -- Show Modal -- //
          _modal.modal("show");

        });


      }

      ACTION.focus();
    });

  },

};
// -- OPEN Commands -- //


// -- PRINT Commands -- //
var PRINT = {

  // -- \/ These Commands are shared and can run in iFRAME or the MAIN Context \/ -- //
  append : function(css) {

    var head = this.head || this.getElementsByTagName("head")[0];

    if (css) {

      var style = this.createElement("style");

      style.setAttribute("id", "printable-css");
      style.type = "text/css";
      if (style.styleSheet) {
        style.styleSheet.cssText = css;
      } else {
        style.appendChild(this.createTextNode(css));
      }

      head.appendChild(style);

    }

    return head;
    
  },

  prepare: function(e) {

    if (STATE) {
      if (STATE.debug) console.log("PRINTING PREPARE:", e);
      if (STATE.verbose) DEBUG.editors();
    }

  },

  close: function(e) {

    if (STATE) {
      if (STATE.debug) console.log("PRINTING CLOSE:", e);
      if (STATE.verbose) DEBUG.editors();
    }

  },
  // -- /\ These Commands are shared and can run in iFRAME or the MAIN Context /\ -- //

  // -- \/ This Command runs in iFRAME Context \/ -- //
  set: function(css) {

    return function() {

      var head = PRINT.append.call(this.contentDocument, css);

      [
        {
          "http-equiv" : "Cross-Origin-Opener-Policy",
          "content" : "same-origin-allow-popups"
        },
        {
          "http-equiv" : "Cross-Origin-Resource-Policy",
          "content": "same-site"
        },
        {
          "http-equiv" : "Cross-Origin-Embedder-Policy",
          "content" : "require-corp"
        }
      ].forEach((value) => {
        var meta = this.contentDocument.createElement("meta");
        Object.keys(value).forEach((key) => meta.setAttribute(key, value[key]));
        head.appendChild(meta);
      });

      this.contentWindow.__container__ = this;
      this.contentWindow.onbeforeprint = PRINT.prepare;
      this.contentWindow.onafterprint = function(e) {

        PRINT.close(e);

        this.parent.focus();
    
        document.body.removeChild(this.__container__);

        setTimeout(ACTION.focus);

      };
      
      this.contentWindow.focus();
      this.contentWindow.print();

    };

  },
  // -- /\ This Command runs in iFRAME Context /\ -- //

  generate : function(text, extra_Formatting, strict, lineBreaks) {

    if (text) {

      // == Process Actions == //
      var pattern = RegExp("^\@\@\#([A-Z_\-]+)\#\@\@$", "gm"),
        match,
        actions = [],
        markers = [];

      var _words = text.match(/\S+/g);
      var word_Count = _words ? _words.length.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",") : 0;

      // -- Match Actions -- //
      while ((match = pattern.exec(text))) {

        // == Insert Inline | Word Count == //
        if (match[1] == "WORD_COUNT") {
          actions.push((function(m) {
            return function(text) {
              return text.substr(0, m.index) + 
                "Words: " + 
                word_Count + 
                text.substr(m.index + m[0].length);
            };
          })(match));

        // == Insert Inline | Page Break == //
        } else if (match[1] == "PAGE_BREAK") {
          actions.push((function(m) {
            return function(text) {
              return text.substr(0, m.index) + 
                '<div class="page-break"></div>' + 
                text.substr(m.index + m[0].length);
            };
          })(match));

        // == Insert Per-Page Footer | Page Numbers == //
        } else if (match[1] == "PAGE_NUMBERS") {
          markers.push(function() {
            return '<div class="page-number">Page </div>';
          });
          actions.push((function(m) {
            return function(text) {
              return text.substr(0, m.index) + text.substr(m.index + m[0].length);
            };
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

      try {

        // == General: Clean Up Text == //

        // -- Firstly, identify code blocks
        // -- Code Blocks are ``` or ~~~
        // -- Single Line of code is `code`
        const codeBlock = /^(\t*| *)(```|~~~)(\t*| *).*$/gm;
        var code_Match, code_Matches = [];
        while ((code_Match = codeBlock.exec(text)) !== null) {
          if (code_Matches.length > 0 && code_Matches[code_Matches.length - 1].close === undefined) {
            code_Matches[code_Matches.length - 1].close = {
              start : code_Match.index,
              end : codeBlock.lastIndex
            };
          } else {
            code_Matches.push({
              open : {
                start : code_Match.index,
                end : codeBlock.lastIndex
              }
            });
          } 
        }

        // -- Remove whitespace (greater that four spaces or tab) at the start of lines -- //
        // -- This avoids it being converted to 'pre' elements that overflow the page and look weird -- //
        // -- Except in code blocks! -- //
        var replacer = function(match, capture, offset) {
          var blocked = !!code_Matches.find((code) => code.open && code.close && offset >= code.open.end && (offset + match.length) <= code.close.start);
          return blocked ? match : "   ";
        }
        text = text.replace(/^(\t+| {4,})/gm, replacer);

      } catch (e) {

        // -- Log Error --
        DEBUG.error(e, "GENERAL TEXT CLEAN-UP ERROR");

      }
      
    }

    var css = function(header) {

      // -- TOP RIGHT BOTTOM LEFT -- //
      // margin-top, margin-right, margin-bottom, and margin-left

      var _header = "margin: " + STATE.print.margins.map(function(margin, index) {
        return margin + (index == 0 || index == 2 ? "mm" : "vw");
      }).join(" ") + ";",
          _width = 97 - STATE.print.margins[1] - STATE.print.margins[3];
      return extra_Formatting ? [
        "body {counter-reset: page-number;" + (STATE.print.font.family && STATE.print.font.family != "default" ? "font-family: " + STATE.print.font.family + ";" : "") + "font-size: " + STATE.print.font.size + "pt !important;" + (header ? "" : " " + _header) + "}",
        "body p, body li {line-height: " + STATE.print.line.height + ";}",
        "body > table:first-child > thead {display: table-header-group; color: #888;}",
        "body > table:first-child > thead ul li {line-height: " + STATE.print.line.header + " !important;}",
        "body > table:first-child > tbody {" + (header ? (_header + " display: table;") : "") + "}",
        "body > table:first-child > tbody p {max-width: " + _width + "vw; word-wrap: break-word;}",
        "body > table:first-child > tbody pre {white-space: pre-wrap;}",
        "body > table:first-child > tfoot {display: table-footer-group; color: #888; text-align: right;}",
        "body .align-lhs {text-align: left;}",
        "body .align-rhs {text-align: right;}",
        "body .align-center {text-align: center;}",
        "body .align-justify {width: 100%; text-align: justify;}",
        "body table tr th {padding-left: 4px; padding-right: 4px;}",
        "body table tr td {padding: 2px;}",

        "code {overflow-wrap: break-word; text-wrap: wrap;}",

        ".page-break {page-break-before: always;}",
      
        "div.page-number:before {counter-increment: page-number;}",
        "div.page-number {font-weight: bold;}",
        "div.page-number:after {content: counter(page-number);}",

        // == This removes Print Headers / Footers == //
        // "@page {size:auto; margin:5mm;}",

        // "div.page-number {position: fixed; bottom: 5px; right: 10px;}",

      ].join(" ") : false;

    };

    try {

      if (!strict) {

        // == Not Strict: Clean Up Common Text Issues == //
        var _regexes = [

          { // -- Match dots after numerical line starts, which will be parsed as OL > LI -- //
            match: /^[0-9]+(\.{1})\s/mig,
            replace: function(match, p1) {
              var _reversed = match.split("").reverse().join("");
              var _replaced = _reversed.replace(p1, ". ");
              var _return = _replaced.split("").reverse().join("");
              return _return;
            }
          }

        ];

        $.each(_regexes, function(i, regex) {
          text = text.replace(regex.match, regex.replace);
        });

      }

      // Try to print Markdown Parsed Document
      var converter = new showdown.Converter({
        extensions : extra_Formatting ? ["classify"] : [],
        tables : true,
        strikethrough : true,
        disableForced4SpacesIndentedSublists : true,
        simpleLineBreaks : lineBreaks,
      });
      var html = converter.makeHtml(text),
        _header;

      if (extra_Formatting) {

        if (STATE && STATE.debug) console.log("Pre-Processing / Post-Markdown HTML", html);

        var _nodes = $.parseHTML(html),
          _headers = [],
          _footers = [],
          _content = [];

        $.each(markers, function(i, value) {
          if (value) _footers.push(typeof value === "function" ? value() : value);
        });

        $.each(_nodes, function(i, el) {

          if (el.nodeName !== "META" && !(el.nodeName == "#text" && !el.textContent.trim())) {

            if (_content.length === 0 && (el.nodeName == "HR" || el.nodeName == "UL")) {

              _headers.push(el);

            } else {

              $.each([
                {
                  el: "H1",
                  regex: /\b(\s*[#@]{1}\s*)$/
                },{
                  el: "H2",
                  regex: /\b(\s*[#@]{2}\s*)$/
                },{
                  el: "H3",
                  regex: /\b(\s*[#@]{3}\s*)$/
                }
              ], function(j, value) {
                if (el.nodeName == value.el && value.regex.test(el.innerText)) {

                  if (STATE && STATE.debug) console.log(`Page-Break Match: Element ${i} [${_content.length}]`,
                    el.nodeName, el.innerText);

                  el.innerText = el.innerText.replace(value.regex,"");
                  if (_content.length > 0) el.classList.add("page-break");
                  return false;
  
                }
              });

              _content.push(el);


            }

          }

        });

        if (_headers.length === 3) {

          var _html = ["<table>"];

          // -- Page Headers -- //
          _header = true;
          _html = _html.concat(["<thead>", "<tr>", "<td>"]);
          $.each(_headers, function(i, el) {
            _html.push(el.outerHTML);
          });
          _html = _html.concat(["</td>", "</tr>", "</thead>"]);
          // -- Page Headers -- //

          // -- Page Body -- //
          _html = _html.concat(["<tbody>", "<tr>", "<td>"]);
          $.each(_content, function(i, el) {
            _html.push(el.outerHTML);
          });
          _html = _html.concat(["</td>", "</tr>", "</tbody>"]);
          // -- Page Body -- //

          // -- Page Footers -- //
          if (_footers.length > 0) {
            _html = _html.concat(["<tfoot>", "<tr>", "<td>"]);
            $.each(_footers, function(i, el) {
              if (el) _html.push(el.outerHTML ? el.outerHTML : el);
            });
            _html = _html.concat(["</td>", "</tr>", "</tfoot>"]);
          }
          // -- Page Footers -- //

          _html = _html.concat(["</table>"]);
          html = _html.join("\n");

        }

      }

      return {
        html : html,
        text : text,
        css : {
          full : css(_header),
          plain : css(),
        }
      };

    } catch (e) {

      // -- Log Error -- //
      DEBUG.error(e, "MARKDOWN RENDERING ERROR");

      // Fall back to plain text
      return {
        text : text,
        css : {
          plain : css(),
        }
      };

    }
  },

  html: function(html, css, type = "iframe", title) {

    if (STATE && STATE.debug) {
      console.log("CSS for Printable HTML:", css);
      console.log("Printable HTML", html);
    }
    
    if (type == "iframe") {

      var _frame = document.createElement("iframe");
      _frame.setAttribute("id", "printable-version");
      _frame.onload = PRINT.set(css);
      _frame.style.visibility = "hidden";
      _frame.style.position = "fixed";
      _frame.style.right = "0";
      _frame.style.bottom = "0";

      _frame.srcdoc = html;

      document.body.appendChild(_frame);

    } else if (type == "embedded") {

      document.getElementById("printable").innerHTML = html;

      var _head = PRINT.append.call(document, css);

      var _fn = function(document, head) {

        return function(e) {

          PRINT.close(e);
  
          head.removeChild(document.getElementById("printable-css"));
          document.getElementById("printable").innerHTML = "";
  
          if (title) document.title = title;

          setTimeout(ACTION.focus);
  
        }

      };

      window.onbeforeprint = PRINT.prepare;
      window.onafterprint = _fn(document, _head);
      
      window.print();

    }
    
  },

  print: function(text, extra_Formatting, strict, lineBreaks) {

    try {

      var _title = String(document.title),
          _printable = PRINT.generate(text, extra_Formatting, strict, lineBreaks);

      // Print full formed HTML
      PRINT.html(_printable.html || _printable.text || "", _printable.css.full || _printable.css.plain, STATE.print.mode, _title);

    } catch (e) {

      // -- Log Error -- //
      DEBUG.error(e, "MARKDOWN PRINTING ERROR");

      // Fall back to printing plain text
      PRINT.html(text);

    }

  }

};
// -- PRINT Commands -- //


// -- CONFIGURE Commands -- //
var CONFIGURE = {

  keys: function() {

    return [

      {
        key: "DEBUG",
        get: function() {
          return STATE.debug;
        },
        set: function(value) {
          STATE.debug = value;
        },
      },{
        key: "SAVE_RECOVERY",
        get: function() {
          return STATE.file.recovery;
        },
        set: function(value) {
          STATE.file.recovery = value;
        },
      },
      {
        key: "SAVE_AUTOSAVE",
        get: function() {
          return STATE.file.autosave;
        },
        set: function(value) {
          STATE.file.autosave = value ? value : 0;
          SAVE.auto();
        },
      },
      {
        key: "PRINT_FONT_FAMILY",
        get: function() {
          return STATE.print.font.family;
        },
        set: function(value) {
          STATE.print.font.family = value ? value : DEFAULTS.font.family;
        },
      },
      {
        key: "PRINT_FONT_SIZE",
        get: function() {
          return STATE.print.font.size;
        },
        set: function(value) {
          STATE.print.font.size = value;
        },
      },
      {
        key: "PRINT_LINE_BREAKS",
        get: function() {
          return STATE.print.line.breaks;
        },
        set: function(value) {
          STATE.print.line.breaks = value;
        },
      },
      {
        key: "PRINT_LINE_HEIGHT",
        get: function() {
          return STATE.print.line.height;
        },
        set: function(value) {
          STATE.print.line.height = value;
        },
      },
      {
        key: "PRINT_HEADER_LINE_HEIGHT",
        get: function() {
          return STATE.print.line.header;
        },
        set: function(value) {
          STATE.print.line.header = value;
        },
      },
      {
        key: "PRINT_GUTTER_TOP",
        get: function() {
          return STATE.print.margins[0];
        },
        set: function(value) {
          STATE.print.margins[0] = value;
        },
      },
      {
        key: "PRINT_GUTTER_RIGHT",
        get: function() {
          return STATE.print.margins[1];
        },
        set: function(value) {
          STATE.print.margins[1] = value;
        },
      },
      {
        key: "PRINT_GUTTER_BOTTOM",
        get: function() {
          return STATE.print.margins[2];
        },
        set: function(value) {
          STATE.print.margins[2] = value;
        },
      },
      {
        key: "PRINT_GUTTER_LEFT",
        get: function() {
          return STATE.print.margins[3];
        },
        set: function(value) {
          STATE.print.margins[3] = value;
        },
      },
      {
        key: "PRINT_MODE_EMBEDDED",
        get: function() {
          return STATE.print.mode === "embedded";
        },
        set: function(value) {
          STATE.print.mode = value === true ? "embedded" : "iframe";
        },
      },
      {
        key: "CUSTOM_TEMPLATES",
        get: function() {
          return STATE.templates;
        },
        set: function(value) {
          STATE.templates = value;
        },
      },
      {
        key: "AUTOCORRECT",
        get: function() {
          return STATE.options.autocorrect;
        },
        set: function(value) {
          STATE.options.autocorrect = value;
        },
      },
      {
        key: "SPELLCHECK",
        get: function() {
          return STATE.options.spellcheck;
        },
        set: function(value) {
          STATE.options.spellcheck = value;
        },
      },
      {
        key: "HIGHLIGHT_MISTAKES",
        get: function() {
          return STATE.options.highlight;
        },
        set: function(value) {
          STATE.options.highlight = value;
        },
      },
      {
        key: "SUGGEST_CORRECTIONS",
        get: function() {
          return STATE.options.suggest;
        },
        set: function(value) {
          STATE.options.suggest = value;
        },
      },
      {
        key: "CONTEXTUAL_CORRECTIONS",
        get: function() {
          return STATE.options.contextual;
        },
        set: function(value) {
          STATE.options.contextual = value;
        },
      },
      {
        key: "DICTIONARY_LANGUAGE",
        get: function() {
          return STATE.options.dictionary;
        },
        set: function(value) {
          STATE.options.dictionary = value;
        },
      },

    ];
  },

  managed: () => CONFIGURE.read("managed")
      .then((state) => {
        if (state && state.debug) console.log("Configured State:", state);
        return state;
      })
      .catch((e) => {
        DEBUG.error(e, "MANAGED CONFIGURATION ERROR");
        return null;
      }),

  read: function(from) {

    var _storage = chrome.storage[from ? from : "managed"];
    if (!_storage) return;

    return new Promise((resolve, reject) => {
      _storage.get(null, function(items) {
        if (!chrome.runtime.lastError) {
          CONFIGURE.keys().forEach(function(key) {
            if (items[key.key] !== undefined && items[key.key] !== null) key.set(items[key.key]);
          });
          resolve(STATE);
        } else {
          reject(chrome.runtime.lastError);
        }
      });      
    });

  },

};
// -- CONFIGURE Commands -- //


// -- OPTIONS Commands -- //
var OPTIONS = {
  
  battery : (function() {

    var add_Listerners = function(battery) {

      battery.addEventListener("chargingchange", () => {
      });

      battery.addEventListener("levelchange", () => {
      });
    
      battery.addEventListener("chargingtimechange", () => {
      });

      battery.addEventListener("dischargingtimechange", () => {
      });

    };

    var seconds_To_Duration = function(seconds) {

        seconds = Number(seconds);

        var h = Math.floor(seconds / 3600),
            m = Math.floor(seconds % 3600 / 60),
            s = Math.floor(seconds % 3600 % 60);
    
        var hours = h > 0 ? h + (h == 1 ? " hour" : " hours") : "",
            minutes = m > 0 ? m + (m == 1 ? " min" : " mins") : "",
            seconds = s > 0 ? s + (s == 1 ? " sec" : " secs") : "";

        return `${hours}${hours ? ", " : ""}${minutes}${minutes ? ", " : ""}${seconds}`; 

    };

    return {

      info : function() {

        return navigator.getBattery ?
          navigator.getBattery().then((battery) => {

            var _return = {
              charging : battery.charging,
              level : {
                value: battery.level,
                percentage : `${Math.round(battery.level * 100)}%`
              },
              times : {
                to_charge : battery.charging && battery.chargingTime !== Infinity ? {
                  value : battery.chargingTime,
                  formatted : seconds_To_Duration(battery.chargingTime)
                } : null,
                to_discharge : !battery.charging && battery.dischargingTime !== Infinity ? {
                  value : battery.dischargingTime,
                  formatted : seconds_To_Duration(battery.dischargingTime)
                } : null
              }
            };

            _return.formatted = `Battery Level: ${_return.level.percentage}${_return.times.to_charge && _return.times.to_charge.value > 0 ? 
              ` | ${_return.times.to_charge.formatted} until full` : _return.times.to_discharge && _return.times.to_discharge.value > 0 ?
              ` | ${_return.times.to_discharge.formatted} until empty` : ""}`;

            _return.html = `<span>Battery Level: <strong>${_return.level.percentage}</strong></span>${_return.times.to_charge || _return.times.to_discharge ? 
              `<br /><span>${_return.times.to_charge && _return.times.to_charge.value > 0 ? 
              `${_return.times.to_charge.formatted} until full` : _return.times.to_discharge && _return.times.to_discharge.value > 0 ?
              `${_return.times.to_discharge.formatted} until empty` : ""}</span>` : ""}`;

            return _return;

          }) : Promise.resolve(null);

      },

      show : function(source, charge) {

        var index = 0;
        source.find(".battery .bar").each(function() {
          var power = Math.round(charge / 10);
          if (index != power) {
            $(this).addClass("active");
            index++;
          } else {
            $(this).removeClass("active");
          }
        });

      },
      
    };

  })(),

  show: function(editor) {

    request("/pages/control.html").then(function(value) {
      $("#modal").empty().append(value);
      var _modal = $("#modal .modal").on("hidden.bs.modal", ACTION.focus);

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

      ["dark", "muted_dark", "blue", "light", "muted_light"].forEach(function(value) {
        _modal.find("#" + value + "Mode")
          .prop("checked", editor.getTheme() == DEFAULTS.theme[value])
          .on("change", function(e) {
            if ($(e.currentTarget).prop("checked")) {
              editor.setTheme(DEFAULTS.theme[value]);
              $("body").css("background-color", $("#editor").css("background-color"));
            }
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
          _modal.focus();
        });

      _modal.find("#exampleMarkdown")
        .on("click", function() {
          INSERT.markdown(editor);
          _modal.focus();
        });

      _modal.find("#headerTemplate")
        .on("click", function() {
          INSERT.header(editor);
          _modal.focus();
        });

      _modal.find("#headerInternalTemplate")
        .on("click", function() {
          INSERT.header_internal(editor);
          _modal.focus();
        });

      _modal.find("#exampleAlignments")
        .on("click", function() {
          INSERT.alignments(editor);
          _modal.focus();
        });
        
      _modal.find("#centerAlignment")
        .on("click", function() {
          INSERT.alignments(editor, "center");
          _modal.focus();
        });
      
      _modal.find("#leftAlignment")
        .on("click", function() {
          INSERT.alignments(editor, "left");
          _modal.focus();
        });
        
      _modal.find("#rightAlignment")
        .on("click", function() {
          INSERT.alignments(editor, "right");
          _modal.focus();
        });
        
      _modal.find("#justifyAlignment")
        .on("click", function() {
          INSERT.alignments(editor, "justify");
          _modal.focus();
        });
        
      _modal.find("#tableScaffolding")
        .on("click", function() {
          var _columns = Number(_modal.find("#table_Columns").val() || 3),
              _rows = Number(_modal.find("#table_Rows").val() || 3);
          if (_columns && _rows) INSERT.table(editor, _columns, _rows);
          _modal.focus();
        });

      _modal.find("#wordCounter")
        .on("click", function() {
          INSERT.count(editor);
          _modal.focus();
        });

      _modal.find("#pageBreak")
        .on("click", function() {
          INSERT.break(editor);
          _modal.focus();
        });

        _modal.find("#pageNumbers")
        .on("click", function() {
          INSERT.numbers(editor);
          _modal.focus();
        });

      _modal.find("#helpGeneral")
        .on("click", ACTION.instructions);

      _modal.find("#helpCharacters")
        .on("click", ACTION.characters);

      _modal.find("#simpleLineBreaks")
        .prop("checked", STATE.print.line.breaks)
        .on("change", function(e) {
          STATE.print.line.breaks = $(e.currentTarget).prop("checked");
        });

      _modal.find("#save")
        .on("click", function() {
          SAVE.initial(editor);
        });

      _modal.find("#print, #printNormally")
        .on("click", function() {
          PRINT.print(editor.getSession().getValue(), true, false, STATE.print.line.breaks);
        });

      _modal.find("#printStrict")
        .on("click", function() {
          PRINT.print(editor.getSession().getValue(), true, true, STATE.print.line.breaks);
        });

      _modal.find("#printNoFormatting")
        .on("click", function() {
          PRINT.print(editor.getSession().getValue(), false, false, STATE.print.line.breaks);
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
        _allWords = editor.getValue().match(/\S+/g),
        _words = _allWords ? _allWords.length.toString().replace(_format, ",") : 0,
        _chars = editor.getValue().length.toString().replace(_format, ",");

      _modal.find("#lastSaved").text(STATE.file.saved ? STATE.file.saved.toLocaleString() : "Never");
      _modal.find("#lineCount").text(_lines);
      _modal.find("#wordCount").text(_words);
      _modal.find("#characterCount").text(_chars);

      // -- Handle Populating Custom Templates -- //
      var _templates = _modal.find("#templates");
      if (STATE.templates && STATE.templates.length > 0 && STATE.templates.filter((template) => template.title).length > 0) {
        _templates.removeClass("d-none");
        var _custom = _templates.children(".dropdown-menu");
        _custom.empty();
        STATE.templates
          .filter((template) => template.title && template.template)
          .forEach((template) => {
          if (STATE && STATE.debug) console.log("Custom Template:", template);
          var _template = $(`<a class="dropdown-item" href="#">${template.title}</a>`);
          _custom.append(_template);
          _template.on("click", (template => () => {
            if (STATE && STATE.debug) console.log(`[SELECTED] ${template.title}:`, template.template);
            INSERT.arbitary(editor, template.template, template.top !== false);
            _modal.focus();
          })(template));
        });
      } else {
        _templates.addClass("d-none");
      }

      // -- Display Spelling Option (if allowed) -- //
      _modal.find("[data-option='spelling']")
        .each((index, element) => {
          if (!element) return;
          element = $(element);
          var _show = element.data("show"),
              _hide = element.data("hide");
          
          if (STATE.show.spelling()) {
            element.addClass(_show);
            element.removeClass(_hide);
          } else {
            element.removeClass(_show);
            element.addClass(_hide);
          }
        });

      // -- Configure Spelling Highlight -- //
      _modal.find("#spelling-highlight")
        .prop("checked", STATE.options.highlight)
        .on("change", function(e) {
          var value = $(e.currentTarget).prop("checked");
          STATE.options.highlight = value;
          if (value) {
            if (STATE.loaded.highlight) {
              // Enable Highlighting
              CORRECT.highlight.enable();
            } else {
              // Load Highlighting
              // Don't load as wasn't initially loaded by policy!
              // LOADED.highlight();
            }
          } else {
            // Disable Highlighting
            CORRECT.highlight.disable();
          }
        });

      // -- Configure Battery Information -- //
      OPTIONS.battery.info().then(function(value) {

        if (value) OPTIONS.battery.show(_modal, value.level);

        _modal.find("[data-display='battery']").each((index, element) => {

          if (!element) return;
          element = $(element);

          var _show = element.data("show"),
              _hide = element.data("hide");

          if (value) {

            element.find("[data-display='battery-details']").each((index, details) => {

              if (!details) return;
              details = $(details);

              details.prop("title", value.html);
              if (details.tooltip) details.tooltip();

            });

            element.find("[data-display='battery-level']").each((index, levels) => {

              if (!levels) return;
              levels = $(levels);

              levels.css("width", value.level.percentage);
              levels.append(`<span>${value.level.percentage}</span>`);

              if (value.charging) levels.addClass("charging");
              if (value.level.value > 0.7) {  
                levels.addClass("high");  
              } else if (value.level.value >= 0.4 ) {  
                levels.addClass("medium");
              } else {  
                levels.addClass("low");  
              }

            });

            element.addClass(_show);
            element.removeClass(_hide);

          } else {

            element.removeClass(_show);
            element.addClass(_hide);

          }

        });
        
      })
      
      // -- Handle Enter to Close -- //
      _modal.keypress((e) => {
        if (e.which === 13) {
          e.preventDefault();
          _modal.modal("hide");
        }
      });
      
      // -- Show Modal -- //
      _modal.modal("show");

    });

  },
  
};
// -- OPTIONS Commands -- //


// -- DYNAMIC Commands -- //
var DYNAMIC = {

  script: (url) => {

    return new Promise((resolve) => {

      try {

        var script = document.createElement("script");
        script.type = "text/javascript";
        script.src = url;
        script.onerror = () => resolve(false);
        script.onload = () => resolve(true);
        document.head.append(script);

      } catch(e) {
        DEBUG.error(e, `SCRIPT (${url}) IMPORT ERROR`);
        resolve(false);
      }

    });

  },

  style: (url) => {

    return new Promise((resolve) => {

      try {

        var style = document.createElement("link");
        style.rel = "stylesheet";
        style.type = "text/css";
        style.href = url;
         
        document.head.append(style);
        resolve(true);
        
      } catch(e) {
        DEBUG.error(e, `STYLE (${url}) IMPORT ERROR`);
        resolve(false);
      }
      
    });

  }

}
// -- DYMAMIC Commands -- //


// -- CORRECT Commands -- //
var CORRECT = {

  highlight : (() => {
    
    const UI_DEBOUNCE = 100,
          MODE_DEBOUNCE = 500;

    var enabled, markers = [];

    var clear = (session) => {
      if (!session) session = STATE.session();
    
      // Clear all markers and gutter
      for (var i in markers) {
        session.removeMarker(markers[i]);
      };
      markers = [];

      // Clear the gutter
      var lines = session.getDocument().getAllLines();
      for (var i in lines) {
        session.removeGutterDecoration(i, "misspelled");
      };

    };

    var check, run, enable, disable;

    var initialise = (state, dictionary) => {

      var modified = true,
          checking = false;
  
      enabled = true;
      STATE.loaded.dictionary = dictionary;

      check = function() {
  
        if (dictionary == null || checking || !modified) return;
  
        checking = true;
        var session = state.session();
  
        // Clear all markers and gutter
        for (var i in markers) {
          session.removeMarker(markers[i]);
        };
        markers = [];
  
        // Clear the gutter
        var lines = session.getDocument().getAllLines();
        for (var i in lines) {
          session.removeGutterDecoration(i, "misspelled");
        };
  
        // Populate with markers and gutter
        try {
  
          var range = ace.require("ace/range").Range,
              lines = session.getDocument().getAllLines();
  
          for (var i in lines) {
  
            // Check spelling of this line.
            var misspellings = CORRECT.misspelled(lines[i], dictionary);
            
            // Add markers and gutter markings.
            if (misspellings.length > 0) {
              session.addGutterDecoration(i, "misspelled");
            }
  
            for (var j in misspellings) {
              var r = new range(i, misspellings[j][0], i, misspellings[j][1]);
              markers[markers.length] = session.addMarker(r, "misspelled", "typo", true);
            }
  
          }
  
        } finally {
          checking = false;
          modified = false;
        }
  
      };

      // -- Debounce Run Function -- //
      run = _.debounce(() => {
        modified = true;
        check();
      }, UI_DEBOUNCE);

      disable = _.debounce(() => {
        enabled = false;
        clear();
      }, MODE_DEBOUNCE);
  
      enable = _.debounce(() => {
        enabled = true;
        run();
      }, MODE_DEBOUNCE);
  
      // -- Set Run on Editor Session Change -- //
      state.session().on("change", function() {
        if (enabled) run();
      });

      // -- Finally, enable Highlighter -- //
      enable();

    };

    return {

      disable : () => disable(),

      enable : () => enable(),

      initialise : initialise

    }
  })(),

  replace : function(original, line, start, end, replacement) {
    var lines = original.split("\n");
    var output = "";
    for (var i = 0, _len = lines.length; i < _len; ++i) {
      if (i != line) {
        output += lines[i] + (i == _len - 1 ? "" : "\n");
      } else {
        output += lines[i].substring(0, start);
        output += replacement;
        output += lines[i].substring(end, lines[i].length) + (i == _len - 1 ? "" : "\n");
      }
    }
  
    return output;	
  },

  contextual : function(state, dictionary) {

    if (state && state.debug) console.log("Adding Context Menu");

  },

  misspelled : function(line, dictionary) {
    if (!dictionary) return;
    var words = line.split(/[^a-zA-Z\-']/);
    var i = 0;
    var bads = [];
    for (var word in words) {
      var x = words[word] + "";
      var checkWord = x.replace(/[^a-zA-Z\-']/g, '');
      if (!dictionary.check(checkWord)) {
        bads[bads.length] = [i, i + words[word].length];
      }
      i += words[word].length + 1;
    }
    return bads;
  },

  suggest : function(word, dictionary) {

    if (!dictionary) return;
    var suggestions = dictionary.suggest(word);
    return dictionary.check(word) || suggestions.length === 0 ? false : suggestions;

  },

  edit : function() {

    var position = STATE.editor().getCursorPosition(),
        range = STATE.session().getWordRange(position.row, position.column),
        word = STATE.session().getTextRange(range);
      
    if (STATE && STATE.debug) console.log("SELECTED WORD:", word);

    if (word && word.trim()) {

      if (CORRECT.misspelled(word, STATE.loaded.dictionary)) {

        var _marker = STATE.session().addMarker(range, "ace_bracket", "text");
        setTimeout(() => {
            STATE.session().removeMarker(_marker);
          }, 3000);

        var suggestions = CORRECT.suggest(word, STATE.loaded.dictionary);
        if (suggestions && suggestions.length > 0) {

          if (STATE && STATE.debug) console.log("SUGGESTIONS:", suggestions);

          // -- Remove any existing Tooltips -- //
          $(".ace_tooltip").remove();

          (function() {

            var Tooltip = ace.require("ace/tooltip").Tooltip,
              tooltip = new Tooltip(STATE.editor().container);

            tooltip.setText(suggestions.join(" | "));
            tooltip.width = tooltip.getWidth();
            tooltip.height = tooltip.getHeight();

            tooltip.show(null, 20, 10);

            setTimeout(() => {
              tooltip.hide();
              tooltip.destroy();
              STATE.tooltip = null;
            }, 6000);

          })()
          

        }
      }
      
    }

  }
  
};
// -- CORRECT Commands -- //


// -- SPELLCHECK Commands -- //
var SPELLCHECK = {

  configure : function(enable, autocorrect) {

    // -- Configure Standards Spellcheck -- //
    var el_editor = document.getElementById("editor"), el_textarea = el_editor ? el_editor.getElementsByTagName("textarea")[0] : null;
    [el_editor, el_textarea].forEach(function(element) {
        if (!element) return;
        element.setAttribute("contenteditable", true);
        element.setAttribute("spellcheck", !!enable);
        element.setAttribute("data-gramm", !!enable);
        if (autocorrect && enable) {
          element.setAttribute("autocorrect", "on");
        } else {
          element.setAttribute("autocorrect", "off");
          element.setAttribute("autocomplete", "off");
        }
    });

  },

  enable : function(autocorrect) {

    SPELLCHECK.configure(true, autocorrect);

  },

  disable : function() {

    SPELLCHECK.configure(false);

  },

};
// -- SPELLCHECK Commands -- //


// -- LOADED Commands -- //
var LOADED = {

  commands : function(editor) {

    editor.commands .addCommand({
      name: "Show Controls",
      bindKey: {
        win: "Esc",
        mac: "Esc"
      },
      exec: OPTIONS.show,
      readOnly: true
    }); // -- Show Options Dialog -- //
    
    editor.commands.addCommand({
      name: "Show Controls | Alternative",
      bindKey: {
        win: "Ctrl-Return",
        mac: "Command-Return"
      },
      exec: OPTIONS.show,
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
      name: "Save Manually",
      bindKey: {
        win: "Ctrl-Alt-S",
        mac: "Command-Alt-S"
      },
      exec: SAVE.manually,
      readOnly: true
    }); // -- Save Manually -- //

    editor.commands.addCommand({
      name: "Save HTML",
      bindKey: {
        win: "Ctrl-Shift-A",
        mac: "Command-Shift-A"
      },
      exec: SAVE.html,
      readOnly: true
    }); // -- Save -- //
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
        PRINT.print(editor.getSession().getValue(), true, false, STATE.print.line.breaks);
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
        PRINT.print(editor.getSession().getValue(), false, false, STATE.print.line.breaks);
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
        PRINT.print(editor.getSession().getValue(), true, true, STATE.print.line.breaks);
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
    
    editor.commands.addCommand({
      name: "Go to Top",
      bindKey: {
        win: "Ctrl-Esc",
        mac: "Command-Esc"
      },
      exec: GOTO.start,
      readOnly: true
    }); // -- Go To Top (overrides default close) -- //
    
    editor.commands.addCommand({
      name: "Go to Top | Arrow",
      bindKey: {
        win: "Ctrl-Up",
        mac: "Command-Up"
      },
      exec: GOTO.start,
      readOnly: true
    }); // -- Go To Top -- //
    
    editor.commands.addCommand({
      name: "Go to Bottom",
      bindKey: {
        win: "Ctrl-Shift-Esc",
        mac: "Command-Shift-Esc"
      },
      exec: GOTO.end,
      readOnly: true
    }); // -- Go To Bottom -- //
    
    editor.commands.addCommand({
      name: "Go to Bottom | Arrow",
      bindKey: {
        win: "Ctrl-Down",
        mac: "Command-Down"
      },
      exec: GOTO.end,
      readOnly: true
    }); // -- Go To Bottom -- //
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
        $("body").css("background-color", $("#editor").css("background-color"));
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
        $("body").css("background-color", $("#editor").css("background-color"));
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
        $("body").css("background-color", $("#editor").css("background-color"));
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
      exec: ACTION.instructions,
      readOnly: true
    }); // -- Show Help -- //
  
    editor.commands.addCommand({
      name: "List Foreign Characters",
      bindKey: {
        win: "Ctrl-Shift-/",
        mac: "Command-Shift-/"
      },
      exec: ACTION.characters,
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
      name: "Insert Header Template",
      bindKey: {
        win: "Ctrl-T",
        mac: "Command-T"
      },
      exec: INSERT.header,
      readOnly: true
    }); // -- Insert Header Template -- //
  
    editor.commands.addCommand({
      name: "Insert Internal Header Template",
      bindKey: {
        win: "Ctrl-E",
        mac: "Command-E"
      },
      exec: INSERT.header_internal,
      readOnly: true
    }); // -- Insert Internal Header Template -- //
    // -- Insertion Commands -- //
  
    // -- Spelling / Highlight Commands -- //
    if (STATE.options.highlight || STATE.loaded.highlight) {

      // -- Toggle Highlighting On/Off -- //
      editor.commands.addCommand({
        name: "Toggle Spelling Check Highlight",
        bindKey: {
          win: "Ctrl-Shift-H",
          mac: "Command-Shift-H"
        },
        exec: () => {
          if (STATE.options.highlight) {
            STATE.options.highlight = false;
            CORRECT.highlight.disable();
          } else {
            STATE.options.highlight = true;
            CORRECT.highlight.enable();
          }
        },
        readOnly: true
      });

      if (STATE.options.suggest) {

        editor.commands.addCommand({
          name: "Spelling Edit / Suggestions",
          bindKey: {
            win: "Ctrl-Shift-E",
            mac: "Command-Shift-E"
          },
          exec: CORRECT.edit,
          readOnly: true
        });

        editor.commands.addCommand({
          name: "Spelling Edit / Suggestions (F12)",
          bindKey: {
            win: "F12",
            mac: "F12"
          },
          exec: CORRECT.edit,
          readOnly: true
        });

      }

      

    }
    // -- Spelling / Highlight Commands -- //

    // -- Extra Commands -- //
    editor.commands.addCommand({
      name: "Load Managed Configuration",
      bindKey: {
        win: "Ctrl-Shift-M",
        mac: "Command-Shift-M"
      },
      exec: CONFIGURE.managed,
      readOnly: true
    });
    // -- Extra Commands -- //

  },

  initial : function(state) {

    var editor = ace.edit("editor");
    editor.setTheme(DEFAULTS.theme.light);
    editor.getSession().setMode(DEFAULTS.mode.markdown);
    editor.getSession().setUseWrapMode(true);
    editor.setFontSize(DEFAULTS.font.size);
    editor.setShowPrintMargin(false);
    if (state && state.options) {

      if (state.options.spellcheck) editor.setOption("spellcheck", true);

      if (state.options.spellcheck === false || state.options.autocorrect === false) {
        document.addEventListener("contextmenu", function(e) {
          e.preventDefault();
        });
      }

    }
    
    state.editor = function() {
      return editor;
    }
    state.session = function () {
      return editor.getSession();
    }; 
    state.value = function() {
      return editor.getValue();
    };
    state.window = function() {
      return window;
    }

    // -- Configure Commands -- //
    LOADED.commands(editor);
    
    // -- Focus, ready to go! -- //
    ACTION.focus();

    // -- Return state for chaining -- //
    return state;
  
  },

  spellcheck : function(state) {

    return state && state.options ? 
      (state.loaded.spelling || !state.options.spellcheck ? 
        Promise.resolve(state) : 
        DYNAMIC.script("/libs/ace-1.32.3/ext-spellcheck.js").then(() => {

          if (state && state.debug) console.log("Loaded Spellcheck Script");

          // -- Mark that this has been loaded -- //
          state.loaded.spelling = true;

          return state;

        })
      ).then((state) => {

        if (state.options.spellcheck) {

          SPELLCHECK.enable(state.options.autocorrect);

        } else if (state.options.spellcheck === false) {

          SPELLCHECK.disable();

        }

        return state;

      }) : Promise.resolve(state);

  },

  highlight : function(state) {

    return new Promise((resolve) => {

      if (state && state.options && state.options.highlight) {

        // -- Configure Typo Extension -- //
        Promise.all([
          DYNAMIC.script("/libs/typo/typo.js"),
          DYNAMIC.script("/libs/underscore-1.13.6/underscore-min.js"),
        ]).then(() => {
          
          new Typo(state.options.dictionary, false, false, {
            dictionaryPath: "/libs/typo/dictionaries",
            asyncLoad: true,
            loadedCallback: function(dictionary) {

              if (state.options.contextual) Promise.all([
                DYNAMIC.script("/libs/jquery-contextmenu-2.9.2/jquery.contextMenu.min.js"),
                DYNAMIC.style("/libs/jquery-contextmenu-2.9.2/jquery.contextMenu.min.css")
              ]).then(() => CORRECT.contextual(state, dictionary));
    
              CORRECT.highlight.initialise(state, dictionary);

              // -- Mark that this has been loaded -- //
              state.loaded.highlight = true;

            }
          });

          resolve(state);

        });
        // -- Configure Typo Extension -- //
    
      } else {
        resolve(state);
      }

    });

  },

  templates : function(state) {
  
    // -- Insert Default Templates -- //
    if (state && state.templates && state.templates.length > 0) state.templates
    .filter((template) => template.template && template.default === true)
    .forEach((template) => {
      if (state && state.debug) console.log("Custom Default Template:", template);
      INSERT.arbitary(state.editor(), template.template);
    });
  // -- Insert Default Templates -- //

    return state;

  },

  finally : function(state) {

    return state;

  }

};
// -- LOADED Commands -- //


// -- DEBUG Commands -- //
var DEBUG = {

  editors : function() {

    if (!STATE || !STATE.debug) return;

    [{
      name : "Editor",
      el : document.getElementById("editor")
    },{
      name : "Text Entry",
      el : document.getElementById("editor").getElementsByTagName("textarea")[0]
    }].forEach(function(element) {
      console.log(`${element.name} Element:`, element.el.outerHTML);
      Array.from(element.el.attributes).forEach((attr) => {
          console.log(`${attr.nodeName}=${attr.nodeValue}`);
      });
    });

  },

  error : function(err, details) {

    if (!STATE || !STATE.debug) return;

    console.log(details || "ERROR", err);

  },

  window : function(value, details) {

    if (!STATE || !STATE.debug) return;

    console.log(details || "WINDOW", value ? value.document || value : null);

  },

};
// -- DEBUG Commands -- //

$(document).ready(function() {

  // -- Read Managed Configuration -- //
  CONFIGURE.managed()
    .then(LOADED.spellcheck) // Has to be called first to enable options
    .then(LOADED.initial)
    .then(LOADED.spellcheck)
    .then(LOADED.highlight)
    .then(LOADED.templates)
    .then(LOADED.finally)
    .catch((e) => {
      DEBUG.error(e);
      return STATE.editor ? null : LOADED.initial(STATE);
    });

});