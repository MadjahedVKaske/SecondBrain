FROM php:8.2-apache
RUN docker-php-ext-install pdo pdo_mysql \
  && a2enmod rewrite headers \
  && sed -i 's!/var/www/html!/var/www/html!g' /etc/apache2/sites-available/000-default.conf
WORKDIR /var/www/html
