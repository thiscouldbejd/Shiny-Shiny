var chosenEntry = null;

// -- Fonts --
var default_FontSize = 18;

// -- Themes --
var dark_Theme = "ace/theme/twilight";
var light_Theme = "ace/theme/tomorrow";
var default_Theme = light_Theme;


// -- Modes --
var markdown_Mode = "ace/mode/markdown";
var text_Mode = "ace/mode/plain_text";
var default_Mode = markdown_Mode;

$(document).ready(function(){

	var editor = ace.edit("editor");
	editor.setShowPrintMargin(true);
	editor.setTheme(default_Theme);
	editor.getSession().setMode(default_Mode);
	editor.getSession().setUseWrapMode(true);
	editor.setFontSize(default_FontSize);

	editor.commands.addCommand({
		name: 'Save Locally',
		bindKey: {win: 'Ctrl-S',  mac: 'Command-S'},
		exec: function(editor) {

			// -- Stolen from Google Chrome 'filesystem-access' Sample --
			var _accepts = [{extensions: ['txt']}];
			var _config = {type: 'saveFile', suggestedName: 'output.txt', accepts: _accepts};

			chrome.fileSystem.chooseEntry(_config, function(writableEntry) {
				var blob = new Blob([editor.getValue()], {type: 'text/plain'});
				writeFileEntry(writableEntry, blob, function(e) {
					console.log('Write complete :)');
					focus();
				});
			});
			// -- Stolen from Google Chrome 'filesystem-access' Sample --

		},
		readOnly: true
	});

	editor.commands.addCommand({
		name: 'Open Locally',
		bindKey: {win: 'Ctrl-Shift-O',  mac: 'Option-Shift-O'},
		exec: function(editor) {
			
			// -- Stolen from Google Chrome 'filesystem-access' Sample --
			var _accepts = [{extensions: ['txt']}];
			var _config = {type: 'openFile', accepts: _accepts};

			chrome.fileSystem.chooseEntry(_config, function(readableEntry) {
				if (!readableEntry) {return;}
				chrome.storage.local.set({'chosenFile': chrome.fileSystem.retainEntry(readableEntry)});
				loadFileEntry(readableEntry);
				focus();
			});
			// -- Stolen from Google Chrome 'filesystem-access' Sample --

		},
		readOnly: true
	});

	editor.commands.addCommand({
		name: 'Print Locally (using Markdown)',
		bindKey: {win: 'Ctrl-P',  mac: 'Command-P'},
		exec: function(editor) {
			
			var editor_Text = editor.getSession().getValue();
			if (editor_Text) {
				var title = editor_Text.match(new RegExp("^\@.+\@"));
				if (title && title.length == 1) {
					document.title = title[0].slice(1, title[0].length - 1);
					editor_Text = editor_Text.replace(title[0], "");
				}
			}
			
			var converter = new Markdown.Converter();
			var markdown_HTML = converter.makeHtml(editor_Text);
			console.log(markdown_HTML);
			var iframe = document.createElement("iframe");
			iframe.srcdoc = markdown_HTML;
			iframe.width = iframe.height = 1;
			iframe.style.display = "none";
			$("body").append(iframe);
			setTimeout(function() {
				iframe.contentWindow.print();
				setTimeout(function() {
					iframe.remove();
				});
			});
		},
		readOnly: true
	});

	editor.commands.addCommand({
		name: 'Show/Hide Syntax',
		bindKey: {win: 'Ctrl-G',  mac: 'Command-G'},
		exec: function(editor) {
			editor.renderer.setShowGutter(!editor.renderer.getShowGutter());
		},
		readOnly: true
	});

	editor.commands.addCommand({
		name: 'Markdown Syntax',
		bindKey: {win: 'Ctrl-M',  mac: 'Command-M'},
		exec: function(editor) {
			editor.getSession().setMode(markdown_Mode);
		},
		readOnly: true
	});
	
	editor.commands.addCommand({
		name: 'Plain Text Syntax',
		bindKey: {win: 'Ctrl-T',  mac: 'Command-T'},
		exec: function(editor) {
			editor.getSession().setMode(text_Mode);
		},
		readOnly: true
	});

	editor.commands.addCommand({
		name: 'Increase Font Size',
		bindKey: {win: 'Ctrl+=', mac: 'Command+='},
		exec: function(editor) {

			// -- Stolen from Ace 'kitchen-sink' Sample --
			var size = parseInt(editor.getFontSize(), 10) || default_FontSize;
			editor.setFontSize(size + 1);
			// -- Stolen from Ace 'kitchen-sink' Sample --

		},
		readOnly: true
	});

	editor.commands.addCommand({
		name: 'Decrease Font Size',
		bindKey: {win: 'Ctrl+-',  mac: 'Command+-'},
		exec: function(editor) {

			// -- Stolen from Ace 'kitchen-sink' Sample --
			var size = parseInt(editor.getFontSize(), 10) || default_FontSize;
			editor.setFontSize(Math.max(size - 1 || 1));
			// -- Stolen from Ace 'kitchen-sink' Sample --
			
		},
		readOnly: true
	});

	editor.commands.addCommand({
		name: 'Reset Font Size',
		bindKey: {win: 'Ctrl+0',  mac: 'Command+0'},
		exec: function(editor) {

			// -- Stolen from Ace 'kitchen-sink' Sample --
			editor.setFontSize(default_FontSize);
			// -- Stolen from Ace 'kitchen-sink' Sample --
			
		},
		readOnly: true
	});

	editor.commands.addCommand({
		name: 'Dark Theme',
		bindKey: {win: 'Ctrl-D',  mac: 'Command-D'},
		exec: function(editor) {

			editor.setTheme(dark_Theme);
			
		},
		readOnly: true
	});

	editor.commands.addCommand({
		name: 'Light Theme',
		bindKey: {win: 'Ctrl-L',  mac: 'Command-L'},
		exec: function(editor) {

			editor.setTheme(light_Theme);
			
		},
		readOnly: true
	});

	focus();

});

function focus() {
	var editor = ace.edit("editor");
	editor.focus();
}

// -- Stolen from Google Chrome 'filesystem-access' Sample --
function errorHandler(e) {
	console.error(e);
}

function writeFileEntry(writableEntry, opt_blob, callback) {

	if (!writableEntry) {
		return;
	}

	writableEntry.createWriter(function(writer) {

		writer.onerror = errorHandler;
		writer.onwriteend = callback;

		// If we have data, write it to the file. Otherwise, just use the file we loaded.
		if (opt_blob) {

			writer.truncate(opt_blob.size);
			waitForIO(writer, function() {
				writer.seek(0);
				writer.write(opt_blob);
			});

		} else {

			chosenEntry.file(function(file) {
				writer.truncate(file.fileSize);
				waitForIO(writer, function() {
					writer.seek(0);
					writer.write(file);
				});
			});
		}
	}, errorHandler);
}

function loadFileEntry(_chosenEntry) {
	chosenEntry = _chosenEntry;
	chosenEntry.file(function(file) {
		readAsText(chosenEntry, function(result) {
			var editor = ace.edit("editor");
			editor.insert(result);
		});
	});
}

function readAsText(fileEntry, callback) {
	fileEntry.file(function(file) {
		var reader = new FileReader();

		reader.onerror = errorHandler;
		reader.onload = function(e) {
			callback(e.target.result);
		};

		reader.readAsText(file);
	});
}

function waitForIO(writer, callback) {

	// set a watchdog to avoid eventual locking:
	var start = Date.now();
	// wait for a few seconds
	var reentrant = function() {
		if (writer.readyState===writer.WRITING && Date.now()-start<4000) {
			setTimeout(reentrant, 100);
			return;
		}
		if (writer.readyState===writer.WRITING) {
			console.error("Write operation taking too long, aborting! (current writer readyState is " + writer.readyState + ")");
			writer.abort();
		} else {
			callback();
		}
	};
	setTimeout(reentrant, 100);

}
// -- Stolen from Google Chrome 'filesystem-access' Sample --


// -- Stolen from StackOverflow [http://stackoverflow.com/questions/6157929/how-to-simulate-mouse-click-using-javascript] --
function simulate(element, eventName)
{
    var options = extend(defaultOptions, arguments[2] || {});
    var oEvent, eventType = null;

    for (var name in eventMatchers)
    {
        if (eventMatchers[name].test(eventName)) { eventType = name; break; }
    }

    if (!eventType)
        throw new SyntaxError('Only HTMLEvents and MouseEvents interfaces are supported');

    if (document.createEvent)
    {
        oEvent = document.createEvent(eventType);
        if (eventType == 'HTMLEvents')
        {
            oEvent.initEvent(eventName, options.bubbles, options.cancelable);
        }
        else
        {
            oEvent.initMouseEvent(eventName, options.bubbles, options.cancelable, document.defaultView,
            options.button, options.pointerX, options.pointerY, options.pointerX, options.pointerY,
            options.ctrlKey, options.altKey, options.shiftKey, options.metaKey, options.button, element);
        }
        element.dispatchEvent(oEvent);
    }
    else
    {
        options.clientX = options.pointerX;
        options.clientY = options.pointerY;
        var evt = document.createEventObject();
        oEvent = extend(evt, options);
        element.fireEvent('on' + eventName, oEvent);
    }
    return element;
}

function extend(destination, source) {
    for (var property in source)
      destination[property] = source[property];
    return destination;
}

var eventMatchers = {
    'HTMLEvents': /^(?:load|unload|abort|error|select|change|submit|reset|focus|blur|resize|scroll)$/,
    'MouseEvents': /^(?:click|dblclick|mouse(?:down|up|over|move|out))$/
};

var defaultOptions = {
    pointerX: 0,
    pointerY: 0,
    button: 0,
    ctrlKey: false,
    altKey: false,
    shiftKey: false,
    metaKey: false,
    bubbles: true,
    cancelable: true
};
// -- Stolen from StackOverflow [http://stackoverflow.com/questions/6157929/how-to-simulate-mouse-click-using-javascript] --