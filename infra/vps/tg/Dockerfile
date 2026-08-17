FROM python:3.12.11-alpine3.21@sha256:0b37a58c173df2c801fb6d9fd6d36a61750d1d9390a7e29bf3bd52a2f914ea53

RUN addgroup -S secondbrain && adduser -S -G secondbrain -u 10001 secondbrain
COPY infra/vps/tg/poller.py /app/poller.py
RUN chmod 0555 /app/poller.py
USER secondbrain
ENTRYPOINT ["python3", "/app/poller.py"]
