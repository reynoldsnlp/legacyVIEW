
	wertiview.pos = {	

	// maximum number of instances to turn into exercises (moved to preferences)
	//MAX_CLOZE: 25,

	// maximum number of items in combobox in mc
	MAX_MC: 5,
	// actual number of items in combobox in mc (value is overridden below)
	maxLength: 5,

	// candidates for mc options presented to user
	types: [],
	
	remove: function(contextDoc) {
		var jQuery = wertiview.jQuery;
		var $ = function(selector,context){ return new jQuery.fn.init(selector,contextDoc||window.content.document); };
		$.fn = $.prototype = jQuery.fn;

		$('body').undelegate('span.wertiviewtoken', 'click');
		$('body').undelegate('select.wertiviewinput', 'change');
		$('body').undelegate('span.wertiviewhint', 'click');
		$('body').undelegate('input.wertiviewinput', 'change');
		$('body').undelegate('input.wertiviewhint', 'click');

		$('.wertiviewinput').each( function() {
			$(this).replaceWith($(this).data('wertiviewanswer'));
		});
		$('.wertiviewhint').remove();
	},

	colorize: function(contextDoc) {
		var jQuery = wertiview.jQuery;
        var $ = function(selector,context){ return new jQuery.fn.init(selector,contextDoc||window.content.document); };
        $.fn = $.prototype = jQuery.fn;        
        
		var topic = $('body').data('wertiview-topic');
		
		switch(topic) {
			case 'Arts':
				$('span.wertiviewhit').addClass('colorizeStyleArts');
				break;
			case 'Dets':
				$('span.wertiviewhit').addClass('colorizeStyleDets');
				break;
			case 'Preps':
				$('span.wertiviewhit').addClass('colorizeStylePreps');
				break;
		}
	},
	
	colorizeSpan: function(span, topic, index) {
		switch(topic) {
			case 'Arts':
				span.find('span.wertiviewhit').addClass('colorizeStyleArts');
				break;
			case 'Dets':
				span.find('span.wertiviewhit').addClass('colorizeStyleDets');
				break;
			case 'Preps':
				span.find('span.wertiviewhit').addClass('colorizeStylePreps');
				break;
		}
	},

	click: function(contextDoc) {
		var jQuery = wertiview.jQuery;
        var $ = function(selector,context){ return new jQuery.fn.init(selector,contextDoc||window.content.document); };
        $.fn = $.prototype = jQuery.fn;

		// change all wertiviewtoken spans to mouseover pointer
		$('span.wertiviewtoken').css({'cursor': 'pointer'});

		// handle POS clicking
		$('body').delegate('span.wertiviewtoken', 'click', {context: contextDoc}, wertiview.activity.getHandler(wertiview.pos.clickHandler));
	},

	clickHandler: function(element, event) {
		var jQuery = wertiview.jQuery;
		var contextDoc = event.data.context;
        var $ = function(selector,context){ return new jQuery.fn.init(selector,contextDoc||window.content.document); };
        $.fn = $.prototype = jQuery.fn;

        var countsAsCorrect = false;
		if($(element).hasClass('wertiviewhit')) {
			countsAsCorrect = true;
			$(element).addClass('clickStyleCorrect');
		} else {
			$(element).addClass('clickStyleIncorrect');
		} 
		return countsAsCorrect;
	},
	
	mc: function(contextDoc) {
		var jQuery = wertiview.jQuery;
		var $ = function(selector,context){ return new jQuery.fn.init(selector,contextDoc||window.content.document); };
        $.fn = $.prototype = jQuery.fn;

		// get potential spans
		var $hits = $('span.wertiviewhit');
		
		var hitList = [];
		var tokens = [];
		wertiview.pos.types = [];
		$hits.each( function() {
			hitList.push($(this));
			tokens[$(this).text().toLowerCase()] = 1;
		});
		for (word in tokens) {
			wertiview.pos.types.push(word);
		}

		wertiview.pos.maxLength = wertiview.pos.MAX_MC;
		if (wertiview.pos.maxLength > wertiview.pos.types.length) {
			wertiview.pos.maxLength = wertiview.pos.types.length;
		}
		
		wertiview.activity.mc(contextDoc, hitList, 
				wertiview.pos.clozeInputHandler, 
				wertiview.pos.clozeHintHandler, wertiview.pos.mcGetOptions, 
				wertiview.pos.mcGetCorrectAnswer);
	},
	
	mcGetOptions: function($hit, capType){
		wertiview.lib.shuffleList(wertiview.pos.types);
		var options = [];
		var j = 0;
		while (options.length < wertiview.pos.maxLength - 1) {
			if (wertiview.pos.types[j] != $hit.text().toLowerCase()) {
				options.push(wertiview.lib.matchCapitalization(wertiview.pos.types[j], capType));
			}
			j++;
		}
		
		options.push(wertiview.lib.matchCapitalization($hit.text(), capType));
		
		wertiview.lib.shuffleList(options);
		return options;
	},
	
	mcGetCorrectAnswer: function($hit, capType){
		return $hit.text();
	},
	
	cloze: function(contextDoc) {
		var jQuery = wertiview.jQuery;
		var $ = function(selector,context){ return new jQuery.fn.init(selector,contextDoc||window.content.document); };
        $.fn = $.prototype = jQuery.fn;

		// get potential spans
		var $hits = $('span.wertiviewhit');
		
		var hitList = []; 
		$hits.each( function() {
			hitList.push($(this));				
		});
		
		wertiview.activity.cloze(contextDoc, hitList, 
				wertiview.pos.clozeInputHandler, 
				wertiview.pos.clozeHintHandler, 
				wertiview.pos.mcGetCorrectAnswer);
	},

	clozeInputHandler: function(element, event) {
		var contextDoc = event.data.context;
		
		var jQuery = wertiview.jQuery;
		var $ = function(selector,context){ return new jQuery.fn.init(selector,contextDoc||window.content.document); };
		$.fn = $.prototype = jQuery.fn;

		var nextInput;
		var countsAsCorrect = false;

		// if the answer is correct, turn into text, else color text within input
		if($(element).val().toLowerCase() == $(element).data('wertiviewanswer').toLowerCase()) {
			countsAsCorrect = true;
			$text = $("<span>");
			$text.addClass('wertiview');
			$text.addClass('clozeStyleCorrect');
			$text.text($(element).data('wertiviewanswer'));
			if($(element).data('wertiviewnexthit')) {
				nextInput = $(element).data('wertiviewnexthit');
			}
			wertiview.lib.replaceInput($(element).parent(), $text);

			/*// focus next input
			if(nextInput) {
				$("#" + nextInput).get(0).focus();
			}*/
		} else {
			$(element).addClass('clozeStyleIncorrect');
		}
		
		return countsAsCorrect;
	},

	clozeHintHandler: function(element, event) {
		var contextDoc = event.data.context;
		
		var jQuery = wertiview.jQuery;
		var $ = function(selector,context){ return new jQuery.fn.init(selector,contextDoc||window.content.document); };
		$.fn = $.prototype = jQuery.fn;

		var nextInput;

		// fill in the answer by replacing input with text
		$text = $("<span>");
		$text.addClass('wertiview');
		$text.addClass('clozeStyleProvided');
		$text.text($(element).prev().data('wertiviewanswer'));
		if($(element).prev().data('wertiviewnexthit')) {
			nextInput = $(element).prev().data('wertiviewnexthit');
		}
		wertiview.lib.replaceInput($(element).parent(), $text);

		/*// focus next input
		if(nextInput && $("#" + nextInput).length == 1) {
			$("#" + nextInput).get(0).focus();
		}*/
	}
	};

