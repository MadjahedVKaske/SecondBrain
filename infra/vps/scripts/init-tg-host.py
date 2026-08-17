#!/usr/bin/env python3
"""Root-only one-time TG provisioning. Never prints or overwrites secrets."""
from __future__ import annotations
import argparse, json, os, re, secrets, shutil
from pathlib import Path

def write_new(path: Path, text: str, mode: int = 0o600) -> None:
    fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, mode)
    with os.fdopen(fd, "w", encoding="utf-8", newline="\n") as out:
        out.write(text); out.flush(); os.fsync(out.fileno())
    os.chmod(path, mode)

def sync_dir(path: Path) -> None:
    fd=os.open(path,os.O_RDONLY); os.fsync(fd); os.close(fd)

def main() -> int:
    ap=argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--root", type=Path, default=Path("/opt/secondbrain"))
    ap.add_argument("--user-id", type=int, required=True)
    ap.add_argument("--chat-id", type=int, required=True)
    args=ap.parse_args(); root=args.root.resolve(); shared=root/"shared"; secrets_dir=shared/"secrets"
    runtime=shared/"runtime.env"; desk=secrets_dir/"desk.config.php"; bot=secrets_dir/"tg_bot_token"
    if not runtime.is_file() or not desk.is_file() or not bot.is_file() or not bot.read_text().strip(): raise SystemExit("required Desk runtime or TG token missing")
    recovery=shared/".tg-provision-recovery"
    if recovery.exists() and (shared/"tg-enabled").exists():
        shutil.rmtree(recovery)
        sync_dir(shared)
    # A marker is the only committed state. If a prior process died before it
    # was published, restore durable originals before evaluating preconditions.
    if recovery.exists() and not (shared/"tg-enabled").exists():
        for name, target in (("desk.config.php",desk),("runtime.env",runtime)):
            source=recovery/name
            if not source.is_file(): raise SystemExit("incomplete TG recovery state")
            os.replace(source,target)
        for path in (secrets_dir/"tg_config.json",secrets_dir/"tg_wake_token"):
            path.unlink(missing_ok=True)
        sync_dir(secrets_dir)
        stale=shared/"tg-data"
        if stale.exists():
            shutil.rmtree(stale)
        recovery.rmdir()
        sync_dir(shared)
    if any((secrets_dir/x).exists() for x in ("tg_config.json","tg_wake_token")) or (shared/"tg-enabled").exists(): raise SystemExit("TG already provisioned")
    text=runtime.read_text(encoding="utf-8")
    data=root/"shared"/"tg-data"
    if "TG_DATA_DIR=" in text: raise SystemExit("TG_DATA_DIR already exists")
    token=secrets.token_urlsafe(32)
    config={"allowed_user_ids":[args.user_id],"allowed_chat_ids":[args.chat_id]}
    desk_text=desk.read_text(encoding="utf-8")
    if "tg_wake_token" in desk_text or not re.search(r"\];\s*$",desk_text): raise SystemExit("Desk config is not a supported generated config")
    updated=re.sub(r"\];\s*$",f"    'tg_wake_token' => '{token}',\n];\n",desk_text)
    # Validate everything before any visible mutation. The root-owned marker is
    # published last; without it Docker never enables the TG profile.
    staged=[]
    desk_replaced=False
    runtime_replaced=False
    try:
        recovery.mkdir(mode=0o700)
        sync_dir(shared)
        write_new(recovery/"desk.config.php",desk_text)
        write_new(recovery/"runtime.env",text)
        sync_dir(recovery)
        for path, value in ((secrets_dir/"tg_config.json",json.dumps(config,separators=(",",":"))+"\n"),(secrets_dir/"tg_wake_token",token+"\n"),(desk.with_suffix(".tg-new"),updated),(runtime.with_suffix(".tg-new"),text.rstrip()+f"\nTG_DATA_DIR={data}\n")):
            write_new(path,value); staged.append(path)
        data.mkdir(mode=0o700); os.chown(data,10001,10001); os.chmod(data,0o700)
        os.replace(desk.with_suffix(".tg-new"),desk); sync_dir(secrets_dir); staged.remove(desk.with_suffix(".tg-new")); desk_replaced=True
        os.replace(runtime.with_suffix(".tg-new"),runtime); sync_dir(shared); staged.remove(runtime.with_suffix(".tg-new")); runtime_replaced=True
        write_new(shared/"tg-enabled","enabled\n")
        sync_dir(shared)
        (recovery/"desk.config.php").unlink()
        (recovery/"runtime.env").unlink()
        recovery.rmdir()
        sync_dir(shared)
    except BaseException:
        # Restore live files if publication failed before the final marker.
        # This keeps re-running provisioning safe after any interrupted step.
        if desk_replaced and not (shared/"tg-enabled").exists():
            rollback=desk.with_suffix(".tg-rollback"); rollback.write_text(desk_text,encoding="utf-8",newline="\n"); os.chmod(rollback,0o600); os.replace(rollback,desk)
        if runtime_replaced and not (shared/"tg-enabled").exists():
            rollback=runtime.with_suffix(".tg-rollback"); rollback.write_text(text,encoding="utf-8",newline="\n"); os.chmod(rollback,0o600); os.replace(rollback,runtime)
        for path in staged:
            path.unlink(missing_ok=True)
        if data.exists() and not (shared/"tg-enabled").exists(): data.rmdir()
        raise
    print("TG host provisioning completed; secrets withheld")
    return 0
if __name__=="__main__": raise SystemExit(main())
