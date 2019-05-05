/* exported request */
var request = function(url) {
  
	return new Promise(function(resolve, reject) {

		var r = new XMLHttpRequest();

    if (url && url.endsWith(".json")) {
      r.responseType = "json";
    }

		r.open("GET", url, true);

    r.onload = function() {

      if (r.readyState == 4 && r.status == 200) {

				resolve(r.response);
				
			} else {

				reject(Error(r.statusText));

			}

    };

    r.onerror = function() {
			
			if (r.statusText) {
				reject(Error(r.statusText));
			} else {
				reject(Error("Network Error"));
			}

    };

		r.send();
		
  });

};