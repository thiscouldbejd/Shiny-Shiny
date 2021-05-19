$(document).ready(function() {

  // -- Key Shortcuts for Close -- //
  $("body").keydown(function(event) {
    if (event.which == 27 ||
        event.which == 13 ||
        (event.ctrlKey && event.which == 191) ||
        (event.ctrlKey && event.shiftKey && event.which == 191)) {
      event.preventDefault();
      chrome.app.window.current().close();
    }
  });

  // -- Load Body Content -- //
  var path = querySt("path");
  if (path) request(path).then(function(value) {
    var converter = new showdown.Converter({
        tables: true
      }),
      content = $("#content").append(converter.makeHtml(value));

    content.find("h1, h2")
      .addClass("alert alert-primary");
    content.find("h3, h4")
      .addClass("alert alert-success");
    content.find("h5, h6")
      .addClass("alert alert-secondary");
    content.find("table")
      .addClass("table table-hover")
      .filter(function(index, element) {
        return $(element).find("tr").length > 10;
      })
      .addClass("table-sm");
    content.find("thead")
      .addClass("thead-dark");

    content.find("li em strong, p em strong")
      .each(function(index, element) {
        $(element).parent().replaceWith(
          "<span class='badge badge-dark'>" + $(element).text().replace(/'/g, "") + "</span>"
        );
      });

  });

  // -- Load Version Info -- //
  if (chrome && chrome.runtime) {
    var m = chrome.runtime.getManifest();
    $("#version").append($("<p />", {
      text: "Version = " + m.version +
        (m.short_name == "** Shiny **" ? " | D" : m.short_name == "*Shiny*" ? " | B" : ""),
    }));
  }

});

// -- Provides Access to Query String Variables (e.g. debug flags) -- //
function queryStArray() {
  var url = window.location.search.substring(1);
  return url.split("&");
}

function querySt(variable) {
  var urlArray = queryStArray();

  for (var i = 0; i < urlArray.length; i = i + 1) {
    var ft = urlArray[i].split("=");
    if (ft[0] == variable) return ft[1];
  }

}