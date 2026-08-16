FROM alpine:3.20@sha256:d9e853e87e55526f6b2917df91a2115c36dd7c696a35be12163d44e6e2a4b6bc
RUN apk add --no-cache mariadb-client zstd coreutils
COPY infra/vps/import/import-approved-dump.sh /usr/local/bin/import-approved-dump
RUN chmod 0755 /usr/local/bin/import-approved-dump
ENTRYPOINT ["/usr/local/bin/import-approved-dump"]
