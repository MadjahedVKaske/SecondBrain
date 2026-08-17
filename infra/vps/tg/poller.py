#!/usr/bin/env python3
"""Single-owner Telegram getUpdates poller.  No webhook and no public port."""
from __future__ import annotations

import base64, fcntl, json, os, re, secrets, signal, threading, time, urllib.error, urllib.request, uuid
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

DATA = Path("/data")
TOKEN_FILE = Path("/run/tg-secrets/tg_bot_token")
CONFIG_FILE = Path("/run/tg-secrets/tg_config")
WAKE_TOKEN_FILE = Path("/run/tg-secrets/tg_wake_token")
MAX_MEDIA = 20 * 1024 * 1024
MAX_UPLOADS = 512 * 1024 * 1024
stop = threading.Event()
last_poll = 0.0

def secret(path: Path) -> str:
    value = path.read_text(encoding="utf-8").strip()
    if not value or "change-me" in value.lower(): raise RuntimeError(f"missing {path.name}")
    return value

TOKEN = secret(TOKEN_FILE)
WAKE_TOKEN = secret(WAKE_TOKEN_FILE)
cfg = json.loads(secret(CONFIG_FILE))
ALLOWED = {int(x) for x in cfg["allowed_user_ids"]}
ALLOWED_CHATS = {int(x) for x in cfg["allowed_chat_ids"]}
if not ALLOWED or not ALLOWED_CHATS: raise RuntimeError("invalid tg config")

def atomic(path: Path, value: object) -> None:
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(json.dumps(value, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    os.replace(tmp, path)

def load(path: Path, fallback):
    try: return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError): return fallback

def authoritative(path: Path, fallback, valid):
    if not path.exists(): return fallback
    try: value=json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc: raise RuntimeError(f"corrupt state: {path.name}") from exc
    if not valid(value): raise RuntimeError(f"invalid state: {path.name}")
    return value

def valid_inbox(value):
    if not (isinstance(value,dict) and set(value)=={"items"} and isinstance(value["items"],list) and len(value["items"])<=500): return False
    ids, updates=set(),set()
    for item in value["items"]:
        if not isinstance(item,dict): return False
        iid, uid, stored=item.get("id"),item.get("update_id"),item.get("stored_as")
        if not isinstance(iid,str) or not re.fullmatch(r"[0-9a-f]{32}",iid) or not isinstance(uid,int) or uid<0 or iid in ids or uid in updates: return False
        if stored is not None and (not isinstance(stored,str) or not stored or Path(stored).name!=stored): return False
        ids.add(iid); updates.add(uid)
    return True

def api(method: str, payload: dict, timeout: int = 35) -> dict:
    request = urllib.request.Request(f"https://api.telegram.org/bot{TOKEN}/{method}", data=json.dumps(payload).encode(), headers={"Content-Type":"application/json"}, method="POST")
    with urllib.request.urlopen(request, timeout=timeout) as response:
        result = json.loads(response.read())
    if not result.get("ok"): raise RuntimeError(f"telegram {method} failed")
    return result

def download(file_id: str, dest: Path) -> None:
    path = api("getFile", {"file_id":file_id})["result"]["file_path"]
    url = f"https://api.telegram.org/file/bot{TOKEN}/{path}"
    used=sum(p.stat().st_size for p in (DATA/"uploads").glob("*") if p.is_file())
    if used >= MAX_UPLOADS: raise RuntimeError("media quota reached")
    try:
        with urllib.request.urlopen(url, timeout=90) as response, dest.open("xb") as output:
            n = 0
            while chunk := response.read(65536):
                n += len(chunk)
                if n > MAX_MEDIA or used+n > MAX_UPLOADS: raise RuntimeError("media limit reached")
                output.write(chunk)
    except BaseException:
        dest.unlink(missing_ok=True)
        raise

def media(message: dict) -> tuple[str,str,str,str]:
    if message.get("photo"): return "photo", message["photo"][-1]["file_id"], "photo.jpg", "image/jpeg"
    for kind, name, mime in (("voice","voice.ogg","audio/ogg"),("audio","audio.bin",""),("video_note","video_note.mp4","video/mp4"),("document","file.bin",""),("video","video.mp4","video/mp4"),("animation","animation.mp4","video/mp4"),("sticker","sticker.webp","")):
        if message.get(kind,{}).get("file_id"):
            item=message[kind]; return kind, item["file_id"], Path(str(item.get("file_name") or name)).name, str(item.get("mime_type") or mime)
    return "", "", "", ""

def wake(item: dict) -> None:
    wake_id=str(uuid.uuid5(uuid.NAMESPACE_URL, "secondbrain-tg-update:"+str(item["update_id"])))
    body=json.dumps({"wake_id":wake_id,"tg_id":item["id"],"type":item["type"],"text":item.get("text") or item.get("caption") or "","has_file":bool(item.get("stored_as")),"kind":"tg"}).encode()
    request=urllib.request.Request("http://app/api/desk/tg-wake",data=body,headers={"Content-Type":"application/json","X-SecondBrain-TG":WAKE_TOKEN},method="POST")
    with urllib.request.urlopen(request,timeout=10) as response:
        if response.status != 200: raise RuntimeError("desk wake failed")

def ingest(update: dict) -> None:
    global last_poll
    lock=(DATA/".state.lock").open("a+")
    fcntl.flock(lock,fcntl.LOCK_EX)
    try:
        return _ingest_locked(update)
    finally:
        fcntl.flock(lock,fcntl.LOCK_UN); lock.close()

def _ingest_locked(update: dict) -> None:
    global last_poll
    inbox_path=DATA/"inbox.json"; state_path=DATA/"offset.json"; inbox=authoritative(inbox_path,{"items":[]},valid_inbox)
    uid=int(update.get("update_id",0)); msg=update.get("message") or update.get("edited_message")
    state=authoritative(state_path,{"offset":0},lambda x:isinstance(x,dict) and isinstance(x.get("offset"),int) and x["offset"]>=0); offset=state["offset"]
    if uid < offset: return
    chat=msg.get("chat",{}) if isinstance(msg,dict) else {}
    if not isinstance(msg,dict) or chat.get("type") != "private" or int(msg.get("from",{}).get("id",0)) not in ALLOWED or int(chat.get("id",0)) not in ALLOWED_CHATS:
        atomic(state_path,{"offset":uid+1}); return
    item=next((x for x in inbox["items"] if x.get("update_id")==uid),None)
    if item is None:
        typ,file_id,filename,mime=media(msg)
        item={"id":secrets.token_hex(16),"update_id":uid,"chat_id":msg.get("chat",{}).get("id"),"from_id":msg.get("from",{}).get("id"),"from_username":msg.get("from",{}).get("username",""),"date":msg.get("date"),"received_at":time.strftime("%Y-%m-%dT%H:%M:%SZ",time.gmtime()),"type":typ or "text","text":str(msg.get("text") or ""),"caption":str(msg.get("caption") or ""),"file_id":file_id,"filename":filename,"mime":mime,"wake_sent":False}
        if file_id:
            suffix=Path(filename).suffix or ".bin"; stored=f"{time.strftime('%Y%m%d%H%M%S')}_{secrets.token_hex(3)}{suffix}"; download(file_id,DATA/"uploads"/stored); item["stored_as"]=stored
        elif not item["text"] and not item["caption"]:
            stored=f"{time.strftime('%Y%m%d%H%M%S')}_{secrets.token_hex(3)}.json"; (DATA/"uploads"/stored).write_text(json.dumps(msg,ensure_ascii=False),encoding="utf-8"); item.update(type="raw",filename="message.json",mime="application/json",stored_as=stored)
        inbox["items"]=(inbox["items"]+[item])[-500:]; atomic(inbox_path,inbox)
    if not item.get("wake_sent"):
        wake(item); item["wake_sent"]=True; atomic(inbox_path,inbox)
    atomic(state_path,{"offset":uid+1}); last_poll=time.time()

class Handler(BaseHTTPRequestHandler):
    def log_message(self,*args): pass
    def reply(self,code,data): self.send_response(code); self.send_header("Content-Type","application/json"); self.end_headers(); self.wfile.write(json.dumps(data,ensure_ascii=False).encode())
    def do_GET(self):
        path=self.path.split("?",1)[0]
        if path=="/health": return self.reply(200,{"ok":True,"service":"tg-poller","poll_recent":time.time()-last_poll<180})
        return self.reply(404,{"error":"not_found"})
    def do_POST(self):
        self.reply(404,{"error":"not_found"})

def main():
    global last_poll
    DATA.mkdir(mode=0o700,parents=True,exist_ok=True); (DATA/"uploads").mkdir(mode=0o700,exist_ok=True)
    lock_path=DATA/".state.lock"
    if lock_path.exists() and (lock_path.is_symlink() or not lock_path.is_file()): raise RuntimeError("invalid state lock")
    lock_path.touch(mode=0o600,exist_ok=True)
    os.chmod(lock_path,0o600)
    # Canonical empty state makes first backup/restore verifiable before the
    # bot receives its first update.
    if not (DATA/"inbox.json").exists(): atomic(DATA/"inbox.json",{"items":[]})
    if not (DATA/"offset.json").exists(): atomic(DATA/"offset.json",{"offset":0})
    api("deleteWebhook",{"drop_pending_updates":False})
    server=ThreadingHTTPServer(("127.0.0.1",8080),Handler); threading.Thread(target=server.serve_forever,daemon=True).start()
    while not stop.is_set():
        try:
            inbox=authoritative(DATA/"inbox.json",{"items":[]},valid_inbox)
            state=authoritative(DATA/"offset.json",{"offset":0},lambda x:isinstance(x,dict) and isinstance(x.get("offset"),int) and x["offset"]>=0)
            if state["offset"] <= max((item["update_id"] for item in inbox["items"]), default=-1): raise RuntimeError("incompatible TG state")
            updates=api("getUpdates",{"offset":state["offset"],"timeout":25,"allowed_updates":["message"]},30).get("result",[])
            for update in updates: ingest(update)
            last_poll=time.time()
        except Exception: stop.wait(5)
for sig in (signal.SIGTERM,signal.SIGINT): signal.signal(sig,lambda *_:stop.set())
if __name__=="__main__": main()
