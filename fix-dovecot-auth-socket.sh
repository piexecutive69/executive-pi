#!/usr/bin/env bash
set -euo pipefail
python3 - <<'PY'
from pathlib import Path
p = Path('/etc/dovecot/conf.d/10-master.conf')
s = p.read_text()
old = """  # Postfix smtp-auth
  #unix_listener /var/spool/postfix/private/auth {
  #  mode = 0666
  #}
"""
new = """  # Postfix smtp-auth
  unix_listener /var/spool/postfix/private/auth {
    mode = 0660
    user = postfix
    group = postfix
  }
"""
if old in s:
    s = s.replace(old, new)
else:
    if '/var/spool/postfix/private/auth' not in s:
        marker = '  # Auth process is run as this user.\n'
        s = s.replace(marker, new + '\n' + marker)
p.write_text(s)
PY

systemctl restart dovecot
systemctl restart postfix

ls -la /var/spool/postfix/private/auth
nl -ba /etc/dovecot/conf.d/10-master.conf | sed -n '108,122p'