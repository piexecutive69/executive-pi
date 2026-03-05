#!/usr/bin/env bash
set -euo pipefail
cp -a /etc/roundcube/config.inc.php /etc/roundcube/config.inc.php.bak.mailfix

# Remove previous overrides that may conflict
sed -i "/^\$config\['smtp_host'\]/d" /etc/roundcube/config.inc.php
sed -i "/^\$config\['smtp_port'\]/d" /etc/roundcube/config.inc.php
sed -i "/^\$config\['smtp_user'\]/d" /etc/roundcube/config.inc.php
sed -i "/^\$config\['smtp_pass'\]/d" /etc/roundcube/config.inc.php
sed -i "/^\$config\['mail_domain'\]/d" /etc/roundcube/config.inc.php
sed -i "/^\$config\['username_domain'\]/d" /etc/roundcube/config.inc.php

cat >> /etc/roundcube/config.inc.php <<'RCFG'

// Roundcube local SMTP delivery (same host)
$config['smtp_host'] = 'localhost:25';
$config['smtp_port'] = 25;
$config['smtp_user'] = '';
$config['smtp_pass'] = '';
$config['mail_domain'] = 'pi-executive.com';
RCFG

systemctl restart apache2

tail -n 20 /etc/roundcube/config.inc.php