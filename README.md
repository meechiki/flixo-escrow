# C2C Escrow Marketplace
## (แพลตฟอร์มซื้อขายออนไลน์ระบบ Escrow และการตรวจสอบด้วยปัญญาประดิษฐ์)

A consumer-to-consumer (C2C) marketplace mobile application featuring an integrated escrow payment system, e-KYC identity verification, and AI-powered dispute resolution.

**Senior Project — Computer Engineering**

---

## 📋 About the Project

Online marketplace disputes are one of the leading categories of consumer complaints in Thailand, often stemming from delayed deliveries, item misrepresentation, or non-payment. This project addresses that problem by building a mobile marketplace where:

- Buyer funds are held in escrow until delivery is confirmed
- Seller identity is verified through e-KYC before listing/selling
- Disputes between buyers and sellers are analyzed and assisted by an AI system

The goal is to reduce trust friction in peer-to-peer online transactions and provide a safer alternative to unmediated C2C selling.

## ✨ Key Features

- 🔐 **Escrow Payment System** — Funds are held from the buyer and released to the seller only upon delivery confirmation
- 🪪 **e-KYC Verification** — Identity verification for sellers to reduce fraud
- 🤖 **AI Dispute Resolution** — AI-assisted analysis of buyer/seller disputes via the Anthropic API
- 💬 **In-Chat Cart Management** — Buyers and sellers can manage transactions directly within chat
- 📊 **Admin Dashboard** — Oversight tools for monitoring transactions and disputes

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Flutter (built via FlutterFlow) |
| Backend | Firebase (Authentication, Firestore, Cloud Storage) |
| AI | Anthropic API (dispute analysis) |
| Payment Gateway | Omise, PromptPay *(stubbed — planned for future implementation)* |
| Shipping | Third-party shipping API *(stubbed — planned for future implementation)* |

## 📁 Project Structure
