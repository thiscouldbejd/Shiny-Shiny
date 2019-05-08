document.onkeydown = function(e) {
  if (e.ctrlKey && e.which == 87) {
    
    // -- Override Default CTRL-W to close App -- //
    // -- NOTE: this does not override the key press on the Print Dialog, as that is native Chrome -- //
    e.preventDefault();
    e.stopImmediatePropagation();
    return;
    
  }
};