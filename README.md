# ❄️ FEFROST

Smart Cold Storage berbasis Internet of Things (IoT) dengan metode  
**Adaptive First Expired First Out (FEFO)** untuk meningkatkan efisiensi  
dan kualitas penyimpanan produk sensitif seperti makanan, farmasi,  
dan produk rantai dingin lainnya.

---

![ESP32](https://img.shields.io/badge/ESP32-IoT-blue)
![Platform](https://img.shields.io/badge/Platform-Web%20Dashboard-green)
![Status](https://img.shields.io/badge/Status-Development-orange)
![License](https://img.shields.io/badge/License-MIT-lightgrey)

---

## 📌 About Project

FEFROST merupakan prototipe sistem smart cold storage yang dirancang
untuk melakukan monitoring suhu dan kelembapan secara real-time
menggunakan teknologi Internet of Things (IoT).

Sistem ini tidak hanya berfungsi sebagai alat monitoring lingkungan,
tetapi juga mengintegrasikan metode **Adaptive FEFO (First Expired First Out)** 
untuk menentukan prioritas distribusi produk berdasarkan:

- 📅 Tanggal kedaluwarsa
- 🌡️ Kondisi suhu penyimpanan
- 💧 Kelembapan lingkungan
- ⏱️ Durasi penyimpanan produk

Dengan pendekatan ini, sistem mampu membantu mengurangi risiko
produk rusak atau kedaluwarsa akibat kondisi penyimpanan yang tidak stabil.

---

## 🎯 Main Objectives

- Monitoring suhu dan kelembapan secara real-time
- Meningkatkan efisiensi pengelolaan cold storage
- Mengurangi pemborosan produk akibat kerusakan
- Membantu prioritas distribusi produk secara otomatis
- Mendukung sistem rantai dingin (cold chain) yang lebih cerdas

---

## 🧠 Core Concept

Berbeda dari metode FIFO tradisional, FEFROST menggunakan pendekatan
Adaptive FEFO yang mempertimbangkan kondisi lingkungan penyimpanan
secara dinamis.

Sistem akan:

1. Membaca data suhu dan kelembapan dari sensor IoT
2. Mengirim data ke server/cloud
3. Menganalisis kondisi penyimpanan produk
4. Menghitung prioritas distribusi
5. Menampilkan rekomendasi produk yang harus dikeluarkan lebih dahulu

Dengan konsep ini, prioritas distribusi tidak hanya berdasarkan
tanggal kedaluwarsa, tetapi juga berdasarkan kondisi aktual produk
selama proses penyimpanan.

---
# ✨ Main Features

## 🌡️ Real-Time Temperature Monitoring

FEFROST mampu memantau suhu cold storage secara real-time
menggunakan sensor digital yang terhubung dengan sistem IoT.

Fitur ini membantu memastikan kondisi penyimpanan tetap stabil
untuk menjaga kualitas produk selama proses penyimpanan.

---

## 💧 Humidity Monitoring

Selain suhu, sistem juga melakukan monitoring kelembapan
untuk mengurangi risiko kerusakan produk akibat kondisi
lingkungan yang terlalu lembap atau terlalu kering.

Data kelembapan ditampilkan langsung pada dashboard monitoring.

---

## 📡 IoT Cloud Communication

Semua data sensor dikirim secara otomatis ke server/cloud
menggunakan koneksi internet melalui ESP32.

Sistem memungkinkan monitoring dilakukan dari jarak jauh
melalui dashboard berbasis web.

---

## 📦 Adaptive FEFO System

FEFROST menggunakan metode **Adaptive First Expired First Out (FEFO)**.

Prioritas distribusi produk tidak hanya berdasarkan tanggal
kedaluwarsa, tetapi juga mempertimbangkan:

- suhu penyimpanan,
- kelembapan,
- dan kondisi lingkungan aktual.

Dengan pendekatan ini, sistem dapat menentukan produk
mana yang harus diprioritaskan keluar terlebih dahulu.

---

## 📊 Smart Monitoring Dashboard

Dashboard monitoring menampilkan informasi penting seperti:

- suhu real-time,
- kelembapan,
- status sensor,
- kondisi cold storage,
- dan prioritas distribusi produk.

Semua data divisualisasikan secara sederhana dan mudah dipahami.

---

## 🚨 Alert & Notification System

Sistem dapat memberikan peringatan ketika:

- suhu melebihi batas aman,
- kelembapan tidak stabil,
- sensor mengalami gangguan,
- atau terjadi kondisi abnormal lainnya.

Fitur ini membantu pengguna melakukan tindakan lebih cepat.

---

## 🧠 Dynamic Product Prioritization

FEFROST mampu memperbarui prioritas distribusi secara dinamis
berdasarkan perubahan kondisi penyimpanan.

Sistem akan terus melakukan evaluasi terhadap kondisi produk
selama berada di dalam cold storage.

---

## 🗂️ Inventory Monitoring

Sistem mendukung pencatatan data produk seperti:

- nama produk,
- tanggal masuk,
- tanggal kedaluwarsa,
- dan status distribusi.

Dengan fitur ini, pengelolaan stok menjadi lebih terstruktur.

---

## 🔄 Continuous Monitoring System

FEFROST bekerja secara terus-menerus untuk melakukan:

- pembacaan sensor,
- pengiriman data,
- analisis kondisi lingkungan,
- dan pembaruan informasi dashboard secara otomatis.

---

## 🧪 Prototype-Based Development

Sistem dikembangkan dalam bentuk prototipe untuk mendukung:

- penelitian,
- pengujian sistem,
- validasi metode Adaptive FEFO,
- dan pengembangan smart cold storage di masa depan.

---