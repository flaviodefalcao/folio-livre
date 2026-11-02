package org.folio.reader;

import java.util.TreeMap;
import org.json.JSONArray;
import org.json.JSONObject;

/** Explicit EPUB block boundaries, in UTF-16 offsets shared with JavaScript. */
final class NarrationPauses {
    static int chunkEnd(String text,int start,int limit,TreeMap<Integer,Integer> pauses) {
        int end=Math.min(start+limit,text.length());
        Integer boundary=pauses.higherKey(start);
        if(boundary!=null && boundary<=end)return boundary;
        if(end<text.length()){
            int space=Math.max(text.lastIndexOf(' ',end),text.lastIndexOf('\n',end));
            if(space>start+limit/2)end=space+1;
            if(end<text.length()&&Character.isHighSurrogate(text.charAt(end-1)))end--;
        }
        return end;
    }
    static TreeMap<Integer,Integer> parse(JSONArray input,int textLength) throws FolioPlugin.UserError {
        TreeMap<Integer,Integer> result=new TreeMap<>();
        if(input==null)return result;
        if(input.length()>10000)throw new FolioPlugin.UserError("Pausas de áudio inválidas.");
        int previous=0;
        for(int i=0;i<input.length();i++){
            JSONObject value=input.optJSONObject(i);
            if(value==null)throw new FolioPlugin.UserError("Pausas de áudio inválidas.");
            double offset=value.optDouble("offset",-1),duration=value.optDouble("durationMs",-1);
            if(!Double.isFinite(offset)||!Double.isFinite(duration)||offset!=Math.floor(offset)||duration!=Math.floor(duration)||offset<=previous||offset>textLength||duration<0||duration>3000)throw new FolioPlugin.UserError("Pausas de áudio inválidas.");
            previous=(int)offset;result.put((int)offset,(int)duration);
        }
        return result;
    }
}
