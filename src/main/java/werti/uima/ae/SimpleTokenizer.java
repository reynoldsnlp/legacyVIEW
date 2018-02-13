package werti.uima.ae;

import java.util.Iterator;

import org.apache.log4j.Logger;

import org.apache.uima.analysis_component.JCasAnnotator_ImplBase;

import org.apache.uima.cas.FSIndex;

import org.apache.uima.jcas.JCas;

import werti.uima.types.annot.RelevantText;
import werti.uima.types.annot.Token;
import werti.util.CasUtils;

/**
 * A very simple but fast tokenizer.
 *
 * You should probably use the Lingpipe tokenizer instead.
 *
 * @author Aleksandar Dimitrov
 * @version 0.1
 */
public class SimpleTokenizer extends JCasAnnotator_ImplBase {
	private static final Logger log =
		Logger.getLogger(SimpleTokenizer.class);

	/**
	 * Go through all relevant text areas in the RelevantText-AnnotationIndex and annotate them
	 * with Token-Annotations.
	 *
	 * We only set the CAS-relative Begin and End, but also set the Word-Property of Token for now. This may
	 * change in the future for efficiency reasons.
	 *
	 * @param cas The document's CAS
	 */
	@Override
	@SuppressWarnings("unchecked")
	public void process(JCas cas) {
		// stop processing if the client has requested it
		if (!CasUtils.isValid(cas)) {
			return;
		}
		
		log.debug("Starting tokenization process.");
		final FSIndex textIndex = cas.getAnnotationIndex(RelevantText.type);
		final Iterator<RelevantText> tit = textIndex.iterator();

		while (tit.hasNext()) {
			final RelevantText rt = tit.next();
			final char[] span = rt.getCoveredText().toLowerCase().toCharArray();

			// global and local skews
			final int gskew = rt.getBegin();
			int lskew = gskew;

			// note that we guarantee a length of 1 in the GenericRelevanceAnnotator
			for (int i = 1; i < span.length; i++) {
				if ((Character.getType(span[i]) != Character.getType(span[i-1]))
				||   Character.getType(span[i]) == Character.DIRECTIONALITY_WHITESPACE
				||   span[i] == '.') {
					final Token t = new Token(cas);
					t.setBegin(lskew);
					t.setEnd((lskew = gskew + i));
					t.addToIndexes();
				}
			}
		}
		log.debug("Finished tokenization process.");
	}
}
