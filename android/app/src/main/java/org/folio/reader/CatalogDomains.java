package org.folio.reader;

import okhttp3.HttpUrl;
import java.util.Arrays;
import java.util.List;
import java.util.Set;

/** Only the alternative domains listed by the catalog itself may be interchanged. */
final class CatalogDomains {
    static final String DEFAULT_URL="https://annas-archive.gd";
    static final List<String> HOSTS=Arrays.asList("annas-archive.gd","annas-archive.pk","annas-archive.gl");
    static boolean official(HttpUrl url) {return url.isHttps() && url.port()==443 && HOSTS.contains(url.host()) && url.encodedUsername().isEmpty() && url.encodedPassword().isEmpty();}
    static boolean compatible(HttpUrl a,HttpUrl b) {return FolioPlugin.sameOrigin(a,b) || (official(a) && official(b));}
    static HttpUrl next(HttpUrl current,Set<String> attempted) {
        if(!official(current))return null;
        for(int i=1;i<=HOSTS.size();i++) {String host=HOSTS.get((HOSTS.indexOf(current.host())+i)%HOSTS.size());if(!host.equals(current.host()) && !attempted.contains(host))return current.newBuilder().host(host).build();}
        return null;
    }
}
