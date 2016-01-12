chrome.app.runtime.onLaunched.addListener(function() {
	// Center window on screen.
	var screenWidth = screen.availWidth;
	var screenHeight = screen.availHeight;
	var width = screenWidth / 1.5;
	var height = screenHeight / 1.5;

	chrome.app.window.create('window.html', {
		bounds: {
			width: Math.round(width),
			height: Math.round(height),
			left: Math.round((screenWidth - width) / 2),
			top: Math.round((screenHeight - height) / 2)
		}
	});

});