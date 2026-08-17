# Second Brain: clean VPS runtime

This is a versioned, Desk-only production contract for a **new** VPS. It has
no credentials and does not contact or migrate any prior server. Telegram is
intentionally absent: no bot source, token, config, poller, or data volume is
included until a separately reviewed secure phase.

## Network and services

- `proxy` is the only host listener (TCP 80/443). Caddy serves only `/desk*`
  and `/api/desk*`; every other path is a 404.
- `app` has no published port, is read-only, and uses MySQL exclusively. It
  refuses missing/placeholder Desk configuration or MySQL; it cannot fall back
  to JSON in this runtime.
- `db` has no host port and is reachable only from `app` and one-shot `backup`
  on an internal Docker network.
- `backup` is disabled unless the `ops` profile is explicitly run. It creates
  encrypted Desk-MySQL (including routines, triggers and events) plus
  private-brain backups; retention defaults to 30 days.

The release contains `public/desk` plus only the Desk API runtime files
(`index.php`, `lib.php`, `schema.sql`); sample config, migration utilities and
all other APIs are absent.

## Host layout

```text
/opt/secondbrain/
  releases/<git-sha>/        # root-created, verified, immutable tree
  incoming/<git-sha>.tar.gz  # brain-deploy-writable signed archive only
  current -> releases/<sha>  # active release symlink
  shared/runtime.env         # host-owned, mode 0600
  shared/secrets/            # Desk config and passwords, mode 0700/0600
  shared/brain/{wiki,raw/_inbox}/
  backups/                   # encrypted backup archives
```

Required secret files are `desk.config.php`, `mysql_app_password`,
`mysql_root_password`, and `backup_age_recipient`. See
[`secrets.example/README.md`](secrets.example/README.md); do not create a
Telegram secret in this phase.

## First boot: root-mediated deployment

1. Create a non-root SSH account `brain-deploy` **without** Docker-group
   membership. Keep provider-console recovery access until a second SSH
   session works. Make `incoming/` writable only by that account and
   `releases/` root-owned/non-traversable to it. Root safely extracts the
   signed archive into fresh root-owned files, verifies it, then publishes it.
2. Install Docker Engine and Compose v2. Configure host firewall policy for
   TCP 80/443 only; MySQL must remain un-published. Verify Docker's iptables
   interaction before opening the host to the Internet.
3. Install `systemd/secondbrain-operator` as
   `/usr/local/sbin/secondbrain-operator`, owned `root:brain-deploy`, mode
   `0750`. Install `systemd/secondbrain-deploy.sudoers` with `visudo -cf`,
   `root:root`, mode `0440`. The deploy account can invoke only this
   root-owned validating wrapper; it cannot run Docker itself. Install
   `systemd/verify-release.py` and `systemd/deploy-root.sh` as
   `/usr/local/lib/secondbrain/verify-release.py` and
   `/usr/local/lib/secondbrain/deploy-root.sh`,
   `root:root`, mode `0755`, and install the approved release-signing public
   key as `/opt/secondbrain/shared/release-signing.pub`, `root:root`, mode
   `0644`. The wrapper rejects unsigned, changed, incomplete, and symlinked
   release trees before it runs Compose.
   Before each image update, root runs `scripts/record-image-digests.sh
   /opt/secondbrain/shared/image-digests`; release preflight refuses to proceed
   without those verified pull digests.
4. Generate host-only runtime files. For example, run the versioned generator
   from the checked-out release with a real FQDN, ACME email and public age
   recipient. It refuses existing files and never prints generated credentials:

   ```sh
   python3 infra/vps/scripts/init-runtime.py \
     --secrets-dir /opt/secondbrain/shared/secrets \
     --runtime-env /opt/secondbrain/shared/runtime.env \
     --domain brain.example.net --acme-email ops@example.net \
     --brain-private-dir /opt/secondbrain/shared/brain \
     --backup-dir /opt/secondbrain/backups \
     --backup-age-recipient age1REPLACE_WITH_PUBLIC_RECIPIENT
   ```

   The runtime file and every generated secret must be mode `0600`. Create
   `shared/brain/wiki`, `shared/brain/raw/_inbox`, and `backups` before
   the release preflight. Private mounts are read-only in `app`.
5. On the deploy workstation, copy `deploy.json.example` to ignored
   `.secrets/deploy.json`, pin the SSH host-key fingerprint, then package and
   upload. The referenced signing private key is local-only and must correspond
   to the host public key. `scripts/desk_push_prod.py` does not deploy unless
   passed `--deploy`; uploads are signed. On deploy it calls only `sudo
   secondbrain-operator deploy <sha>`. The helper hard-denies any target other
   than the approved new VPS and requires an exact pinned SSH fingerprint.
6. Verify an authenticated Desk session and the minimal `/api/desk/health`.
   The public health response is limited to availability, service and storage;
   it has no counts, credentials, or database error details.

## Backup, rollback, and acceptance

To import an approved **local** initial dump, place it as
`shared/import/approved.sql.zst`, create `INITIAL_IMPORT_APPROVED` containing
its SHA-256, and invoke `secondbrain-operator initial-import <sha256>`. The
directory must be `root:root 0700`; both files must be installed by root as
`root:root 0600` and are therefore not self-approvable by `brain-deploy`. The
wrapper enforces those owners/modes, requires an empty DB, and deletes both
server-side import files after success. It does not fetch from or connect to
any previous VPS. Run backup
manually through the wrapper or install the root-owned systemd
timer after one successful manual backup. The age **identity** needed to
restore remains off-host. A backup is accepted only after an off-host restore
drill verifies checksum, decryption, SQL compression, and the private-brain
archive with `backup/restore-verify.sh`.

The installed root-owned `deploy-root.sh` verifies, seals and atomically
switches a signed release before Compose reads it; it never executes a script
from the upload-writable tree. The app image is tagged by exact Git SHA;
rollback refuses to rebuild it and reuses the previously accepted image. On
failed start/health it restores the preceding symlink when present. Rollback changes code only; MySQL restoration is a separate deliberate recovery operation
because it can discard later writes.

After the separately approved TG phase, install
`systemd/tg-operator.py` as `/usr/local/lib/secondbrain/tg-operator.py`,
`root:root 0755`. The deploy account then has only two additional audited
commands: `secondbrain-operator tg-inbox [1..100]` and
`secondbrain-operator tg-send <base64url-json>`. They use `docker exec` inside
the TG container; Caddy exposes no TG API and neither command emits a Bot token
or an admin credential.

Install `systemd/desk-operator.py` beside it as
`/usr/local/lib/secondbrain/desk-operator.py`, `root:root 0755`. It exposes
only `desk-wake-list [1..100]`, `desk-wake-ack <uuid>`, and
`desk-sync <base64url-json>` through the root wrapper. Each command validates
its input and invokes a fixed PHP program inside the app container, rather
than the public Desk HTTP API. Browser CSRF protection therefore remains in
force for every public POST/DELETE route.

For an off-host recovery drill, invoke `backup/restore-verify.sh` with a
non-existent absolute `RESTORE_DRILL_TARGET`. It creates that target with
private permissions, extracts the private archives, and validates TG
`offset.json`/`inbox.json` when present. SQL import is additionally gated on
the literal disposable service name `restore-db` and
`RESTORE_DRILL_CONFIRM=FRESH_DISPOSABLE_TARGET`; a live hostname, IP address,
localhost, or the production runtime directory is rejected.

No release is accepted until local syntax/config checks, a review of the
root-owned wrapper and firewall, the first health check, and a restore drill
all pass. Registry images and base images are pinned by recorded digest.
