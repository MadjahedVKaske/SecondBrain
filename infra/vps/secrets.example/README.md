# Desk-only secret file contract

Create these files in the host-only `SECRETS_DIR` from `runtime.env`. They are
never Git content. Directory mode is `0700`; each file is `0600` where the
host supports POSIX modes.

```text
desk.config.php          # db_host=db, db_name=desk, new view/admin tokens
mysql_app_password       # random application password
mysql_root_password      # independent random root password
backup_age_recipient     # one public age recipient beginning with age1
```

Use `scripts/init-runtime.py` for a new installation. It creates the Desk
config, independent random passwords/tokens, and runtime environment file in
explicit host paths; it refuses non-empty/existing targets and does not print
any generated value. A manual setup must follow the same contract.

The production app requires MySQL and all Desk credentials. It never uses a
JSON fallback. Do not add Telegram configuration, token, or poller files to
this initial Desk-only runtime. Keep the private age identity off this server.
