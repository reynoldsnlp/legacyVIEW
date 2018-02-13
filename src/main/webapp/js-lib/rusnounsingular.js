
	wertiview.rusnounsingular = {

	// maximum number of items in combobox in mc
	MAX_MC: 5,
	// actual number of items in combobox in mc (value is overridden below)
	maxLength: 5,
	
	// candidates for mc options presented to user
	types: [],
	hitList: [],
		
	remove: function(contextDoc) {
		var jQuery = wertiview.jQuery;
		var $ = function(selector,context){ 
			return new jQuery.fn.init(selector,contextDoc||window.content.document); 
			};
		$.fn = $.prototype = jQuery.fn;

		$('body').undelegate('span.wertiviewtoken', 'click');
		$('body').undelegate('select.wertiviewinput', 'change');
		$('body').undelegate('span.wertiviewhint', 'click');
		$('body').undelegate('input.wertiviewinput', 'change');
		$('body').undelegate('input.wertiviewhint', 'click');  // was: span.wertiviewhint
		
		$('.wertiviewinput').each( function() {
			$(this).replaceWith($(this).data('wertivieworiginaltext'));
		});
		
		// replace the correct forms correctly answered by the user with the original text
		$('.clozeStyleCorrect').each( function() {
			$(this).replaceWith($(this).data('wertivieworiginaltext'));
		});
		
		// replace the correct forms answered by the hint with the original text
		$('.clozeStyleProvided').each( function() {
			$(this).replaceWith($(this).data('wertivieworiginaltext'));
		});
		
		// replace the correct forms with the original text
		$('.correctForm').each( function() {
			$(this).replaceWith($(this).data('wertivieworiginaltext'));
		});
		
		$('span.wertiviewbaseform').remove();
		$('.wertiviewhint').remove();
	},

	colorize: function(contextDoc) {
		var jQuery = wertiview.jQuery;
		var $ = function(selector,context){ 
			return new jQuery.fn.init(selector,contextDoc||window.content.document); 
			};
		$.fn = $.prototype = jQuery.fn;

		$('span.wertiviewhit').addClass('colorizeStyleRusNounSingular');
	},
	
	colorizeSpan: function(span, topic, index) {
		span.find('span.wertiviewhit').addClass('colorizeStyleRusNounSingular');
	},

	click: function(contextDoc) {
		var jQuery = wertiview.jQuery;
		var $ = function(selector,context){ 
			return new jQuery.fn.init(selector,contextDoc||window.content.document); 
			};
		$.fn = $.prototype = jQuery.fn;
		
		// exclude the tokens in instruction dialogs
		$('#wertiview-inst-notification span.wertiviewtoken').removeAttr('class');

		// change all wertiviewtoken spans to mouseover pointer
		$('span.wertiviewtoken').css({'cursor': 'pointer'}); 

		// handle click
		$('body').delegate('span.wertiviewtoken', 'click', {context: contextDoc}, wertiview.activity.getHandler(wertiview.rusnounsingular.clickHandler)); 
	},

	clickHandler: function(element, event) {
		var contextDoc = event.data.context;

		var jQuery = wertiview.jQuery;
		var $ = function(selector,context){ 
			return new jQuery.fn.init(selector,contextDoc||window.content.document); 
			};
		$.fn = $.prototype = jQuery.fn;
		
		var countsAsCorrect = false;
		if($(element).hasClass('wertiviewhit')) {  // was: wertiviewhit
			countsAsCorrect = true;
			$(element).addClass('clickStyleCorrect');
		} else {
			$(element).addClass('clickStyleIncorrect');
		} 
		
		return countsAsCorrect;
	},
	
	mc: function(contextDoc) {
		var jQuery = wertiview.jQuery;
		var $ = function(selector,context){ 
			return new jQuery.fn.init(selector,contextDoc||window.content.document); 
			};
		$.fn = $.prototype = jQuery.fn;
		
		// get potential spans
		var $hits = $('span.wertiviewhit');
		
		var hitList = [];
		var tokens = [];
		wertiview.rusnounsingular.types = [];
		//alert($hits.length+" hits");
		$hits.each( function() {
			hitList.push($(this));
			//alert($(this).text());
			tokens[$(this).text().toLowerCase()] = 1;
		});

		wertiview.rusnounsingular.maxLength = wertiview.rusnounsingular.MAX_MC;
		wertiview.activity.mc(contextDoc, hitList, 
				wertiview.rusnounsingular.clozeInputHandler, 
				wertiview.rusnounsingular.clozeHintHandler, 
				wertiview.rusnounsingular.mcGetOptions, 
				wertiview.rusnounsingular.mcGetCorrectAnswer);

	},
	
	mcGetOptions: function($hit, capType){
		var options = [];
		var j = 0;
		// Get the list of distractors for the given hit (they are saved as a space-separated list in the attribute "distractors" of the wertiview span tag):
		wertiview.rusnounsingular.types = $hit.attr('distractors').split(" ");
	    wertiview.lib.shuffleList(wertiview.rusnounsingular.types);
        
        // Add the distractor forms to the options list:
        while (j < wertiview.rusnounsingular.types.length && options.length < wertiview.rusnounsingular.MAX_MC - 1) {
            // The forms that are homonymous to the correct form are excluded from the list of options:
            if (wertiview.rusnounsingular.types[j].toLowerCase() != $hit.attr('correctForm').toLowerCase() && wertiview.rusnounsingular.types[j] != "") 
            {
               options.push(wertiview.lib.matchCapitalization(wertiview.rusnounsingular.types[j], capType)); 
            }
			j++;
		}
		
		options.push(wertiview.lib.matchCapitalization($hit.attr('correctForm'), capType));
		wertiview.lib.shuffleList(options);
		return options;
	},
	
	mcGetCorrectAnswer: function($hit, capType){
		return wertiview.lib.matchCapitalization($hit.attr('correctForm'), capType);
	},
	
	cloze: function(contextDoc) {
		var jQuery = wertiview.jQuery;
		var $ = function(selector,context){ 
			return new jQuery.fn.init(selector,contextDoc||window.content.document); 
			};
		$.fn = $.prototype = jQuery.fn;
		
		// get potential spans
		//var $hits = $('span.wertiviewRELEVANT').find('span.wertiviewconjunction');
		var $hits = $('span.wertiviewhit');

		var hitList = [];
		$hits.each( function() {
			hitList.push($(this));				
		}); 

		wertiview.activity.cloze(contextDoc, hitList, 
				wertiview.rusnounsingular.clozeInputHandler, 
				wertiview.rusnounsingular.clozeHintHandler, 
				wertiview.rusnounsingular.mcGetCorrectAnswer,
				wertiview.rusnounsingular.clozeAddBaseform);
	},
	
	clozeAddBaseform: function($hit, capType, $){
		// create baseform info
		var $baseform = $('<span>');
		$baseform.addClass('clozeStyleBaseform');
		$baseform.addClass('wertiviewbaseform');
		var lemmaform = $hit.attr('lemma');
		if (lemmaform)
		  $baseform.text(' (' + lemmaform + ')');
		  $hit.append($baseform);
	},

	clozeInputHandler: function(element, event) {
		var jQuery = wertiview.jQuery;
		var contextDoc = event.data.context;
		  var $ = function(selector,context){ 
			  return new jQuery.fn.init(selector,contextDoc||window.content.document); 
			  };
		  $.fn = $.prototype = jQuery.fn;

		var nextInput;
		var countsAsCorrect = false;

		// if the answer is correct, turn into text, else color text within input
		if($(element).val().toLowerCase() == $(element).data('wertiviewanswer').toLowerCase()) {
			countsAsCorrect = true;
			// return the clue tag color to what it was originally
			$("#"+$(element).parent().attr('clueid')).css( "color", "inherit" );
			$text = $("<span>");
			$text.addClass('wertiview');
			$text.addClass('clozeStyleCorrect');
			$text.text($(element).data('wertiviewanswer'));
			// save the original text in a hidden field
			$text.data('wertivieworiginaltext', $(element).data('wertivieworiginaltext'));
			if($(element).data('wertiviewnexthit')) {   
				nextInput = $(element).data('wertiviewnexthit');
			}
			wertiview.lib.replaceInput($(element).parent(), $text);

		} else {
			// give the clue tag a color if the student guessed wrong
			$("#"+$(element).parent().attr('clueid')).css( "color", "red" );
			$(element).addClass('clozeStyleIncorrect');
		}
		return countsAsCorrect;
	},

	clozeHintHandler: function(element, event) {
		var jQuery = wertiview.jQuery;
		var contextDoc = event.data.context;
		  var $ = function(selector,context){ 
			  return new jQuery.fn.init(selector,contextDoc||window.content.document); 
			  };
		  $.fn = $.prototype = jQuery.fn;

		var nextInput;
		
		// return the clue tag color to what it was originally
		$("#"+$(element).parent().attr('clueid')).css( "color", "inherit" );

		// fill in the answer by replacing input with text
		$text = $("<span>");
		$text.addClass('wertiview');
		$text.addClass('clozeStyleProvided');
		$text.text($(element).prev().data('wertiviewanswer'));
		// save the original text in a hidden field
		$text.data('wertivieworiginaltext', $(element).prev().data('wertivieworiginaltext'));
		if($(element).prev().data('wertiviewnexthit')) {  
			nextInput = $(element).prev().data('wertiviewnexthit');
		}
		wertiview.lib.replaceInput($(element).parent(), $text);
	}
	};
