package werti.uima.enhancer;

import java.io.BufferedReader;
import java.io.BufferedWriter;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileNotFoundException;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStreamReader;
import java.io.ObjectInputStream;
import java.io.OutputStreamWriter;
import java.io.UnsupportedEncodingException;
import java.io.Writer;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
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
 * In this case the topic is Russian participles, use the patterns
 * in the method process() to extract the correct tokens for enhancement.
 * 
 * @author Niels Ott
 * @author Adriane Boyd
 * @author Heli Uibo
 * @author Eduard Schaf
 *
 */
public class Vislcg3RusParticipleEnhancer extends JCasAnnotator_ImplBase {

	private static final Logger log =
		Logger.getLogger(Vislcg3RusVerbImperfectiveEnhancer.class);
	private static final Logger rusNLPLog = Logger.getLogger("rusNLPLogger");
	

//    private final String hfstOptLookupLoc = "/usr/local/bin/hfst-optimized-lookup";                   
//  private final String lookupFlags = "-q"; // was -flags mbTT -utf8 / flags are not possible for the jar   
	private final String loadJar = "java -jar";
	private final String jarOptLookupLoc = "./rus_resources/hfst-ol.jar";
	private final String invertedOptHfstLoc = "./rus_resources/generator-gt-desc.ohfst";
    
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
		log.info("Starting Participle enhancement "+enhancement_type+".");

		long generatingDistractorsTotalTime = 0;

		final long startTime = System.currentTimeMillis();
		
		// FSTUPDATE: The patterns target FST features to find or exclude specific readings

		Pattern posPattern = Pattern.compile("V\\+");
		Pattern aspectPattern = Pattern.compile("Impf|Perf");
		Pattern presentTenseVoicePattern = Pattern.compile("PrsAct|PrsPss");
		Pattern pastTenseVoicePattern = Pattern.compile("PstAct|PstPss");
		// Note that the whole token will be excluded, even when one reading is valid
		// exclude tokens with readings that have a nouns, adjectives, determiner, 
		// prepositions, predicates or adverbials reading among all readings
		Pattern excludePattern = Pattern.compile("\\+N\\+|A\\+|Det|Pr$|Pred|Adv");
		
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
		
		boolean isMcActivity = enhancement_type.equals("mc");
		
		boolean isClozeActivity = enhancement_type.equals("cloze");
		
		Map<String, List<String>> imperfectiveToPerfectiveVerbMap = loadMapKryo("imperfectiveToPerfectiveVerbMap");
		Map<String, List<String>> perfectiveToImperfectiveVerbMap = loadMapKryo("perfectiveToImperfectiveVerbMap");
		
		
		try {
			Writer cg3GeneratorInputWriter = new BufferedWriter(new OutputStreamWriter(new FileOutputStream(cg3GeneratorInputFileLoc), "UTF-8"));

			// go through tokens
			while (cgTokenIter.hasNext()) {
				CGToken cgt = (CGToken) cgTokenIter.next();
				
				String surfaceForm = cgt.getCoveredText();

				boolean isValidReading = false;
				String reading_str = "";
				String lemma = "";
//				log.info("Starting target selection for the word = " + surfaceForm);
				// select from all readings the first occurrence that is matching pos and aspect
				for(int i = 0; i < cgt.getReadings().size(); i++){
					CGReading currentReading = cgt.getReadings(i);
					//log.info("This is the lemma =" +reading.getHead());
					StringListIterable readingIterator = new StringListIterable(currentReading);
					String currentReadingString = "";
					for (String rtag : readingIterator) {
						currentReadingString += "+" + rtag;
					}
					//log.info("The current reading string is=" + currentReadingString);
					// don't consider readings that match the exclude pattern, to filter out unlikely readings
					// (e.g. "и" is a CC in almost all cases, the probability that it is a N is very low)
					Matcher excludeMatcher = excludePattern.matcher(currentReadingString);
					if(excludeMatcher.find()){
						// FSTUPDATE: predicates are only allowed for colorize and click
						// allow predicates unless its the mc or cloze activity
						if(currentReadingString.contains("Pred")){
							if(isMcActivity || isClozeActivity){								
//								log.info("This readings won't be considered=" + currentReadingString + " because of = " + excludeMatcher.group());
								isValidReading = false;
								break;								
							}
						}
						// allow nothing else
						else {							
//							log.info("This readings won't be considered=" + currentReadingString + " because of = " + excludeMatcher.group());
							isValidReading = false;
							break;
						}
					}
					if(!isValidReading){
						Matcher posMatcher = posPattern.matcher(currentReadingString);
						Matcher aspectMatcher = aspectPattern.matcher(currentReadingString);
						if(posMatcher.find() && aspectMatcher.find()){
							String aspect = aspectMatcher.group();
							// FSTUPDATE: no intransitive verbs
							// don't select intransitive verbs
							if(currentReadingString.contains("IV")){
//								log.info("This reading won't be selected=" + currentReadingString + " because it's an intransitive verb (IV)");
								continue;
							}
							// FSTUPDATE: select the participle by finding the correct tense and voice
							// for a given aspect
							// imperfective aspect case
							if(aspect.equals("Impf")){
//								log.info("This reading has imperfective aspect=" +currentReadingString);
								Matcher presentTenseVoiceMatcher = presentTenseVoicePattern.matcher(currentReadingString);
								if(presentTenseVoiceMatcher.find()){
									isValidReading = true;
								}
							}
							// perfective aspect case
							else{
//								log.info("This reading has perfective aspect=" +currentReadingString);
								Matcher pastTenseVoiceMatcher = pastTenseVoicePattern.matcher(currentReadingString);
								if(pastTenseVoiceMatcher.find()){
									isValidReading = true;
								}
							}
						}
						if(isValidReading){
							// remove the first "+" and quotes
							reading_str = currentReadingString.substring(1).replace("\"", ""); 
							// the lemma is the first element of the reading string
							lemma = reading_str.split("\\+")[0];
//							log.info("This reading can be considered=" +currentReadingString);
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
					String distractors = "";
					String rephraseForms = "";

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
					
					wordToSpanMap.put(word, spanTag);
					
					if (isMcActivity) {
						// generate the distractors, with the reading_str (needed for the form generator)
						distractors = createMorphologicalForms(reading_str, lemma, imperfectiveToPerfectiveVerbMap, perfectiveToImperfectiveVerbMap);
						if(!distractors.isEmpty()){
							cg3GeneratorInputWriter.write(reading_str + "\n");
							cg3GeneratorInputWriter.write("ñôŃßĘńŠēCORRECTFORM\n");
							cg3GeneratorInputWriter.write(distractors);
							// write the end marker of the current distractors
							cg3GeneratorInputWriter.write("ñôŃßĘńŠēDISTRACTORS\n");
							// generate the relative pronoun and verb for the rephrase given the reading_str and lemma
							rephraseForms = createRephrase(reading_str, lemma);
							cg3GeneratorInputWriter.write(rephraseForms);
							// write the end marker of the current rephrase forms
							cg3GeneratorInputWriter.write("ñôŃßĘńŠēREPHRASE\n");
							// write the word to the file in order to assign the correct distractors to the correct span
							cg3GeneratorInputWriter.write(word.toString());							
						}
					} 
					else if(isClozeActivity){
						cg3GeneratorInputWriter.write(reading_str + "\n");
						cg3GeneratorInputWriter.write("ñôŃßĘńŠēCORRECTFORM\n");
						// generate the relative pronoun and verb for the rephrase given the reading_str and lemma
						rephraseForms = createRephrase(reading_str, lemma);
						cg3GeneratorInputWriter.write(rephraseForms);
						// write the end marker of the current rephrase forms
						cg3GeneratorInputWriter.write("ñôŃßĘńŠēREPHRASE\n");
						// write the word to the file in order to assign the correct form to the correct span
						cg3GeneratorInputWriter.write(word.toString());
					}
					else{						
						//log.info("This is the cgt=" + cgt.getCoveredText() + " B="+ word.getBegin() + " E=" + word.getEnd());
						
						// make new enhancement, pass it to the cas
						Enhancement e = new Enhancement(cas);
						e.setRelevant(true);
						e.setBegin(word.getBegin());
						e.setEnd(word.getEnd());
						e.setEnhanceStart(spanTag.getSpanTagStart());					
						e.setEnhanceEnd(spanTag.getSpanTagEnd());
						// update CAS
						cas.addFsToIndexes(e);
						//log.info("Enhancement="+e); // testing
					}
				}
			}
			
			cg3GeneratorInputWriter.close();
			
			if(isMcActivity || isClozeActivity){
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
			}
			
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
		
		log.info("Finished Verb imperfective enhancement.");
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
    private String createMorphologicalForms(String reading_str, String lemma, Map<String, List<String>> imperfectiveToPerfectiveVerbMap, Map<String, List<String>> perfectiveToImperfectiveVerbMap) {
    	
    	//log.info("This is the current reading =" + reading_str);
    	
    	// FSTUPDATE: This method creates distractors, thus possible FST readings need
    	// to be constructed here
    	
    	// remove superscript characters from the lemma 
    	String preprocessedLemma = lemma.replaceAll("[¹²³⁴⁵⁶⁷⁸⁹⁰]", "");
        
        String generationInput = "";
    	
    	String otherOption = "";
          
        // imperfective case
        if(reading_str.contains("Impf")){        	
        	// construct the verb aspect pair
        	if(imperfectiveToPerfectiveVerbMap.containsKey(preprocessedLemma)){
        		String perfectiveForms = "";
        		// change the imperfective lemma to the perfective ones
        		List<String> perfectiveVerbList = imperfectiveToPerfectiveVerbMap.get(preprocessedLemma);
        		// only target unique aspectual counterparts
        		if(perfectiveVerbList.size() == 1){
                	// add the unchanged reading_str
                	generationInput += reading_str + "\n";
                	
                	// generate the other option, depending on the voice
                	if(reading_str.contains("PrsAct")){
                		otherOption = reading_str.replace("PrsAct", "PrsPss");
                	}
                	else{
                    	otherOption = reading_str.replace("PrsPss", "PrsAct");                		
                	}
                	
                	// add the other option to the generation input
                	generationInput += otherOption + "\n";
                	
            		for(String perfectiveVerb: perfectiveVerbList){
                    	perfectiveForms += generationInput.replace(lemma, perfectiveVerb);
            		}
            		// change the tense from present to past and the aspect from imperfect to perfect
            		perfectiveForms = perfectiveForms.replace("PrsAct", "PstAct").replace("PrsPss", "PstPss").replace("Impf", "Perf");
            		// add the perfective forms to the generation input
                	generationInput += perfectiveForms;        			
        		}
        	}        	
        }
        // perfective case
        else {     	
        	// construct the verb aspect pair
        	if(perfectiveToImperfectiveVerbMap.containsKey(preprocessedLemma)){            	
        		String imperfectiveForms = "";
        		// change the perfective lemma to the imperfective ones
        		List<String> imperfectiveVerbList = perfectiveToImperfectiveVerbMap.get(preprocessedLemma);
        		// only target unique aspectual counterparts
        		if(imperfectiveVerbList.size() == 1){
                	// add the unchanged reading_str
                	generationInput += reading_str + "\n";
                	
                	// generate the other option, depending on the voice
                	if(reading_str.contains("PstAct")){
                		otherOption = reading_str.replace("PstAct", "PstPss");
                	}
                	else{
                    	otherOption = reading_str.replace("PstPss", "PstAct");                		
                	}
                	
                	// add the other option to the generation input
                	generationInput += otherOption + "\n";   
                	
	        		for(String imperfectiveVerb: imperfectiveVerbList){
	                	imperfectiveForms += generationInput.replace(lemma, imperfectiveVerb);
	        		}
	        		// change the tense from past to present and the aspect from perfect to imperfect
	        		imperfectiveForms = imperfectiveForms.replace("PstAct", "PrsAct").replace("PstPss", "PrsPss").replace("Perf", "Impf");
	        		// add the perfective forms to the generation input
	            	generationInput += imperfectiveForms;
        		}
        	}
        }
        
//        log.info("This are all distractors =" + generationInput);
        
        return generationInput;
    }
    
    private String createRephrase(String reading_str, String lemma){
    	
//    	log.info("This is the current reading =" + reading_str);
    	
    	// FSTUPDATE: the rephrasing is constructed using FST features

    	Pattern genderPattern = Pattern.compile("Msc|Fem|Neu|MFN");
    	Pattern animacyPattern = Pattern.compile("AnIn|Inan|Anim");
    	Pattern numberPattern = Pattern.compile("Sg|Pl");
    	Pattern tenseActiveVoicePattern = Pattern.compile("(Prs|Pst)Act");
		Pattern tensePassiveVoicePattern = Pattern.compile("(Prs|Pst)Pss");
    	
    	Matcher genderMatcher = genderPattern.matcher(reading_str);
    	Matcher animacyMatcher = animacyPattern.matcher(reading_str);
		Matcher numberMatcher = numberPattern.matcher(reading_str);
		Matcher tenseActiveVoiceMatcher = tenseActiveVoicePattern.matcher(reading_str);
		Matcher tensePassiveVoiceMatcher = tensePassiveVoicePattern.matcher(reading_str);
		
    	String tense = "";
    	String gender = "";
    	String animacy = "";
    	String number = "";
    	if(genderMatcher.find()){
        	gender = genderMatcher.group();    		
    	}
    	if(animacyMatcher.find()){
    		animacy = animacyMatcher.group();    		
    	}
    	if(numberMatcher.find()){
        	number = numberMatcher.group();    		
    	}
    	
    	String relPron = "который+Pron+Rel+" + gender + "+" + animacy + "+" + number;
    	String verb = lemma+"+V";
    	
    	String rephraseForms = "";    	
    	
		// active voice
		if(tenseActiveVoiceMatcher.find()){
			relPron += "+Nom";
			rephraseForms += relPron + "\n";
			tense = tenseActiveVoiceMatcher.group(1);
			// present active participle
			if(tense.equals("Prs")){
				verb += "+Impf+TV+" + tense + "+" + number + "3";
			}
			// past active participle
			else {
				verb += "+Perf+TV+" + tense + "+" + gender + "+" + number;
			}
		}
		// passive voice
		else if(tensePassiveVoiceMatcher.find()){
			relPron += "+Acc";
			// create both animacy forms, because there is no reliable way to distinguish this forms
			rephraseForms += relPron.replace(animacy, "Anim") + "\n";
			rephraseForms += relPron.replace(animacy, "Inan") + "\n";
			tense = tensePassiveVoiceMatcher.group(1);
//			log.info("tense (passive) =" + tense);
			// present passive participle
			if(tense.equals("Prs")){
				verb += "+Impf+TV+" + tense + "+Pl3";
			}
			// past passive participle
			else {
				verb += "+Perf+TV+" + tense + "+MFN+Pl";
			}
		}
		
		// construct the rephrase forms
		rephraseForms += verb + "\n";
		
//		log.info("rephraseForms="+rephraseForms);
    	
		return rephraseForms;
    }
    
    /*
     * The output file from the generator is used to create distractors and is placed into the right place in the span tag.
     * Afterwards an enhancement with the span tag is created and passed to the cas.
     */
    private void generateSpanTagWithDistractors(JCas cas, String cg3GeneratorOutputFileLoc, Map<Word, SpanTag> wordToSpanMap){
		try {
			BufferedReader cg3GeneratorOutputReader = new BufferedReader(new InputStreamReader(new FileInputStream(cg3GeneratorOutputFileLoc), "UTF8"));
		
			String generatorOutput = "";
			
			Word currentWord = new Word();
			String distractforms = "";
			
			String rephraseForms = "";
			
			String correctForm = "";
			
			while (cg3GeneratorOutputReader.ready()) {
				String line = cg3GeneratorOutputReader.readLine().trim();
				if(line.isEmpty()){
					continue;
				}
				// generator output was processed, all distractors are created
				// assign the distractors to the correct span from the wordToSpanMap
				// don't enhance tokens, which has no (or one) distractor forms
				else if(line.startsWith("Word")){
					// only enhance tokens with more than one distractor form
					if(!distractforms.isEmpty()){
						String[] lineParts = line.split("\\s");
						int begin = Integer.parseInt(lineParts[1]);
						int end = Integer.parseInt(lineParts[2]);
						currentWord = new Word(begin, end);
						SpanTag spanTag = wordToSpanMap.get(currentWord);
						spanTag.addAttribute("distractors", distractforms);
						spanTag.addAttribute("correctForm", correctForm);
//						log.info("distractforms="+distractforms);
						if(!rephraseForms.isEmpty()){
							String[] rephraseParts = rephraseForms.split("\\s");
							// if both который forms exist, then put a "/" in between those forms
							if(rephraseParts.length == 3){
								rephraseForms = rephraseParts[0] + "/" + rephraseParts[1] + " " + rephraseParts[2];
							}
							spanTag.addAttribute("rephrase", rephraseForms);
//							log.info("rephraseForms="+rephraseForms);
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
					}
					// the practice activity has only rephrases, no distractors
					else if(WERTiServlet.enhancement_type.equals("cloze") && !rephraseForms.isEmpty() && !correctForm.isEmpty()){
						String[] lineParts = line.split("\\s");
						int begin = Integer.parseInt(lineParts[1]);
						int end = Integer.parseInt(lineParts[2]);
						currentWord = new Word(begin, end);
						SpanTag spanTag = wordToSpanMap.get(currentWord);
						spanTag.addAttribute("correctForm", correctForm);
						String[] rephraseParts = rephraseForms.split("\\s");
						// if both который forms exist, then put a "/" in between those forms
						if(rephraseParts.length == 3){
							rephraseForms = rephraseParts[0] + "/" + rephraseParts[1] + " " + rephraseParts[2];
						}
						spanTag.addAttribute("rephrase", rephraseForms);
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
					}
				}
				// the marker (ñôŃßĘńŠēCORRECTFORM) was found, begin to process the generator output, create the correct form
				else if(line.contains("ñôŃßĘńŠēCORRECTFORM")){
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
				// the marker (ñôŃßĘńŠēDISTRACTORS) was found, begin to process the generator output, create distractors
				else if(line.contains("ñôŃßĘńŠēDISTRACTORS")){
					StringTokenizer tok = new StringTokenizer(generatorOutput);
					generatorOutput = "";
					String word = "";
					distractforms = "";
					// the distractorsSet's purpose is to filter out duplicates
					HashSet<String> distractorsSet = new HashSet<String>();
					while (tok.hasMoreTokens()) {
						word = tok.nextToken();
						//log.info("ifst output:"+word);
						// forms that could not be generated are excluded, as well as input strings of the iFST
						if (!word.contains("+") && !word.contains("-") && distractorsSet.add(word)) {  
							distractforms += word + " ";
						}
						else{
							//log.info("Word that was excluded = " + word);
						}
					}
					// remove the whitespace at the end
					distractforms = distractforms.trim();
					// exclude the distractor if its only one, you need at least 2 distractors for mc
					if(distractorsSet.size() < 2) {
						distractforms = "";
					}
					else {
						//log.info("This are the chosen distractforms="+distractforms);
					}
				}
				// the marker (ñôŃßĘńŠēREPHRASE) was found, begin to process the generator output, create rephrase forms
				else if(line.contains("ñôŃßĘńŠēREPHRASE")){
					StringTokenizer tok = new StringTokenizer(generatorOutput);
					generatorOutput = "";
					String word = "";
					rephraseForms = "";
					while (tok.hasMoreTokens()) {
						word = tok.nextToken();
						//log.info("ifst output:"+word);
						// forms that could not be generated are excluded, as well as input strings of the iFST
						if (!word.contains("+") && !word.contains("-")) {  
							rephraseForms += word + " ";
						}
						else{
							//log.info("Word that was excluded = " + word);
						}
					}
					// remove the whitespace at the end
					rephraseForms = rephraseForms.trim();
				}
				// the generator output for the current token is not fully extracted from the file yet
				else{
					generatorOutput += line + " ";	
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
		private Vislcg3RusParticipleEnhancer getOuterType() {
			return Vislcg3RusParticipleEnhancer.this;
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
		private Vislcg3RusParticipleEnhancer getOuterType() {
			return Vislcg3RusParticipleEnhancer.this;
		}
    	
    }
    	
}

