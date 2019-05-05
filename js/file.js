// -- From Google Chrome 'filesystem-access' Sample --
var chosenEntry = null,
    c = console,
    err = c.error;

/* exported writeFileEntry */
var writeFileEntry = function(writableEntry, opt_blob, callback) {

  if (!writableEntry) {
    return;
  }

  writableEntry.createWriter(function(writer) {

    writer.onerror = err;
    var _completed = false;
    writer.onwriteend = function() {
      if (!_completed) {
        _completed = true;
        if (callback) callback();
      }
    };
    
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
  }, err);
};

/* exported loadFileEntry */
var loadFileEntry = function(_chosenEntry) {
  chosenEntry = _chosenEntry;
  chosenEntry.file(function() {
    readAsText(chosenEntry, function(result) {
      var editor = ace.edit("editor");
      editor.insert(result);
    });
  });
};

function readAsText(fileEntry, callback) {
  fileEntry.file(function(file) {
    var reader = new FileReader();

    reader.onerror = err;
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
    if (writer.readyState === writer.WRITING && Date.now() - start < 4000) {
      setTimeout(reentrant, 100);
      return;
    }
    if (writer.readyState === writer.WRITING) {
      err("Write operation taking too long, aborting! (current writer readyState is " + writer.readyState + ")");
      writer.abort();
    } else {
      callback();
    }
  };
  setTimeout(reentrant, 100);

}
// -- From Google Chrome 'filesystem-access' Sample --