

/* First created by JCasGen Thu Sep 15 18:49:35 CEST 2016 */
package werti.uima.types.annot;

import org.apache.uima.jcas.JCas; 
import org.apache.uima.jcas.JCasRegistry;
import org.apache.uima.jcas.cas.TOP_Type;

import org.apache.uima.jcas.cas.NonEmptyStringList;


/** A reading in a constraint grammar cohort.
 * Updated by JCasGen Thu Sep 15 18:49:35 CEST 2016
 * XML source: /home/ruskonteaksta/EduardVIEW/desc/vislcg3TypeSystem.xml
 * @generated */
public class CGReading extends NonEmptyStringList {
  /** @generated
   * @ordered 
   */
  public final static int typeIndexID = JCasRegistry.register(CGReading.class);
  /** @generated
   * @ordered 
   */
  public final static int type = typeIndexID;
  /** @generated  */
  public              int getTypeIndexID() {return typeIndexID;}
 
  /** Never called.  Disable default constructor
   * @generated */
  protected CGReading() {}
    
  /** Internal - constructor used by generator 
   * @generated */
  public CGReading(int addr, TOP_Type type) {
    super(addr, type);
    readObject();
  }
  
  /** @generated */
  public CGReading(JCas jcas) {
    super(jcas);
    readObject();   
  } 

  /** <!-- begin-user-doc -->
    * Write your own initialization here
    * <!-- end-user-doc -->
  @generated modifiable */
  private void readObject() {}
     
}

    