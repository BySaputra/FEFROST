# 🔐 Firebase Realtime Database Setup Guide

## 📋 Overview

Panduan lengkap untuk setup Firebase Realtime Database struktur yang benar untuk FEFROST Dashboard.

---

## 🏗️ Database Structure

Salin struktur JSON berikut ke Firebase Realtime Database:

```json
{
  "fefrost": {
    "monitoring": {
      "humidity": 65.5,
      "status": "SAFE",
      "temperature_room": 22.3,
      "temperature_storage": 4.1,
      "last_updated": "2026-05-09T10:30:45Z"
    },
    "products": {
      "product_001": {
        "product_name": "Premium Ice Cream",
        "category": "Frozen Desserts",
        "entry_date": "2026-04-09",
        "expired_date": "2026-06-09",
        "sensitivity": 3,
        "ideal_temp": 4,
        "added_at": "2026-04-09T08:00:00Z"
      },
      "product_002": {
        "product_name": "Frozen Vegetables",
        "category": "Vegetables",
        "entry_date": "2026-05-01",
        "expired_date": "2026-08-01",
        "sensitivity": 2,
        "ideal_temp": -18,
        "added_at": "2026-05-01T09:15:00Z"
      },
      "product_003": {
        "product_name": "Vaccine Storage",
        "category": "Medical",
        "entry_date": "2026-05-01",
        "expired_date": "2026-12-31",
        "sensitivity": 3,
        "ideal_temp": 2,
        "added_at": "2026-05-01T10:00:00Z"
      }
    },
    "logs": {
      "log_20260509_101": {
        "timestamp": "2026-05-09T10:30:45Z",
        "temperature_room": 22.3,
        "humidity": 65.5,
        "temperature_storage": 4.1,
        "status": "SAFE"
      },
      "log_20260509_102": {
        "timestamp": "2026-05-09T10:35:50Z",
        "temperature_room": 22.4,
        "humidity": 64.2,
        "temperature_storage": 4.3,
        "status": "SAFE"
      },
      "log_20260509_103": {
        "timestamp": "2026-05-09T10:40:55Z",
        "temperature_room": 23.1,
        "humidity": 68.9,
        "temperature_storage": 5.8,
        "status": "WARNING"
      }
    },
    "fefo_priority": []
  }
}
```

---

## 🔧 Data Field Reference

### **monitoring Node**

| Field | Type | Description | Example |
|---|---|---|---|
| `temperature_room` | number | Suhu ruangan (°C) | 22.3 |
| `humidity` | number | Kelembapan relatif (%) | 65.5 |
| `temperature_storage` | number | Suhu penyimpanan (°C) | 4.1 |
| `status` | string | Status monitoring | "SAFE", "WARNING", "CRITICAL" |
| `last_updated` | string | Timestamp update | "2026-05-09T10:30:45Z" |

### **products Node**

| Field | Type | Description | Example |
|---|---|---|---|
| `product_name` | string | Nama produk | "Premium Ice Cream" |
| `category` | string | Kategori produk | "Frozen Desserts" |
| `entry_date` | string | Tanggal masuk (YYYY-MM-DD) | "2026-04-09" |
| `expired_date` | string | Tanggal kadaluarsa (YYYY-MM-DD) | "2026-06-09" |
| `sensitivity` | number | Sensitivitas suhu (1-3) | 3 |
| `ideal_temp` | number | Suhu ideal (°C) | 4 |
| `added_at` | string | Timestamp ditambahkan | "2026-04-09T08:00:00Z" |

### **logs Node**

| Field | Type | Description | Example |
|---|---|---|---|
| `timestamp` | string | Waktu log | "2026-05-09T10:30:45Z" |
| `temperature_room` | number | Suhu ruangan saat log | 22.3 |
| `humidity` | number | Kelembapan saat log | 65.5 |
| `temperature_storage` | number | Suhu storage saat log | 4.1 |
| `status` | string | Status saat log | "SAFE", "WARNING", "CRITICAL" |

---

## 🔐 Firebase Rules (Security)

Untuk production, gunakan rules berikut di Firebase Console:

```json
{
  "rules": {
    "fefrost": {
      ".read": true,
      ".write": false,
      "monitoring": {
        ".write": "auth.uid != null"
      },
      "products": {
        ".write": "auth.uid != null"
      },
      "logs": {
        ".write": "auth.uid != null"
      }
    }
  }
}
```

---

## 📊 Sample Data Generator (untuk testing)

Jalankan kode ini di Firebase Console untuk generate sample data:

```javascript
// Copy & paste di Firebase Realtime Database Console
// atau gunakan Firebase Admin SDK

const generateSampleData = () => {
  const database = getDatabase();
  
  // Monitoring data
  set(ref(database, 'fefrost/monitoring'), {
    temperature_room: 22.5,
    humidity: 65.5,
    temperature_storage: 4.2,
    status: 'SAFE',
    last_updated: new Date().toISOString()
  });

  // Products
  const products = {
    product_001: {
      product_name: 'Ice Cream',
      category: 'Dessert',
      entry_date: '2026-04-09',
      expired_date: '2026-06-09',
      sensitivity: 3,
      ideal_temp: 4
    }
  };
  set(ref(database, 'fefrost/products'), products);

  console.log('Sample data created!');
};
```

---

## ⚙️ Integration Checklist

- [ ] Firebase project created at https://console.firebase.google.com
- [ ] Realtime Database enabled
- [ ] Database URL copied to `config/firebase-config.js`
- [ ] Database structure created (JSON imported)
- [ ] Security rules configured
- [ ] Test data added
- [ ] Listeners working (check browser console)
- [ ] SPA navigation functional

---

## 🧪 Manual Testing Steps

### **Test 1: Verify Monitoring Listener**
1. Open Firebase Console
2. Go to Realtime Database
3. Edit `fefrost/monitoring/temperature_storage` value
4. Check dashboard - Monitoring section should update in real-time

### **Test 2: Verify Products**
1. Go to Products section in dashboard
2. Add new product with test data
3. Check Firebase Console - should appear in `fefrost/products`

### **Test 3: Verify FEFO Calculation**
1. Ensure at least 1 product exists
2. Go to FEFO section
3. Product should display with calculated risk score
4. Change monitoring temperature → risk score should update

### **Test 4: Verify Logs**
1. Ensure logs exist in `fefrost/logs`
2. Go to Logs section
3. Recent logs should display sorted by timestamp
4. Check newest entry appears on top

---

## 🐛 Debugging Firebase Issues

### **Listener not working?**

Check browser console:
```javascript
// Should see logs like:
[FEFO] Realtime listener attached successfully
[LOGS] Realtime listener attached successfully
```

If not, verify:
1. Firebase credentials correct in `config/firebase-config.js`
2. Internet connection active
3. Firebase project not paused
4. Database rules allow read access

### **Data not appearing?**

```javascript
// Test in browser console:
import { ref, get } from "firebase/database";
import { database } from "./config/firebase-config.js";

get(ref(database, 'fefrost/products')).then(snap => {
  console.log('Products:', snap.val());
});
```

### **Performance issues?**

- Limit logs display to 50 items (already done)
- Add indexes to Firebase for large datasets
- Use pagination for products if >1000 items

---

## 📈 Scalability Considerations

For production with large datasets:

1. **Add Indexes:**
   ```json
   {
     ".indexOn": ["timestamp", "status"]
   }
   ```

2. **Pagination:**
   ```javascript
   const query = query(
     ref(database, "fefrost/logs"),
     orderByChild("timestamp"),
     limitToLast(50)
   );
   ```

3. **Batching:**
   - Process logs in batches of 50
   - Archive old logs to separate node

4. **Caching:**
   - Store FEFO results in `fefo_priority` node
   - Reduce recalculation frequency

---

## 🚀 Deployment Checklist

Before production:

- [ ] Security rules configured properly
- [ ] API keys restricted to web domain
- [ ] Database backup enabled
- [ ] Monitoring alerts configured
- [ ] Error logging to external service
- [ ] Performance metrics tracked
- [ ] Data retention policy defined

---

**Version:** 1.0.0  
**Last Updated:** May 9, 2026
