$(document).ready(function(){
	
  $("body").keydown(function( event ) {
    if ( event.which == 27 ||
				(event.ctrlKey && event.which == 191) ||
				(event.ctrlKey && event.shiftKey && event.which == 191)) {
      event.preventDefault();
      chrome.app.window.current().close();
    }
  });

	request("/documentation/CHARACTERS.md").then(function(value) {
    $("#content").append(marked(value));
	});
	
});