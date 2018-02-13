view.interaction = {
	toolbarUI: undefined,

	/*
	 * Create the toolbar ui iframe and inject it in the current page
	 */
	initToolbar: function() {	
		var $iframe = $("<iframe>");
		$iframe.attr("id", "view-toolbar-iframe");
		$iframe.attr("src", chrome.runtime.getURL("toolbar/toolbar.html"));
		
		view.saveGeneralOptions();
		
		view.VIEWmenu.add();	    
	    
		$("body").prepend($iframe);		

		return view.interaction.toolbarUI = $iframe;
	},
	
	/*
	 * Toggle the toolbar directly if it already exists,
	 * initialize it otherwise.
	 */
	toggleToolbar: function(request, sender, sendResponse) {
		if (request.msg == "toggle toolbar") {
			console.log("toggle toolbar: received '" + request.msg + "'");
			var toolbarUI = view.interaction.toolbarUI;
			if (toolbarUI) {
				toolbarUI.toggle();
			} else {
				toolbarUI = view.interaction.initToolbar();
			}
		}
	},
	
	/*
	 * Toggle the menu VIEW.
	 */
	callToggleMenuVIEW: function(request, sender, sendResponse) {
		if (request.msg == "toggle Menu VIEW") {
			$("#view-VIEW-menu-content").toggle();
		}
	},
	
	isAborted: false,	
	
	/*
	 * Start the enhancement process by creating the request data.
	 * Send the request data to background.js for further processing
	 * on the server side.
	 */
	enhance: function(){
		console.log("enhance()");
		
		// remove any previous wertiview markup an restore the page to the original
		if ($(".wertiview").length > 0) {
			view.interaction.restoreToOriginal();
		}
		
		var language = view.language;
		var topic = view.topic;
		var activity = view.activity;	
		
		// check for appropriate selections
		if (language == "unselected") {
			alert("Please select a language!");
			view.interaction.initalInteractionState();
			return;
		} else if (topic.startsWith("unselected")) {
			alert("Please select a topic!");
			view.interaction.initalInteractionState();
			return;
		} else if (activity == "unselected") {
			alert("Please select an activity!");
			view.interaction.initalInteractionState();
			return;
		}
		
		// blur the page for cloze activity
		if (activity == "cloze") {
			view.blur.add();
		}
		
		// request an enhancement ID from the server
		var requestData = {};
		requestData["type"] = "ID";
		requestData["url"] = document.baseURI;
		requestData["language"] = language;
		requestData["topic"] = topic;
		requestData["activity"] = activity;
		requestData["version"] = view.version;
		requestData["userId"] = view.userid;
		
		// send a request to the background script, to send the request data to the server for processing
		console.log("enhance: request 'send requestData enhance'");
	    chrome.runtime.sendMessage({
	    	msg: "send requestData enhance",
	    	requestData: requestData, 
	    	ajaxTimeout: view.ajaxTimeout,
	    	servletURL: view.servletURL,
	    	showInst: view.showInst
	    });		
	},
	
	/*
	 * Get the topic name from the topic.
	 */
	getTopicName: function(topic) {
		// figure out corresponding topic name
		var topicName = topic.toLowerCase();

		// exceptions: 
		//  - e.g. Arts and Dets and Preps use the 'pos' topic
		switch(topic) {
			case "Arts":
			case "Dets":
			case "Preps":
				topicName = "pos";
				break;
			case "RusNounSingular":
			case "RusNounPlural":
				topicName = "rusnouns";
				break;
			case "RusAdjectiveFeminine":
			case "RusAdjectiveMasculine":
			case "RusAdjectiveNeutral":
				topicName = "rusadjectives";
				break;
			case "RusVerbPastTense":
			case "RusVerbPresentTense":
			case "RusVerbPerfective":
			case "RusVerbImperfective":
				topicName = "rusverbs";
				break;
			default:
				break; 
		}	
		return topicName;
	},

	/*
	 * The extension send the message to call initalInteractionState().
	 */
	callInitalInteractionState: function(request, sender, sendResponse) {
		if(request.msg == "call initalInteractionState"){
			console.log("callInitalInteractionState: received '" + request.msg + "'");
			view.interaction.initalInteractionState();
		}
	},
	
	/*
	 * Returns to initial interaction state, where the loading image and abort
	 * button are hidden and the enhance button is enabled. Blur overlay is removed.
	 */
	initalInteractionState: function() {
		chrome.runtime.sendMessage({
		    msg: "hide element",
		    selector: "#wertiview-toolbar-loading-image"
		});
		chrome.runtime.sendMessage({
		    msg: "hide element",
		    selector: "#wertiview-toolbar-abort-button"
		});
		chrome.runtime.sendMessage({
		    msg: "show element",
		    selector: "#wertiview-toolbar-enhance-button"
		});
		view.blur.remove();
	},

	/*
	 * The extension send the message to call saveDataAndInsertSpans(data, options, showInst).
	 */
	callSaveDataAndInsertSpans: function(request, sender, sendResponse) {
		if(request.msg == "call saveDataAndInsertSpans"){
			console.log("callSaveDataAndInsertSpans: received '" + request.msg + "'");
			view.interaction.isAborted = false;
			view.interaction.saveDataAndInsertSpans(request.data, request.showInst);
		}
	},
	
	/*
	 * Constructs the instruction for the given topic and activity
	 * Saves the options used in the page
	 * Stores span id internally
	 * Makes hidden text-node ids visible by wrapping <span>s around them
	 */
	saveDataAndInsertSpans: function(data, showInst) {
		console.log("saveDataAndInsertSpans(data, showInst)");
		
		// identify context document under consideration old: contextDoc||window.content.document;
		var contextDoc = document;
		
		var topicName = view.topic;
		
		var activityType = view.activity;
		
		if(showInst){
			// Construct the instruction for the given topic and activity
			view.interaction.constructTopicInstruction(topicName, activityType);
		}
		
		// get enhancement ID response from wertiview servlet as a number
		var enhId = JSON.parse(data); // old: wertiview.nativeJSON.decode(data);
		console.log("saveDataAndInsertSpans: enhId (from server): " + enhId);

		// save the options used in the page
		$("body").data("wertiview-language", view.language);
		$("body").data("wertiview-topic", topicName);
		$("body").data("wertiview-activity", activityType);
		$("body").data("wertiview-enhId", enhId);
		
		console.log("saveDataAndInsertSpans: body(data): " + JSON.stringify($("body").data()));

		// only enable the abort button once we have stored the enhId
		chrome.runtime.sendMessage({
		    msg: "show element",
		    selector: "#wertiview-toolbar-abort-button"
		});
		
		// retrieve all text nodes in the document body
		var textNodes = view.interaction.getTextNodesIn(contextDoc.body);
		
		// for each text node wrap it into a span and assign it an id
		var counter = 1;
		$(textNodes).each( function() {
		  // make hidden text-node ids visible by wrapping <span>s around them
		  $node = $("<span>");
		  
		  // NOTE: the order in the html string has to be "class" followed by "wertiviewid"
		  // example: "<span class="wertiview" wertiviewid="4">"
		  // this order is a deciding factor for
		  // correct processing and differs between browsers, handle this here
		  if(is.chrome()){ // chrome, class followed by id
			  $node.addClass("wertiview");
			  $node.attr("wertiviewid", counter);
		  }
		  else{ // firefox, Opera and others, id followed by class
			  $node.attr("wertiviewid", counter);
			  $node.addClass("wertiview");
		  }		  
		  
		  // store span id internally
		  $node.data("wertiview", counter);
		  
		  $(this).wrap( function () {
		    return $node;
		  });

		  counter += 1;
		});

		// create the activity data from the copy with the spans in it
		view.interaction.createActivityData(contextDoc, enhId);	
	},

	/*
	 * Constructs the instruction for the given topic and activity
	 */
	constructTopicInstruction: function(topicName, activityType){
		console.log("constructTopicInstruction(topicName, activityType)");
		
		// TODO: consider make this more general
		// show instructions when the page is being enhanced
		// but only if the preference show instructions is enabled
		var topicInstruction = "";
		
		if(topicName == "RusAdjectiveFeminine"){
			// show the user instructions for the current topic and activity
			if(activityType == "colorize"){
				topicInstruction = 'VIEW shows you the Russian feminine adjectives in <font color="#ff8200"><b>orange</b></font>.';
			}
			else if(activityType == "click"){
				topicInstruction = 'Click on each Russian feminine adjective you find in the text and VIEW will show you whether' +
				' you guessed <font color="green"><b>right</b></font> or <font color="red"><b>wrong</b></font>.';
			}
			else if(activityType == "mc"){
				topicInstruction = 'Choose a Russian feminine adjective from the drop-down list and VIEW will show you whether you guessed'+ 
				' <font color="green"><b>right</b></font> or <font color="red"><b>wrong</b></font>.'+
				' You can get help by clicking on <span class="clozeStyleHint">?</span>.';
			}
			else if(activityType == "cloze"){
				topicInstruction = 'Fill in the blanks with the <font color="green"><b>correct</b></font> Russian feminine adjective. '+
				'If you guessed <font color="red"><b>wrong</b></font> or you find it too difficult'+
				' you can get help by clicking on <span class="clozeStyleHint">?</span>.';
			}
		}
		else if(topicName == "RusAdjectiveMasculine"){
			// show the user instructions for the current topic and activity
			if(activityType == "colorize"){
				topicInstruction = 'VIEW shows you the Russian masculine adjectives in <font color="#ff8200"><b>orange</b></font>.';
			}
			else if(activityType == "click"){
				topicInstruction = 'Click on each Russian masculine adjective you find in the text and VIEW will show you whether' +
				' you guessed <font color="green"><b>right</b></font> or <font color="red"><b>wrong</b></font>.';
			}
			else if(activityType == "mc"){
				topicInstruction = 'Choose a Russian masculine adjective from the drop-down list and VIEW will show you whether you guessed'+ 
				' <font color="green"><b>right</b></font> or <font color="red"><b>wrong</b></font>.'+
				' You can get help by clicking on <span class="clozeStyleHint">?</span>.';
			}
			else if(activityType == "cloze"){
				topicInstruction = 'Fill in the blanks with the <font color="green"><b>correct</b></font> Russian masculine adjective. '+
				'If you guessed <font color="red"><b>wrong</b></font> or you find it too difficult'+
				' you can get help by clicking on <span class="clozeStyleHint">?</span>.';
			}
		}			
		else if(topicName == "RusAdjectiveNeutral"){
			// show the user instructions for the current topic and activity
			if(activityType == "colorize"){
				topicInstruction = 'VIEW shows you the Russian neutral adjectives in <font color="#ff8200"><b>orange</b></font>.';
			}
			else if(activityType == "click"){
				topicInstruction = 'Click on each Russian neutral adjective you find in the text and VIEW will show you whether' +
				' you guessed <font color="green"><b>right</b></font> or <font color="red"><b>wrong</b></font>.';
			}
			else if(activityType == "mc"){
				topicInstruction = 'Choose a Russian neutral adjective from the drop-down list and VIEW will show you whether you guessed'+ 
				' <font color="green"><b>right</b></font> or <font color="red"><b>wrong</b></font>.'+
				' You can get help by clicking on <span class="clozeStyleHint">?</span>.';
			}
			else if(activityType == "cloze"){
				topicInstruction = 'Fill in the blanks with the <font color="green"><b>correct</b></font> Russian neutral adjective. '+
				'If you guessed <font color="red"><b>wrong</b></font> or you find it too difficult'+
				' you can get help by clicking on <span class="clozeStyleHint">?</span>.';
			}
		}			
		else if(topicName == "RusNounPlural"){
			// show the user instructions for the current topic and activity
			if(activityType == "colorize"){
				topicInstruction = 'VIEW shows you the Russian plural nouns in <font color="#ff8200"><b>orange</b></font>.';
			}
			else if(activityType == "click"){
				topicInstruction = 'Click on each Russian plural noun you find in the text and VIEW will show you whether' +
				' you guessed <font color="green"><b>right</b></font> or <font color="red"><b>wrong</b></font>.';
			}
			else if(activityType == "mc"){
				topicInstruction = 'Choose a Russian plural noun from the drop-down list and VIEW will show you whether you guessed'+ 
				' <font color="green"><b>right</b></font> or <font color="red"><b>wrong</b></font>.'+
				' You can get help by clicking on <span class="clozeStyleHint">?</span>.';
			}
			else if(activityType == "cloze"){
				topicInstruction = 'Fill in the blanks with the <font color="green"><b>correct</b></font> Russian plural noun. '+
				'If you guessed <font color="red"><b>wrong</b></font> or you find it too difficult'+
				' you can get help by clicking on <span class="clozeStyleHint">?</span>.';
			}
		}
		else if(topicName == "RusNouns"){
			// show the user instructions for the current topic and activity
			if(activityType == "colorize"){
				topicInstruction = 'VIEW shows you the Russian nouns in <font color="#ff8200"><b>orange</b></font>.';
			}
			else if(activityType == "click"){
				topicInstruction = 'Click on each Russian noun you find in the text and VIEW will show you whether' +
				' you guessed <font color="green"><b>right</b></font> or <font color="red"><b>wrong</b></font>.';
			}
			else if(activityType == "mc"){
				topicInstruction = 'Choose a Russian noun from the drop-down list and VIEW will show you whether you guessed'+ 
				' <font color="green"><b>right</b></font> or <font color="red"><b>wrong</b></font>.'+
				' You can get help by clicking on <span class="clozeStyleHint">?</span>.';
			}
			else if(activityType == "cloze"){
				topicInstruction = 'Fill in the blanks with the <font color="green"><b>correct</b></font> Russian noun. '+
				'If you guessed <font color="red"><b>wrong</b></font> or you find it too difficult'+
				' you can get help by clicking on <span class="clozeStyleHint">?</span>.';
			}
		}
		else if(topicName == "RusNounSingular"){
			// show the user instructions for the current topic and activity
			if(activityType == "colorize"){
				topicInstruction = 'VIEW shows you the Russian singular nouns in <font color="#ff8200"><b>orange</b></font>.';
			}
			else if(activityType == "click"){
				topicInstruction = 'Click on each Russian singular noun you find in the text and VIEW will show you whether' +
				' you guessed <font color="green"><b>right</b></font> or <font color="red"><b>wrong</b></font>.';
			}
			else if(activityType == "mc"){
				topicInstruction = 'Choose a Russian singular noun from the drop-down list and VIEW will show you whether you guessed'+ 
				' <font color="green"><b>right</b></font> or <font color="red"><b>wrong</b></font>.'+
				' You can get help by clicking on <span class="clozeStyleHint">?</span>.';
			}
			else if(activityType == "cloze"){
				topicInstruction = 'Fill in the blanks with the <font color="green"><b>correct</b></font> Russian singular noun. '+
				'If you guessed <font color="red"><b>wrong</b></font> or you find it too difficult'+
				' you can get help by clicking on <span class="clozeStyleHint">?</span>.';
			}
		}
		else if(topicName == "RusParticiples"){
			// show the user instructions for the current topic and activity
			if(activityType == "colorize"){
				topicInstruction = 'VIEW shows you the Russian participles in <font color="#ff8200"><b>orange</b></font>.';
			}
			else if(activityType == "click"){
				topicInstruction = 'Click on each Russian participle you find in the text and VIEW will show you whether' +
				' you guessed <font color="green"><b>right</b></font> or <font color="red"><b>wrong</b></font>.';
			}
			else if(activityType == "mc"){
				topicInstruction = 'Choose a Russian participle from the drop-down list and VIEW will show you whether you guessed'+ 
				' <font color="green"><b>right</b></font> or <font color="red"><b>wrong</b></font>.'+
				' You can get help by clicking on <span class="clozeStyleHint">?</span>.';
			}
			else if(activityType == "cloze"){
				topicInstruction = 'Fill in the blanks with the <font color="green"><b>correct</b></font> Russian participles. '+
				'If you guessed <font color="red"><b>wrong</b></font> or you find it too difficult'+
				' you can get help by clicking on <span class="clozeStyleHint">?</span>.';
			}
		}
		else if(topicName == "RusVerbAspect"){
			// show the user instructions for the current topic and activity
			if(activityType == "colorize"){
				topicInstruction = 'VIEW shows you the Russian perfective verbs in <font color="#ff8200"><b>orange</b></font>' +
				' and the Russian imperfective verbs in <font color="#A020F0"><b>purple</b></font>.';
			}
			else if(activityType == "mc"){
				topicInstruction = 'Choose a Russian verb from the drop-down list and VIEW will show you whether you guessed' +
				' <font color="green"><b>right</b></font> or <font color="red"><b>wrong</b></font>.';
			}
			else if(activityType == "cloze"){
				topicInstruction = 'Fill in the blanks with the <font color="green"><b>correct</b></font> Russian verb aspect form' +
				' with help of the <font color="green"><b>correct</b></font> lemma to the right.';
			}
		}
		else if(topicName == "RusVerbImperfective"){
			// show the user instructions for the current topic and activity
			if(activityType == "colorize"){
				topicInstruction = 'VIEW shows you the Russian imperfective verbs in <font color="#ff8200"><b>orange</b></font>.';
			}
			else if(activityType == "click"){
				topicInstruction = 'Click on each Russian imperfective verb you find in the text and VIEW will show you whether' +
				' you guessed <font color="green"><b>right</b></font> or <font color="red"><b>wrong</b></font>.';
			}
			else if(activityType == "mc"){
				topicInstruction = 'Choose a Russian imperfective verb from the drop-down list and VIEW will show you whether you guessed'+ 
				' <font color="green"><b>right</b></font> or <font color="red"><b>wrong</b></font>.'+
				' You can get help by clicking on <span class="clozeStyleHint">?</span>.';
			}
			else if(activityType == "cloze"){
				topicInstruction = 'Fill in the blanks with the <font color="green"><b>correct</b></font> Russian imperfective verb. '+
				'If you guessed <font color="red"><b>wrong</b></font> or you find it too difficult'+
				' you can get help by clicking on <span class="clozeStyleHint">?</span>.';
			}
		}
		else if(topicName == "RusVerbPastTense"){
			// show the user instructions for the current topic and activity
			if(activityType == "colorize"){
				topicInstruction = 'VIEW shows you the Russian past tense verbs in <font color="#ff8200"><b>orange</b></font>.';
			}
			else if(activityType == "click"){
				topicInstruction = 'Click on each Russian past tense verb you find in the text and VIEW will show you whether' +
				' you guessed <font color="green"><b>right</b></font> or <font color="red"><b>wrong</b></font>.';
			}
			else if(activityType == "mc"){
				topicInstruction = 'Choose a Russian past tense verb from the drop-down list and VIEW will show you whether you guessed'+ 
				' <font color="green"><b>right</b></font> or <font color="red"><b>wrong</b></font>.'+
				' You can get help by clicking on <span class="clozeStyleHint">?</span>.';
			}
			else if(activityType == "cloze"){
				topicInstruction = 'Fill in the blanks with the <font color="green"><b>correct</b></font> Russian past tense verb. '+
				'If you guessed <font color="red"><b>wrong</b></font> or you find it too difficult'+
				' you can get help by clicking on <span class="clozeStyleHint">?</span>.';
			}
		}
		else if(topicName == "RusVerbPerfective"){
			// show the user instructions for the current topic and activity
			if(activityType == "colorize"){
				topicInstruction = 'VIEW shows you the Russian perfective verbs in <font color="#ff8200"><b>orange</b></font>.';
			}
			else if(activityType == "click"){
				topicInstruction = 'Click on each Russian perfective verb you find in the text and VIEW will show you whether' +
				' you guessed <font color="green"><b>right</b></font> or <font color="red"><b>wrong</b></font>.';
			}
			else if(activityType == "mc"){
				topicInstruction = 'Choose a Russian perfective verb from the drop-down list and VIEW will show you whether you guessed'+ 
				' <font color="green"><b>right</b></font> or <font color="red"><b>wrong</b></font>.'+
				' You can get help by clicking on <span class="clozeStyleHint">?</span>.';
			}
			else if(activityType == "cloze"){
				topicInstruction = 'Fill in the blanks with the <font color="green"><b>correct</b></font> Russian perfective verb. '+
				'If you guessed <font color="red"><b>wrong</b></font> or you find it too difficult'+
				' you can get help by clicking on <span class="clozeStyleHint">?</span>.';
			}
		}
		else if(topicName == "RusVerbPresentTense"){
			// show the user instructions for the current topic and activity
			if(activityType == "colorize"){
				topicInstruction = 'VIEW shows you the Russian present tense verbs in <font color="#ff8200"><b>orange</b></font>.';
			}
			else if(activityType == "click"){
				topicInstruction = 'Click on each Russian present tense verb you find in the text and VIEW will show you whether' +
				' you guessed <font color="green"><b>right</b></font> or <font color="red"><b>wrong</b></font>.';
			}
			else if(activityType == "mc"){
				topicInstruction = 'Choose a Russian present tense verb from the drop-down list and VIEW will show you whether you guessed'+ 
				' <font color="green"><b>right</b></font> or <font color="red"><b>wrong</b></font>.'+
				' You can get help by clicking on <span class="clozeStyleHint">?</span>.';
			}
			else if(activityType == "cloze"){
				topicInstruction = 'Fill in the blanks with the <font color="green"><b>correct</b></font> Russian present tense verb. '+
				'If you guessed <font color="red"><b>wrong</b></font> or you find it too difficult'+
				' you can get help by clicking on <span class="clozeStyleHint">?</span>.';
			}
		}
		else if(topicName == "RusWordStress"){
			// show the user instructions for the current topic and activity
			if(activityType == "colorize"){
				topicInstruction = 'VIEW shows you the stress of the Russian words in <font color="#ff8200"><b>orange</b></font>.';
			}
			else if(activityType == "click"){
				topicInstruction = 'Click on each stressed vowel in the Russian words you find in the text and VIEW will show you whether' +
				' you guessed <font color="green"><b>right</b></font> or <font color="red"><b>wrong</b></font>.';
			}
			else if(activityType == "mc"){
				topicInstruction = 'Choose the Russian word with the correct stress from the drop-down list and VIEW will show you whether you guessed'+ 
				' <font color="green"><b>right</b></font> or <font color="red"><b>wrong</b></font>.'+
				' You can get help by clicking on <span class="clozeStyleHint">?</span>.';
			}
			else if(activityType == "cloze"){
				topicInstruction = 'VIEW will show you the <font color="green"><b>correct</b></font> stress for the Russian word '+
				' marked in <font color="red"><b>red</b></font> when you hover over it.';
			}
		}
		else if(topicName == "RusAssistiveReading"){
			// show the user instructions for the current topic and activity
			if(activityType == "click"){
				topicInstruction = 'By clicking on a Russian word, VIEW will show you the paradigm of the readings with' +
				' all possible readings bolded and point out the ruled out readings.';
			}
		}
		
		if(topicInstruction !== ""){
			// construct the instruction for the given topic and activity, can also be avoided by the user
			view.notification.addInst(topicInstruction, true);
		}
	},

	/*
	 * Selects text nodes and ignores "script", "noscript" and "style" nodes. 
	 * adapted from: http://stackoverflow.com/questions/298750/how-do-i-select-text-nodes-with-jquery
	 */
	getTextNodesIn: function(node) {
	    var textNodes = [];
	    function getTextNodes(node) {
	        if (node.nodeType == 3 && (/[^\t\n\r ]/.test(node.nodeValue))) {        	
	            textNodes.push(node);
	        } else if (node.nodeName == "SCRIPT" || node.nodeName == "NOSCRIPT" || node.nodeName == "STYLE") {
	        	// skip this node
	        } else {
	            for (var i = 0, len = node.childNodes.length; i < len; ++i) {
	                getTextNodes(node.childNodes[i]);
	            }
	        }
	    }

	    getTextNodes(node);
	    return textNodes;
	},

	/*
	 * Creates the activity data to be send to background.js
	 * for further processing on the server side.
	 */
	createActivityData: function(contextDoc, enhId) {
		console.log("createActivityData(contextDoc, enhId)");
		
		// if spans are found, send to server
		if ($("span.wertiview").length > 0) {
			var activityData = {};
			activityData["type"] = "page";
			activityData["enhId"] = enhId;
			activityData["url"] = contextDoc.baseURI;
			activityData["language"] = view.language;
			activityData["topic"] = view.topic;
			activityData["activity"] = view.activity;
			// outerHTML is first supported in Firefox 11
			activityData["document"] = "<html>" + contextDoc.documentElement.innerHTML + "</html>";
			activityData["version"] = view.version;
			activityData["userId"] = view.userid;
			
			// send a request to the background script, to send the activity data to the server for processing
			console.log("createActivityData: request 'send activityData'");
		    chrome.runtime.sendMessage({
		    	msg: "send activityData",
		    	activityData: activityData, 
		    	ajaxTimeout: view.ajaxTimeout,
		    	servletURL: view.servletURL
		    });		
		} else {
			view.interaction.initalInteractionState();
		}
	},

	/*
	 * The extension send the message to call addServerMarkup(data, options).
	 */
	callAddServerMarkup: function(request, sender, sendResponse) {
		if(request.msg == "call addServerMarkup"){
			console.log("callAddServerMarkup: received '" + request.msg + "'");
			// once the server has finished processing the 
			// enhancement, the user can no longer stop it
			if(!view.interaction.isAborted){
				chrome.runtime.sendMessage({
				    msg: "hide element",
				    selector: "#wertiview-toolbar-abort-button"
				});
				view.interaction.addServerMarkup(request.data); 
			}
		}
	},
	
	/*
	 * Adds the html markup sent from the server to the page.
	 * Text nodes are replaced with annotated spans.
	 */
	addServerMarkup: function(data) {
		console.log("addServerMarkup(data)");
		
		// parse result from wertiview servlet from JSON into list
		var dataList = JSON.parse(data);

		var counter = 0;
		var newcontent;
		
		var spans = [];

		// retrieve all relevant text nodes and store them in spans
		$("span.wertiview").each( function() {
		  if ($(this).data("wertiview")) {
		    spans.push($(this));
		  }
		});
		
		// use the data from the server to replace the text nodes with annotated spans
		while (spans.length > 0) {
			var span = spans.shift();
			counter = span.data("wertiview");

			// retrieve matching updated content
			newcontent = dataList[counter];
			if(newcontent != null) {
				var $newspan = $(newcontent);

				// replace old content with new content
				span.replaceWith($newspan);
				$newspan.data("wertiviewid", counter);
			}
		}	

		view.interaction.runActivity();
		view.interaction.initalInteractionState();
		chrome.runtime.sendMessage({
		    msg: "show element",
		    selector: "#wertiview-toolbar-restore-button"
		});
	},

	/*
	 * Runs the activity selected and informs user when finished with processing
	 */
	runActivity: function() {
		console.log("runActivity(options)");
		
		var topic = view.topicName;
		
		switch(view.activity) {
			case "colorize":
				
				view[topic].colorize(view.topic);
				
				view.notification.add("VIEW Colorize Activity Ready");
				break;
			case "click":
				// remove click from all links
				$("body").on("click", "a", view.lib.clickDisableLink);
				
				view[topic].click();

				view.notification.add("VIEW Click Activity Ready");
				
				break;
			case "mc":
				// no link disabling because the drop-down boxes are prevented
				// from showing up with links because they act strange in links
				
				view[topic].mc();

				view.notification.add("VIEW Multiple Choice Activity Ready");
				break;
			case "cloze":
				// remove click from all links that contain input boxes
				$("body").on("click", "a", view.lib.clozeDisableLink); 
				
				view[topic].cloze();
				
				view.notification.add("VIEW Practice Activity Ready");
				view.blur.remove();
				break;
			default:
				view.blur.remove();
				// we should never get here
				alert("Invalid activity");
		}
	},

	/*
	 * Returns the input using the parameters.
	 * Used in the collectInfoData function.
	 */
	collectInputData: function(element, usedHint, isClick) {
		var result = undefined;
		if (usedHint) {
			element = element.prev();
		}
		if (!isClick && element.val() !== "") {
			result = element.val();
		} else if(!isClick && element.val() == "") {
			result = "no input";
		} else {
			result = element.text();
		}
		return result;
	},

	/*
	 * Returns the correct answer using the paramters.
	 * Used in the collectInfoData function.
	 */
	collectAnswerData: function(element, usedHint) {
		if (usedHint) {
			element = element.prev();
		}
		return element.data("wertiviewanswer");
	},

	/*
	 * Collects information available before the user interaction updates the page.
	 * 
	 * @param element which the user is currently working at
	 * @param usedHint whether the user clicked the 'hint' button (default: false)
	 * @param collectInputDataCallback function that returns the user input (default: collectInputData)
	 * @param collectAnswerDataCallback function that returns the correct answer (default: collectAnswerData)
	 */
	collectInfoData: function(element, usedHint, collectInputDataCallback, collectAnswerDataCallback){
		var info = {};
		var elementInfo = {};	
		
		// collect info data before interaction
		info["type"] = "practice";
		info["enhId"] = $("body").data("wertiview-enhId");
		info["language"] = view.language;
		info["topic"] = view.topic;
		info["activity"] = view.activity;
		var isClick = (info["activity"] == "click");
		info["version"] = view.version;
		info["userId"] = view.userid;
		info["url"] = document.baseURI;
		// get the outermost <span class="wertiview"> around this tag
		var wertiviewSpan = undefined;
		$(element).parents("span.wertiview").each(function() {
			// sometimes an object on this list is {}
			if (this !== undefined && this !== null && this != {}) {
				wertiviewSpan = $(this);
			}
		});
		if (wertiviewSpan !== undefined) {
			elementInfo["wertiviewspanid"] = wertiviewSpan.data("wertiviewid");
		}
		elementInfo["wertiviewtokenid"] = $(element).attr("id");
		elementInfo["userinput"] = collectInputDataCallback($(element), usedHint, isClick);
		if (!isClick) {
			elementInfo["correctanswer"] = collectAnswerDataCallback($(element), usedHint);
			elementInfo["usedhint"] = usedHint;
		}
		
		var infos =  {
				info: info,
				elementInfo: elementInfo
		};
		return infos;
	},

	/*
	 * Collects and sends information about the interaction to the server.
	 * 
	 * @param info contains all info available before user interaction updates the page
	 * @param elementInfo contains all info of the element the user interacted with
	 * @param countsAsCorrect marks the answer as correct or incorrect for the user
	 * @param usedHint whether the user clicked the 'hint' button (default: false)
	 */
	collectInteractionData: function(info, elementInfo, countsAsCorrect, usedHint){	
		// if the user used a hint, then it is definitely a correct answer
		elementInfo["countsascorrect"] = usedHint || countsAsCorrect;
		// yes, this is intended to be double-encoded in JSON
		info["document"] = JSON.stringify(elementInfo);
		
		// send a request to the background script, 
		// send interaction data to the server for processing
		console.log("collectInteractionData: request 'send interactionData'");
	    chrome.runtime.sendMessage({
	    	msg: "send interactionData",
	    	interactionData: info, 
	    	servletURL: view.servletURL
	    });	
	},

	/*
	 * Generate multiple choice exercises.
	 * 
	 * @param hitList list of hits that could be turned into exercises, unwanted instance must be removed in advance
	 * @param getOptionsCallback a function that returns an array of choices to be presented to the user
	 * @param getCorrectAnswerCallback a function that returns the correct answer choice for a given hit
	 * @param addProcCallback a function that is called for every exercise (default: wertiview.lib.doNothing)
	 * @param emptyHit if true, the hit text will be erased (default: true)
	 * @param partExercises decimal by which the number of exercises to generate is multiplied in 'fixed number' mode (default: 1.0)
	 */
	mcHandler: function(hitList, inputHandler, hintHandler, 
			getOptionsCallback, getCorrectAnswerCallback, addProcCallback, 
			emptyHit, partExercises){
		console.log("mcHandler(hitList, inputHandler, hintHandler," +
				"getOptionsCallback, getCorrectAnswerCallback, addProcCallback, " +
				"emptyHit, partExercises)");
		
		var fixedOrPercentageValue = view.fixedOrPercentage;
	    var fixedNumberOfExercises = view.fixedNumberOfExercises;
	    var proportionOfExercises = view.proportionOfExercises;
	    var choiceModeValue = view.choiceMode;
	    var firstOffset = view.firstOffset;
	    var intervalSize = view.intervalSize;

		if (typeof addProcCallback == "undefined"){
			addProcCallback = view.lib.doNothing;
		}
		if (typeof emptyHit == "undefined"){
			emptyHit = true;
		}
		if (typeof partExercises == "undefined"){
			partExercises = 1.0;
		}
		
		// calculate the number of hits to turn into exercises
	    var numExercises = 0;
	    if (fixedOrPercentageValue == 0) {
	        numExercises = fixedNumberOfExercises * partExercises;
	    }
	    else if (fixedOrPercentageValue == 1) {
	    	numExercises = proportionOfExercises * hitList.length;
	    }
	    else {
	    	// we should never get here
	    	view.interaction.prefError();
	    }
	    
	    // choose which hits to turn into exercises
	    var i = 0;
	    var inc = 1;
	    if (choiceModeValue == 0) {
	    	view.lib.shuffleList(hitList);
	    }
	    else if (choiceModeValue == 1) {
	    	i = firstOffset;
	    }
	    else if (choiceModeValue == 2){
	    	inc = intervalSize;
	    }
	    else {
	    	// we should never get here
	    	view.interaction.prefError();
	    }
	    
	    // generate the exercises
	    for (; numExercises > 0 && i < hitList.length; i += inc){
	    	var $hit = hitList[i];	    

	    	// if the span is inside a link, skip (drop-down boxes are weirder 
			// than text input boxes, need to investigate further)
			if ($hit.parents("a").length > 0) {
				continue;
			}

			var capType = view.lib.detectCapitalization($hit.text());
	    	
			// choices for the user
	    	var options = getOptionsCallback($hit, capType);
	    	// correct choice
	    	var answer = getCorrectAnswerCallback($hit, capType);
	    	

			// create select box
			var $input = $("<select>");
			var inputId = $hit.attr("id") + "-select";
			$input.attr("id", inputId);
			$input.addClass("wertiviewinput");
			var $option = $("<option>");
			$option.html(" ");
			$input.append($option);
			for (var j = 0; j < options.length; j++) {
				$option = $("<option>");
				$option.text(options[j]);
				$input.append($option);
			}

	    	// save original text/answer
	    	$input.data("wertivieworiginaltext", $hit.text());
	    	$input.data("wertiviewanswer", answer);	    	
	    	
			if (emptyHit){
				$hit.empty();
			}
			$hit.append($input);
			
			// create hint ? button
			var $hint = $("<span>");
			$hint.attr("id", $hit.attr("id") + "-hint");
			$hint.addClass("clozeStyleHint");
			$hint.text("?");
			$hint.addClass("wertiviewhint");
			$hit.append($hint);
			
			// e.g., phrasalverbs needs to add colorization to the verb
	    	// NEW add rephrase for participles
			addProcCallback($hit, capType);

			// count down numExercises until we're finished
			numExercises--;
	    }

	    $("body").on("change", "select.wertiviewinput", inputHandler);
	    $("body").on("click", "span.wertiviewhint", hintHandler);
	},

	/*
	 * Illegal value for a preference (e.g., user edited about:config)
	 */
	prefError: function(message) {  
		view.interaction.initalInteractionState();

		if (message) {
			alert(message);
		}
		else {
			alert("The preferences have illegal values. Please go to 'Options > Addons' and change the VIEW preferences.");
		}
	},

	/*
	 * Generate cloze exercises. TODO BUG: When typing an answer into the input field and then pressing on the
	 * hint right away, both the typed answer and the hint event are triggered at the same time and send to the server.
	 * @param hitList list of hits that could be turned into exercises, unwanted instance must be removed in advance
	 * @param getCorrectAnswerCallback a function that returns the correct answer choice for a given hit
	 * @param addProcCallback a function that is called for every exercise (default: wertiview.lib.doNothing)
	 * @param emptyHit if true, the hit text will be erased (default: true)
	 * @param partExercises decimal by which the number of exercises to generate is multiplied in 'fixed number' mode (default: 1.0)
	 */
	clozeHandler: function(hitList, inputHandler, hintHandler, 
			getCorrectAnswerCallback, addProcCallback, 
			emptyHit, partExercises){	
		console.log("clozeHandler(hitList, inputHandler, hintHandler," +
				"getCorrectAnswerCallback, addProcCallback, " +
				"emptyHit, partExercises)");
		
		var fixedOrPercentageValue = view.fixedOrPercentage;
	    var fixedNumberOfExercises = view.fixedNumberOfExercises;
	    var proportionOfExercises = view.proportionOfExercises;
	    var choiceModeValue = view.choiceMode;
	    var firstOffset = view.firstOffset;
	    var intervalSize = view.intervalSize;

		if (typeof addProcCallback == "undefined"){
			addProcCallback = view.lib.doNothing;
		}
		if (typeof emptyHit == "undefined"){
			emptyHit = true;
		}
		if (typeof partExercises == "undefined"){
			partExercises = 1.0;
		}

		// calculate the number of hits to turn into exercises
	    var numExercises = 0;
	    if (fixedOrPercentageValue == 0) {
	        numExercises = fixedNumberOfExercises * partExercises;
	    }
	    else if (fixedOrPercentageValue == 1) {
	    	numExercises = proportionOfExercises * hitList.length;
	    }
	    else {
	    	// we should never get here
	    	view.interaction.prefError();
	    }
	    
	    // choose which hits to turn into exercises
	    var i = 0;
	    var inc = 1;
	    if (choiceModeValue == 0) {
	    	view.lib.shuffleList(hitList);
	    }
	    else if (choiceModeValue == 1) {
	    	i = firstOffset;
	    }
	    else if (choiceModeValue == 2){
	    	inc = intervalSize;
	    }
	    else {
	    	// we should never get here
	    	view.interaction.prefError();
	    }
	    
	    // override preferences for Konjunktiv
	    if ($("body").data("wertiview-topic") == "Konjunktiv") {
	    	numExercises = hitList.length;
	    	i = 0;
	    	inc = 1;
	    }
	    
	    // generate the exercises
	    for (; numExercises > 0 && i < hitList.length; i += inc){
			var $hit = hitList[i];
			
			var capType = view.lib.detectCapitalization($hit.text());
	    	
	    	// correct choice
	    	var answer = getCorrectAnswerCallback($hit, capType);

			// create input box
			var $input = $("<input>");
	    	// save original text/answer
	    	$input.data("wertivieworiginaltext", $hit.text());
			$input.attr("type", "text");
			// average of 10 px per letter (can fit 10 x "м" with a width of 110)
			$input.css("width", (answer.length * 10) + "px"); 
			$input.attr("id", $hit.attr("id") + "-input");
			$input.addClass("clozeStyleInput");
			$input.addClass("wertiviewinput");
			$input.data("wertiviewanswer", answer);
			if (emptyHit) {
				$hit.empty();
			}
			$hit.append($input);
			
			// create hint ? button
			var $hint = $("<span>");
			$hint.attr("id", $hit.attr("id") + "-hint");
			$hint.addClass("clozeStyleHint");
			$hint.text("?");
			$hint.addClass("wertiviewhint");
			$hit.append($hint);
	    	
	    	// e.g., phrasalverbs needs to add colorization to the verb
			// and gerunds needs to display the base form
			addProcCallback($hit, capType);

			// count down numExercises until we"re finished
			numExercises--;
		}
		
		// figure out next field
		var prevhit = null;
		var nexthits = {};

		$("input.wertiviewinput").each( function() {
			// keep track of links to next input field
			if (prevhit) {
				nexthits[prevhit] = $(this).attr("id");
			}
			prevhit = $(this).attr("id");
		});
		
		// add the next input info to each input field
		$("input.wertiviewinput").each( function() {
			if (nexthits[$(this).attr("id")]) {
				$(this).data("wertiviewnexthit", nexthits[$(this).attr("id")]);
			} else {
				$(this).data("wertiviewnexthit", null);
			}
		});

		$("body").on("change", "input.wertiviewinput", inputHandler);
		$("body").on("click", "span.wertiviewhint", hintHandler);
	},
	
	/*
	 * The extension send the message to call abort().
	 */
	callAbort: function(request, sender, sendResponse) {
		if (request.msg == "call abort") {
			console.log("callAbort: received '" + request.msg + "'");
			view.interaction.abort();
		}
	},

	/*
	 * Abort the enhancement process.
	 */
	abort: function(){
		console.log("abort()");

		// find out the enhancement ID of this page
		var enhId = $("body").data("wertiview-enhId");

		var requestData = {};
		requestData["type"] = "stop";
		requestData["enhId"] = enhId;
		requestData["url"] = document.baseURI;
		requestData["language"] = view.language;
		requestData["topic"] = view.topic;
		requestData["activity"] = view.activity;
		requestData["version"] = view.version;
		requestData["userId"] = view.userid;
		
		// send a request to the background script, to send the request data to the server for processing
		console.log("abort: request 'send requestData abort'");
	    chrome.runtime.sendMessage({
	    	msg: "send requestData abort",
	    	requestData: requestData, 
	    	ajaxTimeout: view.ajaxTimeout,
	    	servletURL: view.servletURL
	    });		
	},

	/*
	 * The extension send the message to abort the enhancement.
	 */
	abortEnhancement: function(request, sender, sendResponse) {	
		if(request.msg == "call abortEnhancement"){
			console.log("abortEnhancement: received '" + request.msg + "'");
			//always revert to the Enhance button, no matter whether the 
			// server process was stopped successfully
			view.interaction.initalInteractionState();
			view.interaction.isAborted = true;
		}
	},
	
	/*
	 * The extension send the message to call restoreToOriginal().
	 */
	callRestoreToOriginal: function(request, sender, sendResponse) {
		if (request.msg == "call restore to original") {
			console.log("callAbort: received '" + request.msg + "'");
			view.interaction.restoreToOriginal();
		}
	},
	
	/*
	 * Start to remove the wertiview markup and 
	 * restore the original page. 
	 * TODO: BUG: in the cloze activity not everything
	 * gets restored: for instance when the wrong answer is left alone and
	 * enhance is pressed, the token count increases, same with correct answers.
	 */
	restoreToOriginal: function() {
		console.log("restoreToOriginal()");
		
		var topicName = view.interaction.getTopicName($("body").data("wertiview-topic"));

		$("body").removeData("wertiview-language");
		$("body").removeData("wertiview-topic");
		$("body").removeData("wertiview-activity");	
		
		// if we can't find a topic name, skip the rest of the removal
		if (topicName == null) {
			return;
		}	
		
		// remove topic specific markup
		view[topicName].restore();

		$(".wertiview").each( function() {
			$(this).replaceWith($(this).text());
		});

		$("body").off("click", "a", view.lib.clickDisableLink);
		$("body").off("click keydown", "a", view.lib.clozeDisableLink);
		
		chrome.runtime.sendMessage({
		    msg: "hide element",
		    selector: "#wertiview-toolbar-restore-button"
		});
		
		view.notification.remove();
		view.blur.remove();
		
		$("#wertiview-inst-notification").remove();
	},
	
	/*
	 * The extension send the message to sign out the user.
	 */
	signOutUser: function(request, sender, sendResponse) {	
		if(request.msg == "call signOut"){
			console.log("signOutUser: received '" + request.msg + "'");
			view.userid = "";
		}
	},
	
	/*
	 * The extension send the message to sign in the user.
	 */
	signInUser: function(request, sender, sendResponse) {	
		if(request.msg == "call signIn"){
			console.log("signInUser: received '" + request.msg + "'");	
			view.userid = request.userid;
		}
	}
};

//assign addInteraction() as a listener for messages from the extension
chrome.runtime.onMessage.addListener(view.interaction.addInteraction);

//assign callInitalInteractionState() as a listener for messages from the extension
chrome.runtime.onMessage.addListener(view.interaction.callInitalInteractionState);

//assign callSaveDataAndInsertSpans() as a listener for messages from the extension
chrome.runtime.onMessage.addListener(view.interaction.callSaveDataAndInsertSpans);

//assign callAddServerMarkup() as a listener for messages from the extension
chrome.runtime.onMessage.addListener(view.interaction.callAddServerMarkup);

//assign abortEnhancement() as a listener for messages from the extension
chrome.runtime.onMessage.addListener(view.interaction.abortEnhancement);

//assign signOutUser() as a listener for messages from the extension
chrome.runtime.onMessage.addListener(view.interaction.signOutUser);

//assign signInUser() as a listener for messages from the extension
chrome.runtime.onMessage.addListener(view.interaction.signInUser);

/*
 * Handle messages from the add-on background page (only in top level iframes)
 */
if (window.parent == window) {
	//assign the functions as a listener for messages from the extension
	chrome.runtime.onMessage.addListener(view.interaction.toggleToolbar);
	chrome.runtime.onMessage.addListener(view.interaction.callToggleMenuVIEW);
	chrome.runtime.onMessage.addListener(view.interaction.callAbort);
	chrome.runtime.onMessage.addListener(view.interaction.callRestoreToOriginal);
}