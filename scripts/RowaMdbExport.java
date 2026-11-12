import com.healthmarketscience.jackcess.*;
import java.io.*;
import java.nio.charset.*;
import java.nio.file.*;

/** Read-only export. Run with the Jackcess jars on the classpath. */
class RowaMdbExport {
  static String json(Object value) {
    if (value == null) return "null";
    if (value instanceof Number) return value.toString();
    StringBuilder b = new StringBuilder("\"");
    for (char c : value.toString().toCharArray()) {
      switch (c) {
        case '"': b.append("\\\""); break;
        case '\\': b.append("\\\\"); break;
        case '\n': b.append("\\n"); break;
        case '\r': b.append("\\r"); break;
        case '\t': b.append("\\t"); break;
        default: if(c < 32 || c > 126) b.append(String.format("\\u%04x", (int)c)); else b.append(c);
      }
    }
    return b.append('"').toString();
  }
  public static void main(String[] args) throws Exception {
    if(args.length != 2) throw new IllegalArgumentException("Special.mdb output.jsonl");
    try (Database db = new DatabaseBuilder(new File(args[0])).setCharset(Charset.forName("windows-1256")).setReadOnly(true).open();
         BufferedWriter out = Files.newBufferedWriter(Path.of(args[1]), StandardCharsets.UTF_8, StandardOpenOption.CREATE_NEW)) {
      for(String table : new String[]{"rowa", "men", "MenDetail"}) {
        for(Row row : db.getTable(table)) {
          out.write("{\"table\":" + json(table) + ",\"row\":{");
          boolean first = true;
          for(String key : row.keySet()) {
            if(!first) out.write(','); first = false;
            out.write(json(key) + ":" + json(row.get(key)));
          }
          out.write("}}\n");
        }
      }
    }
  }
}
