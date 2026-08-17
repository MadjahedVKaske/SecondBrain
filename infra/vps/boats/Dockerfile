FROM php:8.3.25-apache-bookworm@sha256:3b8ad4bef693501c26589e29e2ddd2894ef1312e9c0e76783c9c351a012f62f9

RUN apt-get update \
    && apt-get install -y --no-install-recommends curl libonig-dev \
    && docker-php-ext-install mbstring \
    && a2enmod headers rewrite \
    && rm -rf /var/lib/apt/lists/*

COPY infra/vps/app/apache.conf /etc/apache2/conf-available/secondbrain.conf
COPY infra/vps/app/php.ini /usr/local/etc/php/conf.d/secondbrain.ini
RUN a2enconf secondbrain
COPY public/api/boats/index.php /var/www/html/api/boats/index.php
COPY infra/vps/boats/boats.htaccess /var/www/html/api/boats/.htaccess
COPY infra/vps/boats/entrypoint.sh /usr/local/bin/secondbrain-boats-entrypoint
RUN chmod 0755 /usr/local/bin/secondbrain-boats-entrypoint \
    && mkdir -p /run/boats-input \
    && chown -R root:root /var/www/html

ENTRYPOINT ["/usr/local/bin/secondbrain-boats-entrypoint"]
CMD ["apache2-foreground"]
