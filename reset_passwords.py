import sqlite3
from werkzeug.security import generate_password_hash, check_password_hash

conn = sqlite3.connect('instance/ecgenius.db')
cur = conn.cursor()

cur.execute('SELECT id, username, role FROM users')
rows = cur.fetchall()
print('Users in DB:')
for row in rows:
    print('  id=%d username=%s role=%s' % (row[0], row[1], row[2]))

cur.execute('UPDATE users SET password_hash=? WHERE username=?',
            (generate_password_hash('doctorpassword'), 'doctor'))
cur.execute('UPDATE users SET password_hash=? WHERE username=?',
            (generate_password_hash('adminpassword'), 'admin'))
conn.commit()

cur.execute('SELECT username, password_hash FROM users WHERE username="doctor" OR username="admin"')
for row in cur.fetchall():
    expected = 'doctorpassword' if row[0] == 'doctor' else 'adminpassword'
    result = check_password_hash(row[1], expected)
    print('%s verify OK: %s' % (row[0], result))

conn.close()
print('Password reset complete!')
