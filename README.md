# Litania X — RPG Prototype

ผมเคยทำ prototype RPG ตัวนี้ไว้ แต่ตอนนี้ย้ายไปพัฒนาโปรเจกต์ใหม่แล้ว
เลยเปิด source ของเวอร์ชันเก่าไว้ เผื่อใครอยากเอาไปศึกษา ทดลอง หรือต่อยอดครับ

โปรเจกต์นี้เป็น prototype เก่าที่หยุดพัฒนาแล้ว ยังมีเนื้อหาและภาพบางส่วนที่เป็น
placeholder และไม่ได้เป็นเกมที่เสร็จสมบูรณ์ ผมเก็บเวอร์ชันนี้ไว้เป็นตัวอย่าง
ของระบบสำรวจแผนที่ การต่อสู้แบบ turn-based และระบบพื้นฐานของเกม RPG

## ในเวอร์ชันนี้มีอะไรบ้าง

- แผนที่สำรวจ 4 แผนที่ และการต่อสู้แบบ turn-based
- บทสนทนา ร้านค้า inventory/equipment และเมนู skill
- การตั้งค่าและระบบบันทึกใน browser พร้อม Continue
- เครื่องมือ map editor และชุด regression tests

เพลงประกอบและเสียง ambience ที่เล่นต่อเนื่องถูกนำออกจาก repo นี้แล้ว
เสียง SFX สำหรับการโจมตี skill UI และเหตุการณ์ในเกมยังอยู่ครบครับ

## วิธีเปิดเล่น

เกมใช้ HTML, CSS และ JavaScript โดยตรง ไม่มี game engine หรือ framework
และไม่ต้อง build ใช้ desktop browser รุ่นปัจจุบันและ Node.js 22 ขึ้นไป
สำหรับเปิด local server และรัน checks

จากโฟลเดอร์ repo ให้รัน:

```sh
node scripts/preview-exploration.mjs
```

เปิด [เกมในเครื่อง](http://127.0.0.1:8080/) แล้วเลือก **New Game**
ควรเปิดผ่าน HTTP server เพราะเกมใช้ JavaScript modules
หยุด server ด้วย Ctrl+C

New Game เริ่มที่ Front Forest เส้นทางหลักคือ
Deep Forest ↔ Front Forest ↔ Town South ↔ Town North
ระบบ save ผูกกับ browser และ origin ที่ใช้งาน หากเปลี่ยน browser ชื่อ host
หรือ port จะใช้พื้นที่ save คนละชุดกัน

## ปุ่มควบคุม

| ส่วนของเกม | ปุ่ม |
| --- | --- |
| เมนูหลัก | ลูกศรขึ้น/ลง หรือ W/S เพื่อเลือก; Enter/Space เพื่อยืนยัน; ใช้เมาส์ได้ |
| สำรวจ | WASD หรือปุ่มลูกศรเพื่อเดิน; E/Space เพื่อโต้ตอบ |
| เมนู | B เปิด inventory/equipment; K เปิด skill; Escape ปิดเมนู |
| ต่อสู้ | ใช้ปุ่มคำสั่งบนหน้าจอ หรือ keyboard navigation |
| ดู geometry | F2 เปิด/ปิดภาพอ้างอิง collision และ warp overlays |

เปิด [map editor](http://127.0.0.1:8080/map-editor.html) หรือ
[blockout inspector](http://127.0.0.1:8080/index.html?scene=map-blockout)
ได้ขณะที่ local server ทำงาน

## ตรวจสอบโค้ด

```sh
node scripts/run-checks.mjs
```

คำสั่งนี้ตรวจ syntax และรัน regression tests ทั้ง 36 ไฟล์
หากต้องการตรวจเฉพาะ syntax ใช้ `--syntax-only`

หากมี Playwright และเปิด local server อยู่ สามารถรัน browser smoke check ได้:

```sh
node scripts/browser-smoke.cjs
```

บน Windows จะใช้ Edge ที่ติดตั้งไว้ ส่วนระบบอื่นใช้ Playwright Chromium
ตั้ง `BROWSER_CHANNEL` หรือ `EXPLORATION_URL` เพื่อเปลี่ยนค่าได้
Google Fonts เป็นส่วนเสริมด้านตัวอักษร เกมใช้ system fonts แทนได้เมื่อไม่มี network

## โครงสร้างและเอกสาร

- `game.js`: จุดเริ่มต้นของโปรแกรม
- `src/`: scene ระบบต่อสู้ state และข้อมูล content
- `assets/`: ภาพและ SFX
- `tests/`: regression tests

ดู [asset guide](ASSET_GUIDE.md), [game flow](GAME_FLOW.md),
[battle flow](BATTLE_FLOW.md) และ [release audit](docs/PUBLIC_RELEASE_AUDIT.md)
สำหรับรายละเอียด เอกสารพัฒนาบางส่วนอธิบายระบบในเวอร์ชันก่อนหน้า
ระบบ story/campaign ที่กว้างกว่าตัว demo ยังเป็นงานทดลองและไม่ได้ตรวจครบทุกเส้นทาง

## License และ assets

ยังไม่ได้กำหนด License ของโปรเจกต์ ข้อความเกี่ยวกับการศึกษา ทดลอง และต่อยอด
ข้างต้นเป็นจุดประสงค์ของการแชร์ ไม่ใช่การให้สิทธิ์ตาม License
เจ้าของโปรเจกต์ต้องเลือก License และตรวจ
[สิทธิ์เผยแพร่ assets](docs/THIRD_PARTY_ASSETS.md) ก่อนเผยแพร่ต่อสาธารณะ

Repo นี้เริ่ม Git history ใหม่จาก source ที่ทำความสะอาดแล้ว
ไม่ได้นำประวัติ commit เพลง หรือข้อมูลผู้เขียน commit จาก repo เดิมมาด้วย
