FROM alpine:3.20@sha256:d9e853e87e55526f6b2917df91a2115c36dd7c696a35be12163d44e6e2a4b6bc

RUN apk add --no-cache mariadb-client zstd age tar findutils
COPY infra/vps/backup/backup.sh /usr/local/bin/secondbrain-backup
COPY infra/vps/backup/restore-verify.sh /usr/local/bin/secondbrain-restore-verify
RUN chmod 0755 /usr/local/bin/secondbrain-backup /usr/local/bin/secondbrain-restore-verify

ENTRYPOINT ["/usr/local/bin/secondbrain-backup"]
