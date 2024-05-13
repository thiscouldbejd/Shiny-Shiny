chrome.app.runtime.onLaunched.addListener(function(launchData) {
  
  // Keep awake in Kiosk Mode;
  if (launchData && launchData.isKioskSession) {
    chrome.power.requestKeepAwake("display");
  }
  
  // Center window on screen.
  var screenWidth = screen.availWidth;
  var screenHeight = screen.availHeight;
  var width = screenWidth / 1.5;
  var height = screenHeight / 1.5;
  
  chrome.app.window.create("pages/window.html", {
    id: "main",
    bounds: {
      width: Math.round(width),
      height: Math.round(height),
      left: Math.round((screenWidth - width) / 2),
      top: Math.round((screenHeight - height) / 2)
    }
  }, function(window) {
    
    var saved = false,
				save = function() {
          if (!saved && window && window.contentWindow && window.contentWindow.STATE.file.recovery) {
            saved = true;
            var _value = window.contentWindow.STATE.value();
            if (_value && _value.length >= 5) {

              var timestamp = new Date().toISOString(),
                  filename = "recovery_" + timestamp.split(".")[0] + ".txt",
                  element = document.createElement("a");

              element.setAttribute("href", "data:text/plain;charset=utf-8," + encodeURIComponent(_value));
              element.setAttribute("download", filename);
              element.click();

            };
          }
        };
    
    // -- Handle Window Closure -- //
    window.onClosed.addListener(save);
    
    // -- Handle App Suspend -- //
    chrome.runtime.onSuspend.addListener(save);
    
  });
  
});