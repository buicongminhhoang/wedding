"""Lập danh sách ảnh và nhạc cho web slide ảnh cưới (web tĩnh, host được trên GitHub Pages).

Thư mục photos/ là nguồn chính:
  photos/l/<tên>.jpg  ảnh chính, cạnh dài 2200 px
  photos/s/<tên>.jpg  ảnh nhỏ, cạnh dài 900 px (ô lưới, polaroid, màn chọn ảnh)
Tên file quyết định nhóm ảnh: "Ăn hỏi (12).jpg" thuộc nhóm "Ăn hỏi".

  python prep.py                 đồng bộ tên giữa l/ và s/, viết lại photos.js và music.js
  python prep.py --them <thư mục>  thêm ảnh gốc mới (tự thu nhỏ vào l/ và s/), rồi làm như trên

Đổi tên nhóm: chỉ cần đổi tên file trong photos/s rồi chạy lại script. Script so nội dung ảnh
để đổi tên file tương ứng trong photos/l. Nhạc: bỏ file vào music/ rồi chạy lại script.
"""
import json
import os
import re
import sys

from PIL import Image, ImageOps

HERE = os.path.dirname(os.path.abspath(__file__))
DL, DS = os.path.join(HERE, "photos", "l"), os.path.join(HERE, "photos", "s")
L, S = 2200, 900
IMG = (".jpg", ".jpeg", ".png")
AUDIO = (".mp3", ".m4a", ".aac", ".wav", ".ogg", ".flac", ".opus")
out = sys.stdout.buffer


def project_dir(name):
    """Tìm thư mục con `name` của dự án gốc bằng cách đi ngược lên từ thư mục này."""
    d = HERE
    for _ in range(5):
        d = os.path.dirname(d)
        if os.path.isdir(os.path.join(d, name)):
            return os.path.join(d, name)
    return os.path.join(os.path.dirname(HERE), name)


def say(*a):
    out.write((" ".join(str(x) for x in a) + "\n").encode("utf-8", "replace"))
    out.flush()


def natural(name):
    return [int(t) if t.isdigit() else t.lower() for t in re.split(r"(\d+)", name)]


def group_of(name):
    stem = os.path.splitext(name)[0]
    g = re.sub(r"[\s_-]*\(?\d+\)?$", "", stem).strip(" _-")
    return g or "Ảnh"


def shrink(im, size, path, q):
    w, h = im.size
    k = size / max(w, h)
    t = im.resize((round(w * k), round(h * k)), Image.LANCZOS) if k < 1 else im
    t.save(path, quality=q, optimize=True, progressive=True)


def signature(path):
    im = Image.open(path)
    im.draft("L", (96, 96))
    return list(ImageOps.exif_transpose(im).convert("L").resize((24, 24), Image.BILINEAR).tobytes())


os.makedirs(DL, exist_ok=True)
os.makedirs(DS, exist_ok=True)

# 1. Thêm ảnh gốc mới
if "--them" in sys.argv:
    src = sys.argv[sys.argv.index("--them") + 1]
    for f in sorted(os.listdir(src), key=natural):
        if not f.lower().endswith(IMG):
            continue
        name = os.path.splitext(f)[0] + ".jpg"
        if os.path.exists(os.path.join(DL, name)):
            continue
        im = Image.open(os.path.join(src, f))
        im.draft("RGB", (L * 2, L * 2))
        im = ImageOps.exif_transpose(im).convert("RGB")
        shrink(im, L, os.path.join(DL, name), 85)
        shrink(im, S, os.path.join(DS, name), 80)
        say("thêm", name)

# 2. Đồng bộ tên: photos/s là nơi đổi tên, photos/l đổi theo (so khớp bằng nội dung ảnh)
ls = lambda d: {f for f in os.listdir(d) if f.lower().endswith(IMG)}
nl, ns = ls(DL), ls(DS)
renamed = {}                                   # tên cũ -> tên mới
only_l, only_s = sorted(nl - ns), sorted(ns - nl)
if only_l and only_s:
    say(f"so khớp {len(only_s)} ảnh đã đổi tên...")
    sig_l = {f: signature(os.path.join(DL, f)) for f in only_l}
    sig_s = {f: signature(os.path.join(DS, f)) for f in only_s}
    pairs = sorted((sum(abs(a - b) for a, b in zip(sig_s[s], sig_l[l])) / 576, s, l) for s in only_s for l in only_l)
    used_s, used_l = set(), set()
    for d, s, l in pairs:
        if s in used_s or l in used_l:
            continue
        if d > 12:                             # khác nhau quá nhiều: không phải cùng một ảnh
            break
        used_s.add(s)
        used_l.add(l)
        renamed[l] = s
    for old, new in renamed.items():           # đổi qua tên tạm để không đè lên nhau
        os.rename(os.path.join(DL, old), os.path.join(DL, old + ".tmp~"))
    for old, new in renamed.items():
        os.rename(os.path.join(DL, old + ".tmp~"), os.path.join(DL, new))
    say(f"đã đổi tên {len(renamed)} ảnh trong photos/l theo photos/s")
    nl = ls(DL)
for f in sorted(nl - ns):                      # có ảnh lớn mà thiếu ảnh nhỏ: tạo lại
    shrink(Image.open(os.path.join(DL, f)).convert("RGB"), S, os.path.join(DS, f), 80)
    say("tạo ảnh nhỏ", f)
for f in sorted(ns - nl):
    say("CẢNH BÁO: có trong photos/s nhưng không có trong photos/l, bỏ qua:", f)

# 3. Giữ lại điểm lấy nét (khuôn mặt) đã có
old = {}
try:
    txt = open(os.path.join(HERE, "photos.js"), encoding="utf-8").read()
    for p in json.loads(txt[txt.index("["):txt.rindex("]") + 1]):
        old[renamed.get(p["f"], p["f"])] = p
except (OSError, ValueError):
    pass

# 4. Danh sách ảnh
items = []
for f in sorted(ls(DL) & ls(DS), key=lambda n: (natural(group_of(n)), natural(n))):
    with Image.open(os.path.join(DL, f)) as im:
        w, h = im.size
    with Image.open(os.path.join(DS, f)) as im:
        r, g, b = im.convert("RGB").resize((1, 1), Image.BILINEAR).getpixel((0, 0))
    o = old.get(f, {})
    items.append({"f": f, "a": round(w / h, 4), "fx": o.get("fx", .5), "fy": o.get("fy", .4 if h > w else .45),
                  "c": "#%02x%02x%02x" % (r, g, b), "g": group_of(f)})
with open(os.path.join(HERE, "photos.js"), "w", encoding="utf-8") as fp:
    fp.write("window.PHOTOS = " + json.dumps(items, ensure_ascii=False, separators=(",", ":")) + ";" + chr(10))

# 5. Danh sách nhạc
os.makedirs(os.path.join(HERE, "music"), exist_ok=True)
songs = sorted((f for f in os.listdir(os.path.join(HERE, "music")) if f.lower().endswith(AUDIO)), key=natural)
# Lưới nhịp từng bài (vạch ô nhịp, năng lượng từng ô, đoạn điệp khúc) lấy từ ../mashup/library.json.
# Bài mới chưa có trong đó: chép file vào ../music, chạy python ../mashup/analyze_library.py rồi chạy lại script này.
beats = {}
try:
    lib = {s["file"]: s for s in json.load(open(os.path.join(project_dir("mashup"), "library.json"), encoding="utf-8"))}
except (OSError, ValueError):
    lib = {}
# Bài chưa có trong library.json: tự đo bằng mashup/analyze_library.py (cần numpy và ffmpeg), lưu lại trong beats_cache.json
CACHE = os.path.join(HERE, "beats_cache.json")
try:
    cache = json.load(open(CACHE, encoding="utf-8"))
except (OSError, ValueError):
    cache = {}
for f in songs:
    path = os.path.join(HERE, "music", f)
    key = f"{f}|{os.path.getsize(path)}"
    if f in lib:
        continue
    if key not in cache:
        try:
            sys.path.insert(0, project_dir("mashup"))
            from analyze_library import analyse
            say("  đo nhịp:", f)
            r = analyse(path)
            cache[key] = {k: r[k] for k in ("bpm", "bar_times", "bar_db", "chorus") if k in r}
        except Exception as e:                      # thiếu numpy/ffmpeg hoặc file lỗi: bài đó sẽ đếm theo giây
            say("  không đo được nhịp:", f, "-", type(e).__name__, e)
            continue
    lib[f] = cache[key]
with open(CACHE, "w", encoding="utf-8") as fp:
    json.dump(cache, fp, ensure_ascii=False)
for f in songs:
    s = lib.get(f)
    if not s or len(s.get("bar_times", [])) < 8:
        say("  chưa có dữ liệu nhịp:", f)
        continue
    db = sorted(s["bar_db"])
    lo, hi = db[len(db) // 10], db[len(db) * 9 // 10]
    raw = [min(1, max(0, (d - lo) / max(1e-6, hi - lo))) for d in s["bar_db"]]
    en = [round(sum(raw[max(0, i - 1):i + 2]) / len(raw[max(0, i - 1):i + 2]), 2) for i in range(len(raw))]
    beats[f] = {"bpm": round(s["bpm"], 1), "bars": [round(t, 3) for t in s["bar_times"]], "e": en,
                "ch": [[round(c["t0"], 2), round(c["t1"], 2)] for c in s.get("chorus", [])]}
with open(os.path.join(HERE, "music.js"), "w", encoding="utf-8") as fp:
    fp.write("window.MUSIC = " + json.dumps(songs, ensure_ascii=False) + ";" + chr(10))
    fp.write("window.BEATS = " + json.dumps(beats, ensure_ascii=False, separators=(",", ":")) + ";" + chr(10))

groups = {}
for p in items:
    groups[p["g"]] = groups.get(p["g"], 0) + 1
say("xong:", len(items), "ảnh,", len(songs), "bài nhạc,", len(beats), "bài có lưới nhịp")
for g, n in groups.items():
    say(f"  {g}: {n}")
