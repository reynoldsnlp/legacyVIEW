/*
 * Initialization of the extension when the browser action button 
 * is clicked and active events.
 */
$(document).ready(function() {		
	// TODO enable/disable button?
	// restore all selections made for language, topic and activity	
	restoreSelections();
	
	/* When the user clicks on the button,
	toggle between hiding and showing the dropdown content */
	$("#wertiview-VIEW-menu-btn").on("click", function(){
		// send a request to the view.js in the active tab
		console.log("click on menu VIEW btn: request 'toggle Menu VIEW'");
		chrome.runtime.sendMessage({
		    msg: "toggle Menu VIEW"
		});		
	});
	
	// handle the new language selection
	$("#wertiview-toolbar-language-menu").on("change",function() {		
		// select the topic menu according to the language
		selectTopicMenu($(this).val());
	});
	
	// handle the new topic selection
	$(	"#wertiview-toolbar-topic-menu-unselected, " +
		"#wertiview-toolbar-topic-menu-en, " +
		"#wertiview-toolbar-topic-menu-de, " +
		"#wertiview-toolbar-topic-menu-es, " +
		"#wertiview-toolbar-topic-menu-ru").on("change",function() {		
		// update activities for topic selection
		updateActivities($("#wertiview-toolbar-language-menu").val(), $(this).val());
	});
	
	// show run button and hide restore, abort buttons and loading image
	$("#wertiview-toolbar-enhance-button").show();
	$("#wertiview-toolbar-restore-button").hide();
	$("#wertiview-toolbar-abort-button").hide();
	$("#wertiview-toolbar-loading-image").hide();	
	
	// prepare and send the message to enhance the page when "enhance" was clicked
	$("#wertiview-toolbar-enhance-button").on("click",function() {
		// store the selected language, topic and activity
		chrome.storage.local.set({
			language: $("#wertiview-toolbar-language-menu").val(),
			topic: $(".selected-toolbar-topic-menu").val(),
			activity: $("#wertiview-toolbar-activity-menu").val()
		}, function(){ // afterwards initiate the enhancement process
			// disable enhance and restore button, show spinning wheel
			$("#wertiview-toolbar-enhance-button").hide();
			$("#wertiview-toolbar-restore-button").hide();
			$("#wertiview-toolbar-loading-image").show();
			
			// send a request to view.js
			console.log("click on enhance: request 'call initUserOptions'");
			chrome.runtime.sendMessage({
			    msg: "call initUserOptions"
			});
		});		
	}); 
	
	// add a click handler for abort
	$("#wertiview-toolbar-abort-button").on("click",function() {			
	  	console.log("click on abort: request 'call abort()'");
	  	chrome.runtime.sendMessage({
		    msg: "call abort"
		});
	});
	
	// add a click handler for restore
	$("#wertiview-toolbar-restore-button").on("click",function() {			
	  	console.log("click on restore: request 'call restoreToOriginal()'");
	  	chrome.runtime.sendMessage({
		    msg: "call restore to original"
		});
	});
	
	chrome.storage.local.get(["serverURL",
	                          "userEmail"], function (res) {
		
		initSignInOutInterfaces(res.serverURL);
		
		var userEmail = res.userEmail;
		
		// verify User Sign In Status
		if(userEmail == ""){
			signOut();
		}
		else {
			signIn(userEmail);
		}
		
		// add a click handler for the sign in link
		$("#wertiview-toolbar-identity-signinlink").on("click",function() {	
			console.log("click on signinlink: open auth popup");
			var authWindow = window.open($(this).attr("link"), "Sign In", "width=985,height=735");
			authWindow.focus();
		});
	  
		// add a click handler for the sign out link
		$("#wertiview-toolbar-identity-signoutlink").on("click",function() {	
			console.log("click on signoutlink: open auth popup");
			var authWindow = window.open($(this).attr("link"), "Sign Out", "width=1,height=1");
			authWindow.moveTo(0,window.screen.availHeight+1000);
		}); 
	});	
    
    // Handle click events on the toolbar button.
    $("#wertiview-toolbar-toggle").on("click",function() {
    	console.log("click on toggle: request 'toggle toolbar'");
    	// Ask the background page to toggle the toolbar on the current tab
    	chrome.runtime.sendMessage({
		    msg: "toggle toolbar"
		});
    });
});

/*
 * Restores all selections from language, topic and activity
 * The values right to "||" are default values.
 */
function restoreSelections() {	
	console.log("restoreSelections()");
	// restore language menu selection
	chrome.storage.local.get(["language",
	                          "topic",
	                          "activity"], function (res) {
		var language = res.language || "unselected";
		var topic = res.topic || "unselected";
		var activity = res.activity || "unselected";
		
		// restore language menu selection
		$("#wertiview-toolbar-language-" + language).prop("selected", true);			
		
		// restore topic menu selection
		// special case Dets and Preps are shared between en, de and es
		if(topic == "Dets" || topic == "Preps"){ // add "-en|de|es" to selector
			$("#wertiview-toolbar-topic-" + topic + "-"+ language).prop("selected", true);	
		}
		else {
			$("#wertiview-toolbar-topic-" + topic).prop("selected", true);		
		}				
		
		// restore activity menu selection
		$("#wertiview-toolbar-activity-" + activity).prop("selected", true);
		
		// select the topic menu according to the language
		selectTopicMenu(language);
	});
};

/*
 * Select the topic menu according to the language
 */
function selectTopicMenu(lang){
	// select the topic menu according to the language option
	$("#wertiview-toolbar-language-menu option").each(function() {
		var currentLang = $(this).val();
		var $topicMenu = $("#wertiview-toolbar-topic-menu-" + currentLang);
		if(currentLang == lang){ // show topics appropriate to the language
			$topicMenu.addClass("selected-toolbar-topic-menu");
			$topicMenu.show();
			var topic = $topicMenu.val();
			// update activities for topic selection
			updateActivities(lang, topic);	
			chrome.storage.local.set({
				topic: topic
			});
		} else { // hide topics from other languages
			$topicMenu.removeClass("selected-toolbar-topic-menu");
			$topicMenu.hide();
		}
	});		
}

/*
 * Update activities when the topic is changed. Enable activities available
 * to the topic and disable the ones that aren't.
 */
function updateActivities(language, topic){
	
	var $unselected = $("#wertiview-toolbar-activity-unselected");
	var $click = $("#wertiview-toolbar-activity-click");
	var $colorize = $("#wertiview-toolbar-activity-colorize");
	var $mc = $("#wertiview-toolbar-activity-mc");
	var $cloze = $("#wertiview-toolbar-activity-cloze");
	
	// show the horizontal separator
	$unselected.next().show();
	
	// handle special cases, some topics don't have all activities available
	if (language == "ru" && topic == "RusVerbAspect") {
		$click.prop("disabled", true).hide();

		$colorize.prop("disabled", false).show();
		$mc.prop("disabled", false).show();
		$cloze.prop("disabled", false).show();
	}
	else if(language == "ru" && topic == "RusAssistiveReading"){
		$colorize.prop("disabled", true).hide();
		$mc.prop("disabled", true).hide();
		$cloze.prop("disabled", true).hide();
		
		$click.prop("disabled", false).show();
	}
	else if(language == "en" && topic == "NounCountability"){
		$cloze.prop("disabled", true).hide();

		$colorize.prop("disabled", false).show();
		$click.prop("disabled", false).show();
		$mc.prop("disabled", false).show();
	}
	else if(language == "en" && topic == "WhQuestions"){
		$mc.prop("disabled", false).hide();

		$colorize.prop("disabled", false).show();
		$click.prop("disabled", false).show();
		$cloze.prop("disabled", true).show();
	}
	else if(language == "unselected" || topic.startsWith("unselected")){
		$unselected.next().hide();
		$colorize.prop("disabled", true).hide();
		$mc.prop("disabled", true).hide();
		$cloze.prop("disabled", true).hide();		
		$click.prop("disabled", true).hide();
	}
	else{ // default case, all activities are available
		$colorize.prop("disabled", false).show();
		$click.prop("disabled", false).show();
		$mc.prop("disabled", false).show();
		$cloze.prop("disabled", false).show();
	}
	
	// switch to "Pick an Activity" if the selected activity isn't available for
	// the currently selected topic
	var activity = $("#wertiview-toolbar-activity-menu").val();
	if(activity == null){
		// select "Pick a Topic"
		$unselected.prop("selected", true);
		// store the new topic selection
		chrome.storage.local.set({
			activity: "unselected"
		});
	};	
};

/*
 * Set the href attribute for the identity sign-in/out link.
 */
function initSignInOutInterfaces(serverURL){
	console.log("initSignInOutInterfaces(serverURL)");
	var link = serverURL + "/openid/authenticator.html";
	$("#wertiview-toolbar-identity-signinlink").attr("link", link);
	$("#wertiview-toolbar-identity-signoutlink").attr("link", link);
}

/*
 * Show the sign in link and hide the signed in status, user id and sign out link.
 */
function signOut() {
	console.log("signOut: the user is logged out");
	$("#wertiview-toolbar-identity-signinlink").css("display", "inline");
    $("#wertiview-toolbar-identity-signedinstatus").hide();
    $("#wertiview-toolbar-identity-signedinuserid").hide();
    $("#wertiview-toolbar-identity-signoutlink").hide();
}

/*
 * Hide the sign in link and show the signed in status, user id and sign out link.
 * Fill in the user id.
 */
function signIn(userid){
	console.log("enableSignInInterface: the user is logged in");
	$("#wertiview-toolbar-identity-signinlink").hide();
    $("#wertiview-toolbar-identity-signedinstatus").css("display", "inline");
    $("#wertiview-toolbar-identity-signedinuserid").css("display", "inline");
    $("#wertiview-toolbar-identity-signoutlink").css("display", "inline");
    $("#wertiview-toolbar-identity-signedinuserid").text(userid);
}

/*
 * The extension send the message to sign out the user.
 */
function signOutUser(request, sender, sendResponse) {	
	if(request.msg == "call signOut"){
		console.log("signOutUser: received '" + request.msg + "'");
		signOut();
	}
}

/*
 * The extension send the message to sign in the user.
 */
function signInUser(request, sender, sendResponse) {	
	if(request.msg == "call signIn"){
		console.log("signInUser: received '" + request.msg + "'");	
		signIn(request.userEmail);
	}
}

//assign signOutUser as a listener for messages from the extension
chrome.runtime.onMessage.addListener(signOutUser);

//assign signInUser as a listener for messages from the extension
chrome.runtime.onMessage.addListener(signInUser);

/*
 * Interaction.js send the message to show/hide an element
 * using a selector.
 */
function showHideElement(request, sender, sendResponse) {	
	if(request.msg == "show element"){
		$(request.selector).show();
	}
	else if(request.msg == "hide element"){
		$(request.selector).hide();
	}
}

chrome.runtime.onMessage.addListener(showHideElement);	