#!/usr/bin/env bash
set -e
grep -nE 'smtp_server|smtp_port|smtp_user|smtp_pass|default_host|username_domain' /etc/roundcube/config.inc.php || true
echo '---'
sed -n '1,260p' /etc/roundcube/config.inc.php