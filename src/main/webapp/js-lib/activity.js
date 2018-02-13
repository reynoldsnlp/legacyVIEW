
	var isAborted;
	wertiview.activity = {
			

	// add wertiview markup
	add: function(contextDoc) {
		var jQuery = wertiview.jQuery;
		var $ = function(selector,context){ return new jQuery.fn.init(selector,contextDoc||window.content.document); };
		$.fn = $.prototype = jQuery.fn;

		// identify context document under consideration
		contextDoc = contextDoc||window.content.document;

		// disable toolbar button
		wertiview.toolbar.disableRunButton();
		wertiview.toolbar.disableRestoreButton();
		wertiview.toolbar.showSpinningWheel();

		// load options from preferences
		var options = wertiview.getOptions();

		// remove any previous activity from this page
		if ($('.wertiview').length > 0) {
			wertiview.activity.remove(contextDoc);
		}
		
		// check for appropriate selections
		if (options['language'] == "unselected") {
			alert("Please select a language!");
			wertiview.toolbar.hideSpinningWheel();
			wertiview.toolbar.disableAbortButton();
			wertiview.toolbar.enableRunButton();
			wertiview.blur.remove(contextDoc);
			return;
		} else if (options['topic'] == "unselected") {
			alert("Please select a topic!");
			wertiview.toolbar.hideSpinningWheel();
			wertiview.toolbar.disableAbortButton();
			wertiview.toolbar.enableRunButton();
			wertiview.blur.remove(contextDoc);
			return;
		} else if (options['activity'] == "unselected") {
			alert("Please select an activity!");
			wertiview.toolbar.hideSpinningWheel();
			wertiview.toolbar.disableAbortButton();
			wertiview.toolbar.enableRunButton();
			wertiview.blur.remove(contextDoc);
			return;
		}
		
		var topicName = wertiview.activity.getTopicName(options['topic']);
		
		// check whether this topic/activity exists as a function
		if (!window['wertiview'][topicName] || !window['wertiview'][topicName][options['activity']]) {
			alert("The selected topic and activity are not available.");
			wertiview.toolbar.hideSpinningWheel();
			wertiview.toolbar.disableAbortButton();
			wertiview.toolbar.enableRunButton();
			wertiview.blur.remove(contextDoc);
			return;
		}
		
		var activityFunction = window['wertiview'][topicName][options['activity']];

		if(typeof activityFunction !== 'function') {
			alert("The selected topic and activity are not available.");
			wertiview.toolbar.hideSpinningWheel();
			wertiview.toolbar.disableAbortButton();
			wertiview.toolbar.enableRunButton();
			wertiview.blur.remove(contextDoc);
			return;
		}

		// blur the page for cloze activity
		if (options['activity'] == "cloze") {
			wertiview.blur.add(contextDoc, true, "0.9");
		}

		// request an enhancement ID from the server
		var requestData = {};
		requestData['type'] = "ID";
		requestData['url'] = wertiview.getURL(contextDoc);
		requestData['language'] = options['language'];
		requestData['topic'] = options['topic'];
		requestData['activity'] = options['activity'];
		requestData['version'] = wertiview.VERSION;
		requestData['userId'] = wertiview.getUserid();

		var ajaxTimeout = wertiview.getAjaxTimeout() || 120000;
		jQuery.ajax({
			type: "POST",
			url: wertiview.servletURL,
			data: wertiview.nativeJSON.encode(requestData),
			processData: false,
			timeout: ajaxTimeout,
			success: function(data, textStatus, xhr) { 
				if (data) {
					isAborted = false;
					wertiview.activity.insertSpansAndEnhance(data, options, contextDoc);
				} else {
					wertiview.activity.ajaxError(xhr, "nodata");
					wertiview.toolbar.hideSpinningWheel();
					wertiview.toolbar.disableAbortButton();
					wertiview.toolbar.enableRunButton();
					wertiview.blur.remove(contextDoc);
				}
			},
			error: wertiview.activity.ajaxError
		});
	},
	
	insertSpansAndEnhance: function(data, options, contextDoc){
		var jQuery = wertiview.jQuery;
		var $ = function(selector,context){ return new jQuery.fn.init(selector,contextDoc||window.content.document); };
		$.fn = $.prototype = jQuery.fn;
		
		var topicName = options['topic'];
		
		var activityType = options['activity'];
		
		// show instructions when the page is being enhanced
		// but only if the preference show instructions is enabled
		if(wertiview.getShowInst()){
			var topicInstruction = '';
			
			if(topicName == 'RusAdjectiveFeminine'){
				// show the user instructions for the current topic and activity
				if(activityType == 'colorize'){
					topicInstruction = 'VIEW shows you the Russian feminine adjectives in <font color="#ff8200"><b>orange</b></font>.';
				}
				else if(activityType == 'click'){
					topicInstruction = 'Click on each Russian feminine adjective you find in the text and VIEW will show you whether' +
					' you guessed <font color="green"><b>right</b></font> or <font color="red"><b>wrong</b></font>.';
				}
				else if(activityType == 'mc'){
					topicInstruction = 'Choose a Russian feminine adjective from the drop-down list and VIEW will show you whether you guessed'+ 
					' <font color="green"><b>right</b></font> or <font color="red"><b>wrong</b></font>.'+
					' You can get help by clicking on <span class="clozeStyleHint">?</span>.';
				}
				else if(activityType == 'cloze'){
					topicInstruction = 'Fill in the blanks with the <font color="green"><b>correct</b></font> Russian feminine adjective. '+
					'If you guessed <font color="red"><b>wrong</b></font> or you find it too difficult'+
					' you can get help by clicking on <span class="clozeStyleHint">?</span>.';
				}
			}
			else if(topicName == 'RusAdjectiveMasculine'){
				// show the user instructions for the current topic and activity
				if(activityType == 'colorize'){
					topicInstruction = 'VIEW shows you the Russian masculine adjectives in <font color="#ff8200"><b>orange</b></font>.';
				}
				else if(activityType == 'click'){
					topicInstruction = 'Click on each Russian masculine adjective you find in the text and VIEW will show you whether' +
					' you guessed <font color="green"><b>right</b></font> or <font color="red"><b>wrong</b></font>.';
				}
				else if(activityType == 'mc'){
					topicInstruction = 'Choose a Russian masculine adjective from the drop-down list and VIEW will show you whether you guessed'+ 
					' <font color="green"><b>right</b></font> or <font color="red"><b>wrong</b></font>.'+
					' You can get help by clicking on <span class="clozeStyleHint">?</span>.';
				}
				else if(activityType == 'cloze'){
					topicInstruction = 'Fill in the blanks with the <font color="green"><b>correct</b></font> Russian masculine adjective. '+
					'If you guessed <font color="red"><b>wrong</b></font> or you find it too difficult'+
					' you can get help by clicking on <span class="clozeStyleHint">?</span>.';
				}
			}			
			else if(topicName == 'RusAdjectiveNeutral'){
				// show the user instructions for the current topic and activity
				if(activityType == 'colorize'){
					topicInstruction = 'VIEW shows you the Russian neutral adjectives in <font color="#ff8200"><b>orange</b></font>.';
				}
				else if(activityType == 'click'){
					topicInstruction = 'Click on each Russian neutral adjective you find in the text and VIEW will show you whether' +
					' you guessed <font color="green"><b>right</b></font> or <font color="red"><b>wrong</b></font>.';
				}
				else if(activityType == 'mc'){
					topicInstruction = 'Choose a Russian neutral adjective from the drop-down list and VIEW will show you whether you guessed'+ 
					' <font color="green"><b>right</b></font> or <font color="red"><b>wrong</b></font>.'+
					' You can get help by clicking on <span class="clozeStyleHint">?</span>.';
				}
				else if(activityType == 'cloze'){
					topicInstruction = 'Fill in the blanks with the <font color="green"><b>correct</b></font> Russian neutral adjective. '+
					'If you guessed <font color="red"><b>wrong</b></font> or you find it too difficult'+
					' you can get help by clicking on <span class="clozeStyleHint">?</span>.';
				}
			}			
			else if(topicName == 'RusNounPlural'){
				// show the user instructions for the current topic and activity
				if(activityType == 'colorize'){
					topicInstruction = 'VIEW shows you the Russian plural nouns in <font color="#ff8200"><b>orange</b></font>.';
				}
				else if(activityType == 'click'){
					topicInstruction = 'Click on each Russian plural noun you find in the text and VIEW will show you whether' +
					' you guessed <font color="green"><b>right</b></font> or <font color="red"><b>wrong</b></font>.';
				}
				else if(activityType == 'mc'){
					topicInstruction = 'Choose a Russian plural noun from the drop-down list and VIEW will show you whether you guessed'+ 
					' <font color="green"><b>right</b></font> or <font color="red"><b>wrong</b></font>.'+
					' You can get help by clicking on <span class="clozeStyleHint">?</span>.';
				}
				else if(activityType == 'cloze'){
					topicInstruction = 'Fill in the blanks with the <font color="green"><b>correct</b></font> Russian plural noun. '+
					'If you guessed <font color="red"><b>wrong</b></font> or you find it too difficult'+
					' you can get help by clicking on <span class="clozeStyleHint">?</span>.';
				}
			}
			else if(topicName == 'RusNouns'){
				// show the user instructions for the current topic and activity
				if(activityType == 'colorize'){
					topicInstruction = 'VIEW shows you the Russian nouns in <font color="#ff8200"><b>orange</b></font>.';
				}
				else if(activityType == 'click'){
					topicInstruction = 'Click on each Russian noun you find in the text and VIEW will show you whether' +
					' you guessed <font color="green"><b>right</b></font> or <font color="red"><b>wrong</b></font>.';
				}
				else if(activityType == 'mc'){
					topicInstruction = 'Choose a Russian noun from the drop-down list and VIEW will show you whether you guessed'+ 
					' <font color="green"><b>right</b></font> or <font color="red"><b>wrong</b></font>.'+
					' You can get help by clicking on <span class="clozeStyleHint">?</span>.';
				}
				else if(activityType == 'cloze'){
					topicInstruction = 'Fill in the blanks with the <font color="green"><b>correct</b></font> Russian noun. '+
					'If you guessed <font color="red"><b>wrong</b></font> or you find it too difficult'+
					' you can get help by clicking on <span class="clozeStyleHint">?</span>.';
				}
			}
			else if(topicName == 'RusNounSingular'){
				// show the user instructions for the current topic and activity
				if(activityType == 'colorize'){
					topicInstruction = 'VIEW shows you the Russian singular nouns in <font color="#ff8200"><b>orange</b></font>.';
				}
				else if(activityType == 'click'){
					topicInstruction = 'Click on each Russian singular noun you find in the text and VIEW will show you whether' +
					' you guessed <font color="green"><b>right</b></font> or <font color="red"><b>wrong</b></font>.';
				}
				else if(activityType == 'mc'){
					topicInstruction = 'Choose a Russian singular noun from the drop-down list and VIEW will show you whether you guessed'+ 
					' <font color="green"><b>right</b></font> or <font color="red"><b>wrong</b></font>.'+
					' You can get help by clicking on <span class="clozeStyleHint">?</span>.';
				}
				else if(activityType == 'cloze'){
					topicInstruction = 'Fill in the blanks with the <font color="green"><b>correct</b></font> Russian singular noun. '+
					'If you guessed <font color="red"><b>wrong</b></font> or you find it too difficult'+
					' you can get help by clicking on <span class="clozeStyleHint">?</span>.';
				}
			}
			else if(topicName == 'RusParticiples'){
				// show the user instructions for the current topic and activity
				if(activityType == 'colorize'){
					topicInstruction = 'VIEW shows you the Russian participles in <font color="#ff8200"><b>orange</b></font>.';
				}
				else if(activityType == 'click'){
					topicInstruction = 'Click on each Russian participle you find in the text and VIEW will show you whether' +
					' you guessed <font color="green"><b>right</b></font> or <font color="red"><b>wrong</b></font>.';
				}
				else if(activityType == 'mc'){
					topicInstruction = 'Choose a Russian participle from the drop-down list and VIEW will show you whether you guessed'+ 
					' <font color="green"><b>right</b></font> or <font color="red"><b>wrong</b></font>.'+
					' You can get help by clicking on <span class="clozeStyleHint">?</span>.';
				}
				else if(activityType == 'cloze'){
					topicInstruction = 'Fill in the blanks with the <font color="green"><b>correct</b></font> Russian participles. '+
					'If you guessed <font color="red"><b>wrong</b></font> or you find it too difficult'+
					' you can get help by clicking on <span class="clozeStyleHint">?</span>.';
				}
			}
			else if(topicName == 'RusVerbAspect'){
				// show the user instructions for the current topic and activity
				if(activityType == 'colorize'){
					topicInstruction = 'VIEW shows you the Russian perfective verbs in <font color="#ff8200"><b>orange</b></font>' +
					' and the Russian imperfective verbs in <font color="#A020F0"><b>purple</b></font>.';
				}
				else if(activityType == 'mc'){
					topicInstruction = 'Choose a Russian verb from the drop-down list and VIEW will show you whether you guessed' +
					' <font color="green"><b>right</b></font> or <font color="red"><b>wrong</b></font>.';
				}
				else if(activityType == 'cloze'){
					topicInstruction = 'Fill in the blanks with the <font color="green"><b>correct</b></font> Russian verb aspect form' +
					' with help of the <font color="green"><b>correct</b></font> lemma to the right.';
				}
			}
			else if(topicName == 'RusVerbImperfective'){
				// show the user instructions for the current topic and activity
				if(activityType == 'colorize'){
					topicInstruction = 'VIEW shows you the Russian imperfective verbs in <font color="#ff8200"><b>orange</b></font>.';
				}
				else if(activityType == 'click'){
					topicInstruction = 'Click on each Russian imperfective verb you find in the text and VIEW will show you whether' +
					' you guessed <font color="green"><b>right</b></font> or <font color="red"><b>wrong</b></font>.';
				}
				else if(activityType == 'mc'){
					topicInstruction = 'Choose a Russian imperfective verb from the drop-down list and VIEW will show you whether you guessed'+ 
					' <font color="green"><b>right</b></font> or <font color="red"><b>wrong</b></font>.'+
					' You can get help by clicking on <span class="clozeStyleHint">?</span>.';
				}
				else if(activityType == 'cloze'){
					topicInstruction = 'Fill in the blanks with the <font color="green"><b>correct</b></font> Russian imperfective verb. '+
					'If you guessed <font color="red"><b>wrong</b></font> or you find it too difficult'+
					' you can get help by clicking on <span class="clozeStyleHint">?</span>.';
				}
			}
			else if(topicName == 'RusVerbPastTense'){
				// show the user instructions for the current topic and activity
				if(activityType == 'colorize'){
					topicInstruction = 'VIEW shows you the Russian past tense verbs in <font color="#ff8200"><b>orange</b></font>.';
				}
				else if(activityType == 'click'){
					topicInstruction = 'Click on each Russian past tense verb you find in the text and VIEW will show you whether' +
					' you guessed <font color="green"><b>right</b></font> or <font color="red"><b>wrong</b></font>.';
				}
				else if(activityType == 'mc'){
					topicInstruction = 'Choose a Russian past tense verb from the drop-down list and VIEW will show you whether you guessed'+ 
					' <font color="green"><b>right</b></font> or <font color="red"><b>wrong</b></font>.'+
					' You can get help by clicking on <span class="clozeStyleHint">?</span>.';
				}
				else if(activityType == 'cloze'){
					topicInstruction = 'Fill in the blanks with the <font color="green"><b>correct</b></font> Russian past tense verb. '+
					'If you guessed <font color="red"><b>wrong</b></font> or you find it too difficult'+
					' you can get help by clicking on <span class="clozeStyleHint">?</span>.';
				}
			}
			else if(topicName == 'RusVerbPerfective'){
				// show the user instructions for the current topic and activity
				if(activityType == 'colorize'){
					topicInstruction = 'VIEW shows you the Russian perfective verbs in <font color="#ff8200"><b>orange</b></font>.';
				}
				else if(activityType == 'click'){
					topicInstruction = 'Click on each Russian perfective verb you find in the text and VIEW will show you whether' +
					' you guessed <font color="green"><b>right</b></font> or <font color="red"><b>wrong</b></font>.';
				}
				else if(activityType == 'mc'){
					topicInstruction = 'Choose a Russian perfective verb from the drop-down list and VIEW will show you whether you guessed'+ 
					' <font color="green"><b>right</b></font> or <font color="red"><b>wrong</b></font>.'+
					' You can get help by clicking on <span class="clozeStyleHint">?</span>.';
				}
				else if(activityType == 'cloze'){
					topicInstruction = 'Fill in the blanks with the <font color="green"><b>correct</b></font> Russian perfective verb. '+
					'If you guessed <font color="red"><b>wrong</b></font> or you find it too difficult'+
					' you can get help by clicking on <span class="clozeStyleHint">?</span>.';
				}
			}
			else if(topicName == 'RusVerbPresentTense'){
				// show the user instructions for the current topic and activity
				if(activityType == 'colorize'){
					topicInstruction = 'VIEW shows you the Russian present tense verbs in <font color="#ff8200"><b>orange</b></font>.';
				}
				else if(activityType == 'click'){
					topicInstruction = 'Click on each Russian present tense verb you find in the text and VIEW will show you whether' +
					' you guessed <font color="green"><b>right</b></font> or <font color="red"><b>wrong</b></font>.';
				}
				else if(activityType == 'mc'){
					topicInstruction = 'Choose a Russian present tense verb from the drop-down list and VIEW will show you whether you guessed'+ 
					' <font color="green"><b>right</b></font> or <font color="red"><b>wrong</b></font>.'+
					' You can get help by clicking on <span class="clozeStyleHint">?</span>.';
				}
				else if(activityType == 'cloze'){
					topicInstruction = 'Fill in the blanks with the <font color="green"><b>correct</b></font> Russian present tense verb. '+
					'If you guessed <font color="red"><b>wrong</b></font> or you find it too difficult'+
					' you can get help by clicking on <span class="clozeStyleHint">?</span>.';
				}
			}
			else if(topicName == 'RusWordStress'){
				// show the user instructions for the current topic and activity
				if(activityType == 'colorize'){
					topicInstruction = 'VIEW shows you the stress of the Russian words in <font color="#ff8200"><b>orange</b></font>.';
				}
				else if(activityType == 'click'){
					topicInstruction = 'Click on each stressed vowel in the Russian words you find in the text and VIEW will show you whether' +
					' you guessed <font color="green"><b>right</b></font> or <font color="red"><b>wrong</b></font>.';
				}
				else if(activityType == 'mc'){
					topicInstruction = 'Choose the Russian word with the correct stress from the drop-down list and VIEW will show you whether you guessed'+ 
					' <font color="green"><b>right</b></font> or <font color="red"><b>wrong</b></font>.'+
					' You can get help by clicking on <span class="clozeStyleHint">?</span>.';
				}
				else if(activityType == 'cloze'){
					topicInstruction = 'VIEW will show you the <font color="green"><b>correct</b></font> stress for the Russian word '+
					' marked in <font color="red"><b>red</b></font> when you hover over it.';
				}
			}
			else if(topicName == 'RusAssistiveReading'){
				// show the user instructions for the current topic and activity
				if(activityType == 'click'){
					topicInstruction = 'By clicking on a Russian word, VIEW will show you the paradigm of the readings with' +
					' all possible readings bolded and point out the ruled out readings.';
				}
			}
			
			if(topicInstruction !== ''){
				// construct the instruction for the given topic and activity
				wertiview.notification.instDialog(topicInstruction, contextDoc);
			}
		}
		
		// get enhancement ID response from wertiview servlet as a number
		var enhId = wertiview.nativeJSON.decode(data);

		// save the options used in the page
		$('body').data('wertiview-language', options['language']);
		$('body').data('wertiview-topic', topicName);
		$('body').data('wertiview-activity', activityType);
		$('body').data('wertiview-enhId', enhId);

		// only enable the abort button once we have stored the enhId
		wertiview.toolbar.enableAbortButton();
		
		// make a copy of the contextDoc and insert wertiview spans into it
		var contextDocCopy = contextDoc.cloneNode(true);

		var textNodes = wertiview.activity.getTextNodesIn(contextDoc.body);
		var textNodesCopy = wertiview.activity.getTextNodesIn(contextDocCopy.body);
		
		var counter = 1;
		$(textNodes).each( function() {
			var thisCopy = textNodesCopy[counter-1];
			// store span id internally
			$(this).data('wertiview', counter);
			$(thisCopy).data('wertiview', counter);

			// make hidden text-node ids visible by wrapping <span>s around them
			$(thisCopy).wrap( function () {
				return '<span class="wertiview" wertiviewid="' + counter + '"></span>';
			});

			counter += 1;
		});
		// send the copy with the spans in it to the server for processing
			wertiview.activity.sendAjaxRequest(contextDocCopy, options, enhId, contextDoc);	
	},
	
	sendAjaxRequest: function(contextDocCopy, options, enhId, contextDoc) {
		var jQuery = wertiview.jQuery;
		var $ = function(selector,context){ return new jQuery.fn.init(selector,context||contextDoc||window.content.document); };
		$.fn = $.prototype = jQuery.fn;
		
		// if spans are found, send to server
		if ($('span.wertiview', contextDocCopy).length > 0) {
			var activityData = {};
			activityData['type'] = "page";
			activityData['enhId'] = enhId;
			activityData['url'] = wertiview.getURL(contextDocCopy);
			activityData['language'] = options['language'];
			activityData['topic'] = options['topic'];
			activityData['activity'] = options['activity'];
			// outerHTML is first supported in Firefox 11
			activityData['document'] = '<html>' + contextDocCopy.documentElement.innerHTML + '</html>';
			activityData['version'] = wertiview.VERSION;
			activityData['userId'] = wertiview.getUserid();

			var ajaxTimeout = wertiview.getAjaxTimeout() || 120000;
			jQuery.ajax({
				type: "POST",
				url: wertiview.servletURL,
				data: wertiview.nativeJSON.encode(activityData),
				processData: false,
				timeout: ajaxTimeout,
				success: function(data, textStatus, xhr) {
					if (data) {
						// once the server has finished processing the 
						// enhancement, the user can no longer stop it
						if(!isAborted){
							wertiview.toolbar.disableAbortButton();
							wertiview.activity.addServerMarkup(data, options, contextDoc); 
						}
					} else {
						wertiview.activity.ajaxError(xhr, "nodata");
						wertiview.toolbar.disableAbortButton();
						wertiview.toolbar.hideSpinningWheel();
						wertiview.toolbar.enableRunButton();
						wertiview.blur.remove(contextDoc);
					}
				},
				error: wertiview.activity.ajaxError
			});
		} else {
			wertiview.blur.remove(contextDoc);
			wertiview.toolbar.disableAbortButton();
			wertiview.toolbar.hideSpinningWheel();
			wertiview.toolbar.enableRunButton();
		}
	},

	// add the markup sent from the servlet to the page
	addServerMarkup: function(data, options, contextDoc) {
		var jQuery = wertiview.jQuery;
		var $ = function(selector,context){ return new jQuery.fn.init(selector,contextDoc||window.content.document); };
		$.fn = $.prototype = jQuery.fn;
		
		// parse result from wertiview servlet from JSON into list
		var dataList = wertiview.nativeJSON.decode(data);
		
		// identify context document under consideration
		contextDoc = contextDoc||window.content.document;

		var counter = 0;
		var newcontent;
		var spans = [];
		
		var textNodes = wertiview.activity.getTextNodesIn(contextDoc.body);
		
		$(textNodes).each( function() {
			if ($(this).data('wertiview')) {
				spans.push($(this));
			}
		});

		var length = spans.length;
		var index = 0;
		var span;
		var timer = Components.classes["@mozilla.org/timer;1"]
					       .createInstance(Components.interfaces.nsITimer);
		
		var addwertiviewspans = function() {
			while (spans.length > 0) {
				span = spans.shift();
				counter = span.data('wertiview');

				// retrieve matching updated content
				newcontent = dataList[counter];
				if(newcontent != null) {
					newspan = $(newcontent);

					// colorize before adding spans
					if (options['activity'] == 'colorize') {
						var topicName = wertiview.activity.getTopicName(options['topic']);

						// check whether this topic/activity exists as a function
						var colorizeFunction = window['wertiview'][topicName]['colorizeSpan'];

						if(typeof colorizeFunction === 'function') {
							colorizeFunction(newspan, options['topic']);
						}
					}

					// replace old content with new content
					span.replaceWith(newspan);
					newspan.data('wertiviewid', counter);
				}
				
				// Firefox needs a break after every 50 changes
				if (counter % 50 == 0) {
					return;
				}
			}

			wertiview.activity.addActivity(options, contextDoc);
			wertiview.toolbar.disableAbortButton(); // (should already be disabled)
			wertiview.toolbar.hideSpinningWheel();
			wertiview.toolbar.enableRunButton();
			wertiview.toolbar.enableRestoreButton();
			wertiview.blur.remove(contextDoc);
			
			timer.cancel();
		};
		
		timer.initWithCallback(addwertiviewspans, 5, Components.interfaces.nsITimer.TYPE_REPEATING_SLACK);
		// note that anything after this point will probably
		// happen BEFORE the addwertiviewspans/timer loop finishes!
	},

	// add JS/etc. for activity
	addActivity: function(options, contextDoc) {
		var jQuery = wertiview.jQuery;
		var $ = function(selector,context){ return new jQuery.fn.init(selector,contextDoc||window.content.document); };
		$.fn = $.prototype = jQuery.fn;

		var topicName = wertiview.activity.getTopicName(options['topic']);
		var activityFunction = window['wertiview'][topicName][options['activity']];

		switch(options['activity']) {
			case 'colorize':
				wertiview.notification.add("VIEW Colorize Activity Ready", contextDoc);
				break;
			case 'click':
				// remove click from all links
				$('body').delegate('a', 'click', wertiview.lib.clickDisableLink);

				activityFunction(contextDoc);
				wertiview.notification.add("VIEW Click Activity Ready", contextDoc);
				
				break;
			case 'mc':
				// no link disabling because the drop-down boxes are prevented
				// from showing up with links because they act strange in links

				activityFunction(contextDoc);
				wertiview.notification.add("VIEW Multiple Choice Activity Ready", contextDoc);
				break;
			case 'cloze':
				// remove click from all links that contain input boxes
				$('body').delegate('a', 'click', {context: contextDoc}, wertiview.lib.clozeDisableLink);
				
				activityFunction(contextDoc);
				wertiview.notification.add("VIEW Practice Activity Ready", contextDoc);
				wertiview.blur.remove(contextDoc);
				break;
			default:
				wertiview.blur.remove(contextDoc);
				// we should never get here
				alert('Invalid activity');
		}
	},

	// remove wertiview markup
	remove: function(contextDoc) {
		var jQuery = wertiview.jQuery;
		var $ = function(selector,context){ return new jQuery.fn.init(selector,contextDoc||window.content.document); };
		$.fn = $.prototype = jQuery.fn;
		
		// identify context document under consideration
		contextDoc = contextDoc||window.content.document;

		var savedOptions = {};
		savedOptions['language'] = $('body').data('wertiview-language');
		savedOptions['topic'] = $('body').data('wertiview-topic');
		savedOptions['activity'] = $('body').data('wertiview-activity');
		$('body').removeData('wertiview-language');
		$('body').removeData('wertiview-topic');
		$('body').removeData('wertiview-activity');
		
		var topicName = wertiview.activity.getTopicName(savedOptions['topic']);
		
		// if we can't find a topic name, skip the rest of the removal
		if (topicName == null) {
			return;
		}

		// generate remove function for this topic and make sure
		// the function exists before calling
		var removeFunction = window['wertiview'][topicName]['remove'];
		
		if(typeof removeFunction !== 'function') {
			alert("Error removing activity.  Please reload the page.");
			return;
		}
		
		removeFunction(contextDoc);

		$('.wertiview').each( function() {
			$(this).replaceWith($(this).text());
		});

		$('body').undelegate('a', 'click', wertiview.lib.clickDisableLink);
		$('body').undelegate('a', 'click keydown', wertiview.lib.clozeDisableLink);
		wertiview.toolbar.disableRestoreButton();
		wertiview.notification.remove(contextDoc);
		wertiview.blur.remove(contextDoc);
	},
	
	abort: function(contextDoc){
		var jQuery = wertiview.jQuery;
		var $ = function(selector,context){ return new jQuery.fn.init(selector,contextDoc||window.content.document); };
		$.fn = $.prototype = jQuery.fn;
		
		// identify context document under consideration
		contextDoc = contextDoc||window.content.document;

		// find out the enhancement ID of this page
		var enhId = $('body').data('wertiview-enhId');

		var requestData = {};
		requestData['type'] = "stop";
		requestData['enhId'] = enhId;
		requestData['url'] = wertiview.getURL(contextDoc);
		requestData['language'] = options['language'];
		requestData['topic'] = options['topic'];
		requestData['activity'] = options['activity'];
		requestData['version'] = wertiview.VERSION;
		requestData['userId'] = wertiview.getUserid();

		var ajaxTimeout = wertiview.getAjaxTimeout() || 120000;
		jQuery.ajax({
			type: "POST",
			url: wertiview.servletURL,
			data: wertiview.nativeJSON.encode(requestData),
			processData: false,
			timeout: ajaxTimeout,
			success: function(data, textStatus, xhr) {
				// always revert to the Enhance button, no matter whether the 
				// server process was stopped successfully
				wertiview.toolbar.disableAbortButton();
				wertiview.toolbar.hideSpinningWheel();
				wertiview.toolbar.enableRunButton();
				wertiview.blur.remove(contextDoc);
				isAborted = true;
			},
			// don't show whether stopping was successful
			error: wertiview.lib.doNothing
		});
	},
	
	getTopicName: function(topic) {
		if (topic == null) {
			return null;
		}
		
		// figure out corresponding topic name
		var topicName = topic.toLowerCase();

		// exceptions: 
		//   - Arts and Dets and Preps use the 'pos' topic
		switch(topic) {
			case "Arts":
			case "Dets":
			case "Preps":
				topicName = 'pos';
				break;
			default:
				break; 
		}
		
		return topicName;
	},

	ajaxError: function(xhr, textStatus, errorThrown) {
		wertiview.toolbar.enableRunButton();
		wertiview.toolbar.hideSpinningWheel();
		wertiview.toolbar.disableAbortButton();
		wertiview.blur.remove();

		if (!xhr || !textStatus) {
			alert("The VIEW server encountered an error.");
			return;
		}

		switch(textStatus) {
			case "nodata":
				alert("The VIEW server is currently unavailable.");
				break;
			case "timeout":
				alert("The VIEW server is taking too long to respond.");
				// when the add-on has timed out, tell the server to stop
				wertiview.activity.abort();
				break;
			case "error":
				switch (xhr.status) {
					case 490:
						alert("The VIEW server no longer supports this version of the VIEW extension.\nPlease check for a new version of the add-on in the Tools->Add-ons menu!");
						break;
					case 491:
						alert("The topic selected isn't available.\nPlease select a different topic from the toolbar menu.");
						break;
					case 492:
						alert("The topic selected isn't available for the language selected.\nPlease select a different language or topic from the toolbar menu.");
						break;
					case 493:
						alert("The server is too busy right now. Please try again in a few minutes.");
						break;
					case 494:
						// enhancement was stopped on client's request
						break;
					default:
						alert("The VIEW server encountered an error.");
						break;
				}
				break;
			default:
				alert("The VIEW server encountered an error.");
				break;
		}
	},
	
	// adapted from: http://stackoverflow.com/questions/298750/how-do-i-select-text-nodes-with-jquery
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
	
	// generate multiple choice exercises
	// @param hitList list of hits that could be turned into exercises, unwanted instance must be removed in advance
	// @param getOptionsCallback a function that returns an array of choices to be presented to the user
	// @param getCorrectAnswerCallback a function that returns the correct answer choice for a given hit
	// @param addProcCallback a function that is called for every exercise (default: wertiview.lib.doNothing)
	// @param emptyHit if true, the hit text will be erased (default: true)
	// @param partExercises decimal by which the number of exercises to generate is multiplied in 'fixed number' mode (default: 1.0)
	mc: function(contextDoc, hitList, inputHandler, hintHandler, 
			getOptionsCallback, getCorrectAnswerCallback, addProcCallback, 
			emptyHit, partExercises){
		
		if (typeof addProcCallback == 'undefined'){
			addProcCallback = wertiview.lib.doNothing;
		}
		if (typeof emptyHit == 'undefined'){
			emptyHit = true;
		}
		if (typeof partExercises == 'undefined'){
			partExercises = 1.0;
		}

		var jQuery = wertiview.jQuery;
		var $ = function(selector,context){ return new jQuery.fn.init(selector,contextDoc||window.content.document); };
        $.fn = $.prototype = jQuery.fn;
		
    	// calculate the number of hits to turn into exercises
        var numExercises = 0;
        var fixedOrPercentage = wertiview.getFixedOrPercentage();
        if (fixedOrPercentage == wertiview.pref_fixedNumber) {
            numExercises = wertiview.getFixedNumberOfExercises() * partExercises;
        }
        else if (fixedOrPercentage == wertiview.pref_percentage) {
        	numExercises = wertiview.getProportionOfExercisesDec() * hitList.length;
        }
        else {
        	// we should never get here
        	wertiview.prefError();
        }
        
        // choose which hits to turn into exercises
        var i = 0;
        var inc = 1;
        var choiceMode = wertiview.getChoiceMode();
        if (choiceMode == wertiview.pref_random) {
            wertiview.lib.shuffleList(hitList);
        }
        else if (choiceMode == wertiview.pref_first) {
        	i = wertiview.getFirstOffset();
        }
        else if (choiceMode == wertiview.pref_intervals){
        	inc = wertiview.getIntervalSize();
        }
        else {
        	// we should never get here
        	wertiview.prefError();
        }
        
        // generate the exercises
        for (; numExercises > 0 && i < hitList.length; i += inc){
        	var $hit = hitList[i];

        	// if the span is inside a link, skip (drop-down boxes are weirder 
    		// than text input boxes, need to investigate further)
    		if ($hit.parents('a').length > 0) {
    			continue;
    		}

    		var capType = wertiview.lib.detectCapitalization($hit.text());
        	
    		// choices for the user
        	var options = getOptionsCallback($hit, capType);
        	// correct choice
        	var answer = getCorrectAnswerCallback($hit, capType);
        	

    		// create select box
    		var $input = $('<select>');
    		var inputId = $hit.attr('id') + '-select';
    		$input.attr('id', inputId);
    		$input.addClass('wertiviewinput');
    		var $option = $('<option>');
    		$option.html(" ");
    		$input.append($option);
    		for (var j = 0; j < options.length; j++) {
    			$option = $('<option>');
    			$option.text(options[j]);
    			$input.append($option);
    		}

        	// save original text/answer
        	$input.data('wertivieworiginaltext', $hit.text());
        	$input.data('wertiviewanswer', answer);
        	
        	// e.g., phrasalverbs needs to add colorization to the verb
//        	addProcCallback($hit, capType);
        	
    		if (emptyHit){
    			$hit.empty();
    		}
    		$hit.append($input);
    		
    		// create hint ? button
    		var $hint = $('<span>');
    		$hint.attr('id', $hit.attr('id') + '-hint');
    		$hint.addClass('clozeStyleHint');
    		$hint.text("?");
    		$hint.addClass('wertiviewhint');
    		$hit.append($hint);
    		
    		// e.g., NEW add rephrase for participles
        	addProcCallback($hit, capType, $); // NEW added , $

    		// count down numExercises until we're finished
			numExercises--;
        }

        $('body').delegate('select.wertiviewinput', 'change', {context: contextDoc}, wertiview.activity.getHandler(inputHandler, false));
        $('body').delegate('span.wertiviewhint', 'click', {context: contextDoc}, wertiview.activity.getHandler(hintHandler, true));
	},

	// generate practice exercises
	// @param hitList list of hits that could be turned into exercises, unwanted instance must be removed in advance
	// @param getCorrectAnswerCallback a function that returns the correct answer choice for a given hit
	// @param addProcCallback a function that is called for every exercise (default: wertiview.lib.doNothing)
	// @param emptyHit if true, the hit text will be erased (default: true)
	// @param partExercises decimal by which the number of exercises to generate is multiplied in 'fixed number' mode (default: 1.0)
	cloze: function(contextDoc, hitList, inputHandler, hintHandler, 
			getCorrectAnswerCallback, addProcCallback, 
			emptyHit, partExercises){
		
		if (typeof addProcCallback == 'undefined'){
			addProcCallback = wertiview.lib.doNothing;
		}
		if (typeof emptyHit == 'undefined'){
			emptyHit = true;
		}
		if (typeof partExercises == 'undefined'){
			partExercises = 1.0;
		}

		var jQuery = wertiview.jQuery;
		var $ = function(selector,context){ return new jQuery.fn.init(selector,contextDoc||window.content.document); };
        $.fn = $.prototype = jQuery.fn;

    	// calculate the number of hits to turn into exercises
        var numExercises = 0;
        var fixedOrPercentage = wertiview.getFixedOrPercentage();
        if (fixedOrPercentage == wertiview.pref_fixedNumber) {
            numExercises = wertiview.getFixedNumberOfExercises() * partExercises;
        }
        else if (fixedOrPercentage == wertiview.pref_percentage) {
        	numExercises = wertiview.getProportionOfExercisesDec() * hitList.length;
        }
        else {
        	// we should never get here
        	wertiview.prefError();
        }
        
        // choose which hits to turn into exercises
        var i = 0;
        var inc = 1;
        var choiceMode = wertiview.getChoiceMode();
        if (choiceMode == wertiview.pref_random) {
            wertiview.lib.shuffleList(hitList);
        }
        else if (choiceMode == wertiview.pref_first) {
        	i = wertiview.getFirstOffset();
        }
        else if (choiceMode == wertiview.pref_intervals){
        	inc = wertiview.getIntervalSize();
        }
        else {
        	// we should never get here
        	wertiview.prefError();
        }
        
        // override preferences for Konjunktiv
        if ($('body').data('wertiview-topic') == 'Konjunktiv') {
        	numExercises = hitList.length;
        	i = 0;
        	inc = 1;
        }
        
        // generate the exercises
        for (; numExercises > 0 && i < hitList.length; i += inc){
			var $hit = hitList[i];
			
    		var capType = wertiview.lib.detectCapitalization($hit.text());
        	
        	// correct choice
        	var answer = getCorrectAnswerCallback($hit, capType);

			// create input box
			var $input = $('<input>');
        	// save original text/answer
        	$input.data('wertivieworiginaltext', $hit.text());
			$input.attr('type', 'text');
			$input.attr('id', $hit.attr('id') + '-input');
			$input.addClass('clozeStyleInput');
			$input.addClass('wertiviewinput');
			$input.data('wertiviewanswer', answer);
			if (emptyHit) {
				$hit.empty();
			}
			$hit.append($input);
			
			// create hint ? button
			var $hint = $('<span>');
			$hint.attr('id', $hit.attr('id') + '-hint');
			$hint.addClass('clozeStyleHint');
			$hint.text("?");
			$hint.addClass('wertiviewhint');
			$hit.append($hint);
        	
        	// e.g., phrasalverbs needs to add colorization to the verb
			// and gerunds needs to display the base form
        	addProcCallback($hit, capType, $);

    		// count down numExercises until we're finished
			numExercises--;
		}
		
		// figure out next field
		var prevhit = null;
		var nexthits = {};
	
		$('input.wertiviewinput').each( function() {
			// keep track of links to next input field
			if (prevhit) {
				nexthits[prevhit] = $(this).attr('id');
			}
			prevhit = $(this).attr('id');
		});
		
		// add the next input info to each input field
		$('input.wertiviewinput').each( function() {
			if (nexthits[$(this).attr('id')]) {
				$(this).data('wertiviewnexthit', nexthits[$(this).attr('id')]);
			} else {
				$(this).data('wertiviewnexthit', null);
			}
		});

			$('body').delegate('input.wertiviewinput', 'change', {context: contextDoc}, wertiview.activity.getHandler(inputHandler, false));
			$('body').delegate('span.wertiviewhint', 'click', {context: contextDoc}, wertiview.activity.getHandler(hintHandler, true));
		},
		
		// return a function that sends information about the interaction to the
		// server and calls the given inputHandler (or hint handler)
		// @param inputHandler function that marks the answer as correct or incorrect for the user
		// @param usedHint whether the user clicked the 'hint' button (default: false)
		// @param getInput function that returns the user input (default: wertiview.activity.getInput)
		// @param getCorrectAnswer function that returns the correct answer (default: wertiview.activity.getCorrectAnswer)
		getHandler: function(inputHandler, usedHint, getInput, getCorrectAnswer) {
			if (usedHint === undefined) {
				usedHint = false;
			}
			if (getInput === undefined) {
				getInput = wertiview.activity.getInput;
			}
			if (getCorrectAnswer === undefined) {
				getCorrectAnswer = wertiview.activity.getCorrectAnswer;
			}
		
			return function(event) {
				var jQuery = wertiview.jQuery;
				var $ = function(selector,context){ return new jQuery.fn.init(selector,window.content.document); };
				$.fn = $.prototype = jQuery.fn;
		
				var userId = undefined;
				if (typeof wertiview.getUserid == 'function') {
					userId = wertiview.getUserid();
				}
				var info = {};
				var moreInfo = {};
				if (userId) {
					// send info on interaction to server
					info['type'] = 'practice';
					info['enhId'] = $('body').data('wertiview-enhId');
					info['language'] = $('body').data('wertiview-language');
					info['topic'] = $('body').data('wertiview-topic');
					info['activity'] = $('body').data('wertiview-activity');
					var isClick = (info['activity'] == "click");
					info['version'] = wertiview.VERSION;
					info['userId'] = userId;
					info['url'] = wertiview.getURL(window.content.document);
					// get the outermost <span class="wertiview"> around this tag
					var wertiviewSpan = undefined;
					$(this).parents('span.wertiview').each(function() {
						// sometimes an object on this list is {}
						if (this !== undefined && this !== null && this != {}) {
							wertiviewSpan = $(this);
						}
					});
					if (wertiviewSpan !== undefined) {
						moreInfo['wertiviewspanid'] = wertiviewSpan.data('wertiviewid');
					}
					moreInfo['wertiviewtokenid'] = $(this).attr('id');
					moreInfo['userinput'] = getInput($(this), usedHint, isClick);
					if (!isClick) {
						moreInfo['correctanswer'] = getCorrectAnswer($(this), usedHint);
						moreInfo['usedhint'] = usedHint;
					}
				}
		
				// call the actual input handler
				var countsAsCorrect = inputHandler(this, event);
		
				if (userId) {
					// if the user used a hint, then it is definitely a correct answer
					moreInfo['countsascorrect'] = usedHint || countsAsCorrect;
					// yes, this is intended to be double-encoded in JSON
					info['document'] = wertiview.nativeJSON.encode(moreInfo);
		
					jQuery.ajax({
						type: "POST",
						url: wertiview.servletURL,
						data: wertiview.nativeJSON.encode(info),
						processData: false,
						timeout: 10000,
						success: wertiview.lib.doNothing,
						error: wertiview.lib.doNothing
					});
				}
		
				// prevent execution of further event listeners
				return false;
			};
		},
		
		getInput: function(element, usedHint, isClick) {
			var result = undefined;
			if (usedHint) {
				element = element.prev();
			}
			if (!isClick && element.val !== undefined) {
				result = element.val();
			} else {
				result = element.text();
			}
			return result;
		},
		
		getCorrectAnswer: function(element, usedHint) {
			if (usedHint) {
				element = element.prev();
			}
			return element.data('wertiviewanswer');
	}
	
	};

