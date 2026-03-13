import sqlite3

conn = sqlite3.connect('gd_simulator.db')
tables = [t[0] for t in conn.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()]
print('Tables:', tables)

for table in tables:
    print(f'\n--- {table} ---')
    cursor = conn.execute(f'SELECT * FROM {table}')
    cols = [d[0] for d in cursor.description]
    print('Columns:', cols)
    rows = cursor.fetchall()
    if rows:
        for row in rows:
            print(row)
    else:
        print('(empty)')

conn.close()
