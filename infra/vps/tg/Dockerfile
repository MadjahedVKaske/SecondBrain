FROM python:3.12.11-alpine3.21@sha256:0cf3dd9af1073f8555de9c29c912677fb08767ad9ca84bb3ad0bae4b5e903460

RUN apk add --no-cache su-exec \
    && addgroup -S secondbrain && adduser -S -G secondbrain -u 10001 secondbrain
COPY infra/vps/tg/poller.py /app/poller.py
COPY infra/vps/tg/entrypoint.sh /usr/local/bin/secondbrain-tg-entrypoint
RUN chmod 0555 /app/poller.py /usr/local/bin/secondbrain-tg-entrypoint
ENTRYPOINT ["/usr/local/bin/secondbrain-tg-entrypoint"]
