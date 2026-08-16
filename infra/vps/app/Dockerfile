FROM php:8.3.25-apache-bookworm@sha256:3b8ad4bef693501c26589e29e2ddd2894ef1312e9c0e76783c9c351a012f62f9

RUN apt-get update \
    && apt-get install -y --no-install-recommends curl libonig-dev \
    && docker-php-ext-install pdo_mysql mbstring \
    && a2enmod headers rewrite \
    && rm -rf /var/lib/apt/lists/*

COPY infra/vps/app/apache.conf /etc/apache2/conf-available/secondbrain.conf
COPY infra/vps/app/php.ini /usr/local/etc/php/conf.d/secondbrain.ini
RUN a2enconf secondbrain

# Copy only the Second Brain surface. Other legacy public APIs are deliberately
# absent from this image and cannot be exposed through this deployment.
COPY public/desk /var/www/html/desk
COPY public/api/desk /var/www/html/api/desk
RUN rm -f /var/www/html/api/desk/config.sample.php \
    /var/www/html/api/desk/migrate.php \
    /var/www/html/api/desk/README.md \
    /var/www/html/api/desk/schema.sql
COPY infra/vps/app/desk.htaccess /var/www/html/api/desk/.htaccess
COPY infra/vps/app/entrypoint.sh /usr/local/bin/secondbrain-entrypoint
RUN chmod 0755 /usr/local/bin/secondbrain-entrypoint \
    && mkdir -p /run/secondbrain-input \
    && rm -f /var/www/html/api/desk/config.php

ENTRYPOINT ["/usr/local/bin/secondbrain-entrypoint"]
CMD ["apache2-foreground"]
