/**
 * Displays the UI for a signed in user.
 */
function handleSignedInUser(user) {
	if(window.name == "Sign In") {
		$("#user-signed-in").show();
		$("#user-signed-out").hide();
		$("#name").text(user.displayName);
		$("#email").text(user.email);
		var account = user.displayName + "/" + user.email + "/" + user.uid;
		
		view.cookies.setCookie(document, view.cookie_name, account, 10, view.cookie_path);
		var $photo = $("#photo");
		if (user.photoURL){
			$photo.attr("src", user.photoURL);
			$photo.show();
		} else {
			$photo.hide();
		}
		
		// close window after 3 seconds
		window.setTimeout(function(){
			window.close();
		}, 3000);
	}	
};


/**
 * Displays the UI for a signed out user.
 */
function handleSignedOutUser() {
	$("#user-signed-in").hide();
	$("#user-signed-out").show();
	$("#firebaseui-auth-container").hide();
};

/*
 * Listen to change in auth state so it displays the correct UI for when
 * the user is signed in or not.
 */ 
firebase.auth().onAuthStateChanged(function(user) {
	user ? handleSignedInUser(user) : handleSignedOutUser();
});


/**
 * Initializes the app.
 */
function initAuthenticator() {
	if(window.name == "Sign In"){
		$("#firebaseui-auth-container").show();
	}
	else {// Sign Out window
		var prevUserid = view.cookies.getCookie(document, view.cookie_name);
		if(prevUserid == null){
			view.cookies.setCookie(document, view.cookie_name, "temp/temp@web.de/1234", 10, view.cookie_path);
		}
		view.cookies.deleteCookie(document, view.cookie_name, view.cookie_path);			
		
		firebase.auth().signOut().then(function() {
			// Sign-out successful.
			window.close();
		}, function(error) {
			// An error happened.
			console.log(error);
		});
	}
};

$(window).on("load", initAuthenticator);