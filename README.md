# FLIXO: C2C Escrow Marketplace & AI Dispute (Web Prototype)
## แพลตฟอร์มซื้อขายออนไลน์ระบบ Escrow และการตรวจสอบด้วยปัญญาประดิษฐ์ (เว็บต้นแบบ)

เว็บต้นแบบ (Web Prototype) สำหรับระบบการซื้อขายออนไลน์แบบ C2C (Consumer-to-Consumer) ที่มาพร้อมกับระบบชำระเงินผ่านตัวกลางกักเก็บเงิน (Escrow System) ระบบการยืนยันตัวตน (e-KYC) และระบบจัดการข้อพิพาทโดยมี AI ช่วยประเมินหลักฐานและการพูดคุย

**Senior Project — Computer Engineering**

---

## 📋 ข้อมูลเกี่ยวกับโปรเจกต์ (About the Project)

โปรเจกต์นี้จัดทำขึ้นเพื่อแก้ไขปัญหาการโกงและการเอารัดเอาเปรียบในการซื้อขายของออนไลน์ในประเทศไทย (P2P/C2C) โดยการจำลองการทำงานของเว็บแอปพลิเคชันที่รวมเอาความปลอดภัยของระบบ Escrow เข้ามาร่วมกับ AI เพื่อช่วยคัดกรองพฤติกรรมการโกงและการเปิดข้อพิพาทแบบอัตโนมัติ

### 🌟 ฟังก์ชันการใช้งานเด่น (Key Features)
1. **🔐 ระบบเงินฝากกลาง (Escrow Payment System)**
   - ผู้ซื้อชำระเงินผ่าน QR Code/PromptPay ยอดเงินจะถูกดึงไปกักเก็บไว้ที่บัญชีส่วนกลาง (Hold) ของระบบโดยยังไม่โอนให้ผู้ขาย
   - ผู้ขายจัดส่งพัสดุและแจ้งเลขพัสดุผ่านระบบ
   - ผู้ซื้อได้รับและตรวจสอบสินค้า จากนั้นกด "ยืนยันรับสินค้า" ยอดเงินจึงจะถูกปล่อยโอนให้ผู้ขาย (Release)
2. **🪪 ระบบยืนยันตัวตน (e-KYC Verification)**
   - จำลองระบบส่งเอกสารบัตรประชาชนและรูปถ่ายใบหน้า
   - มี AI ช่วยสแกนประเมินความสอดคล้องเบื้องต้น
   - มี Admin Console ในการตรวจสอบข้อมูลและอนุมัติสิทธิ์การทำธุรกรรมแบบแมนนวล
3. **🤖 ระบบจัดการข้อพิพาทและคัดกรองห้องแชท (AI Dispute & Chat Filter)**
   - **OpenTyphoon AI API (Typhoon LLM)** คัดกรองคำพูดคุยและบล็อกข้อความที่มีแนวโน้มการชักชวนให้โกงนอกระบบทันที
   - เมื่อเกิดข้อพิพาท (Dispute) ระบบ AI จะสรุปบทสนทนา 4 ข้อความล่าสุด วิเคราะห์หลักฐาน ประเมินความน่าจะเป็นของการโกง และแนะนำคำตัดสินส่งให้ผู้ดูแลระบบ (Admin) พิจารณาคดียอดเงินกักเก็บ
4. **💬 ระบบดีลและห้องเจรจา (In-Chat Deal Management)**
   - ผู้ขายสามารถสร้างข้อเสนอราคา รูปภาพ รายละเอียดสินค้า เพื่อส่งให้ผู้ซื้อแสกนจ่ายเงินเข้า Escrow ได้โดยตรงภายในห้องแชท

---

## 🛠️ เทคโนโลยีที่ใช้จริงในปัจจุบัน (Tech Stack)

| เลเยอร์ | เทคโนโลยีที่ใช้งานในโค้ดปัจจุบัน |
|---|---|
| **Frontend** | Single Page Application (SPA) พัฒนาด้วย **HTML5**, **Vanilla CSS (Modern UI/Glassmorphic Style)**, และ **Vanilla JavaScript (ES6)** |
| **Backend** | **Firebase** (Firebase Authentication + Cloud Firestore Database สำหรับการทำงานแบบ Real-time ข้ามอุปกรณ์) |
| **AI Integration** | **OpenTyphoon AI API (Typhoon LLM by SCB 10X)** สำหรับการกรองความปลอดภัยของแชทและการสรุปข้อพิพาท |
| **Payment Gateway** | PromptPay & TrueMoney (ระบบจำลอง - Stubbed/Local Simulation สำหรับตัวเว็บต้นแบบ) |
| **Shipping** | Kerry, Thailand Post (ระบบจำลองเลขพัสดุ - Stubbed) |

---

## 📁 โครงสร้างโปรเจกต์ (Project Structure)

```
c2c-escrow-prototype/
├── index.html        # ไฟล์หน้าเว็บหลัก (โครงสร้าง UI ทั้งหมด ระบบ Router และหน้า Modal)
├── app.js            # ไฟล์ควบคุม Logic, การเชื่อมต่อ Firebase, ระบบการคำนวณและตอบกลับของ AI
├── styles.css        # ไฟล์ตกแต่งหน้าเว็บแบบโมเดิร์น พร้อม HSL tailored colors และ Dark mode
├── deploy.bat        # สคริปต์สั้นสำหรับ Push ขึ้น GitHub Pages สะดวกต่อการทดสอบ
└── README.md         # เอกสารแนะนำโครงการนี้
```

---

## 🚀 วิธีเปิดใช้งานภายในเครื่อง (How to Run Locally)

1. **โคลนโปรเจกต์นี้ลงในเครื่องคอมพิวเตอร์ของคุณ**
   ```bash
   git clone https://github.com/meechiki/flixo-escrow.git
   ```
2. **การตั้งค่า Firebase (กรณีทดสอบด้วยฐานข้อมูลตัวเอง):**
   - เปิดไฟล์ `app.js` ไปที่บรรทัดที่ 10-18
   - แก้ไขวัตถุ `firebaseConfig` ให้ตรงกับแอปพลิเคชัน Firebase Project ของคุณเอง
   - ไปที่หน้า Firebase Console ของคุณและเปิดใช้งาน **Firestore Database** และ **Authentication (Phone Auth, Google Login)**
3. **รันหน้าเว็บ:**
   - คุณสามารถดับเบิ้ลคลิกเปิดไฟล์ `index.html` เพื่อทดสอบผ่าน Browser ได้ทันที หรือ
   - รันผ่าน local server เช่น Live Server ใน VS Code หรือ `http-server` ใน Node.js
