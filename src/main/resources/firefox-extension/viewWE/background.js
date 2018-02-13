var currentTabId = -1;

/*
 * Handle the browser action button.
 * Initialize and toggle in the toolbar.
 */
chrome.browserAction.onClicked.addListener(function(tab) {
	console.log("browserAction: pressed VIEW button to toggle the toolbar");	
	currentTabId = tab.id;
	chrome.tabs.sendMessage(currentTabId, {
    	msg: "toggle toolbar"
    });
});

/*
 * The toolbar ui send the message to toggle the toolbar.
 * Pass it on to interaction.js.
 */
function toggleToolbar(request, sender, sendResponse) {
	if(request.msg == "toggle toolbar"){
		console.log("toggleToolbar: received '" + request.msg + "'");
		currentTabId = sender.tab.id;
		chrome.tabs.sendMessage(currentTabId, {
	    	msg: "toggle toolbar"
	    });
	}
}

chrome.runtime.onMessage.addListener(toggleToolbar);	

/*
 * The toolbar ui send the message to toggle the menu VIEW.
 * Pass it on to interaction.js.
 */
function callToggleMenuVIEW(request, sender, sendResponse) {
	if (request.msg == "toggle Menu VIEW") {
		console.log("callToggleMenuVIEW: received '" + request.msg + "'");
		currentTabId = sender.tab.id;
		chrome.tabs.sendMessage(currentTabId, {
	    	msg: "toggle Menu VIEW"
	    });
	}
}

chrome.runtime.onMessage.addListener(callToggleMenuVIEW);

/*
 * The toolbar ui send the message to call initUserOptions().
 * Pass it on to view.js.
 */
function callInitUserOptions(request, sender, sendResponse) {	
	if(request.msg == "call initUserOptions"){
		console.log("callInitUserOptions: received '" + request.msg + "'");	
		currentTabId = sender.tab.id;
		chrome.tabs.sendMessage(currentTabId, {
	    	msg: "call initUserOptions"
	    });
	}
}

chrome.runtime.onMessage.addListener(callInitUserOptions);

/*
 * The toolbar ui send the message to call abort().
 * Pass it on to interaction.js.
 */
function callAbort(request, sender, sendResponse) {
	if (request.msg == "call abort") {
		console.log("callAbort: received '" + request.msg + "'");
		currentTabId = sender.tab.id;
		chrome.tabs.sendMessage(currentTabId, {
	    	msg: "call abort"
	    });
	}
}

chrome.runtime.onMessage.addListener(callAbort);

/*
 * The toolbar ui send the message to call restoreToOriginal().
 * Pass it on to interaction.js.
 */
function callRestoreToOriginal(request, sender, sendResponse) {
	if (request.msg == "call restore to original") {
		console.log("callRestoreToOriginal: received '" + request.msg + "'");
		currentTabId = sender.tab.id;
		chrome.tabs.sendMessage(currentTabId, {
	    	msg: "call restore to original"
	    });
	}
}

chrome.runtime.onMessage.addListener(callRestoreToOriginal);

/*
 * Redirects to the given link in the request.
 */
function redirect(request, sender, sendResponse) {
	if(request.msg == "redirect to link"){
		console.log("redirect: received '" + request.msg + "'");		
		chrome.tabs.create({
	        url: request.link
	    });
	}
}

chrome.runtime.onMessage.addListener(redirect);

/*
 * The toolbar ui send the message to open the options page.
 */
function openOptionsPage(request, sender, sendResponse) {
	if(request.msg == "open options page"){
		console.log("openOptionsPage: received '" + request.msg + "'");		
		chrome.runtime.openOptionsPage();
	}	
}

chrome.runtime.onMessage.addListener(openOptionsPage);

/*
 * The toolbar ui send the message to open the help page.
 */
function openHelpPage(request, sender, sendResponse) {
	if(request.msg == "open help page"){
		console.log("openHelpPage: received '" + request.msg + "'");		
		chrome.storage.local.get("serverURL", function (res) {
        	var url = res.serverURL + "/index.jsp?content=activities";  
        	chrome.tabs.create({
    	        url: url
    	    });
    	}); 
	}	
}

chrome.runtime.onMessage.addListener(openHelpPage);

/*
 * The toolbar ui send the message to open the about dialog.
 * Pass it on to about.js.
 */
function openAboutDialog(request, sender, sendResponse) {
	if(request.msg == "open about dialog"){
		console.log("openAboutDialog: received '" + request.msg + "'");	
		currentTabId = sender.tab.id;
		chrome.tabs.sendMessage(currentTabId, {
	    	msg: "open about dialog"
	    });
	}	
}

chrome.runtime.onMessage.addListener(openAboutDialog);

/*
 * Helper function for ajax post calls.
 */
function ajaxPost(url, data, ajaxTimeout){
	return $.post({
		url: url,
		data: JSON.stringify(data), // old: wertiview.nativeJSON.encode(requestData),
		processData: false,
		timeout: ajaxTimeout
	})
	.done(function(data, textStatus, xhr) { // default
		//console.log("data: " + JSON.stringify(data));
		console.log("textStatus: " + JSON.stringify(textStatus));
		var xhrInfo = {
				readyState: xhr.readyState,
				status: xhr.status,
				statusText: xhr.statusText
		};
		console.log("xhrInfo: " + JSON.stringify(xhrInfo));
	})
	.fail(doNothing); // default
}

/*
 * Send the request data from interaction.js to the
 * server for processing.
 * If successful, request a call of saveDataAndInsertSpans 
 * in interaction.js.
 */
function sendRequestDataEnhance(request, sender, sendResponse) {
	if(request.msg == "send requestData enhance"){
		console.log("sendRequestData: received '" + request.msg + "'");		
		currentTabId = sender.tab.id;
		var ajaxTimeout = request.ajaxTimeout || 120000;
		ajaxPost(request.servletURL, 
				request.requestData, 
				ajaxTimeout)
		.done(function(data, textStatus, xhr) { 
			if (data) {
				// send a request to the interaction.js in the current interaction tab
				console.log("sendRequestData: request 'call saveDataAndInsertSpans'");
			    chrome.tabs.sendMessage(currentTabId, {
			    	msg: "call saveDataAndInsertSpans",
			    	data: data,
			    	showInst: request.showInst
			    });
			} else {
				ajaxError(xhr, "nodata");
			}
		})
		.fail(ajaxError);	
	}
}

chrome.runtime.onMessage.addListener(sendRequestDataEnhance);	

/*
 * Send the activity data from interaction.js to the
 * server for processing.
 * If successful, request a call of addServerMarkup 
 * in interaction.js.
 */
function sendActivityData(request, sender, sendResponse) {
	if(request.msg == "send activityData"){
		console.log("sendActivityData: received '" + request.msg + "'");	
		currentTabId = sender.tab.id;	
		var ajaxTimeout = request.ajaxTimeout || 120000;
		ajaxPost(request.servletURL, 
				request.activityData, 
				ajaxTimeout)
		.done(function(data, textStatus, xhr) { 
			if (data) {
				// send a request to the interaction.js in the current interaction tab
				console.log("sendActivityData: request 'call addServerMarkup'");
			    chrome.tabs.sendMessage(currentTabId, {
			    	msg: "call addServerMarkup",
			    	data: data
			    });
			} else {
				ajaxError(xhr, "nodata");
			}
		})
		.fail(ajaxError);	
	}
}

chrome.runtime.onMessage.addListener(sendActivityData);	

/*
 * Send the interaction data from interaction.js to the
 * server for processing.
 */
function sendInteractionData(request, sender, sendResponse) {
	if(request.msg == "send interactionData"){
		console.log("sendInteractionData: received '" + request.msg + "'");	
		console.log("sendInteractionData: interactionData "+ JSON.stringify(request.interactionData));
		ajaxPost(request.servletURL, 
				request.interactionData, 
				10000);
	}
}

chrome.runtime.onMessage.addListener(sendInteractionData);	

/*
 * Send the request data from interaction.js to the
 * server for processing.
 * If successful, request a call of saveDataAndInsertSpans 
 * in interaction.js.
 */
function sendRequestDataAbort(request, sender, sendResponse) {
	if(request.msg == "send requestData abort"){
		console.log("sendRequestData: received '" + request.msg + "'");		
		currentTabId = sender.tab.id;		
		var ajaxTimeout = request.ajaxTimeout || 120000;
		ajaxPost(request.servletURL, 
				request.requestData, 
				ajaxTimeout)
		.done(function(data, textStatus, xhr) { 
			// send a request to the interaction.js in the current interaction tab
			console.log("sendRequestDataAbort: request 'call abortEnhancement'");
		    chrome.tabs.sendMessage(currentTabId, {
		    	msg: "call abortEnhancement"
		    });
		});
	}
}

chrome.runtime.onMessage.addListener(sendRequestDataAbort);	

/*
 * Interaction.js send the message to show/hide an element
 * using a selector. Pass it on to toolbar.js.
 */
function showHideElement(request, sender, sendResponse) {	
	if(request.msg == "show element" || request.msg == "hide element"){
		currentTabId = sender.tab.id;
		chrome.tabs.sendMessage(currentTabId, {
		    msg: request.msg,
		    selector: request.selector
		});
	}
}

chrome.runtime.onMessage.addListener(showHideElement);	


/*
 * Observe the user id cookie when it changes.
 */
function observeUserId(changeInfo){
	// we are only interested in the view user id cookie changes
	if(changeInfo.cookie.name == "wertiview_userid"){
		console.log('Cookie changed: ' +
				'\n * Cookie: ' + JSON.stringify(changeInfo.cookie) +
				'\n * Cause: ' + changeInfo.cause +
				'\n * Removed: ' + changeInfo.removed);
		if(changeInfo.removed){ // cookie was removed, user logged out
			// send a request to the interaction.js in the current interaction tab
		    chrome.storage.local.set({
		    	userEmail: "",
		    	userid: ""
		    });
		    
			console.log("observeUserId: request 'call signOutUser'");
		    chrome.tabs.sendMessage(currentTabId, {
		    	msg: "call signOut"
		    });
		}
		else{// the user logged in			 
			// send a request to the interaction.js in the current interaction tab
			var account = changeInfo.cookie.value.split("/");
			var userEmail = account[1];
			var userid = account[2];
			
			chrome.storage.local.set({
				userEmail: userEmail,
		    	userid: userid
		    });	
			
			console.log("observeUserId: request 'call signInUser'");
		    chrome.tabs.sendMessage(currentTabId, {
		    	msg: "call signIn",
		    	userEmail: userEmail
		    });
		}		
	}
}

//assign observeUserId() as a listener for the userid cookie
chrome.cookies.onChanged.addListener(observeUserId);

/*
 * This function is supposed to do nothing
 */
function doNothing(){
	// intentionally empty here
}

/*
 * Fire an ajaxError if anything went wrong when sending data 
 * from the extension to the server.
 */
function ajaxError(xhr, textStatus, errorThrown) {
	console.log("ajaxError: calling ajaxError(xhr, textStatus, errorThrown)");	
	console.log("xhr: " + JSON.stringify(xhr));
	console.log("textStatus: " + JSON.stringify(textStatus));
	console.log("errorThrown: " + JSON.stringify(errorThrown));
	// send a request to the interaction.js in the current interaction tab
	console.log("ajaxError: request 'call initalInteractionState'");
    chrome.tabs.sendMessage(currentTabId, {
    	msg: "call initalInteractionState"
    });

	if (!xhr || !textStatus) {
		console.log("(!xhr || !textStatus): The VIEW server encountered an error.");
		chrome.notifications.create("no-xhr-or-textstatus-notification", {
		    "type": "basic",
		    "title": "(!xhr || !textStatus)!",
		    "message": "The VIEW server encountered an error."
		});
		return;
	}

	switch(textStatus) {
		case "nodata":
			console.log("nodata: The VIEW server is currently unavailable.");
			chrome.notifications.create("nodata-notification", {
			    "type": "basic",
			    "title": "No data!",
			    "message": "The VIEW server is taking too long to respond."
			});
			break;
		case "timeout":
			console.log("timeout: The VIEW server is taking too long to respond.");
			chrome.notifications.create("timeout-notification", {
			    "type": "basic",
			    "title": "Timeout!",
			    "message": "The VIEW server is currently unavailable."
			});
			// when the add-on has timed out, tell the server to stop
			//wertiview.activity.abort(); TODO
			break;
		case "error":
			switch (xhr.status) {
				case 490:
					console.log("error 490: The VIEW server no longer supports this version of " +
							"the VIEW extension.\nPlease check for a new version of the add-on" +
							" in the Tools->Add-ons menu!");
					chrome.notifications.create("error-490-notification", {
					    "type": "basic",
					    "title": "Error 490!",
					    "message": "The VIEW server no longer supports this version of the VIEW " +
					    		"extension.\nPlease check for a new version of the add-on in the " +
					    		"Tools->Add-ons menu!"
					});
					break;
				case 491:
					console.log("error 491: The topic selected isn't available.\nPlease select a " +
							"different topic from the toolbar menu.");
					chrome.notifications.create("error-491-notification", {
					    "type": "basic",
					    "title": "Error 491!",
					    "message": "The topic selected isn't available.\nPlease select a " +
					    		"different topic from the toolbar menu."
					});
					break;
				case 492:
					console.log("error 492: The topic selected isn't available for the language " +
							"selected.\nPlease select a different language or topic from the " +
							"toolbar menu.");
					chrome.notifications.create("error-492-notification", {
					    "type": "basic",
					    "title": "Error 492!",
					    "message": "The topic selected isn't available for the language " +
					    		"selected.\nPlease select a different language or topic from " +
					    		"the toolbar menu."
					});
					break;
				case 493:
					console.log("error 493: The server is too busy right now. Please try " +
							"again in a few minutes.");
					chrome.notifications.create("error-493-notification", {
					    "type": "basic",
					    "title": "Error 493!",
					    "message": "The server is too busy right now. Please try again " +
					    		"in a few minutes."
					});
					break;
				case 494:
					// enhancement was stopped on client's request
					break;
				default:
					console.log("error default: The VIEW server encountered an error.");
					chrome.notifications.create("error-default-notification", {
					    "type": "basic",
					    "title": "Error default!",
					    "message": "The VIEW server encountered an error."
					});
					break;
			}
			break;
		default:
			console.log("default: The VIEW server encountered an error.");
			chrome.notifications.create("default-notification", {
			    "type": "basic",
			    "title": "Error default!",
			    "message": "The VIEW server encountered an error."
			});
			break;
	}
}