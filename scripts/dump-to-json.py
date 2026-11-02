"""แปลงไฟล์ข้อความที่ export จาก Google Sheet (## Sheet name: ... + CSV) เป็น JSON {sheet: grid}"""
import csv, io, json, sys

src, out = sys.argv[1], sys.argv[2]
text = open(src, encoding="utf-8").read()
sheets, name, buf = {}, None, []
for line in text.split("\n"):
    if line.startswith("## Sheet name: "):
        if name is not None:
            sheets[name] = "\n".join(buf)
        name, buf = line[len("## Sheet name: "):].strip(), []
    else:
        buf.append(line)
if name is not None:
    sheets[name] = "\n".join(buf)
grids = {k: [row for row in csv.reader(io.StringIO(v))] for k, v in sheets.items()}
json.dump(grids, open(out, "w", encoding="utf-8"), ensure_ascii=False)
print({k: len(v) for k, v in grids.items()})
