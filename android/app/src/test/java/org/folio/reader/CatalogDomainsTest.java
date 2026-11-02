package org.folio.reader;
import org.junit.Test;
import okhttp3.HttpUrl;
import java.util.HashSet;
import java.util.Set;
import static org.junit.Assert.*;
public class CatalogDomainsTest {
 @Test public void fallbackPreservesTheSearchAndTriesEachOfficialDomainOnce() {
  HttpUrl url=HttpUrl.get("https://annas-archive.gd/search?q=Machado&ext=epub&page=2");Set<String> seen=new HashSet<>();seen.add(url.host());
  HttpUrl next=CatalogDomains.next(url,seen);assertEquals("annas-archive.pk",next.host());assertEquals(url.encodedPath(),next.encodedPath());assertEquals(url.encodedQuery(),next.encodedQuery());seen.add(next.host());
  next=CatalogDomains.next(next,seen);assertEquals("annas-archive.gl",next.host());seen.add(next.host());assertNull(CatalogDomains.next(next,seen));
 }
 @Test public void customOriginsAndLookalikeDomainsDoNotReceiveAutomaticFallback() {
  for(String host:new String[]{"example.org","annas-archive.gd.example.org","evil-annas-archive.gd"})assertNull(CatalogDomains.next(HttpUrl.get("https://"+host+"/search"),new HashSet<>()));
 }
 @Test public void trustedMirrorRedirectsWorkWithoutAllowingArbitraryOrigins() throws Exception {
  HttpUrl gd=HttpUrl.get("https://annas-archive.gd/search");assertEquals("annas-archive.pk",FolioPlugin.catalogLink(gd,"https://annas-archive.pk/md5/0123456789abcdef0123456789abcdef").host());
  try{FolioPlugin.catalogLink(gd,"https://example.org/search");fail("Accepted unrelated host");}catch(FolioPlugin.UserError expected){}
 }
}
