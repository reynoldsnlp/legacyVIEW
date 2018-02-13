package werti.uima.enhancer;

import java.io.BufferedReader;
import java.io.BufferedWriter;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileNotFoundException;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStreamReader;
import java.io.OutputStreamWriter;
import java.io.UnsupportedEncodingException;
import java.io.Writer;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.StringTokenizer;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import org.apache.log4j.Logger;
import org.apache.uima.UimaContext;
import org.apache.uima.analysis_component.JCasAnnotator_ImplBase;
import org.apache.uima.analysis_engine.AnalysisEngineProcessException;
import org.apache.uima.cas.FSIterator;
import org.apache.uima.jcas.JCas;
import org.apache.uima.resource.ResourceInitializationException;

import com.esotericsoftware.kryo.Kryo;
import com.esotericsoftware.kryo.io.UnsafeInput;

import werti.server.WERTiServlet;
import werti.uima.types.Enhancement;
import werti.uima.types.annot.CGReading;
import werti.uima.types.annot.CGToken;
import werti.util.CasUtils;
import werti.util.EnhancerUtils;
import werti.util.StringListIterable;

/**
 * The output from the CG3 analysis from {@link werti.ae.Vislcg3RusAnnotator} 
 * is being used to enhance spans corresponding to the tags specified by the topic
 * and the activity that was chosen by the user. 
 * In this case the topic is Russian adjectives in feminine form, use the patterns
 * in the method process() to extract the correct tokens for enhancement.
 * 
 * @author Niels Ott
 * @author Adriane Boyd
 * @author Heli Uibo
 * @author Eduard Schaf
 *
 */
public class Vislcg3RusAssistiveReadingEnhancer extends JCasAnnotator_ImplBase {

	private static final Logger log =
			Logger.getLogger(Vislcg3RusAssistiveReadingEnhancer.class);
	private static final Logger rusNLPLog = Logger.getLogger("rusNLPLogger");

	//  private final String hfstOptLookupLoc = "/usr/local/bin/hfst-optimized-lookup";                    
	//  private final String lookupFlags = "-q"; // was -flags mbTT -utf8 / flags are not possible for the jar     
	private final String loadJar = "java -jar";
	private final String jarOptLookupLoc = "./rus_resources/hfst-ol.jar";
	private final String invertedOptHfstLoc = "./rus_resources/generator-raw-gt-desc.ohfst";

	@Override
	public void initialize(UimaContext context)
			throws ResourceInitializationException {
		super.initialize(context);
	}

	@Override
	public void process(JCas cas) throws AnalysisEngineProcessException {

		/*
		 * To disable a logger you need to comment out this code.
		 * You can turn off every logger or just one of them.
		 * To enable them you need to comment in the code.
		 * 
		 * Note that the performance increases when the loggers are disabled;
		 * especially when you disable the NLP logger, because a lot gets written to the log file.
		 * This will prevent the logger from writing anything to the logfiles/console.
		 * The NLP logger doesn't print to the console by default even if its activated.
		 * The default settings can be changed in: "/VIEW/src/main/webapp/WEB-INF/classes/log4j.properties"
		 */

		// fastest way to disable the rus NLP logger is to activate the following:
		//rusNLPLog.setLevel(Level.OFF);

		// you can also disable the root logger (prints to console) of this class via:
		//log.setLevel(Level.OFF);

		// stop processing if the client has requested it
		if (!CasUtils.isValid(cas)) {
			return;
		}
		// colorize, click, mc or cloze - chosen by the user and sent to the servlet as a request parameter
		String enhancement_type = WERTiServlet.enhancement_type;
		log.info("Starting Assistive Reading enhancement "+enhancement_type+".");

		long generatingDistractorsTotalTime = 0;

		final long startTime = System.currentTimeMillis();
		
		// FSTUPDATE: The patterns target FST features to find or exclude specific readings

		Pattern posPattern = Pattern.compile("\\+(N|A|V|Pron|Det|Num\\+Ord)\\+");
		Pattern posIndeclPattern = Pattern.compile("\\+(Abbr|Adv.*|CC|CS|Interj|Paren|Pcle|Po|Pr)$");
		Pattern aspectPattern = Pattern.compile("Impf|Perf");
		Pattern transitivityPattern = Pattern.compile("TV|IV");
		Pattern tenseVoicePattern = Pattern.compile("(Prs|Pst)(Act|Pss)");

		// Pattern to find Russian words in case there was no reading for them
		Pattern cyrillicPattern = Pattern.compile("\\p{IsCyrillic}+");

		Map<String, MutableInt> classCounts = new HashMap<String, MutableInt>();

		FSIterator cgTokenIter = cas.getAnnotationIndex(CGToken.type).iterator();

		// get timestamp in milliseconds and use it in the names of the temporary files in order to avoid conflicts between simultaneous users                                                                                            
		long timestamp = System.currentTimeMillis();

		String cg3GeneratorInputFileLoc = "./rus_output/cg3GeneratorInputFiles/cg3GeneratorInput"+timestamp+".tmp";
		String cg3GeneratorOutputFileLoc = "./rus_output/cg3GeneratorOutputFiles/cg3GeneratorOutput"+timestamp+".tmp";

		//create temporary files for saving cg3 input and output                                                   
		File cg3GeneratorInputFile = new File(cg3GeneratorInputFileLoc);
		File cg3GeneratorOutputFile = new File(cg3GeneratorOutputFileLoc);
		try {
			cg3GeneratorInputFile.createNewFile();
			cg3GeneratorOutputFile.createNewFile();

		} catch (IOException e1) {
			e1.printStackTrace();
		}

		Map<Word, SpanTag> wordToSpanMap = new HashMap<Word, SpanTag>();

		try {
			Writer cg3GeneratorInputWriter = new BufferedWriter(new OutputStreamWriter(new FileOutputStream(cg3GeneratorInputFileLoc), "UTF-8"));
			
			

			// go through tokens
			while (cgTokenIter.hasNext()) {
				CGToken cgt = (CGToken) cgTokenIter.next();

				String surfaceForm = cgt.getCoveredText();

				boolean isValidReading = false;
				String indeclinableReadings = "";
				String reading_str = "";
				String lemma = "";
				List<String> ruledOutReadingsList = new ArrayList<String>();
				List<String> disambiguatedReadingsList = new ArrayList<String>();
				List<String> paradigmReadingsList = new ArrayList<String>();
				Set<String> distinctElementSet = new HashSet<String>();
				// select from all readings the first occurrence that is matching pos and number
				for(int i = 0; i < cgt.getReadings().size(); i++){
					CGReading currentReading = cgt.getReadings(i);
					//log.info("This is the lemma =" +reading.getHead());
					StringListIterable readingIterator = new StringListIterable(currentReading);
					String currentReadingString = "";
					for (String rtag : readingIterator) {
						currentReadingString += "+" + rtag;
					}
					// remove the first "+" and quotes
					currentReadingString = currentReadingString.substring(1).replace("\"", "");
					String[] tags = currentReadingString.split("\\+");
					String firstTag = tags[0];
					// ruled out readings have ";" as first tag
					if(firstTag.equals(";")){
						ruledOutReadingsList.add(currentReadingString.substring(2));
					}
					else{ // it is a disambiguated reading
						disambiguatedReadingsList.add(currentReadingString);
						// add to all different readings for paradigm creation
						Matcher posMatcher = posPattern.matcher(currentReadingString);
						if(posMatcher.find()){
							String readingLemma = firstTag;
							String pos = posMatcher.group(1);
							String distinctElement = readingLemma + "+" + pos;
							// FSTUPDATE: Verbs need additional distinctive features
							if(pos.equals("V")){ // verb
								Matcher aspectMatcher = aspectPattern.matcher(currentReadingString);
								Matcher transitivityMatcher = transitivityPattern.matcher(currentReadingString);
								Matcher tenseVoiceMatcher = tenseVoicePattern.matcher(currentReadingString);
								if(aspectMatcher.find()){
									distinctElement += "+" + aspectMatcher.group();
								}
								if(transitivityMatcher.find()){
									distinctElement += "+" + transitivityMatcher.group();
								}
								if(tenseVoiceMatcher.find()){
									distinctElement += "+" + tenseVoiceMatcher.group();
								}
							}
							// only add readings with distinct element to the list
							if(distinctElementSet.add(distinctElement)){
								paradigmReadingsList.add(currentReadingString);	
								//				    	        log.info("paradigmReadingsList extended with="+ currentReadingString);
							}
							
							if(!isValidReading){
								isValidReading = true;
								reading_str = currentReadingString; 
								lemma = firstTag;
							}
						}
						
						Matcher posIndeclMatcher = posIndeclPattern.matcher(currentReadingString);
						if(posIndeclMatcher.find()){
							// add the indeclinable reading to the others (one reading per line)
							indeclinableReadings += currentReadingString + "\nñôŃßĘńŠēINDECLINABLEREADING\n";
//							log.info("indeclinableReadings extended with="+ currentReadingString);
							
							if(!isValidReading){
								isValidReading = true;
								reading_str = currentReadingString; 
								lemma = firstTag;
							}
						}
					}
				}

				// handle words without readings, in this case the reading_str is empty
				if(cgt.getReadings().size() == 0){
					Matcher cyrillicMatcher = cyrillicPattern.matcher(surfaceForm);
					if(cyrillicMatcher.find()){ // only consider Russian words
						rusNLPLog.info("This Russian word has no reading =" + surfaceForm);
					}
					else{
						rusNLPLog.info("There is no reading for this token =" + surfaceForm);
					}
				}

				if(isValidReading){
					//					log.info("This reading will be used=" +reading_str);

					// id's with the "+" symbol have to be escaped, thats why we use a "-" instead
					String spanReadingString = reading_str.replace("+", "-");

					MutableInt idCount = classCounts.get(spanReadingString);
					if (idCount == null) {
						classCounts.put(spanReadingString, new MutableInt());
					}
					else {
						idCount.increment();
					}

					// create a word with begin and end of the current CGToken
					Word word = new Word(cgt.getBegin(), cgt.getEnd());

					String spanTagStart = "<span id=\"" + EnhancerUtils.get_id("WERTi-span-" + spanReadingString, classCounts.get(spanReadingString).value) + 
							"\" class=\"wertiviewtoken  wertiviewhit\">";

					SpanTag spanTag = new SpanTag(spanTagStart);

					spanTag.addAttribute("lemma", lemma);					

					String ruledOutReadings = "";

					for(String ruledOutReading: ruledOutReadingsList){
						ruledOutReadings += ruledOutReading + "\n";
					}
					
					String disambiguatedReadings = "";

					for(String disambiguatedReading: disambiguatedReadingsList){
						disambiguatedReadings += disambiguatedReading + "\n";
					}

					wordToSpanMap.put(word, spanTag);
					
					cg3GeneratorInputWriter.write(reading_str + "\n");
					cg3GeneratorInputWriter.write("ñôŃßĘńŠēCORRECTFORM\n");
					if(!ruledOutReadings.isEmpty()){
						cg3GeneratorInputWriter.write(ruledOutReadings);
						//						log.info("ruledOutReadings="+ruledOutReadings);
						cg3GeneratorInputWriter.write("ñôŃßĘńŠēRULEDOUTREADINGS\n");
					}
					if(!disambiguatedReadings.isEmpty()){
						cg3GeneratorInputWriter.write(disambiguatedReadings);
						//						log.info("disambiguatedReadings="+disambiguatedReadings);
						cg3GeneratorInputWriter.write("ñôŃßĘńŠēDISAMBIGUATEDREADINGS\n");
					}
					if(!indeclinableReadings.isEmpty()){
						cg3GeneratorInputWriter.write(indeclinableReadings);
//						log.info("indeclinableReadings="+indeclinableReadings.trim());
					}
					String paradigms = createParadigms(reading_str, paradigmReadingsList, disambiguatedReadingsList);
					cg3GeneratorInputWriter.write(paradigms);					
					
					// write the word to the file in order to assign the correct form to the correct span
					cg3GeneratorInputWriter.write(word.toString());
				}
			}

			cg3GeneratorInputWriter.close();

			// generate distractors only when the activity is "mc" (multiple choice)

			// this was the previous version which required to install hfst on the computer

			//				String[] generationPipeline = {
			//						"/bin/sh", 
			//						"-c", 
			//						"/bin/cat " + cg3GeneratorInputFileLoc + 
			//						" | " + hfstOptLookupLoc + " " + lookupFlags + " " + invertedOptHfstLoc +
			//						" | " + "cut -f1-2"+ // get rid of the weight
			//						" > " + cg3GeneratorOutputFileLoc}; 

			// the newer version is using hfst-ol.jar to load the .ohfst files (ol = optimized lookup)
			
			// FSTUPDATE: The pipeline to generate readings using the FST generator

			String[] generationPipeline = {
					"/bin/sh", 
					"-c", 
					"/bin/cat " + cg3GeneratorInputFileLoc + 
					" | " + loadJar + " " + jarOptLookupLoc + " " +  invertedOptHfstLoc +
					" | " + "tail -n+5" + // remove the header produced by hfst-ol.jar
					" | " + "cut -f1-2"+ // get rid of the weight
					" > " + cg3GeneratorOutputFileLoc}; 

			log.info("Distractor generation pipeline: "+generationPipeline[2]);

			final long startTimeGenerator = System.currentTimeMillis();

			Process process = Runtime.getRuntime().exec(generationPipeline);
			process.waitFor();

			generateSpanTagWithDistractors(cas, cg3GeneratorOutputFileLoc, wordToSpanMap);

			final long endTimeGenerator = System.currentTimeMillis();
			generatingDistractorsTotalTime += (endTimeGenerator - startTimeGenerator);

			// delete temporary files:
			cg3GeneratorInputFile.delete();
			cg3GeneratorOutputFile.delete();

			//			// always keep the latest two input/output files, delete the oldest files 
			//	        
			//	        File inputFileDir = new File("./rus_output/cg3GeneratorInputFiles/");
			//			File[] inputFiles = inputFileDir.listFiles();
			//			List<File> inputFilesList = new ArrayList<File>(Arrays.asList(inputFiles));
			//			// sort according to last modified date
			//			inputFilesList.sort(new FileComparator());
			//			if(inputFilesList.size() == 3){
			//				// delete the oldest file, this is always the first element in the list
			//				inputFilesList.get(0).delete();
			//			}
			//			
			//			File outputFileDir = new File("./rus_output/cg3GeneratorOutputFiles/");
			//			File[] outputFiles = outputFileDir.listFiles();
			//			List<File> outputFilesList = new ArrayList<File>(Arrays.asList(outputFiles));
			//			// sort according to last modified date
			//			outputFilesList.sort(new FileComparator());
			//			if(outputFilesList.size() == 3){
			//				// delete the oldest file, this is always the first element in the list
			//				outputFilesList.get(0).delete();
			//			}

		} catch (IOException e) {
			e.printStackTrace();
		} catch (InterruptedException e) {
			e.printStackTrace();
		}

		log.info("Finished Assistive Reading enhancement.");
		final long endTime = System.currentTimeMillis();

		log.info("Total execution time: " + (endTime - startTime)*0.001 + " seconds." );
		log.info("Generating the distractforms takes in total: " + generatingDistractorsTotalTime * 0.001 + " seconds." );
	}
	
	/**
	 * Deserialize a map on the hard drive.
	 * @param mapName the name of the map
	 * @return the map stored on the hard drive
	 */
	private <T1, T2> Map<T1, T2> loadMapKryo(String mapName){
		Kryo kryo = new Kryo();
		kryo.register(HashMap.class, 0);
		Map<T1, T2> map = new HashMap<T1, T2>();
		try
		{
			UnsafeInput input = new UnsafeInput(new FileInputStream("rus_resources/"+mapName+".ser"));
			map = kryo.readObject(input, HashMap.class);
			input.close();
		}catch(IOException ioe)
		{
			ioe.printStackTrace();
		}
		log.info(mapName+" loaded");
		return map;
	}

	/*
	 * Create all relevant morphological forms of the current token
	 * It is the input for the distractor generation
	 */
	private String createParadigms(String reading_str, List<String> paradigmReadingsList, List<String> disambiguatedReadingsList) {
		
		// FSTUPDATE: The paradigms are created by constructing all readings after identifying the POS
		
		String generationInputAll = "";

		// create for each reading a paradigm
		for(String paradigmReading: paradigmReadingsList){
			String generationInput = "";
			String lemma = paradigmReading.split("\\+")[0];
			if(paradigmReading.contains("+A+") 
					|| paradigmReading.contains("Num+") 
					|| paradigmReading.contains("Det+")){// adjective, ordinal number, determiner
				String[] caseTags = {"+Nom", "+Acc", "+Gen", "+Loc", "+Dat", "+Ins", "+Pred"};
				String[] genderTags = {"+Msc", "+Neu", "+Fem", "+MFN"};

				for(String caseTag: caseTags){

					if(paradigmReading.contains(caseTag)){
						String reading = paradigmReading;

						if(reading.contains("Anim")||
								reading.contains("Inan")){
							// change the animacy marker to AnIn
							reading = reading.replace("+Anim", "+AnIn").replace("+Inan", "+AnIn");
						}
						// add animacy tag for short form paradigm readings
						if(caseTag.equals("+Pred")){
							reading = reading.replace("+Sg", "+AnIn+Sg").replace("+Pl", "+AnIn+Pl");
						}

						// Assign case tags from the array 
						for(String aCase: caseTags) {
							// don't include short forms for ordinal numbers and determiner
							if(aCase.equals("+Pred")){
								if(paradigmReading.contains("Num+") 
										|| paradigmReading.contains("Det+"))	{
									continue;
								}
								// remove animacy tag for short forms
								generationInput += reading.replace(caseTag, aCase).replace("+AnIn", "") + "\n";
								continue;
							}
							else if(aCase.equals("+Acc")){
								// add all possible animacy readings
								generationInput += reading.replace(caseTag, aCase) + "\n";
								generationInput += reading.replace(caseTag, aCase).replace("+AnIn", "+Anim") + "\n";
								generationInput += reading.replace(caseTag, aCase).replace("+AnIn", "+Inan") + "\n";
							}
							else if(aCase.equals("+Ins")){
								generationInput += reading.replace(caseTag, aCase) + "\n";
								// add the +Leng reading
								generationInput += reading.replace(caseTag, aCase + "+Leng") + "\n";
							}
							else{
								generationInput += reading.replace(caseTag, aCase) + "\n";
							}
						}

						break;
					}
				}

				// create all forms for the other genders
				for(String genderTag: genderTags){
					if(paradigmReading.contains(genderTag)){
						String generationInputAllOtherGender = "";
						String generationInputOtherGender = "";
						// Assign gender tags from the array 
						for(String aGender: genderTags) {
							if(!aGender.equals(genderTag)){
								// generate other gender forms from the generation input
								generationInputOtherGender = generationInput.replace(genderTag, aGender);
								if(aGender.equals("+MFN")){
									// change singular forms to plural forms
									generationInputOtherGender = generationInputOtherGender.replace("+Sg+", "+Pl+");
								}
								if(genderTag.equals("+MFN")){
									// change plural forms to singular forms
									generationInputOtherGender = generationInputOtherGender.replace("+Pl+", "+Sg+");
								}
								// add the other gender forms to all other gender forms
								generationInputAllOtherGender += generationInputOtherGender;
							}
						}
						// add all the other gender forms to the generation input
						generationInput += generationInputAllOtherGender;

						break;
					}
				}

				// Add the comparative form (only adjectives)
				if(paradigmReading.contains("+A+"))	{
					generationInput += lemma + "+A+Cmpar+Pred\n";
				}

				//    	        log.info("generationInput(A)="+generationInput);
			}
			else if(paradigmReading.contains("+V+")){ // verb
				String[] formsPresentOrFuture = {"+Sg1", "+Sg2", "+Sg3", "+Pl1", "+Pl2", "+Pl3"};
				String[] formsPast = {"+Msc+Sg", "+Neu+Sg", "+Fem+Sg", "+MFN+Pl"};
				String[] formsImperative = {"+Sg2", "+Pl2"};
				String[] participleTypes = {"+PrsAct", "+PrsPss", "+PstAct", "+PstPss"};
//				log.info("Verb paradigm reading=" + paradigmReading);

				// generate all verb forms according to tense
				if(paradigmReading.contains("Prs+")){ // present
					String tenseTag = "+Prs";

					for(String personTag: formsPresentOrFuture){

						if(paradigmReading.contains(personTag)){

							// generate present tense forms
							for (String aPerson: formsPresentOrFuture) {
								generationInput += paradigmReading.replace(personTag, aPerson) + "\n";
							}
							
							// generate future tense forms
							if(paradigmReading.contains("+Perf") || lemma.contains("быть")){
								for (String aPerson: formsPresentOrFuture) {
									generationInput += paradigmReading.replace(personTag, aPerson).replace(tenseTag, "+Fut") + "\n";
								}
							}

							// generate past tense forms
							for(String aGenderAndNumber: formsPast){
								generationInput += paradigmReading.replace(personTag, aGenderAndNumber).replace(tenseTag, "+Pst") + "\n";
							}

							// generate imperative forms
							for (String aPerson: formsImperative) {
								generationInput += paradigmReading.replace(personTag, aPerson).replace(tenseTag, "+Imp") + "\n";
							}

							// generate verbal adverbs and the infinitive
							// remove tense tags
							String reading = paradigmReading.replace(tenseTag, "");
							// replace the person tag with the infinitive tag
							generationInput += reading.replace(personTag, "+Inf") + "\n";
							// replace the person tag with verbal adverb tags
							generationInput += reading.replace(personTag, "+PrsAct+Adv") + "\n";
							generationInput += reading.replace(personTag, "+PstAct+Adv") + "\n";
							
							// generate participles
							for (String aParticipleType: participleTypes) {
								generationInput += reading.replace(personTag, aParticipleType + "+Msc+AnIn+Sg+Nom") + "\n";
							}

							break;
						}
					}
				}
				if(paradigmReading.contains("Fut+")){ // future
					String tenseTag = "+Fut";

					for(String personTag: formsPresentOrFuture){

						if(paradigmReading.contains(personTag)){

							// generate present tense forms
							if(paradigmReading.contains("+Impf")){
								for (String aPerson: formsPresentOrFuture) {
									generationInput += paradigmReading.replace(personTag, aPerson).replace(tenseTag, "+Prs") + "\n";
								}
							}
							
							// generate future tense forms
							for (String aPerson: formsPresentOrFuture) {
								generationInput += paradigmReading.replace(personTag, aPerson) + "\n";
							}

							// generate past tense forms
							for(String aGenderAndNumber: formsPast){
								generationInput += paradigmReading.replace(personTag, aGenderAndNumber).replace(tenseTag, "+Pst") + "\n";
							}

							// generate imperative forms
							for (String aPerson: formsImperative) {
								generationInput += paradigmReading.replace(personTag, aPerson).replace(tenseTag, "+Imp") + "\n";
							}

							// generate verbal adverbs and the infinitive
							// remove tense tags
							String reading = paradigmReading.replace(tenseTag, "");
							// replace the person tag with the infinitive tag
							generationInput += reading.replace(personTag, "+Inf") + "\n";
							// replace the person tag with verbal adverb tags
							generationInput += reading.replace(personTag, "+PrsAct+Adv") + "\n";
							generationInput += reading.replace(personTag, "+PstAct+Adv") + "\n";
							
							// generate participles
							for (String aParticipleType: participleTypes) {
								generationInput += reading.replace(personTag, aParticipleType + "+Msc+AnIn+Sg+Nom") + "\n";
							}

							break;
						}
					}
				}
				else if(paradigmReading.contains("Pst+")){ // past
					String tenseTag = "+Pst";

					for(String genderAndNumberTag: formsPast){

						if(paradigmReading.contains(genderAndNumberTag)){

							// generate present tense forms
							if(paradigmReading.contains("+Impf")){
								for (String aPerson: formsPresentOrFuture) {
									generationInput += paradigmReading.replace(genderAndNumberTag, aPerson).replace(tenseTag, "+Prs") + "\n";
								}
							}
							
							// generate future tense forms
							if(paradigmReading.contains("+Perf") || lemma.contains("быть")){
								for (String aPerson: formsPresentOrFuture) {
									generationInput += paradigmReading.replace(genderAndNumberTag, aPerson).replace(tenseTag, "+Fut") + "\n";
								}
							}

							// generate past tense forms
							for(String aGenderAndNumber: formsPast){
								generationInput += paradigmReading.replace(genderAndNumberTag, aGenderAndNumber) + "\n";
							}

							// generate imperative forms
							for (String aPerson: formsImperative) {
								generationInput += paradigmReading.replace(genderAndNumberTag, aPerson).replace(tenseTag, "+Imp") + "\n";
							}

							// generate verbal adverbs and the infinitive
							// remove tense tags
							String reading = paradigmReading.replace(tenseTag, "");
							// replace the person tag with the infinitive tag
							generationInput += reading.replace(genderAndNumberTag, "+Inf") + "\n";
							// replace the person tag with verbal adverb tags
							generationInput += reading.replace(genderAndNumberTag, "+PrsAct+Adv") + "\n";
							generationInput += reading.replace(genderAndNumberTag, "+PstAct+Adv") + "\n";
							
							// generate participles
							for (String aParticipleType: participleTypes) {
								generationInput += reading.replace(genderAndNumberTag, aParticipleType + "+Msc+AnIn+Sg+Nom") + "\n";
							}

							break;
						}
					}
				}
				else if(paradigmReading.contains("+Inf")){ // infinitive
					String tenseTag = "+Inf";

					// generate present tense forms
					if(paradigmReading.contains("+Impf")){
						for (String aPerson: formsPresentOrFuture) {
							generationInput += paradigmReading.replace(tenseTag, "+Prs" + aPerson) + "\n";
						}
					}
					
					// generate future tense forms
					if(paradigmReading.contains("+Perf") || lemma.contains("быть")){
						for (String aPerson: formsPresentOrFuture) {
							generationInput += paradigmReading.replace(tenseTag, "+Fut" + aPerson) + "\n";
						}
					}

					// generate past tense forms
					for(String aGenderAndNumber: formsPast){
						generationInput += paradigmReading.replace(tenseTag, "+Pst" + aGenderAndNumber) + "\n";
					}

					// generate imperative forms
					for (String aPerson: formsImperative) {
						generationInput += paradigmReading.replace(tenseTag, "+Imp" + aPerson) + "\n";
					}

					// generate verbal adverbs and the infinitive
					// add the infinitive
					generationInput += paradigmReading + "\n";
					// replace the person tag with verbal adverb tags
					generationInput += paradigmReading.replace(tenseTag, "+PrsAct+Adv") + "\n";
					generationInput += paradigmReading.replace(tenseTag, "+PstAct+Adv") + "\n";
					
					// generate participles
					for (String aParticipleType: participleTypes) {
						generationInput += paradigmReading.replace(tenseTag, aParticipleType + "+Msc+AnIn+Sg+Nom") + "\n";
					}
					
				}
				else if(paradigmReading.contains("Imp+")){ // imperative
					String tenseTag = "+Imp+";
	             	
	             	for(String personTag: formsImperative){
	             		
	                 	if(paradigmReading.contains(personTag)){
	                 		
	                 		// generate present tense forms
							if(paradigmReading.contains("+Impf")){
								for (String aPerson: formsPresentOrFuture) {
									generationInput += paradigmReading.replace(personTag, aPerson).replace(tenseTag, "+Prs+") + "\n";
								}
							}
							
							// generate future tense forms
							if(paradigmReading.contains("+Perf") || lemma.contains("быть")){
								for (String aPerson: formsPresentOrFuture) {
									generationInput += paradigmReading.replace(personTag, aPerson).replace(tenseTag, "+Fut+") + "\n";
								}
							}

							// generate past tense forms
							for(String aGenderAndNumber: formsPast){
								generationInput += paradigmReading.replace(personTag, aGenderAndNumber).replace(tenseTag, "+Pst+") + "\n";
							}

							// generate imperative forms
							for (String aPerson: formsImperative) {
								generationInput += paradigmReading.replace(personTag, aPerson) + "\n";
							}

							// generate verbal adverbs and the infinitive
							// remove tense tags
							String reading = paradigmReading.replace(tenseTag, "+");
							// replace the person tag with the infinitive tag
							generationInput += reading.replace(personTag, "+Inf") + "\n";
							// replace the person tag with verbal adverb tags
							generationInput += reading.replace(personTag, "+PrsAct+Adv") + "\n";
							generationInput += reading.replace(personTag, "+PstAct+Adv") + "\n";
							
							// generate participles
							for (String aParticipleType: participleTypes) {
								generationInput += reading.replace(personTag, aParticipleType + "+Msc+AnIn+Sg+Nom") + "\n";
							}

							break;
	                 	}
	                 }
	             }
				else if(paradigmReading.contains("+Adv")){ // verbal adverb
					String tenseTag = "";
					
					// determine the tense
					if(paradigmReading.contains("+PrsAct")){
						tenseTag = "+PrsAct";
					}
					else if(paradigmReading.contains("+PstAct")){
						tenseTag = "+PstAct";
					}
					
					int tenseTagIndex = paradigmReading.indexOf(tenseTag);
					
					// the reading tag sequence starting from the tensetag
					String fromTenseTagToEnd = paradigmReading.substring(tenseTagIndex);

					// generate present tense forms
					if(paradigmReading.contains("+Impf")){
						for (String aPerson: formsPresentOrFuture) {
							generationInput += paradigmReading.replace(fromTenseTagToEnd, "+Prs" + aPerson) + "\n";
						}
					}
					
					// generate future tense forms
					if(paradigmReading.contains("+Perf") || lemma.contains("быть")){
						for (String aPerson: formsPresentOrFuture) {
							generationInput += paradigmReading.replace(fromTenseTagToEnd, "+Fut" + aPerson) + "\n";
						}
					}

					// generate past tense forms
					for(String aGenderAndNumber: formsPast){
						generationInput += paradigmReading.replace(fromTenseTagToEnd, "+Pst" + aGenderAndNumber) + "\n";
					}

					// generate imperative forms
					for (String aPerson: formsImperative) {
						generationInput += paradigmReading.replace(fromTenseTagToEnd, "+Imp" + aPerson) + "\n";
					}

					// generate verbal adverbs and the infinitive
					// replace the tenseTag tag with the infinitive tag
					generationInput += paradigmReading.replace(fromTenseTagToEnd, "+Inf") + "\n";
					// replace the tenseTag tag with verbal adverb tags
					generationInput += paradigmReading.replace(fromTenseTagToEnd, "+PrsAct+Adv") + "\n";
					generationInput += paradigmReading.replace(fromTenseTagToEnd, "+PstAct+Adv") + "\n";		
					
					// generate participles
					for (String aParticipleType: participleTypes) {
						generationInput += paradigmReading.replace(fromTenseTagToEnd, aParticipleType + "+Msc+AnIn+Sg+Nom") + "\n";
					}
				}
				else if(paradigmReading.contains("Act+")||
						paradigmReading.contains("Pss+")){ // participle
					String tenseTag = "";
					
					// determine the tense
					if(paradigmReading.contains("+PrsAct")){
						tenseTag = "+PrsAct";
					}
					else if(paradigmReading.contains("+PstAct")){
						tenseTag = "+PstAct";
					}
					else if(paradigmReading.contains("+PrsPss")){
						tenseTag = "+PrsPss";
					}
					else if(paradigmReading.contains("+PstPss")){
						tenseTag = "+PstPss";
					}
					
					int tenseTagIndex = paradigmReading.indexOf(tenseTag);
					
					// the reading tag sequence starting from the tensetag
					String fromTenseTagToEnd = paradigmReading.substring(tenseTagIndex);

					// generate present tense forms
					if(paradigmReading.contains("+Impf")){
						for (String aPerson: formsPresentOrFuture) {
							generationInput += paradigmReading.replace(fromTenseTagToEnd, "+Prs" + aPerson) + "\n";
						}
					}
					
					// generate future tense forms
					if(paradigmReading.contains("+Perf") || lemma.contains("быть")){
						for (String aPerson: formsPresentOrFuture) {
							generationInput += paradigmReading.replace(fromTenseTagToEnd, "+Fut" + aPerson) + "\n";
						}
					}

					// generate past tense forms
					for(String aGenderAndNumber: formsPast){
						generationInput += paradigmReading.replace(fromTenseTagToEnd, "+Pst" + aGenderAndNumber) + "\n";
					}

					// generate imperative forms
					for (String aPerson: formsImperative) {
						generationInput += paradigmReading.replace(fromTenseTagToEnd, "+Imp" + aPerson) + "\n";
					}

					// generate verbal adverbs and the infinitive
					// replace the tenseTag tag with the infinitive tag
					generationInput += paradigmReading.replace(fromTenseTagToEnd, "+Inf") + "\n";
					// replace the tenseTag tag with verbal adverb tags
					generationInput += paradigmReading.replace(fromTenseTagToEnd, "+PrsAct+Adv") + "\n";
					generationInput += paradigmReading.replace(fromTenseTagToEnd, "+PstAct+Adv") + "\n";		
					
					// generate participles
					// determine the gender
					String genderTag = "";
					if(fromTenseTagToEnd.contains("+Msc")){
						genderTag = "+Msc";
					}
					else if(fromTenseTagToEnd.contains("+Fem")){
						genderTag = "+Fem";
					}
					else if(fromTenseTagToEnd.contains("+Neu")){
						genderTag = "+Neu";
					}
					else if(fromTenseTagToEnd.contains("+MFN")){
						genderTag = "+MFN";
					}
					
					int genderTagIndex = fromTenseTagToEnd.indexOf(genderTag);
					
					// the reading tag sequence starting from the gender tag
					String fromGenderTagToEnd = fromTenseTagToEnd.substring(genderTagIndex);
					for (String aParticipleType: participleTypes) {
						if(tenseTag.equals(aParticipleType)){
							// generate the whole paradigm of the current participle type
							String[] caseTags = {"+Nom", "+Acc", "+Gen", "+Loc", "+Dat", "+Ins", "+Pred"};
							String[] genderTags = {"+Msc", "+Neu", "+Fem", "+MFN"};
							
							String participleGenerationInput = "";

							for(String caseTag: caseTags){

								if(paradigmReading.contains(caseTag)){
									String reading = paradigmReading;

									if(reading.contains("Anim")||
											reading.contains("Inan")){
										// change the animacy marker to AnIn
										reading = reading.replace("+Anim", "+AnIn").replace("+Inan", "+AnIn");
									}
									// add animacy tag for short form paradigm readings
									if(caseTag.equals("+Pred")){
										reading = reading.replace("+Sg", "+AnIn+Sg").replace("+Pl", "+AnIn+Pl");
									}

									// Assign case tags from the array 
									for(String aCase: caseTags) {
										// don't include short forms for ordinal numbers and determiner
										if(aCase.equals("+Pred")){
											// remove animacy tag for short forms
											participleGenerationInput += reading.replace(caseTag, aCase).replace("+AnIn", "") + "\n";
											continue;
										}
										else if(aCase.equals("+Acc")){
											// add all possible animacy readings
											participleGenerationInput += reading.replace(caseTag, aCase) + "\n";
											participleGenerationInput += reading.replace(caseTag, aCase).replace("+AnIn", "+Anim") + "\n";
											participleGenerationInput += reading.replace(caseTag, aCase).replace("+AnIn", "+Inan") + "\n";
										}
										else if(aCase.equals("+Ins")){
											participleGenerationInput += reading.replace(caseTag, aCase) + "\n";
											// add the +Leng reading
											participleGenerationInput += reading.replace(caseTag, aCase + "+Leng") + "\n";
										}
										else{
											participleGenerationInput += reading.replace(caseTag, aCase) + "\n";
										}
									}

									break;
								}
							}

							// create all forms for the other genders
							for(String aGenderTag: genderTags){
								if(paradigmReading.contains(aGenderTag)){
									String generationInputAllOtherGender = "";
									String generationInputOtherGender = "";
									// Assign gender tags from the array 
									for(String aGender: genderTags) {
										if(!aGender.equals(aGenderTag)){
											// generate other gender forms from the generation input
											generationInputOtherGender = participleGenerationInput.replace(aGenderTag, aGender);
											if(aGender.equals("+MFN")){
												// change singular forms to plural forms
												generationInputOtherGender = generationInputOtherGender.replace("+Sg+", "+Pl+");
											}
											if(aGenderTag.equals("+MFN")){
												// change plural forms to singular forms
												generationInputOtherGender = generationInputOtherGender.replace("+Pl+", "+Sg+");
											}
											// add the other gender forms to all other gender forms
											generationInputAllOtherGender += generationInputOtherGender;
										}
									}
									// add all the other gender forms to the generation input
									participleGenerationInput += generationInputAllOtherGender;

									break;
								}
							}
							
							// add all participle forms to the generation input
							generationInput += "ñôŃßĘńŠēPARTICIPLESTART\n" + participleGenerationInput + "ñôŃßĘńŠēPARTICIPLEEND\n";

						}
						else{
							// generate other participle type forms (only Msc AnIn Sg Nom)
							generationInput += paradigmReading.replace(tenseTag, aParticipleType).replace(fromGenderTagToEnd, "+Msc+AnIn+Sg+Nom") + "\n";							
						}
					}
				}

				//    			log.info("generationInput(V)="+generationInput);
			}
			else if(paradigmReading.contains("+N+")
					|| paradigmReading.contains("Pron+")){ // noun, pronoun
				String[] caseTags = {"+Nom", "+Acc", "+Gen", "+Loc", "+Dat", "+Ins", "+Loc2", "+Gen2", "+Voc"};

				for(String caseTag: caseTags){

					if(paradigmReading.contains(caseTag)){

						// Assign case tags from the array 
						for(String aCase: caseTags) {
							// pronouns never have the case tags Loc2, Gen2 and Voc, stop the loop
							if(paradigmReading.contains("Pron+")){
								if(aCase.equals("+Loc2")){
									break;
								}
							}
							generationInput += paradigmReading.replace(caseTag, aCase) + "\n";
						}

						break;
					}
				}

				// sg and pl forms for nouns
				if(paradigmReading.contains("+N+")){
					// Generate other number forms
					String generationInputOtherNumber = "";
					if(paradigmReading.contains("+Sg+")){
						generationInputOtherNumber = generationInput.replace("+Sg+", "+Pl+");
					}
					else{
						generationInputOtherNumber = generationInput.replace("+Pl+", "+Sg+");
					}  

					// Add the plural forms to the generation input
					generationInput += generationInputOtherNumber;  				
				}

				//    	        log.info("generationInput(N, Pron)="+generationInput);
			}
			if(!generationInput.isEmpty()){
				generationInput = paradigmReading + "\n" + "ñôŃßĘńŠēNEWPARADIGM\n"  + generationInput + "ñôŃßĘńŠēPARADIGMEND\n";				
			}
			// add the generation input for the current reading to the others
			generationInputAll += generationInput;
		}

		return generationInputAll;
	}

	/*
	 * The output file from the generator is used to create distractors and is placed into the right place in the span tag.
	 * Afterwards an enhancement with the span tag is created and passed to the cas.
	 */
	private void generateSpanTagWithDistractors(JCas cas, String cg3GeneratorOutputFileLoc, Map<Word, SpanTag> wordToSpanMap){
		try {
			BufferedReader cg3GeneratorOutputReader = new BufferedReader(new InputStreamReader(new FileInputStream(cg3GeneratorOutputFileLoc), "UTF8"));
			
			// FSTUPDATE: The patterns target FST features to construct the tables for the paradigms
			// by identifying required features
			
			Pattern posPattern = Pattern.compile("\\+(N|A|V|Pron|Det|Num\\+Ord)\\+");
			
			Pattern posIndeclPattern = Pattern.compile("\\+(Abbr|Adv.*|CC|CS|Interj|Paren|Pcle|Po|Pr)$");
			
			Pattern numberPattern = Pattern.compile("\\+(Sg|Pl)");

			Pattern casePattern = Pattern.compile("\\+(Nom|Acc|Gen|Loc|Dat|Ins|Pred|Cmpar|Loc2|Gen2|Voc)");
			
			Pattern genderPattern = Pattern.compile("\\+(Msc|Fem|Neu|MFN)");
			
			Pattern animacyPattern = Pattern.compile("\\+(Anim|Inan|AnIn)");
			
			Pattern tensePattern = Pattern.compile("\\+(Pst|Fut|Prs|Imp)\\+");
			
			Pattern personPattern = Pattern.compile("1|2|3");
			
			Pattern tenseVoicePattern = Pattern.compile("(Prs|Pst)(Act|Pss)");
			
			Pattern lemmaPattern = Pattern.compile("^(.*?)\\+");

			String generatorOutput = "";
			
			String[][] tableArr = new String[10][10];
			
			String[][] verbPastArr = new String[10][10];
			
			String[][] verbNoPastArr = new String[10][10];
			
			String[][] verbImperativeArr = new String[10][10];	
			
			String[][] verbAdverbArr = new String[10][10];
			
			String[][] verbParticipleArr = new String[10][10];

			boolean isVerb = false;
			
			boolean isAdjective = false;
			
			boolean isDeterminer = false;
			
			boolean isOrdinalNumber = false;

			boolean isNoun = false;
			
			boolean isPronoun = false;
			
			boolean isParadigm = false;
			
			boolean isParticiple = false;
			
			int row = 0;
			
			int column = 0;
			
			String currentTagSequence = "";
			
			String table = "";

			Word currentWord = new Word();
			String paradigmTables = "";

			String correctForm = "";

			String ruledOutFormsWithReadings = "";
			
			String disambiguatedReadings = "";
			
			String quote = "&quot;";
			
			String disambiguatedClass = "class="+quote+"disambiguated"+quote;
			
			String paradigmClass = "class="+quote+"paradigm";
			
			String translationsClass = "class="+quote+"translations"+quote;
			
			String verbInfinitive = "";
			
			Map<String, String> lemmaToTranslationsMap = loadMapKryo("lemmaToTranslationsMap");

			while (cg3GeneratorOutputReader.ready()) {
				String line = cg3GeneratorOutputReader.readLine().trim();
				if(line.isEmpty()){
					continue;
				}
				// generator output was processed, all distractors are created
				// assign the distractors to the correct span from the wordToSpanMap
				else if(line.startsWith("Word")){
					// only enhance tokens with more than one distractor form
					if(!paradigmTables.isEmpty()){
						paradigmTables += "</div>";
						paradigmTables = paradigmTables.replace("<", "&lt;").replace(">", "&gt;").replace("\"", "&quot;");;
						String[] lineParts = line.split("\\s");
						int begin = Integer.parseInt(lineParts[1]);
						int end = Integer.parseInt(lineParts[2]);
						currentWord = new Word(begin, end);
						SpanTag spanTag = wordToSpanMap.get(currentWord);
						spanTag.addAttribute("paradigms", paradigmTables);
						if(!correctForm.isEmpty()){
							spanTag.addAttribute("correctForm", correctForm);	
							correctForm = "";			
						}
						if(!ruledOutFormsWithReadings.isEmpty()){
							spanTag.addAttribute("ruledOutReadings", ruledOutFormsWithReadings);
							ruledOutFormsWithReadings = "";		
						}
						// make new enhancement, pass it to the cas
						Enhancement e = new Enhancement(cas);
						e.setRelevant(true);
						e.setBegin(begin);
						e.setEnd(end);
						e.setEnhanceStart(spanTag.getSpanTagStart());					
						e.setEnhanceEnd(spanTag.getSpanTagEnd());
						// update CAS
						cas.addFsToIndexes(e);
						//log.info("Enhancement="+e); // testing
						paradigmTables = "";
					}	
				}
				else if(line.startsWith("ñôŃßĘńŠēNEWPARADIGM")){
					isParadigm = true;
					// initialize new paradigm
					StringTokenizer tok = new StringTokenizer(generatorOutput);
					generatorOutput = "";
					String word = "";
					String reading = "";
					String form = "";
					while (tok.hasMoreTokens()) {
						word = tok.nextToken();
						//log.info("ifst output:"+word);
						// forms that could not be generated are excluded
						if (!word.contains("+")) {  
							if(form.isEmpty()){
								form = word;								
							}
							else{
								form += ", " + word;
							}
						}
						else if(!word.contains("+?") && word.contains("+")){
							reading = word;
						}
						else {
							//log.info("Word that was excluded = " + word);
						}
					}
					
					Matcher posMatcher = posPattern.matcher(reading);
					Matcher lemmaMatcher = lemmaPattern.matcher(reading);
					String pos = "";
					table = "";
					String lemma = "";
					String lemmaAttribute = "";
					String tablePOS = "";
					String fullPOS = "";
					if(posMatcher.find()){
						
						if(lemmaMatcher.find()){
							lemma = lemmaMatcher.group(1).replaceAll("[¹²³⁴⁵⁶⁷⁸⁹⁰]", "");
							lemmaAttribute += " lemma="+quote + lemma + quote;
						}
						table += "<div" + lemmaAttribute + ">";
						
						pos = posMatcher.group(1);

						isNoun = pos.equals("N");
						isPronoun = pos.equals("Pron");
						isAdjective = pos.equals("A");
						isDeterminer = pos.equals("Det");
						isOrdinalNumber = pos.equals("Num+Ord");					
						isVerb = pos.equals("V");
						
						if(isNoun){
							fullPOS = "noun";
							tablePOS += "<table " + paradigmClass + " " + fullPOS + quote + ">";
							tableArr = new String[10][3];
						}
						else if(isPronoun){
							fullPOS = "pronoun";
							tablePOS += "<table " + paradigmClass + " " + fullPOS + quote + ">";
							tableArr = new String[7][3];
						}
						else if(isAdjective){
							fullPOS = "adjective";
							tablePOS += "<table " + paradigmClass + " " + fullPOS + quote + ">";
							tableArr = new String[10][5];
						}
						else if(isDeterminer){
							fullPOS = "determiner";
							tablePOS += "<table " + paradigmClass + " " + fullPOS + quote + ">";
							tableArr = new String[8][5];
						}
						else if(isOrdinalNumber){
							fullPOS = "ordinalNumber";
							tablePOS += "<table " + paradigmClass + " " + fullPOS + quote + ">";
							tableArr = new String[8][5];
						}
						else if(isVerb){
							fullPOS = "verb";
							verbPastArr = new String[5][2];
							
							verbNoPastArr = new String[4][3];
							
							verbImperativeArr = new String[2][2];
							
							verbAdverbArr = new String[2][2];
							
							verbParticipleArr = new String[2][4];	
							
							tableArr = new String[10][5];
						}
						
						
						table += "<span class="+quote+"tableClick"+quote+"><br>"+ lemma + " ("+fullPOS+")" + "</span>";
						table += "<div>";
						table += "<br><b>"+ form + "</b><br>";

						String translations = "";
						// TODO Det and Pron same class?
						String key = lemma+"#"+pos.replace("+Ord", "").replace("Det", "Pron");
						if(lemmaToTranslationsMap.containsKey(key)){
							translations = lemmaToTranslationsMap.get(key);
						}
						else{
							translations = "<div " + translationsClass + ">No translations available</div>";
						}
						table += "<br>" + translations + "<br><br>";	
						table += tablePOS;
					}
					row = 0;
					column = 0;
				}
				else if(line.startsWith("ñôŃßĘńŠēINDECLINABLEREADING")){
					isParadigm = false;
					// initialize new paradigm
					StringTokenizer tok = new StringTokenizer(generatorOutput);
					generatorOutput = "";
					String word = "";
					String reading = "";
					String form = "";
					while (tok.hasMoreTokens()) {
						word = tok.nextToken();
						//log.info("ifst output:"+word);
						// forms that could not be generated are excluded
						if (!word.contains("+")) {  
							if(form.isEmpty()){
								form = word;								
							}
							else{
								form += ", " + word;
							}
						}
						else if(!word.contains("+?") && word.contains("+")){
							reading = word;
						}
						else {
							//log.info("Word that was excluded = " + word);
						}
					}
					
					Matcher posIndeclMatcher = posIndeclPattern.matcher(reading);
					Matcher lemmaMatcher = lemmaPattern.matcher(reading);
					String pos = "";
					table = "";
					String lemma = "";
					String lemmaAttribute = "";
					String fullPOS = "";
					if(posIndeclMatcher.find()){
						
						if(lemmaMatcher.find()){
							lemma = lemmaMatcher.group(1).replaceAll("[¹²³⁴⁵⁶⁷⁸⁹⁰]", "");
							lemmaAttribute += " lemma="+quote + lemma + quote;
						}
						table += "<div" + lemmaAttribute + ">";
						
						pos = posIndeclMatcher.group(1);
					     switch (pos) {
					         case "Abbr":
					        	 fullPOS = "Abbreviation";
					             break;
					         case "Adv":
					        	 fullPOS = "Adverb";
					             break;
					         case "Adv+Rel":
					        	 fullPOS = "Relative Adverb";
					             break;
					         case "Adv+Cmpar":
					        	 fullPOS = "Comparative Adverb";
					             break;
					         case "Adv+Interr":
					        	 fullPOS = "Interrogative Adverb";
					             break;
					         case "CC":
					        	 fullPOS = "Coordinating Conjunction";
					             break;
					         case "CS":
					        	 fullPOS = "Subordinating Conjunction";
					             break;
					         case "Interj":
					        	 fullPOS = "Interjection";
					             break;
					         case "Paren":
					        	 fullPOS = "Parenthetical";
					             break;
					         case "Pcle":
					        	 fullPOS = "Particle";
					             break;
					         case "Po":
					        	 fullPOS = "Postposition";
					             break;
					         case "Pr":
					        	 fullPOS = "Preposition";
					             break;
					         default:
					             log.info("Invalid pos: " + pos);
					     }
						
						
						table += "<span class="+quote+"tableClick"+quote+"><br>"+ lemma + " ("+fullPOS+")" + "</span>";
						table += "<div>";
						table += "<br><b>"+ form + "</b><br>";

						String translations = "";
						String key = lemma+"#"+pos.replaceAll("CC|CS", "C").replaceAll("Adv.+", "Adv");
						if(lemmaToTranslationsMap.containsKey(key)){
							translations = lemmaToTranslationsMap.get(key);
						}
						else{
							translations = "<div " + translationsClass + ">No translations available</div>";
						}
						table += "<br>" + translations + "<br><br>";	
					}
					
					if(paradigmTables.isEmpty()){
						paradigmTables += "<div>";						
					}
					paradigmTables += table;
					paradigmTables += "</div><br></div>";
				}
				else if(line.startsWith("ñôŃßĘńŠēPARTICIPLESTART")){
					isParticiple = true;
					row = 0;
					column = 0;
				}
				else if(line.startsWith("ñôŃßĘńŠēPARTICIPLEEND")){
					isParticiple = false;
				}
				// the marker (ñôŃßĘńŠēCORRECTFORM) was found, begin to process the generator output, create the correct form
				else if(line.contains("ñôŃßĘńŠēCORRECTFORM")){
					isParadigm = false;
					StringTokenizer tok = new StringTokenizer(generatorOutput);
					generatorOutput = "";
					String word = "";
					correctForm = "";
					while (tok.hasMoreTokens()) {
						word = tok.nextToken();
						//log.info("ifst output:"+word);
						// forms that could not be generated are excluded, as well as input strings of the iFST
						if (!word.contains("+") && !word.contains("-")) {  
							correctForm += word + " ";
						}
						else{
							//log.info("Word that was excluded = " + word);
						}
					}
					// remove the whitespace at the end
					correctForm = correctForm.trim();
				}
				// the marker (ñôŃßĘńŠēRULEDOUTREADINGS) was found, begin to process the generator output, create the ruled out readings
				else if(line.contains("ñôŃßĘńŠēRULEDOUTREADINGS")){
					isParadigm = false;
					StringTokenizer tok = new StringTokenizer(generatorOutput);
					generatorOutput = "";
					String word = "";
					ruledOutFormsWithReadings = "";
					String reading = "";
					String form = "";
					while (tok.hasMoreTokens()) {
						word = tok.nextToken();
						//log.info("ifst output:"+word);
						// forms that could not be generated are excluded
						if (!word.contains("+")) { 
							form = word;
							if(ruledOutFormsWithReadings.isEmpty()){
								ruledOutFormsWithReadings = form + " " + reading;
							}
							else{
								ruledOutFormsWithReadings += "#" + form + " " + reading;								
							}
						}
						else if(!word.contains("+?") && word.contains("+")){
							reading = word;
						}
						else {
							//log.info("Word that was excluded = " + word);
						}
					}
				}
				// the marker (ñôŃßĘńŠēDISAMBIGUATEDREADINGS) was found, begin to process the generator output, create the disambiguated readings
				else if(line.contains("ñôŃßĘńŠēDISAMBIGUATEDREADINGS")){
					isParadigm = false;
					StringTokenizer tok = new StringTokenizer(generatorOutput);
					generatorOutput = "";
					String word = "";
					disambiguatedReadings = "";
					while (tok.hasMoreTokens()) {
						word = tok.nextToken();
						//log.info("ifst output:"+word);
						// forms that could not be generated are excluded
						if(!word.contains("+?") && word.contains("+")){
							if(disambiguatedReadings.isEmpty()){
								disambiguatedReadings = word;
							}
							else{
								disambiguatedReadings += "\n" + word;
							}							
						}
						else {
							//log.info("Word that was excluded = " + word);
						}
					}
				}
				// the marker (ñôŃßĘńŠēPARADIGMS) was found, begin to process the generator output, create paradigms
				else if(line.contains("ñôŃßĘńŠēPARADIGMEND")){
					isParadigm = false;
					generatorOutput = "";
					if(paradigmTables.isEmpty()){
						paradigmTables += "<div>";						
					}
					if(isNoun || isPronoun){
//						System.out.println("noun table start");
						for(int aRow = 0; aRow < tableArr.length; aRow++){
							// skip over rows with no entries
							if(tableArr[aRow][0] == null){
								continue;
							}
//							System.out.println("new row start");
							for(int aColumn = 0; aColumn < tableArr[aRow].length; aColumn++){
								String currentCell = tableArr[aRow][aColumn];
								if(currentCell == null){
									currentCell = "---";
								}
								if(aColumn == 0){ // a new table row, first column
									table += "<tr" + " class=" + quote + currentCell + quote + ">";
								}
								table += "<td>";
								table += currentCell.replace("Case", "");
								table += "</td>";
//								System.out.println("new entry <td>"+currentCell+"</td>");
							}
							table += "</tr>";
//							System.out.println("new row end");
						}
						table += "</table>";
//						System.out.println("noun table end");
					}
					if(isAdjective || isDeterminer || isOrdinalNumber){
//						System.out.println("adjective table start");
						for(int aRow = 0; aRow < tableArr.length; aRow++){
							// skip over rows with no entries
							if(tableArr[aRow][0] == null){
								continue;
							}
//							System.out.println("new row start");
							for(int aColumn = 0; aColumn < tableArr[aRow].length; aColumn++){
								String currentCell = tableArr[aRow][aColumn];
								if(currentCell == null){
									currentCell = "---";
								}
								if(aColumn == 0){ // a new table row, first column
									table += "<tr" + " class=" + quote + currentCell + quote + ">";
								}
								table += "<td>";
								table += currentCell.replace("Case", "");
								table += "</td>";
//								System.out.println("new entry <td>"+currentCell+"</td>");
							}
							table += "</tr>";
//							System.out.println("new row end");
						}
						table += "</table>";
//						System.out.println("adjective table end");
					}
					else if(isVerb){
						table += "Infinitive: " + verbInfinitive + "<br>";	
						// return the infinitive value to the default
						verbInfinitive = "---";
//						System.out.println("Past:");
						table += "Past:<br>";
//						System.out.println("verb table past start");
						table += "<table " + paradigmClass + " verbPast" + quote + ">";
						for(int aRow = 0; aRow < verbPastArr.length; aRow++){
//							System.out.println("new row start");
							table += "<tr>";
							for(int aColumn = 0; aColumn < verbPastArr[aRow].length; aColumn++){
								String currentCell = verbPastArr[aRow][aColumn];
								if(currentCell == null){
									currentCell = "---";
								}
								else if(currentCell.isEmpty()){
									continue;
								}
								table += "<td>";
								table += currentCell;
								table += "</td>";
//								System.out.println("new entry <td>"+currentCell+"</td>");
							}
							table += "</tr>";
//							System.out.println("new row end");
						}						
//						System.out.println("verb table past end");
						table += "</table>";
						
//						System.out.println();
//						System.out.println("Nonpast (Pres/Fut):");
						table += "<br>Nonpast (Pres/Fut):<br>";
//						System.out.println("verb table nonpast start");
						table += "<table " + paradigmClass + " verbNonpast" + quote + ">";
						for(int aRow = 0; aRow < verbNoPastArr.length; aRow++){
//							System.out.println("new row start");
							table += "<tr>";
							for(int aColumn = 0; aColumn < verbNoPastArr[aRow].length; aColumn++){
								String currentCell = verbNoPastArr[aRow][aColumn];
								if(currentCell == null){
									currentCell = "---";
								}
								table += "<td>";
								table += currentCell;
								table += "</td>";
//								System.out.println("new entry <td>"+currentCell+"</td>");
							}
							table += "</tr>";
//							System.out.println("new row end");
						}
//						System.out.println("verb table nonpast end");
						table += "</table>";
						
//						System.out.println();
//						System.out.println("Imperative (command):");
						table += "<br>Imperative (command):</br>";
//						System.out.println("verb table Imperative start");
						table += "<table " + paradigmClass + " verbImperative" + quote + ">";
						for(int aRow = 0; aRow < verbImperativeArr.length; aRow++){
//							System.out.println("new row start");
							table += "<tr>";
							for(int aColumn = 0; aColumn < verbImperativeArr[aRow].length; aColumn++){
								String currentCell = verbImperativeArr[aRow][aColumn];
								if(currentCell == null){
									currentCell = "---";
								}
								table += "<td>";
								table += currentCell;
								table += "</td>";
//								System.out.println("new entry <td>"+currentCell+"</td>");
							}
							table += "</tr>";
//							System.out.println("new row end");
						}
//						System.out.println("verb table Imperative end");
						table += "</table>";
						
//						System.out.println();
//						System.out.println("Verbal adverbs:");
//						System.out.println("verb table verbal adverb start");
						table += "<table " + paradigmClass + " verbalAdverbs" + quote + ">";
						table += "<span><br>Verbal adverbs:<br></span>";
						for(int aRow = 0; aRow < verbAdverbArr.length; aRow++){
//							System.out.println("new row start");
							table += "<tr>";
							for(int aColumn = 0; aColumn < verbAdverbArr[aRow].length; aColumn++){
								String currentCell = verbAdverbArr[aRow][aColumn];
								if(currentCell == null){
									currentCell = "---";
								}
								table += "<td>";
								table += currentCell;
								table += "</td>";
//								System.out.println("new entry <td>"+currentCell+"</td>");
							}
							table += "</tr>";
//							System.out.println("new row end");
						}
//						System.out.println("verb table verbal adverb end");
						table += "</table>";
						
//						System.out.println();
//						System.out.println("Participles:");
						table += "<span><br>Participles:</br></span>";
//						System.out.println("verb table participle start");
						table += "<table " + paradigmClass + " verbParticiples" + quote + ">";
						for(int aRow = 0; aRow < verbParticipleArr.length; aRow++){
//							System.out.println("new row start");
							table += "<tr>";
							for(int aColumn = 0; aColumn < verbParticipleArr[aRow].length; aColumn++){
								String currentCell = verbParticipleArr[aRow][aColumn];
								if(currentCell == null){
									currentCell = "---";
								}
								table += "<td>";
								table += currentCell;
								table += "</td>";
//								System.out.println("new entry <td>"+currentCell+"</td>");
							}
							table += "</tr>";
//							System.out.println("new row end");
						}
//						System.out.println("verb table participle end");
						table += "</table>";
						
						if(tableArr[0][0] != null){
//							System.out.println("participle table start");
							table += "<table " + paradigmClass + " participle" + quote + ">";
							for(int aRow = 0; aRow < tableArr.length; aRow++){
								// skip over rows with no entries
								if(tableArr[aRow][0] == null){
									continue;
								}
//								System.out.println("new row start");
								table += "<tr>";
								for(int aColumn = 0; aColumn < tableArr[aRow].length; aColumn++){
									String currentCell = tableArr[aRow][aColumn];
									if(currentCell == null){
										currentCell = "---";
									}
									table += "<td>";
									table += currentCell;
									table += "</td>";
//									System.out.println("new entry <td>"+currentCell+"</td>");
								}
								table += "</tr>";
//								System.out.println("new row end");
							}
							table += "</table>";
//							System.out.println("participle table end");
						}
					}
					paradigmTables += table;
					paradigmTables += "</div><br></div>";
				}
				// the generator output for the current token is not fully extracted from the file yet
				else{
					generatorOutput += line + " ";	
					if(isParadigm){
						// FSTUPDATE: The FST features are used to find the correct readings and place
						// them into their respective slots inside the paradigm
						String[] lineParts = line.split("\\t");
						currentTagSequence = lineParts[0];
						String generatedWord = lineParts[1];
						
						// disambiguated readings are bolded, they are marked with a # at the beginning
						if(disambiguatedReadings.contains(currentTagSequence)){
//							log.info("The tag sequence=" + currentTagSequence + " is contained in the disambiguated readings:\n" + disambiguatedReadings);
							generatedWord = "<span " + disambiguatedClass + ">" + generatedWord + "</span>";;
						}						

						// include a "*" for the tags +Fac and +Prb
						if(currentTagSequence.contains("+Fac")||currentTagSequence.contains("+Prb")){
							generatedWord = generatedWord + "*";
						}
						
						// default row and column is one
						if(!(row == 0) && !(column == 0)){
							row = 1;
							column = 1;
						}
						
						if(!generatedWord.contains("+?")){
							if(isNoun || isPronoun){
								String number = "";
								String aCase = "";
								Matcher numberMatcher = numberPattern.matcher(currentTagSequence);
								Matcher caseMatcher = casePattern.matcher(currentTagSequence);
								if(numberMatcher.find()){
									number = numberMatcher.group(1);
								}
								if(caseMatcher.find()){
									aCase = caseMatcher.group(1);
								}
								
								/*
								 * Template:
								 * Case	Singular	Plural
								 * Nom
								 * Acc
								 * Gen
								 * Loc
								 * Dat
								 * Ins
								 * (Loc2)
								 * (Gen2)
								 * (Voc)
								 * forms in () appear for Nouns and only in some cases 
								 */
								if(row == 0 && column == 0){
									// header
									tableArr[0][0] = "Case";
									tableArr[0][1] = "Sg";
									tableArr[0][2] = "Pl";
									// first column
									tableArr[1][0] = "Nom";
									tableArr[2][0] = "Acc";
									tableArr[3][0] = "Gen";
									tableArr[4][0] = "Loc";
									tableArr[5][0] = "Dat";
									tableArr[6][0] = "Ins";
								}
								
								
								if(number.equals("Sg")){
									column = 1;
								}
								else if(number.equals("Pl")){
									column = 2;
								}
								
								if(aCase.equals("Nom")){
									row = 1;
								}
								else if(aCase.equals("Acc")){
									row = 2;
								}
								else if(aCase.equals("Gen")){
									row = 3;
								}
								else if(aCase.equals("Loc")){
									row = 4;
								}
								else if(aCase.equals("Dat")){
									row = 5;
								}
								else if(aCase.equals("Ins")){
									row = 6;
								}
								// add rows for the cases Loc2|Gen2|Voc only if they exist
								else if(aCase.equals("Loc2")){
									row = 7;
									if(tableArr[row][0] == null){	
										tableArr[row][0] = "Loc2";									
									}								
								}
								else if(aCase.equals("Gen2")){
									row = 8;
									if(tableArr[row][0] == null){	
										tableArr[row][0] = "Gen2";									
									}								
								}
								else if(aCase.equals("Voc")){
									row = 9;
									if(tableArr[row][0] == null){	
										tableArr[row][0] = "Voc";									
									}								
								}
								
								if(tableArr[row][column] == null){ // first/only entry
									tableArr[row][column] = generatedWord;
								}
								else{ // n-th entry
									if(!tableArr[row][column].contains(generatedWord)){
										tableArr[row][column] += "/" + generatedWord;
									}
								}
							}
							if(isAdjective || isDeterminer || isOrdinalNumber){
								String gender = "";
								String animacy = "";
								String aCase = "";
								Matcher genderMatcher = genderPattern.matcher(currentTagSequence);
								Matcher animacyMatcher = animacyPattern.matcher(currentTagSequence);
								Matcher caseMatcher = casePattern.matcher(currentTagSequence);

								if(genderMatcher.find()){
									gender = genderMatcher.group(1);
								}
								if(animacyMatcher.find()){
									animacy = animacyMatcher.group(1);
								}
								if(caseMatcher.find()){
									aCase = caseMatcher.group(1);
								}
								
								/*
								 * Template:
								 * Case		Msc	Neu	Fem	Pl
								 * Nom
								 * Acc/Anim
								 * Acc/Inan
								 * Gen
								 * Loc
								 * Dat
								 * Ins
								 * (Pred)
								 * (Cmpar)
								 * forms in () appear for Adjectives and only in some cases 
								 */
								if(row == 0 && column == 0){
									// header
									tableArr[0][0] = "Case";
									tableArr[0][1] = "Msc";
									tableArr[0][2] = "Neu";
									tableArr[0][3] = "Fem";
									tableArr[0][4] = "Pl";
									// first column
									tableArr[1][0] = "Nom";
									tableArr[2][0] = "Acc/Inan";
									tableArr[3][0] = "Acc/Anim";
									tableArr[4][0] = "Gen";
									tableArr[5][0] = "Loc";
									tableArr[6][0] = "Dat";
									tableArr[7][0] = "Ins";
								}
								
								if(gender.equals("Msc")){
									column = 1;
								}
								else if(gender.equals("Neu")){
									column = 2;
								}
								if(gender.equals("Fem")){
									column = 3;
								}
								if(gender.equals("MFN")){
									column = 4;
								}
								
								if(aCase.equals("Nom")){
									row = 1;
								}
								else if(aCase.equals("Acc") && animacy.equals("Inan")){
									row = 2;
								}
								else if(aCase.equals("Acc") && animacy.equals("Anim")){
									row = 3;
								}
								else if(aCase.equals("Acc") && animacy.equals("AnIn")){
									row = 3; // generate entry for row 3
									// and once again for row 2
									if(tableArr[2][column] == null){ // first/only entry
										tableArr[2][column] = generatedWord;
									}
									else{ // n-th entry
										if(!tableArr[2][column].contains(generatedWord)){
											tableArr[2][column] += "/" + generatedWord;
										}
									}
								}
								else if(aCase.equals("Gen")){
									row = 4;
								}
								else if(aCase.equals("Loc")){
									row = 5;
								}
								else if(aCase.equals("Dat")){
									row = 6;
								}
								else if(aCase.equals("Ins")){
									row = 7;									
								}
								// add rows for the cases Pred|Cmpar only if they exist
								else if(aCase.equals("Pred")){
									row = 8;
									if(tableArr[row][0] == null){	
										tableArr[row][0] = "Short";									
									}
								}
								else if(aCase.equals("Cmpar")){
									row = 9;
									if(tableArr[row][0] == null){	
										tableArr[row][0] = "Cmpar";									
									}
								}
								
								if(tableArr[row][column] == null){ // first/only entry
									tableArr[row][column] = generatedWord;
								}
								else{ // n-th entry
									if(!tableArr[row][column].contains(generatedWord)){
										if(currentTagSequence.contains("+Leng")){
											tableArr[row][column] += "<br>(" + generatedWord + ")";
										}
										else{
											tableArr[row][column] += "/" + generatedWord;											
										}
									}
								}
							}
							if(isVerb){
								String tense = "";
								String gender = "";
								String number = "";
								String person = "";
								String tenseVoice = "";
								String animacy = "";
								String aCase = "";
								
								Matcher tenseMatcher = tensePattern.matcher(currentTagSequence);
								Matcher genderMatcher = genderPattern.matcher(currentTagSequence);
								Matcher numberMatcher = numberPattern.matcher(currentTagSequence);
								Matcher personMatcher = personPattern.matcher(currentTagSequence);
								Matcher tenseVoiceMatcher = tenseVoicePattern.matcher(currentTagSequence);
								Matcher animacyMatcher = animacyPattern.matcher(currentTagSequence);
								Matcher caseMatcher = casePattern.matcher(currentTagSequence);
								
								if(tenseMatcher.find()){
									tense = tenseMatcher.group(1);
								}
								if(genderMatcher.find()){
									gender = genderMatcher.group(1);
								}								
								if(numberMatcher.find()){
									number = numberMatcher.group(1);
								}
								if(personMatcher.find()){
									person = personMatcher.group();
								}
								if(tenseVoiceMatcher.find()){
									tenseVoice = tenseVoiceMatcher.group();
								}
								if(animacyMatcher.find()){
									animacy = animacyMatcher.group(1);
								}
								if(caseMatcher.find()){
									aCase = caseMatcher.group(1);
								}
								/*
								 * Template:
								 * Infinitive: 
								 * Past:
								 * Gender	Form
								 * M
								 * N
								 * F
								 * Pl
								 * 
								 * Nonpast (Pres/Fut):
								 * Person  	Sg      Pl
								 * 1
								 * 2
								 * 3
								 * 
								 * Imperative (command):
								 * Sg		Pl
								 * 
								 * Verbal Adverbs:
								 * PrsAct	PstAct
								 * 
								 * Participles:
								 * PrsAct	PrsPss	PstAct	PstPss
								 * 
								 * Participle table: (if token is participle only)
								 * Like adjective template but without Cmpr
								 */
								if(row == 0 && column == 0){
									// Verb Past Tense
									// header
									verbPastArr[0][0] = "";
									verbPastArr[0][1] = "";
									// first column
									verbPastArr[1][0] = "Msc";
									verbPastArr[2][0] = "Neu";
									verbPastArr[3][0] = "Fem";
									verbPastArr[4][0] = "Pl";
									
									// Verb Non Past Tense (Pres/Fut)
									// header
									verbNoPastArr[0][0] = "Person";
									verbNoPastArr[0][1] = "Sg";
									verbNoPastArr[0][2] = "Pl";
									// first column
									verbNoPastArr[1][0] = "1";
									verbNoPastArr[2][0] = "2";
									verbNoPastArr[3][0] = "3";
									
									// Verb Imperative (command)
									// header
									verbImperativeArr[0][0] = "Sg";
									verbImperativeArr[0][1] = "Pl";
									
									// Verbal Adverbs
									// header
									verbAdverbArr[0][0] = "PrsAct";
									verbAdverbArr[0][1] = "PstAct";
									
									// Participles
									// header
									verbParticipleArr[0][0] = "PrsAct";
									verbParticipleArr[0][1] = "PrsPss";
									verbParticipleArr[0][2] = "PstAct";
									verbParticipleArr[0][3] = "PstPss";
									
									// Participle (if token is participle only)
									if(isParticiple){
										// header
										tableArr[0][0] = "Case";
										tableArr[0][1] = "Msc";
										tableArr[0][2] = "Neu";
										tableArr[0][3] = "Fem";
										tableArr[0][4] = "Pl";
										// first column
										tableArr[1][0] = "Nom";
										tableArr[2][0] = "Acc/Inan";
										tableArr[3][0] = "Acc/Anim";
										tableArr[4][0] = "Gen";
										tableArr[5][0] = "Loc";
										tableArr[6][0] = "Dat";
										tableArr[7][0] = "Ins";										
									}
								}
								

								if(currentTagSequence.contains("+Inf")){
									verbInfinitive = generatedWord;
								}
								else if(tense.equals("Pst")){
									column = 1;
									if(gender.equals("Msc")){
										row = 1;
									}
									else if(gender.equals("Neu")){
										row = 2;
									}
									else if(gender.equals("Fem")){
										row = 3;
									}
									else if(gender.equals("MFN")){
										row = 4;
									}
									
									if(verbPastArr[row][column] == null){ // first/only entry
										verbPastArr[row][column] = generatedWord;
									}
									else{ // n-th entry
										if(!verbPastArr[row][column].contains(generatedWord)){
											verbPastArr[row][column] += "/" + generatedWord;
										}
									}
								}
								else if(tense.equals("Prs") || tense.equals("Fut")){
									if(number.equals("Sg")){
										column = 1;
									}
									else if(number.equals("Pl")){
										column = 2;
									}
									
									
									if(person.equals("1")){
										row = 1;
									}
									else if(person.equals("2")){
										row = 2;
									}
									else if(person.equals("3")){
										row = 3;
									}
									
									if(verbNoPastArr[row][column] == null){ // first/only entry
										verbNoPastArr[row][column] = generatedWord;
									}
									else{ // n-th entry
										if(!verbNoPastArr[row][column].contains(generatedWord)){
											verbNoPastArr[row][column] += "/" + generatedWord;
										}
									}
								}
								else if(tense.equals("Imp")){
									row = 1;
									if(number.equals("Sg")){
										column = 0;
									}
									else if(number.equals("Pl")){
										column = 1;
									}
									if(verbImperativeArr[row][column] == null){ // first/only entry
										verbImperativeArr[row][column] = generatedWord;
									}
									else{ // n-th entry
										if(!verbImperativeArr[row][column].contains(generatedWord)){
											verbImperativeArr[row][column] += "/" + generatedWord;
										}
									}
								}
								// verbal adverbs
								else if(currentTagSequence.contains("+Adv")){
									row = 1;
									if(tenseVoice.equals("PrsAct")){
										column = 0;
									}
									else if(tenseVoice.equals("PstAct")){
										column = 1;
									}
									if(verbAdverbArr[row][column] == null){ // first/only entry
										verbAdverbArr[row][column] = generatedWord;
									}
									else{ // n-th entry
										if(!verbAdverbArr[row][column].contains(generatedWord)){
											verbAdverbArr[row][column] += "/" + generatedWord;
										}
									}
								}
								// participles
								// full participle table
								else if(isParticiple){
									if(gender.equals("Msc")){
										column = 1;
									}
									else if(gender.equals("Neu")){
										column = 2;
									}
									if(gender.equals("Fem")){
										column = 3;
									}
									if(gender.equals("MFN")){
										column = 4;
									}
									
									if(aCase.equals("Nom")){
										row = 1;
									}
									else if(aCase.equals("Acc") && animacy.equals("Inan")){
										row = 2;
									}
									else if(aCase.equals("Acc") && animacy.equals("Anim")){
										row = 3;
									}
									else if(aCase.equals("Acc") && animacy.equals("AnIn")){
										row = 3; // generate entry for row 3
										// and once again for row 2
										if(tableArr[2][column] == null){ // first/only entry
											tableArr[2][column] = generatedWord;
										}
										else{ // n-th entry
											if(!tableArr[2][column].contains(generatedWord)){
												tableArr[2][column] += "/" + generatedWord;
											}
										}
									}
									else if(aCase.equals("Gen")){
										row = 4;
									}
									else if(aCase.equals("Loc")){
										row = 5;
									}
									else if(aCase.equals("Dat")){
										row = 6;
									}
									else if(aCase.equals("Ins")){
										row = 7;									
									}
									// add rows for the cases Pred only if they exist
									else if(aCase.equals("Pred")){
										row = 8;
										if(tableArr[row][0] == null){	
											tableArr[row][0] = "Short";									
										}
									}
									
									if(tableArr[row][column] == null){ // first/only entry
										tableArr[row][column] = generatedWord;
									}
									else{ // n-th entry
										if(!tableArr[row][column].contains(generatedWord)){
											if(currentTagSequence.contains("+Leng")){
												tableArr[row][column] += "<br>(" + generatedWord + ")";
											}
											else{
												tableArr[row][column] += "/" + generatedWord;											
											}
										}
									}
								}
								// partial participle table (+Msc +Sg +Nom only)
								if(!currentTagSequence.contains("+Adv") && !tenseVoice.isEmpty()){
									row = 1;
									if(tenseVoice.equals("PrsAct")){
										column = 0;
									}
									else if(tenseVoice.equals("PrsPss")){
										column = 1;
									}
									else if(tenseVoice.equals("PstAct")){
										column = 2;
									}
									else if(tenseVoice.equals("PstPss")){
										column = 3;
									}
									// only consider the Msc Sg Nom forms
									if(gender.equals("Msc") && number.equals("Sg") && aCase.equals("Nom")){
										if(verbParticipleArr[row][column] == null){ // first/only entry
											verbParticipleArr[row][column] = generatedWord;
										}
										else{ // n-th entry
											if(!verbParticipleArr[row][column].contains(generatedWord)){
												verbParticipleArr[row][column] += "/" + generatedWord;
											}
										}										
									}
								}
							}
						}
					}					
				}
			}

			cg3GeneratorOutputReader.close();

		} catch (UnsupportedEncodingException e1) {
			e1.printStackTrace();
		} catch (FileNotFoundException e1) {
			e1.printStackTrace();
		} catch (IOException e) {
			e.printStackTrace();
		}
	}

	/**
	 * This class represents a mutable integer value, which is especially useful
	 * and fast for counting frequencies inside a map.
	 * 
	 * @author Eduard Schaf
	 *
	 */
	public class MutableInt {
		int value = 1; // note that we start at 1 since we're counting
		/**
		 * Increment the mutable int by one.
		 */
		public void increment () { 
			++value;      
		}
		/**
		 * Get the value of the mutable int.
		 * @return the mutable int value.
		 */
		public int  get () { 
			return value; 
		}
	}

	/**
	 * This class represents a word of two integers
	 * which are begin and end. They are used to store
	 * the offsets of a given Token.
	 * 
	 * @author Eduard Schaf
	 *
	 */
	public class Word {
		private int begin;
		private int end;
		public Word(int begin, int end) {
			this.begin = begin;
			this.end = end;
		}
		public Word() {
			this.begin = 0;
			this.end = 0;
		}
		public int getBegin() {
			return begin;
		}
		public void setBegin(int begin) {
			this.begin = begin;
		}
		public int getEnd() {
			return end;
		}
		public void setEnd(int end) {
			this.end = end;
		}
		@Override
		public String toString() {
			return "Word " + begin + " " + end + "\n";
		}
		@Override
		public int hashCode() {
			final int prime = 31;
			int result = 1;
			result = prime * result + getOuterType().hashCode();
			result = prime * result + begin;
			result = prime * result + end;
			return result;
		}
		@Override
		public boolean equals(Object obj) {
			if (this == obj)
				return true;
			if (obj == null)
				return false;
			if (getClass() != obj.getClass())
				return false;
			Word other = (Word) obj;
			if (!getOuterType().equals(other.getOuterType()))
				return false;
			if (begin != other.begin)
				return false;
			if (end != other.end)
				return false;
			return true;
		}
		private Vislcg3RusAssistiveReadingEnhancer getOuterType() {
			return Vislcg3RusAssistiveReadingEnhancer.this;
		}

	} 

	/**
	 * This class represents a SpanTag consisting out of
	 * the span start tag with possibility to add attributes to the span tag
	 * and the span end tag. It is the span surrounding the
	 * token that is being enhanced.
	 * 
	 * @author Eduard Schaf
	 *
	 */
	public class SpanTag{
		private String spanTagStart;
		private String spanTagEnd;
		public SpanTag(String spanTagStart) {
			this.spanTagStart = spanTagStart;
			this.spanTagEnd = "</span>";
		}
		public String getSpanTagStart() {
			return spanTagStart;
		}
		public void setSpanTagStart(String spanTagStart) {
			this.spanTagStart = spanTagStart;
		}
		public void addAttribute(String attributeName, String attributeValue) {
			this.spanTagStart = this.spanTagStart.replace(">", attributeName + "=\"" + attributeValue + "\">");
		}
		public String getSpanTagEnd() {
			return spanTagEnd;
		}
		public void setSpanTagEnd(String spanTagEnd) {
			this.spanTagEnd = spanTagEnd;
		}


		@Override
		public String toString() {
			return "SpanTag [spanTagStart=" + spanTagStart + ", spanTagEnd=" + spanTagEnd + "]";
		}
		@Override
		public int hashCode() {
			final int prime = 31;
			int result = 1;
			result = prime * result + getOuterType().hashCode();
			result = prime * result
					+ ((spanTagEnd == null) ? 0 : spanTagEnd.hashCode());
			result = prime * result
					+ ((spanTagStart == null) ? 0 : spanTagStart.hashCode());
			return result;
		}
		@Override
		public boolean equals(Object obj) {
			if (this == obj)
				return true;
			if (obj == null)
				return false;
			if (getClass() != obj.getClass())
				return false;
			SpanTag other = (SpanTag) obj;
			if (!getOuterType().equals(other.getOuterType()))
				return false;
			if (spanTagEnd == null) {
				if (other.spanTagEnd != null)
					return false;
			} else if (!spanTagEnd.equals(other.spanTagEnd))
				return false;
			if (spanTagStart == null) {
				if (other.spanTagStart != null)
					return false;
			} else if (!spanTagStart.equals(other.spanTagStart))
				return false;
			return true;
		}
		private Vislcg3RusAssistiveReadingEnhancer getOuterType() {
			return Vislcg3RusAssistiveReadingEnhancer.this;
		}

	}

}

