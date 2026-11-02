package org.folio.reader;
import org.junit.Test;
import org.junit.Rule;
import org.junit.rules.TemporaryFolder;
import java.io.*;
import java.util.*;
import static org.junit.Assert.*;
public class NeuralInstallTest {
 @Rule public TemporaryFolder temp=new TemporaryFolder();
 @Test public void installsActualBundledFaberWithoutNetwork() throws Exception {
  File archive=new File("src/main/assets/neural-models/vits-piper-pt_BR-faber-medium.tar.bz2");
  assertTrue("Run prepare-voice-assets.py before native tests",archive.isFile());
  NeuralVoiceModels models=new NeuralVoiceModels(temp.newFolder(),name -> {if(!name.equals(NeuralVoiceModels.assetPath(NeuralVoiceModels.MODELS[0])))throw new FileNotFoundException();return new FileInputStream(archive);});
  NeuralVoiceModels.Model faber=NeuralVoiceModels.MODELS[0];
  assertTrue(models.bundled(faber));assertFalse(models.installed(faber));
  List<Integer> progress=new ArrayList<>();models.download(faber,progress::add);
  assertTrue(models.installed(faber));assertTrue(models.modelFile(faber).length()>1_000_000);assertEquals(Integer.valueOf(100),progress.get(progress.size()-1));
  models.download(faber,n -> fail("Installed model should not be reinstalled"));
 }
 @Test public void rejectsCorruptBundledArchiveWithoutMarkingInstalled() throws Exception {
  File root=temp.newFolder();NeuralVoiceModels models=new NeuralVoiceModels(root,name -> new ByteArrayInputStream(new byte[]{1,2,3}));
  try{models.download(NeuralVoiceModels.MODELS[0],n -> {});fail("Accepted corrupt model");}catch(IOException expected){assertTrue(expected.getMessage().contains("verificação"));}
  assertFalse(models.installed(NeuralVoiceModels.MODELS[0]));assertEquals(0,root.list().length);
 }
 @Test public void rejectsArchivePathTraversal() throws Exception {
  File root=temp.newFolder();for(String path:new String[]{"../escape","/tmp/escape","a/../../escape","a\\b"}) {
   try{NeuralVoiceModels.safeEntry(root,path);fail("Accepted unsafe entry");}catch(IOException expected){}
  }
 }
}
