set -e
for d in store.pi-executive.com mall.pi-executive.com toko.pi-executive.com; do
  cat > /var/www/$d/robots.txt <<EOF
User-agent: *
Allow: /

Sitemap: https://$d/sitemap.xml
EOF

  cat > /var/www/$d/sitemap.xml <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://$d/</loc>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
</urlset>
EOF

done
chown www-data:www-data /var/www/store.pi-executive.com/robots.txt /var/www/store.pi-executive.com/sitemap.xml /var/www/mall.pi-executive.com/robots.txt /var/www/mall.pi-executive.com/sitemap.xml /var/www/toko.pi-executive.com/robots.txt /var/www/toko.pi-executive.com/sitemap.xml
chmod 644 /var/www/store.pi-executive.com/robots.txt /var/www/store.pi-executive.com/sitemap.xml /var/www/mall.pi-executive.com/robots.txt /var/www/mall.pi-executive.com/sitemap.xml /var/www/toko.pi-executive.com/robots.txt /var/www/toko.pi-executive.com/sitemap.xml
systemctl reload apache2