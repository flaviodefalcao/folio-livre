package org.folio.reader;
import okhttp3.HttpUrl;
import org.json.JSONObject;
import org.junit.Test;
import static org.junit.Assert.*;
public class FreeCatalogTest {
 @Test public void parserExposesOnlyFreeOptions() throws Exception {
  String hash="0123456789abcdef0123456789abcdef";
  String html="<div id='md5-panel-downloads'><a class='js-download-link' href='/fast_download/"+hash+"/0/0'>Fast download</a><a class='js-download-link' href='/slow_download/"+hash+"/0/0'>Slow download</a><a class='js-download-link' href='https://example.org/book.epub'>EPUB</a><a class='js-download-link' href='/account'>Members only</a><a class='js-download-link' href='http://example.org/insecure.epub'>Insecure</a></div>";
  JSONObject parsed=CatalogDownloads.parse(html,HttpUrl.get("https://annas-archive.gl/md5/"+hash),200);
  assertEquals(2,parsed.getJSONArray("options").length());
  assertEquals("page",parsed.getJSONArray("options").getJSONObject(0).getString("kind"));
  assertEquals("direct",parsed.getJSONArray("options").getJSONObject(1).getString("kind"));
 }
 @Test public void preservesVerificationChallenges() throws Exception {
  assertTrue(CatalogDownloads.parse("<title>Just a moment...</title>",HttpUrl.get("https://annas-archive.gl/md5/0123456789abcdef0123456789abcdef"),403).getBoolean("challenge"));
 }
 @Test public void normalBookTitleIsNotAChallenge() {assertFalse(CatalogDownloads.challenge("<title>Book catalogue</title><main>A book about Cloudflare</main>",200));}
 @Test public void rejectsNonHttpsAndCredentialBearingUrls() throws Exception {
  for(String url:new String[]{"http://example.org/book.epub","https://reader:password@example.org/book.epub","file:///tmp/book.epub"}){try{FolioPlugin.httpsURL(url);fail("Accepted invalid URL");}catch(FolioPlugin.UserError expected){}}
 }
 @Test public void nativeInterfaceDoesNotExposeRemovedServices() {
  for(java.lang.reflect.Method method:FolioPlugin.class.getDeclaredMethods())assertFalse(method.getName().matches("chat|identifyBooks|downloadAnna|openRecommendations|recommendationsFeed|configureDailyCuration|readSecret"));
 }
}
