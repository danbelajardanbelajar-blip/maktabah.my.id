const ADODB = require('node-adodb');

const mdbPath = process.argv[2];
if (!mdbPath) {
  console.error("Please provide the MDB path.");
  process.exit(1);
}

const connection = ADODB.open(`Provider=Microsoft.Jet.OLEDB.4.0;Data Source=${mdbPath};`);

async function inspect() {
  try {
    const tables = await connection.schema(20);
    const tableNames = tables
      .filter(t => t.TABLE_TYPE === 'TABLE')
      .map(t => t.TABLE_NAME);
    
    console.log("Tables:", tableNames);

    for (const table of tableNames.slice(0, 5)) {
      console.log(`\n--- Schema for ${table} ---`);
      const cols = await connection.schema(4, [null, null, table]);
      console.log(cols.map(c => c.COLUMN_NAME));
      
      try {
        const rows = await connection.query(`SELECT TOP 1 * FROM [${table}]`);
        console.log(`Sample row for ${table}:`, rows);
      } catch (err) {
        console.error(`Could not query ${table}:`, err.message);
      }
    }
  } catch (error) {
    console.error("Inspection failed:", error);
  }
}

inspect();
