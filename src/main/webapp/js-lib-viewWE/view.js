view = {
	// General options
	serverURL: "http://gtlab.uit.no:8080/VIEW",
	servletURL: "http://gtlab.uit.no:8080/VIEW/VIEW",
	cookie_name: "wertiview_userid",
	cookie_path: "/VIEW/openid",
	ajaxTimeout: 60000,
	version: "1.0", 
	userEmail: "",
	userid: "",
	
	// user options (defaults)
	fixedOrPercentage: 0,
    fixedNumberOfExercises: 25,
    proportionOfExercises: 100,
    choiceMode: 0,
    firstOffset: 0,
    intervalSize: 1,
    showInst: false,
    
    // language, topic and activity selections (default)
    language: "unselected",
    topic: "unselected",
    activity: "unselected",
    
    // the topic name which is used to call the topic modules
    // e.g. topic = "RusNouns", topic name = "rusnouns"
    topicName: "unselected",
    
	/*
	 * Save general options to the storage.
	 * This options can't be changed by the user.
	 */
	saveGeneralOptions: function(){
		console.log("saveGeneralOptions()");
		chrome.storage.local.get(["userEmail",
		                          "userid"], function (res) {
			chrome.storage.local.set({
				serverURL: view.serverURL,
				servletURL: view.servletURL,
				cookie_name: view.cookie_name,
				cookie_path: view.cookie_path,
				ajaxTimeout: view.ajaxTimeout,
				version: view.version
			});
			// set the user email and user id
			if(res.userid == undefined){
				chrome.storage.local.set({
					userEmail: "",
					userid: ""
				}, function(){
					view.userEmail = "",
					view.userid = "";
				});
			}
			else{
				view.userEmail = res.userEmail;
				view.userid = res.userid;
			}			
		});
	},
	
	/*
	 * The extension send the message to call initUserOptions().
	 */
	callInitUserOptions: function(request, sender, sendResponse) {	
		if(request.msg == "call initUserOptions"){
			console.log("initUserOptions: received '" + request.msg + "'");
			// initialize the user options and save them globally
			view.initUserOptions();		
		}
	},
	
	/*
	 * Initialize all user options and make them accessible to VIEW.
	 * Afterwards start enhancing.
	 */
	initUserOptions: function(){
		console.log("initUserOptions()");
		chrome.storage.local.get(["fixedOrPercentage",
		                          "fixedNumberOfExercises",
		                          "proportionOfExercises",
		                          "choiceMode",
		                          "firstOffset",
		                          "intervalSize",
		                          "showInst",
		                          "language",
		                          "topic",
		                          "activity"], function (res) {
			if(chrome.runtime.lastError){
		        // an error occurred, do nothing
				console.log("initUserOptions: Storage error occurred!\n" + chrome.runtime.lastError); 				
		    } else if(res.fixedOrPercentage == undefined){
				console.log("initUserOptions: in the options page no options were set yet, " +
						"set language, topic and activity and use default values for the rest.");
				 // language, topic and activity selections
				view.language = res.language;
				view.topic = res.topic;
				view.activity = res.activity;
				
				// set the topic name
				view.topicName = view.interaction.getTopicName(view.topic);			
			} else if(res.language == undefined || res.topic == undefined || res.activity == undefined){
				console.log("initUserOptions: user didn't select language, topic or activity." +
						"Use default values.");			
			} else{
				// the storage items are available, update...
				// user options
				view.fixedOrPercentage = res.fixedOrPercentage;
				view.fixedNumberOfExercises = res.fixedNumberOfExercises;
				view.proportionOfExercises = res.proportionOfExercises;
				view.choiceMode = res.choiceMode;
				view.firstOffset = res.firstOffset;
				view.intervalSize = res.intervalSize;
				view.showInst = res.showInst;
			    
			    // language, topic and activity selections
				view.language = res.language;
				view.topic = res.topic;
				view.activity = res.activity;
				
				// set the topic name
				view.topicName = view.interaction.getTopicName(view.topic);			
			}
			
			// start enhancing the page
			view.interaction.enhance();
		});
	}
};

//assign callInitUserOptions() as a listener for messages from the extension
chrome.runtime.onMessage.addListener(view.callInitUserOptions);
