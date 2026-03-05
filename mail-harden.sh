#!/usr/bin/env bash
set -euo pipefail

# Ensure Dovecot exposes auth socket for Postfix SASL
if ! grep -q '/var/spool/postfix/private/auth' /etc/dovecot/conf.d/10-master.conf; then
  cat >> /etc/dovecot/conf.d/10-master.conf <<'EOCFG'

service auth {
  unix_listener /var/spool/postfix/private/auth {
    mode = 0660
    user = postfix
    group = postfix
  }
}
EOCFG
fi

# Postfix hardening baseline
postconf -e 'disable_vrfy_command = yes'
postconf -e 'smtpd_helo_required = yes'
postconf -e 'strict_rfc821_envelopes = yes'
postconf -e 'smtpd_tls_security_level = may'
postconf -e 'smtp_tls_security_level = may'
postconf -e 'smtpd_tls_auth_only = yes'
postconf -e 'smtpd_relay_restrictions = permit_mynetworks permit_sasl_authenticated reject_unauth_destination'
postconf -e 'smtpd_recipient_restrictions = reject_non_fqdn_recipient reject_unknown_recipient_domain permit_mynetworks permit_sasl_authenticated reject_unauth_destination'
postconf -e 'smtpd_sasl_auth_enable = yes'
postconf -e 'smtpd_sasl_type = dovecot'
postconf -e 'smtpd_sasl_path = private/auth'
postconf -e 'broken_sasl_auth_clients = yes'

# Harden submission/smtps services
cp -a /etc/postfix/master.cf /etc/postfix/master.cf.bak.$(date +%s)
cat > /etc/postfix/master.cf <<'EOF'
# Postfix master process configuration file.
smtp      inet  n       -       y       -       -       smtpd
pickup    unix  n       -       y       60      1       pickup
cleanup   unix  n       -       y       -       0       cleanup
qmgr      unix  n       -       n       300     1       qmgr
tlsmgr    unix  -       -       y       1000?   1       tlsmgr
rewrite   unix  -       -       y       -       -       trivial-rewrite
bounce    unix  -       -       y       -       0       bounce
defer     unix  -       -       y       -       0       bounce
trace     unix  -       -       y       -       0       bounce
verify    unix  -       -       y       -       1       verify
flush     unix  n       -       y       1000?   0       flush
proxymap  unix  -       -       n       -       -       proxymap
proxywrite unix -       -       n       -       1       proxymap
smtp      unix  -       -       y       -       -       smtp
relay     unix  -       -       y       -       -       smtp
showq     unix  n       -       y       -       -       showq
error     unix  -       -       y       -       -       error
retry     unix  -       -       y       -       -       error
discard   unix  -       -       y       -       -       discard
local     unix  -       n       n       -       -       local
virtual   unix  -       n       n       -       -       virtual
lmtp      unix  -       -       y       -       -       lmtp
anvil     unix  -       -       y       -       1       anvil
scache    unix  -       -       y       -       1       scache

submission inet n       -       y       -       -       smtpd
  -o syslog_name=postfix/submission
  -o smtpd_tls_security_level=encrypt
  -o smtpd_tls_auth_only=yes
  -o smtpd_sasl_auth_enable=yes
  -o smtpd_sasl_type=dovecot
  -o smtpd_sasl_path=private/auth
  -o smtpd_client_restrictions=permit_sasl_authenticated,reject
  -o smtpd_recipient_restrictions=permit_sasl_authenticated,reject
  -o milter_macro_daemon_name=ORIGINATING

smtps     inet  n       -       y       -       -       smtpd
  -o syslog_name=postfix/smtps
  -o smtpd_tls_wrappermode=yes
  -o smtpd_tls_security_level=encrypt
  -o smtpd_tls_auth_only=yes
  -o smtpd_sasl_auth_enable=yes
  -o smtpd_sasl_type=dovecot
  -o smtpd_sasl_path=private/auth
  -o smtpd_client_restrictions=permit_sasl_authenticated,reject
  -o smtpd_recipient_restrictions=permit_sasl_authenticated,reject
  -o milter_macro_daemon_name=ORIGINATING
EOF

systemctl restart dovecot
systemctl restart postfix

echo '--- postfix checks ---'
postconf -n | egrep '^(smtpd_sasl_auth_enable|smtpd_sasl_type|smtpd_sasl_path|smtpd_tls_auth_only|smtpd_relay_restrictions|disable_vrfy_command|smtpd_helo_required)'
ss -tulpn | egrep ':(25|465|587|993|995)\s' || true