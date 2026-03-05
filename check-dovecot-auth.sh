#!/usr/bin/env bash
set -e
ls -la /var/spool/postfix/private || true
echo '--- 10-master.conf excerpts ---'
grep -nE 'service auth|unix_listener|private/auth' /etc/dovecot/conf.d/10-master.conf || true
echo '--- doveconf -n ---'
doveconf -n