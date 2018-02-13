<%
String activity = request.getParameter("activity");
String clientEnhancement = "colorize";
%>

<div class="text">

<div class="activityForm">

<h2>Try it out:</h2>

<p>
This form lets you get an idea of what VIEW can do, but it may have trouble accessing or displaying
some pages.  For the best results, use the  
<a href="index.jsp?content=firefox-extension">VIEW firefox extension</a>.
</p>

<form class="activityForm" target="_blank" method="get" action="VIEW" name="activityForm">
<input type="hidden" name="activity" value="<%= activity %>" />

<b>URL:</b>&nbsp; <input type="text" name="url" class="urlInput" />
<p />
<b>Activity type:</b>&nbsp;
<% if (activity.equals("RusVerbAspect")) { %>

<label><input type="radio" name="client.enhancement" value="colorize" checked="checked" />Colorize</label>&nbsp;
<label><input type="radio" name="client.enhancement" value="mc" />Multiple Choice</label>&nbsp;
<label><input type="radio" name="client.enhancement" value="cloze" />Practice</label>

<% } else if (activity.equals("RusAssistiveReading")) { 
	clientEnhancement = "click";
%>

<label><input type="radio" name="client.enhancement" value="click" checked="checked" />Click</label>&nbsp;

<% } else { %>

<label><input type="radio" name="client.enhancement" value="colorize" checked="checked" />Colorize</label>&nbsp;
<label><input type="radio" name="client.enhancement" value="click" />Click</label>&nbsp;
<label><input type="radio" name="client.enhancement" value="mc" />Multiple Choice</label>&nbsp;
<label><input type="radio" name="client.enhancement" value="cloze" />Practice</label>

<% } %>

<br /><br />



<% if (activity.equals("Dets") || activity.equals("Preps")) { %>
<b>Language:</b>
<label><input type="radio" name="language" value="en" checked="checked" />English</label>&nbsp;  
<label><input type="radio" name="language" value="de" />German (beta)</label>&nbsp;  
<label><input type="radio" name="language" value="es" />Spanish (beta)</label>
<br /><br />

<% } else if (activity.equals("SerEstar")) { %>
<b>Language:</b>
<label><input type="radio" name="language" value="es" checked="checked"/>Spanish (beta)</label>
<br /><br />

<% } else if (activity.equals("Konjunktiv")) { %>
<b>Language:</b>
<label><input type="radio" name="language" value="de" checked="checked"/>German</label>
<br /><br />

<% } else if (activity.startsWith("Rus")) { %>
<b>Language:</b>
<label><input type="hidden" name="language" value="ru" />Russian</label>
<br /><br />

<% } else { %>

<input type="hidden" name="language" value="en" />

<% } %>

<input type="submit" value="Go!" class="activityFormSubmit" />&nbsp;(opens in a new window)
</form>


<% if (!activity.equals("SerEstar") && !activity.equals("Konjunktiv") && !activity.startsWith("Rus")) { %>
<p>Some English example sites with colorizing:</p>

<ul>
<li><a target="_blank" href="/VIEW/VIEW?activity=<%= activity %>&amp;url=http%3A%2F%2Fen.wikipedia.org%2Fwiki%2FComputer-assisted_language_learning&amp;client.enhancement=colorize">Wikipedia</a> (computer-assisted language learning)</li>
<li><a target="_blank" href="/VIEW/VIEW?activity=<%= activity %>&amp;url=http%3A%2F%2Fwww.guardian.co.uk%2Fenvironment%2Fgreen-living-blog%2F2009%2Foct%2F29%2Fcar-free-cities-neighbourhoods&amp;client.enhancement=colorize">The Guardian</a> (car-free cities)</li>
<li><a target="_blank" href="/VIEW/VIEW?activity=<%= activity %>&amp;url=http%3A%2F%2Ftechcrunch.com%2F2010%2F07%2F06%2Fap-woot-oil-spill%2F&amp;client.enhancement=colorize">TechCrunch</a> (Woot vs. AP)</li>
<li><a target="_blank" href="/VIEW/VIEW?activity=<%= activity %>&amp;url=http%3A%2F%2Fwww.theonion.com%2Farticles%2Fthis-american-life-completes-documentation-of-libe%2C2188%2F&amp;client.enhancement=colorize">The Onion</a> (on This American Life)</li>
<li><a target="_blank" href="/VIEW/VIEW?activity=<%= activity %>&amp;url=http%3A%2F%2Fpublicliterature.org%2Fbooks%2Femma%2F&amp;client.enhancement=colorize">Public Literature</a> (Emma by Jane Austen)</li>
<li><a target="_blank" href="/VIEW/VIEW?activity=<%= activity %>&amp;url=http%3A%2F%2Fjobsearch.about.com%2Fod%2Finterviewquestionsanswers%2Fa%2Finterviewquest.htm&amp;client.enhancement=colorize">About.com</a> (interview questions)</li>
</ul>

<% } else if (activity.startsWith("Rus")) { %>
<p>Some Russian example sites with <%= clientEnhancement %>:</p>

<ul>
<li><a target="_blank" href="/VIEW/VIEW?activity=<%= activity %>&amp;url=http%3A%2F%2Fnews.bbc.co.uk%2Fhi%2Frussian%2Flife%2Fnewsid_2298000%2F2298119.stm&amp;client.enhancement=<%= clientEnhancement %>&language=ru">BBC</a> (best joke in the world)</li>
<li><a target="_blank" href="/VIEW/VIEW?activity=<%= activity %>&amp;url=http%3A%2F%2Fwww.bbc.com%2Frussian%2Fscience%2F2015%2F09%2F150903_vert_fut_why_the_stupid_say_theyre_smart&amp;client.enhancement=<%= clientEnhancement %>&language=ru">BBC</a> (the less intelligent the more confident)</li>
<li><a target="_blank" href="/VIEW/VIEW?activity=<%= activity %>&amp;url=https%3A%2F%2Fru.wikipedia.org%2Fwiki%2F%25D0%25A3%25D1%2581%25D0%25B2%25D0%25BE%25D0%25B5%25D0%25BD%25D0%25B8%25D0%25B5_%25D1%258F%25D0%25B7%25D1%258B%25D0%25BA%25D0%25B0&amp;client.enhancement=<%= clientEnhancement %>&language=ru">Wikipedia</a> (language acquisition)</li>
</ul>
<% } %>

<p>
</p>


</div>

</div>
