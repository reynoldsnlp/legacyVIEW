view.rusparticiples = {	
	/*
	 * Run the colorize activity.
	 * Add css attribute color to span marked as hit.
	 */
	colorize: function(topicCSS) {
		console.log("colorize()");
		
		$("span.wertiviewhit").addClass("colorizeStyle" + topicCSS);
	},

	/*
	 * Run the click activity.
	 * Ignore instruction dialogs.
	 * Add css attribute cursor: pointer to each span marked as token.
	 * Call the click handler when the span marked as token was clicked.
	 */
	click: function() {	
		console.log("click()");
		
		// exclude the tokens in instruction dialogs
		$("#wertiview-inst-notification span.wertiviewtoken").removeAttr("class");
	
		// change all wertiviewtoken spans to mouseover pointer
		$("span.wertiviewtoken").addClass("clickStylePointer");
	
		// handle click
		$("body").on("click", "span.wertiviewtoken", view[view.topicName].clickHandler); 
	},
	
	/*
	 * Run the multiple choice activity.
	 * Get all potential spans and call the mcHandler.
	 */
	mc: function() {	
		console.log("mc()");
		
		// get potential spans
		var $hits = $("span.wertiviewhit");
		
		var hitList = [];
		
		$hits.each( function() {
			hitList.push($(this));
		});
	
		view.interaction.mcHandler(hitList, 
				view[view.topicName].inputHandler, 
				view[view.topicName].hintHandler, 
				view[view.topicName].getOptions, 
				view[view.topicName].getCorrectAnswer,
				view[view.topicName].addRephrase);
	},
	
	/*
	 * Run the cloze activity.
	 * Get all potential spans and call the clozeHandler.
	 */
	cloze: function() {
		console.log("cloze()");
		// get potential spans
		var $hits = $("span.wertiviewhit");
	
		var hitList = [];
		$hits.each( function() {
			hitList.push($(this));				
		}); 
	
		view.interaction.clozeHandler(hitList, 
				view[view.topicName].inputHandler, 
				view[view.topicName].hintHandler, 
				view[view.topicName].getCorrectAnswer,
				view[view.topicName].addRephrase);
	},
	
	/*
	 * Remove topic specific markup and restore the page
	 * to the original.
	 */
	restore: function() {
		console.log("restore()");
		
		$("body").off("click", "span.wertiviewtoken");
		$("body").off("change", "select.wertiviewinput");
		$("body").off("click", "span.wertiviewhint");
		$("body").off("change", "input.wertiviewinput");
		$("body").off("click", "input.wertiviewhint");
		
		// replace the input spans with the original text
		$(".wertiviewinput").each( function() {
			$(this).replaceWith($(this).data("wertivieworiginaltext"));
		});
		
		// replace the correct forms correctly answered by the user with the original text
		$(".clozeStyleCorrect").each( function() {
			$(this).replaceWith($(this).data("wertivieworiginaltext"));
		});
		
		// replace the correct forms answered by the hint with the original text
		$(".clozeStyleProvided").each( function() {
			$(this).replaceWith($(this).data("wertivieworiginaltext"));
		});
		
		// replace the correct forms with the original text
		$(".correctForm").each( function() {
			$(this).replaceWith($(this).data("wertivieworiginaltext"));
		});
		
		$("span.wertiviewrephrase").remove();
		$(".wertiviewhint").remove();
	},
	
	/*
	 * Turn correctly clicked hits green and incorrect ones red
	 */
	clickHandler: function(event) {	
		var countsAsCorrect = false;
		var element = this;
		var infos = {};
		
		if($(element).hasClass("wertiviewhit")) {  // was: wertiviewhit
			countsAsCorrect = true;
			$(element).addClass("clickStyleCorrect");
		} else {
			$(element).addClass("clickStyleIncorrect");
		} 
		
		// remove the mouseover pointer
		$(element).removeClass("clickStylePointer");
		
		if(view.userid){	// if the user is logged in (userid is not null)
			// collect info data before page update
			infos = view.interaction.collectInfoData(
					element,
					false, // usedHint: only true when hint handler
					view.interaction.collectInputData, 
					view.interaction.collectAnswerData);
			
			var info = infos.info;
			var elementInfo = infos.elementInfo;
			
			// collect and send interaction data after page update
			view.interaction.collectInteractionData(
					info,
					elementInfo,
					countsAsCorrect, 
					false); // usedHint: only true when hint handler				
		}	
		
		// prevent execution of further event listeners
		return false;
	},

	/*
	 * Deals with the input in the mc and cloze activities.
	 */
	inputHandler: function(event) {
		var nextInput;
		var countsAsCorrect = false;
		var element = this;
		
		var userid = view.userid;
		var infos = {};
		
		if(userid){	// if the user is logged in (userid is not null)
			// collect info data before page update
			infos = view.interaction.collectInfoData(
					element,
					false, // usedHint: only true when hint handler
					view.interaction.collectInputData, 
					view.interaction.collectAnswerData);
		}

		// if the answer is correct, turn into text, else color text within input
		if($(element).val().toLowerCase() == $(element).data("wertiviewanswer").toLowerCase()) {
			countsAsCorrect = true;
			$text = $("<span>");
			$text.addClass("wertiview");
			$text.addClass("clozeStyleCorrect");
			$text.text($(element).data("wertiviewanswer"));
			// save the original text in a hidden field
			$text.data("wertivieworiginaltext", $(element).data("wertivieworiginaltext"));
			if($(element).data("wertiviewnexthit")) {   
				nextInput = $(element).data("wertiviewnexthit");
			}
			view.lib.replaceInput($(element).parent(), $text);

		} else {
			// turns all options, the topmost element after selection included, as red
			$(element).addClass("clozeStyleIncorrect");
			// remove assigned classes to all options from previous selections
			$(element).find("option").removeAttr("class");
			// turn the selected option red
			$(element).find("option:selected").addClass("clozeStyleIncorrect");
			// turn the not selected options black
			$(element).find("option:not(:selected)").addClass("clozeStyleNeutral");
		}
		
		if(userid){	// if the user is logged in (userid is not null)	
			var info = infos.info;
			var elementInfo = infos.elementInfo;
			
			// collect and send interaction data after page update
			view.interaction.collectInteractionData(
					info,
					elementInfo,
					countsAsCorrect, 
					false); // usedHint: only true when hint handler
		}	
		
		// prevent execution of further event listeners
		return false;
	},

	/*
	 * Deals with the hint in the mc and cloze activities.
	 */
	hintHandler: function(event) {
		var nextInput;
		var element = this;

		var userid = view.userid;
		var infos = {};
		
		if(userid){	// if the user is logged in (userid is not null)
			// collect info data before page update
			infos = view.interaction.collectInfoData(
					element,
					true, // usedHint: only true when hint handler
					view.interaction.collectInputData, 
					view.interaction.collectAnswerData);
		}

		// fill in the answer by replacing input with text
		$text = $("<span>");
		$text.addClass("wertiview");
		$text.addClass("clozeStyleProvided");
		$text.text($(element).prev().data("wertiviewanswer"));
		// save the original text in a hidden field
		$text.data("wertivieworiginaltext", $(element).prev().data("wertivieworiginaltext"));
		if($(element).prev().data("wertiviewnexthit")) {  
			nextInput = $(element).prev().data("wertiviewnexthit");
		}
		view.lib.replaceInput($(element).parent(), $text);
		
		if(userid){	// if the user is logged in (userid is not null)	
			var info = infos.info;
			var elementInfo = infos.elementInfo;
			
			// collect and send interaction data after page update
			view.interaction.collectInteractionData(
					info,
					elementInfo,
					true, // if the user used a hint, then it is definitely a correct answer
					true); // usedHint: only true when hint handler
		}		
		
		// prevent execution of further event listeners
		return false;
	},

	/*
	 * Gets the options provided by the server in the distractors attribute.
	 */
	getOptions: function($hit, capType){
		var options = [];
		var j = 0;
		
		// Get the list of distractors for the given hit 
		// (they are saved as a space-separated list in the attribute "distractors" of the wertiview span tag):
		var types = $hit.attr("distractors").split(" ");
	    
	    // Add the distractor forms to the options list:
	    while (j < types.length && options.length < 4) {
	        // The forms that are homonymous to the correct form are excluded from the list of options:
	        if (types[j].toLowerCase() != $hit.attr("correctForm").toLowerCase() && types[j] != "") 
	        {
	           options.push(view.lib.matchCapitalization(types[j], capType)); 
	        }
			j++;
		}
		
		options.push(view.lib.matchCapitalization($hit.attr("correctForm"), capType));
		view.lib.shuffleList(options);
		return options;
	},

	/*
	 * Get the correct answer for the mc and cloze activities.
	 */
	getCorrectAnswer: function($hit, capType){
		return view.lib.matchCapitalization($hit.attr("correctForm"), capType);
	},

	/*
	 * Add the rephrase next to
	 * the input field (used in cloze).
	 */
	addRephrase: function($hit, capType){		
		// create rephrase info
		var $rephrase = $("<span>");
		$rephrase.addClass("clozeStyleRephrase");
		$rephrase.addClass("wertiviewrephrase");
		var rephrase = $hit.attr("rephrase");
		if (rephrase){
			$rephrase.text(" (" + rephrase + ")");
			$hit.append($rephrase);
		}
	}
};