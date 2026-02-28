from db_jdbc import get_connection

conn = get_connection()
cursor = conn.cursor()

cursor.execute("SELECT GETDATE()")
print(cursor.fetchone())

cursor.close()
conn.close()
