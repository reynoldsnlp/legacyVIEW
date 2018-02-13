package werti.uima.ae;

import java.util.Iterator;
import java.util.regex.Pattern;

import org.apache.log4j.Logger;
import org.apache.uima.analysis_component.JCasAnnotator_ImplBase;
import org.apache.uima.analysis_engine.AnalysisEngineProcessException;
import org.apache.uima.cas.text.AnnotationIndex;
import org.apache.uima.jcas.JCas;

import werti.uima.types.annot.PlainTextSentenceAnnotation;
import werti.uima.types.annot.RelevantText;
import werti.uima.types.annot.SentenceAnnotation;
import werti.util.CasUtils;

/**
 * Dummy AE that converts all PlainTextSentenceAnnotation into
 * SentenceAnnotation and breaks sentences on HTML list tags
 * 
 * @author Marion Zepf
 */
public class DummyHTMLSentenceAnnotator extends JCasAnnotator_ImplBase {

    private static final Logger log = Logger
            .getLogger(DummyHTMLSentenceAnnotator.class);

    // HTML tags that typically indicate sentence breaks, but not necessarily
    // a shift in content type
    private static Pattern htmlBreakPattern = Pattern.compile(
            ".*(<li|</li>|<ul|</ul>|<ol|</ol>).*", Pattern.DOTALL);

    @SuppressWarnings("unchecked")
    @Override
    public void process(JCas jcas) throws AnalysisEngineProcessException {
        // stop processing if the client has requested it
        if (!CasUtils.isValid(jcas)) {
            return;
        }

        log.debug("Starting dummy HTML sentence detection");
        final AnnotationIndex sentIndex = jcas
                .getAnnotationIndex(PlainTextSentenceAnnotation.type);
        final AnnotationIndex rtIndex = jcas
                .getAnnotationIndex(RelevantText.type);

        final Iterator<PlainTextSentenceAnnotation> sit = sentIndex.iterator();

        while (sit.hasNext()) {
            final PlainTextSentenceAnnotation s = sit.next();
            final Iterator<RelevantText> rtit = rtIndex.subiterator(s, true,
                    false);

            int prevRTEnd = 0; // end of previous text span in the loop
            int currentSentStart = -1; // start of current new sentence under
            // consideration
            // (may span multiple text segments)
            int lastAddedSentEnd = -1; // end of last sentence added
            PlainTextSentenceAnnotation lastS = null;
            while (rtit.hasNext()) {
                final RelevantText t = rtit.next();

                // initialize in first loop
                if (currentSentStart == -1) {
                    currentSentStart = t.getBegin();
                    prevRTEnd = s.getBegin();
                }

                // if a sentence boundary was not just added but any of the
                // HTML tags in the pattern appear between the previous rt span
                // and
                // the current one, insert a sentence boundary
                if (currentSentStart != t.getBegin()
                        && htmlBreakPattern.matcher(
                                jcas.getDocumentText()
                                        .substring(prevRTEnd, t.getBegin())
                                        .toLowerCase()).matches()) {
                    SentenceAnnotation sentence = new SentenceAnnotation(jcas,
                            currentSentStart, prevRTEnd);
                    sentence.addToIndexes();
                    currentSentStart = t.getBegin();
                    lastAddedSentEnd = prevRTEnd;
                }

                prevRTEnd = t.getEnd();
                lastS = s;
            }

            // if no sentences were added (because the whole sentence
            // corresponded to a single RelevantText span or all spans were
            // of the same type), add the whole original plain text sentence
            // as a sentence
            if (lastAddedSentEnd == -1) {
                SentenceAnnotation sentence = new SentenceAnnotation(jcas,
                        s.getBegin(), s.getEnd());
                sentence.addToIndexes();
                // add the last sentence if needed
            } else if (lastS != null && lastAddedSentEnd != lastS.getEnd()) {
                SentenceAnnotation sentence = new SentenceAnnotation(jcas,
                        currentSentStart, lastS.getEnd());
                sentence.addToIndexes();
            }
        }

        log.debug("Finished dummy HTML sentence detection");
    }
}
