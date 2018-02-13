view.cookies = {

	getCookie: function(doc, c_name) {
		// we see only the name-value pairs without expiry dates or paths 
		var cookies = doc.cookie.split(";");
		for (var i = 0; i < cookies.length; i++) {
			var equIndex = cookies[i].indexOf("=");
			var name = cookies[i].substr(0, equIndex);
			var value = cookies[i].substr(equIndex + 1);
			name = name.replace(/^\s+|\s+$/g, "");
			if (name == c_name) {
				return unescape(value);
			}
		}
		return null;
	},

	setCookie: function(doc, c_name, value, exhours, path) {
		var exdate = new Date();
		var exdateStr = "";
		if (exhours != null) {
			exdate.setHours(exdate.getHours() + exhours);
			exdateStr = "expires=" + exdate.toUTCString() + ";";
		}
	
		if (path == null) {
			path = "/";
		}
		var pathStr = "path=" + path + ";";
	
		var valueStr = escape(value) + ";";
		var c_value = valueStr + exdateStr + pathStr;
		doc.cookie = c_name + "=" + c_value;
	},

	deleteCookie: function(doc, c_name, path) {
		// set cookie with expiry date before now 
		// the browser automatically deletes expired cookies 
		view.cookies.setCookie(doc, c_name, '', -1, path);
	},

	areCookiesEnabled: function(doc, path) {
		// the only way to find out whether cookies are enabled is to try to
		// set one and see whether it was successful
		var TEST_COOKIE_NAME = 'test_cookie';
		view.cookies.setCookie(doc, TEST_COOKIE_NAME, 'test', 1, path);
		var value = view.cookies.getCookie(doc, TEST_COOKIE_NAME);
		view.cookies.deleteCookie(doc, TEST_COOKIE_NAME, path);
		return value != null;
	},

};