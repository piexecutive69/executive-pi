#!/usr/bin/env bash
set -euo pipefail
python3 - <<'PY'
from pathlib import Path
p = Path('/etc/dovecot/conf.d/10-master.conf')
s = p.read_text()
needle = 'service auth {\n'
if needle in s and 'inet_listener {' not in s[s.find(needle):s.find('service auth-worker {')]:
    insert = """service auth {
  inet_listener {
    address = 127.0.0.1
    port = 12345
  }
"""
    start = s.find('service auth {')
    end = s.find('\n', start)
    s = s[:start] + insert + s[end+1:]
    p.write_text(s)
PY

postconf -e 'smtpd_sasl_type = dovecot'
postconf -e 'smtpd_sasl_path = inet:127.0.0.1:12345'

systemctl restart dovecot
systemctl restart postfix

ss -tulpn | grep 12345 || true
postconf smtpd_sasl_type smtpd_sasl_path