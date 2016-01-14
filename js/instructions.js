$(document).ready(function(){
  $("body").keydown(function( event ) {
    if ( event.which == 27 || (event.ctrlKey && event.which == 191)) {
      event.preventDefault();
      chrome.app.window.current().close();
    }
  });

	request("INSTRUCTIONS.md").then(function(value) {
	  var converter = new Markdown.Converter();
	  var markdown_HTML = converter.makeHtml(value);
    $("body").append(markdown_HTML);
	});
});