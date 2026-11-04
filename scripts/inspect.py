import pyodbc
import sys

def main(mdb_path):
    # Setup the connection string
    conn_str = r'Driver={Microsoft Access Driver (*.mdb, *.accdb)};DBQ=' + mdb_path + ';'
    print(f"Connecting to: {mdb_path}")
    
    try:
        conn = pyodbc.connect(conn_str)
        cursor = conn.cursor()
        
        # Get all tables
        tables = [table.table_name for table in cursor.tables(tableType='TABLE')]
        print("Tables in MDB:", tables)
        
        for table in tables[:5]:  # Just inspect the first 5 tables
            print(f"\n--- Columns in {table} ---")
            columns = [column.column_name for column in cursor.columns(table=table)]
            print(columns)
            
            # Fetch one row
            try:
                cursor.execute(f"SELECT TOP 1 * FROM [{table}]")
                row = cursor.fetchone()
                print(f"Sample row from {table}:", row)
            except Exception as e:
                print(f"Could not fetch row from {table}: {e}")
                
        conn.close()
    except Exception as e:
        print("Error connecting to or reading database:", e)

if __name__ == "__main__":
    if len(sys.argv) > 1:
        main(sys.argv[1])
    else:
        print("Provide mdb path")
