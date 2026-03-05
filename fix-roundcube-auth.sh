#!/usr/bin/env bash
set -e
cp -a /etc/roundcube/config.inc.php /etc/roundcube/config.inc.php.bak.$(date +%s)

# Append explicit mail settings for production domain
cat >> /etc/roundcube/config.inc.php <<'RCFG'

// Production mail settings (override defaults)
$config['imap_host'] = ['ssl://mail.pi-executive.com:993'];
$config['smtp_host'] = 'tls://mail.pi-executive.com:587';
$config['smtp_port'] = 587;
$config['smtp_user'] = '%u';
$config['smtp_pass'] = '%p';
$config['mail_domain'] = 'pi-executive.com';
$config['username_domain'] = 'pi-executive.com';
$config['identity_select'] = true;
RCFG

systemctl restart apache2

echo '--- roundcube effective settings (tail) ---'
tail -n 30 /etc/roundcube/config.inc.php