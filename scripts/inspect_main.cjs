const ADODB = require('node-adodb');

async function inspect(dbName) {
  console.log(`\n--- Inspecting ${dbName} ---`);
  const connection = ADODB.open(`Provider=Microsoft.Jet.OLEDB.4.0;Data Source=D:\\Maktabah Syamilah Golden\\Files\\${dbName};`);
  
  try {
    const tables = await connection.schema(20); // 20 is adSchemaTables
    const userTables = tables.filter(t => t.TABLE_TYPE === 'TABLE').map(t => t.TABLE_NAME);
    console.log("Tables:", userTables);
    
    for (const table of userTables.slice(0, 10)) { // Inspect first 10 tables for brevity, or specific ones if we know them
      try {
        const data = await connection.query(`SELECT TOP 1 * FROM [${table}]`);
        if (data.length > 0) {
            console.log(`Schema for ${table}:`, Object.keys(data[0]));
        } else {
            console.log(`Table ${table} is empty.`);
        }
      } catch (err) {
        console.log(`Could not read table ${table}:`, err.message);
      }
    }
  } catch (err) {
    console.error(err);
  }
}

async function run() {
  await inspect('main.mdb');
  await inspect('special.mdb');
}

run();
