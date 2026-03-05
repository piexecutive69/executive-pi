#!/usr/bin/env bash
set -euo pipefail

# Enable Postfix auth socket in Dovecot
perl -0777 -i -pe 's/#unix_listener \/var\/spool\/postfix\/private\/auth \{\n#  mode = 0666\n#\}/unix_listener \/var\/spool\/postfix\/private\/auth {\n  mode = 0660\n  user = postfix\n  group = postfix\n}/s' /etc/dovecot/conf.d/10-master.conf

# Keep login compatible with system user (support), but sender domain fixed
sed -i "/^\$config\['username_domain'\]/d" /etc/roundcube/config.inc.php

systemctl restart dovecot
systemctl restart postfix
systemctl restart apache2

ls -la /var/spool/postfix/private/auth || true
grep -nE 'private/auth|mode = 0660|user = postfix|group = postfix' /etc/dovecot/conf.d/10-master.conf