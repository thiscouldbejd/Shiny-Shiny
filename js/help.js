$(document).ready(function(){
	
	// -- Key Shortcuts for Close -- //
  $("body").keydown(function( event ) {
    if ( event.which == 27 ||
				(event.ctrlKey && event.which == 191) ||
				(event.ctrlKey && event.shiftKey && event.which == 191)) {
      event.preventDefault();
      chrome.app.window.current().close();
    }
  });

	// -- Load Body Content -- //
	var path = querySt("path");
	if (path) request(path).then(function(value) {
		var converter = new showdown.Converter({tables: true});
    $("#content").append(converter.makeHtml(value));
	});
	
  // -- Load Version Info -- //
  if (chrome && chrome.runtime) {
    var manifestData = chrome.runtime.getManifest();
     $("#version").append($("<p />", {text: "Version = " + manifestData.version}));
		 console.log(manifestData);
  }
  
});

// -- Provides Access to Query String Variables (e.g. debug flags) -- //
function queryStArray() {
	var url = window.location.search.substring(1);
	return url.split("&");
}

function querySt(variable) {
	var urlArray = queryStArray();

	for (var i = 0; i < urlArray.length; i=i+1) {
		ft = urlArray[i].split("=");
		if (ft[0] == variable) return ft[1];
	}

}

function hasQuerySt(variable) {
	var valReturn = false;
	var urlArray = queryStArray();

	for (i = 0; i < urlArray.length; i=i+1) {
		if (urlArray[i].split("=")[0] == variable) {
			valReturn = true;
		}
	}

	return valReturn;
}