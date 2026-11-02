package org.folio.reader;

import java.util.HashSet;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import okhttp3.HttpUrl;
import org.json.JSONArray;
import org.json.JSONObject;
import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.jsoup.nodes.Element;

final class CatalogDownloads {
    static JSONObject parse(String html, HttpUrl page, int status) throws Exception {
        JSONObject result = new JSONObject().put("options", new JSONArray()).put("sourceUrl", page.toString());
        if (challenge(html, status)) return result.put("challenge", true).put("error", "O site pediu uma verificação para mostrar os links.");
        if (status != 200) return result.put("error", "Os links não carregaram. Você pode abrir a página do livro dentro do app.");
        Document doc = Jsoup.parse(html, page.toString());
        if (doc.selectFirst("#md5-panel-downloads") == null) return result.put("error", "A página ainda não mostrou os links de download.");
        JSONArray options = new JSONArray(); HashSet<String> seen = new HashSet<>();
        for (Element link : doc.select("#md5-panel-downloads a.js-download-link[href]")) {
            HttpUrl url;
            try { HttpUrl resolved = page.resolve(link.attr("href")); if (resolved == null) continue; url = FolioPlugin.httpsURL(resolved.toString()); } catch (FolioPlugin.UserError invalid) { continue; }
            if (!seen.add(url.toString())) continue;
            String label = link.text().trim(); if (label.isEmpty()) label = url.host(); if (label.length() > 180) label = label.substring(0, 180);
            JSONObject option = new JSONObject().put("id", "link-" + options.length()).put("label", label).put("url", url.toString()).put("kind", "page");
            if (!isFreeLink(url, label)) continue;
            if (url.encodedPath().toLowerCase(java.util.Locale.ROOT).endsWith(".epub")) option.put("kind", "direct");
            options.put(option); if (options.length() >= 30) break;
        }
        return result.put("options", options);
    }
    static boolean isFreeLink(HttpUrl url, String label) {
        String path=url.encodedPath().toLowerCase(java.util.Locale.ROOT);
        return !path.contains("fast_download") && !path.contains("/account")
            && !path.contains("/donate") && !path.contains("/login")
            && !label.toLowerCase(java.util.Locale.ROOT).matches(".*(premium|members? only|somente membros|doadores|fast download|download rápido).*");
    }
    static boolean challenge(String body, int status) {
        String lower = body.toLowerCase(java.util.Locale.ROOT);
        if (status == 403 || status == 429) return true;
        java.util.regex.Matcher title = java.util.regex.Pattern.compile("<title[^>]*>\\s*([^<]{0,200})</title>", java.util.regex.Pattern.CASE_INSENSITIVE).matcher(body);
        String pageTitle = title.find() ? title.group(1).trim().toLowerCase(java.util.Locale.ROOT) : "";
        // Ordinary catalog pages mention DDOS-GUARD in a JavaScript cache comment.
        return pageTitle.equals("ddos-guard") || pageTitle.startsWith("just a moment") || pageTitle.startsWith("checking your browser")
            || (lower.contains("cf-chl-") && !lower.contains("js-aarecord-list-outer"));
    }
}
