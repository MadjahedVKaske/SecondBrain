FROM python:3.12.11-alpine3.21@sha256:0cf3dd9af1073f8555de9c29c912677fb08767ad9ca84bb3ad0bae4b5e903460

RUN addgroup -S secondbrain && adduser -S -G secondbrain -u 10001 secondbrain
COPY infra/vps/tg/poller.py /app/poller.py
RUN chmod 0555 /app/poller.py
USER secondbrain
ENTRYPOINT ["python3", "/app/poller.py"]
