"""Lập danh sách nhạc buổi lễ cho trang chọn (../index.html).

Mỗi thư mục con là một hạng mục của buổi lễ (xem PHASES). Bỏ file mp3 vào đúng thư mục rồi chạy:
    python prep.py
Script đo từng bài (cần numpy + ffmpeg): độ dài, khoảng lặng đầu bài, điểm cao trào, độ to,
rồi ghi list.js. Kết quả đo được lưu trong phan-tich.json nên lần sau chỉ đo bài mới.
"""
import json
import os
import re
import shutil
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
out = sys.stdout.buffer
say = lambda *a: (out.write((" ".join(str(x) for x in a) + "\n").encode("utf-8", "replace")), out.flush())

# kind: "diem" = khoảnh khắc trên sân khấu (một bài, lặp lại), "nen" = nhạc nền (phát lần lượt cả danh sách)
PHASES = [
    ("01-le-gia-tien", "Lễ gia tiên, đón đoàn", "nen", "Tại nhà: làm lễ trước bàn thờ, đón đoàn nhà trai, nhà gái"),
    ("02-don-khach", "Đón khách", "nen", "Khách tới, chụp ảnh ở cổng hoa, vào bàn"),
    ("03-lam-nong", "Làm nóng trước giờ lễ", "nen", "10-15 phút cuối trước khi MC lên sân khấu"),
    ("04-mc-mo-dau", "MC chào, ổn định chỗ ngồi", "diem", "MC mở đầu, kể chuyện tình yêu"),
    ("05-chu-re", "Chú rể tiến vào", "diem", "Chú rể bước lên sân khấu"),
    ("06-co-dau", "Cô dâu vào lễ đường", "diem", "Ba mẹ dắt cô dâu vào, chú rể đón"),
    ("07-ba-me", "Ba mẹ hai bên lên sân khấu", "diem", "Giới thiệu gia đình, phát biểu"),
    ("08-trao-nhan", "Trao nhẫn", "diem", "Lời hứa và trao nhẫn cưới"),
    ("09-cat-banh", "Cắt bánh, rót rượu", "diem", "Rót tháp ly, cắt bánh cưới, pháo bông"),
    ("10-nang-ly", "Dâng rượu ba mẹ, nâng ly", "diem", "Mời rượu ba mẹ, cả hội trường nâng ly"),
    ("11-first-walk", "First walk, khiêu vũ", "diem", "Cô dâu chú rể đi xuống chào bàn, nhảy điệu đầu tiên"),
    ("12-chup-hinh", "Chụp hình tập thể", "nen", "Chụp ảnh với gia đình, bạn bè"),
    ("13-tiec", "Tiệc và after party", "nen", "Khai tiệc, đi chào bàn, giao lưu"),
    ("14-tien-khach", "Tiễn khách", "nen", "Cảm ơn và chào khách ra về"),
    ("15-du-phong", "Dự phòng", "nen", "Bài để sẵn khi cần chữa cháy"),
]
# Bài ưa thích gợi ý sẵn cho từng hạng mục (so khớp theo một đoạn của tên bài, không phân biệt hoa thường)
FAV = {
    "01-le-gia-tien": ["Giao Hưởng Tân Thời"],
    "02-don-khach": ["Ngày Đầu Tiên", "Bài Này Không Để Đi Diễn", "một đời", "Em Ơi Sau Này", "Lễ Đường", "Em Đồng Ý"],
    "03-lam-nong": ["A Thousand Years", "Love Me Like You Do", "Young and Beautiful"],
    "04-mc-mo-dau": ["MC chào"],
    "05-chu-re": ["Golden Hour"],
    "06-co-dau": ["Young And Beautiful"],
    "07-ba-me": ["Canon In D"],
    "08-trao-nhan": ["Trao nhẫn"],
    "09-cat-banh": ["Marry You"],
    "10-nang-ly": ["Nâng ly"],
    "11-first-walk": ["First walk"],
    "12-chup-hinh": ["Home Is You"],
    "13-tiec": ["A Sky Full Of Stars", "Dancing Queen", "You Are The Reason", "I Wanna Grow Old With You", "Sway"],
    "14-tien-khach": ["Thank You For Loving Me"],
}
AUDIO = (".mp3", ".m4a", ".aac", ".wav", ".ogg", ".flac", ".opus")
SR = 11025


def ffmpeg():
    d = HERE
    for _ in range(5):                      # dùng lại hàm dò ffmpeg của dự án nếu có
        d = os.path.dirname(d)
        if os.path.exists(os.path.join(d, "analyze_music.py")):
            sys.path.insert(0, d)
            try:
                from analyze_music import find_ffmpeg
                return find_ffmpeg()
            except Exception:
                break
    return shutil.which("ffmpeg") or "ffmpeg"


def analyse(path, exe):
    import numpy as np
    raw = subprocess.run([exe, "-v", "error", "-i", path, "-ac", "1", "-ar", str(SR), "-f", "f32le", "-"],
                         capture_output=True, check=True).stdout
    y = np.frombuffer(raw, dtype=np.float32)
    hop = SR // 4                                             # khung 0,25 giây
    n = len(y) // hop
    if n < 8:
        return {"dur": round(len(y) / SR, 1), "lead": 0, "hook": None, "db": -20}
    rms = np.sqrt((y[:n * hop].reshape(n, hop) ** 2).mean(axis=1) + 1e-12)
    db = 20 * np.log10(rms)
    loud = float(np.percentile(db, 80))                        # độ to đại diện của bài
    on = np.nonzero(db > loud - 35)[0]                         # hết khoảng lặng đầu bài
    lead = max(0.0, on[0] * .25 - .1) if len(on) else 0.0
    # Điểm cao trào: lần đầu năng lượng (trung bình 4 giây) vượt ngưỡng cao và giữ được ít nhất 8 giây,
    # sau một đoạn nhỏ hơn rõ rệt. Thường là chỗ vào điệp khúc.
    k = 16
    sm = np.convolve(db, np.ones(k) / k, mode="same")
    hi = np.percentile(sm, 78)
    hook = None
    for i in range(int(15 / .25), n - 40):
        if sm[i] >= hi and sm[i - 20:i - 4].mean() < hi - 2.5 and sm[i:i + 32].min() >= hi - 3:
            j = i                                              # lùi về chỗ năng lượng bắt đầu bật lên
            while j > i - 16 and db[j - 1] > db[j] - 1.5 and sm[j - 1] > hi - 6:
                j -= 1
            hook = round(max(0.0, j * .25 - .5), 1)
            break
    return {"dur": round(len(y) / SR, 1), "lead": round(lead, 1), "hook": hook, "db": round(loud, 1)}


CACHE = os.path.join(HERE, "phan-tich.json")
try:
    cache = json.load(open(CACHE, encoding="utf-8"))
except (OSError, ValueError):
    cache = {}
try:
    meta = {(m["phase"], m["file"]): m for m in json.load(open(os.path.join(HERE, "nguon.json"), encoding="utf-8"))}
except (OSError, ValueError):
    meta = {}
natural = lambda s: [int(t) if t.isdigit() else t.lower() for t in re.split(r"(\d+)", s)]
exe = ffmpeg()

phases, total = [], 0
for pid, title, kind, hint in PHASES:
    d = os.path.join(HERE, pid)
    os.makedirs(d, exist_ok=True)
    songs = []
    for f in sorted((x for x in os.listdir(d) if x.lower().endswith(AUDIO)), key=natural):
        path = os.path.join(d, f)
        key = f"{pid}/{f}|{os.path.getsize(path)}"
        if key not in cache:
            try:
                cache[key] = analyse(path, exe)
                say("  đo:", pid, "/", f)
            except Exception as e:
                say("  không đo được:", f, "-", type(e).__name__, e)
                cache[key] = {"dur": 0, "lead": 0, "hook": None, "db": -20}
        a, m = cache[key], meta.get((pid, f), {})
        name = m.get("title") or os.path.splitext(f)[0]
        songs.append({"f": f, "t": name, "src": m.get("src", ""), "dur": a["dur"], "lead": a["lead"], "hook": a["hook"], "db": a["db"],
                      "fav": any(s.lower() in name.lower() for s in FAV.get(pid, []))})
    if kind == "diem" and songs and sum(s["fav"] for s in songs) > 1:      # khoảnh khắc sân khấu: mặc định chỉ một bài
        first = next(s for s in songs if s["fav"])
        for s in songs:
            s["fav"] = s is first
    total += len(songs)
    phases.append({"id": pid, "title": title, "kind": kind, "hint": hint, "songs": songs})
json.dump(cache, open(CACHE, "w", encoding="utf-8"), ensure_ascii=False)

# Cân âm lượng: bài to bị giảm xuống gần mức của nhóm bài nhỏ, để chuyển bài không giật mình
dbs = sorted(s["db"] for p in phases for s in p["songs"]) or [-20]
ref = dbs[len(dbs) // 5]
for p in phases:
    for s in p["songs"]:
        s["gain"] = round(min(1.0, max(.35, 10 ** ((ref - s.pop("db")) / 20))), 2)

with open(os.path.join(HERE, "list.js"), "w", encoding="utf-8") as fp:
    fp.write("window.CEREMONY = " + json.dumps(phases, ensure_ascii=False, separators=(",", ":")) + ";" + chr(10))
say("xong:", total, "bài trong", len(phases), "hạng mục")
for p in phases:
    fav = [s["t"] for s in p["songs"] if s["fav"]]
    say(f"  {p['title']}: {len(p['songs'])} bài | ưa thích: {'; '.join(fav) or '(chưa chọn)'}")
