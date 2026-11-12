import com.healthmarketscience.jackcess.*;
import java.io.*;
import java.nio.charset.*;
import java.nio.file.*;

/** Read-only author/catalogue metadata export; never uses display row counts. */
class AuthorMdbExport {
  static String json(Object value) {
    if(value==null)return "null";
    if(value instanceof Number)return value.toString();
    StringBuilder b=new StringBuilder("\"");
    for(char c:value.toString().toCharArray()) {
      if(c=='"')b.append("\\\"");else if(c=='\\')b.append("\\\\");
      else if(c<32||c>126)b.append(String.format("\\u%04x",(int)c));else b.append(c);
    }
    return b.append('"').toString();
  }
  public static void main(String[] args)throws Exception {
    if(args.length!=3)throw new IllegalArgumentException("Special.mdb main.mdb output.jsonl");
    try(BufferedWriter out=Files.newBufferedWriter(Path.of(args[2]),StandardCharsets.UTF_8,StandardOpenOption.CREATE_NEW)) {
      for(int i=0;i<2;i++)try(Database db=new DatabaseBuilder(new File(args[i])).setCharset(Charset.forName("windows-1256")).setReadOnly(true).open()) {
        String table=i==0?"Auth":"0bok";
        for(Row row:db.getTable(table)) {
          Object id=row.get(i==0?"authid":"bkid"),name=row.get(i==0?"auth":"bk");
          if(!(id instanceof Number)||((Number)id).longValue()<1||name==null||name.toString().isBlank())continue;
          out.write("{\"table\":"+json(table)+",\"row\":{");boolean first=true;
          for(String key:row.keySet()) {if(!first)out.write(',');first=false;out.write(json(key)+":"+json(row.get(key)));}
          out.write("}}\n");
        }
      }
    }
  }
}
