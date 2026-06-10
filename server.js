const express = require('express');
const fs = require('fs');
const path = require('path');
const nodemailer = require('nodemailer');
const axios = require('axios');
const admin = require('firebase-admin');
const jwt = require('jsonwebtoken');
require('dotenv').config();

// ✅ قراءة JSON الخاص بـ Firebase من متغير البيئة FIREBASE_CONFIG
const serviceAccount = JSON.parse(process.env.FIREBASE_CONFIG);

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

const app = express();
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static('public'));

// إعداد nodemailer مع بيانات SMTP من .env
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

// ✅ دوال إرسال البريد الإلكتروني المحسنة
function getPercentageClass(percentage) {
  if (percentage >= 70) return 'high';
  if (percentage >= 50) return 'medium';
  return 'low';
}

async function sendProfessionalEmail(to, studentData, customMessage = '') {
  try {
    const htmlTemplate = `
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
      <head>
        <meta charset="UTF-8">
        <title>نتيجة الطالب - gizaresult</title>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@300;400;500;700;800&display=swap');
          body { font-family: 'Tajawal', sans-serif; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px; }
          .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 20px; overflow: hidden; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 40px 30px; text-align: center; }
          .content { padding: 40px 30px; }
          .result-card { background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%); border-radius: 15px; padding: 30px; text-align: center; }
          .percentage { font-size: 48px; font-weight: 800; margin: 20px 0; }
          .percentage.high { color: #4CAF50; }
          .percentage.medium { color: #FF9800; }
          .percentage.low { color: #f44336; }
          .info-row { display: flex; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid #e0e0e0; }
          .status-pass { background: #4CAF50; color: white; display: inline-block; padding: 8px 20px; border-radius: 50px; }
          .status-fail { background: #f44336; color: white; display: inline-block; padding: 8px 20px; border-radius: 50px; }
          .footer { background: #f8f9fa; padding: 30px; text-align: center; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header"><h1>🏆 نتيجة الطالب</h1><p>نظام النتائج الإلكتروني - gizaresult</p></div>
          <div class="content">
            <div class="result-card">
              <div class="percentage ${getPercentageClass(studentData.percentage)}">${studentData.percentage}%</div>
              <div class="info-row"><span>📝 رقم الجلوس:</span><span>${studentData.seatNumber}</span></div>
              <div class="info-row"><span>👤 اسم الطالب:</span><span>${studentData.name || 'غير محدد'}</span></div>
              <div class="info-row"><span>📚 الصف الدراسي:</span><span>${studentData.gradeLevel || 'غير محدد'}</span></div>
              <div class="info-row"><span>🏫 المدرسة:</span><span>${studentData.schoolName || 'غير محددة'}</span></div>
              <div class="${studentData.percentage >= 50 ? 'status-pass' : 'status-fail'}">${studentData.percentage >= 50 ? '✓ ناجح' : '✗ غير ناجح'}</div>
            </div>
            ${customMessage ? `<div style="background:#e8f5e9; padding:20px; border-radius:10px; margin-top:20px;"><strong>💬 رسالة خاصة:</strong><br>${customMessage}</div>` : ''}
          </div>
          <div class="footer"><p>© ${new Date().getFullYear()} gizaresult - جميع الحقوق محفوظة</p></div>
        </div>
      </body>
      </html>
    `;
    
    const info = await transporter.sendMail({
      from: `"gizaresult" <${process.env.SMTP_USER}>`,
      to: to,
      subject: '🎓 نتيجة الاختبار',
      text: `السلام عليكم،\n\nالنتيجة:\nرقم الجلوس: ${studentData.seatNumber}\nالاسم: ${studentData.name}\nالنسبة: ${studentData.percentage}%\n\n${customMessage}`,
      html: htmlTemplate
    });
    
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Error sending email:', error);
    return { success: false, error: error.message };
  }
}

async function sendResultBySeatNumber(seatNumber, email, customMessage = '') {
  try {
    const resultsRef = db.collection('results');
    const resultSnap = await resultsRef.where('seatNumber', '==', seatNumber).get();
    
    if (resultSnap.empty) {
      return { success: false, message: 'لم يتم العثور على نتيجة لهذا الرقم' };
    }
    
    const studentData = resultSnap.docs[0].data();
    const emailResult = await sendProfessionalEmail(email, studentData, customMessage);
    
    if (emailResult.success) {
      await db.collection('email_logs').add({
        seatNumber: seatNumber,
        email: email,
        sentAt: new Date().toISOString(),
        message: customMessage
      });
      return { success: true, message: 'تم إرسال النتيجة بنجاح' };
    } else {
      return { success: false, message: emailResult.error };
    }
  } catch (error) {
    console.error('Error sending result:', error);
    return { success: false, message: error.message };
  }
}

async function sendEmailNotification(subject, text) {
  try {
    await transporter.sendMail({
      from: process.env.SMTP_USER,
      to: process.env.NOTIFICATION_EMAIL,
      subject: subject,
      text: text
    });
  } catch (error) {
    console.error('Error sending email notification:', error);
  }
}

async function sendTelegramNotification(message) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!botToken || !chatId) return;

  try {
    await axios.post(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      chat_id: chatId,
      text: message,
      parse_mode: 'HTML'
    });
  } catch (error) {
    console.error('Error sending Telegram:', error.message);
  }
}

function authenticateAdmin(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader) return res.status(401).json({ success: false, message: 'Unauthorized' });

  const token = authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ success: false, message: 'Unauthorized' });

  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) return res.status(403).json({ success: false, message: 'Forbidden' });
    req.admin = decoded;
    next();
  });
}

// ----------------- Routes -----------------

app.get('/api/requests', authenticateAdmin, async (req, res) => {
  try {
    const snap = await db.collection('requests').get();
    const requests = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.json({ requests });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ✅ مسار الدفع - بدون رفع ملفات
app.post('/pay', async (req, res) => {
  try {
    const { nationalId, seatNumber, phone, email } = req.body;
    
    if (!nationalId || !seatNumber || !phone || !email) {
      return res.status(400).send('جميع الحقول مطلوبة');
    }

    const cleanPhone = phone.replace(/\D/g, '');

    const newRequest = {
      nationalId,
      seatNumber,
      phone: cleanPhone,
      email,
      paid: false,
      created_at: new Date().toISOString()
    };

    await db.collection('requests').add(newRequest);

    await sendEmailNotification('طلب دفع جديد', JSON.stringify(newRequest, null, 2));
    await sendTelegramNotification(`طلب دفع جديد:\nالرقم القومي: ${nationalId}\nرقم الجلوس: ${seatNumber}\nالهاتف: ${cleanPhone}\nالبريد: ${email}`);

    res.send('تم تسجيل طلبك، سيتم التأكد من الدفع قريبًا.');
  } catch (error) {
    console.error('Error in /pay:', error);
    res.status(500).send(`حدث خطأ: ${error.message}`);
  }
});

// ✅ مسار الحجز - بدون رفع ملفات
app.post('/reserve', async (req, res) => {
  try {
    const { nationalId, phone, email, senderPhone } = req.body;
    if (!nationalId || !phone || !email || !senderPhone) {
      return res.status(400).send('البيانات غير مكتملة');
    }

    const cleanPhone = phone.replace(/\D/g, '');
    const cleanSenderPhone = senderPhone.replace(/\D/g, '');

    const newReservation = {
      nationalId,
      phone: cleanPhone,
      email,
      senderPhone: cleanSenderPhone,
      reserved_at: new Date().toISOString()
    };

    await db.collection('reservations').add(newReservation);

    await sendEmailNotification('طلب حجز جديد', JSON.stringify(newReservation, null, 2));
    await sendTelegramNotification(`طلب حجز جديد:\nالرقم القومي: ${nationalId}\nالهاتف: ${cleanPhone}\nالبريد: ${email}\nرقم المحول: ${cleanSenderPhone}`);

    res.send('تم تسجيل الحجز بنجاح.');
  } catch (error) {
    console.error('Error in /reserve:', error);
    res.status(500).send('حدث خطأ أثناء معالجة الحجز');
  }
});

app.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (username === process.env.ADMIN_USER && password === process.env.ADMIN_PASS) {
    const token = jwt.sign({ username }, process.env.JWT_SECRET, { expiresIn: '24h' });
    return res.json({ success: true, token, expiresIn: '24h' });
  }
  res.status(401).json({ success: false, message: 'خطأ في تسجيل الدخول' });
});

app.post('/api/check-result', async (req, res) => {
  const { phone, seatNumber } = req.body;

  try {
    const requestsRef = db.collection('requests');
    let query = requestsRef.where('phone', '==', phone);
    if (seatNumber) query = requestsRef.where('seatNumber', '==', seatNumber);

    const snap = await query.get();
    if (snap.empty) {
      return res.status(404).json({ success: false, message: 'لم يتم العثور على نتيجة' });
    }

    const requestData = snap.docs[0].data();
    if (!requestData.paid) {
      return res.status(402).json({ success: false, message: 'لم يتم الدفع بعد' });
    }

    if (requestData.result) {
      return res.json({ success: true, result: requestData.result });
    }

    if (requestData.seatNumber) {
      const resultSnap = await db.collection('results').where('seatNumber', '==', requestData.seatNumber).get();
      if (!resultSnap.empty) {
        const resultData = resultSnap.docs[0].data();
        await snap.docs[0].ref.update({ result: resultData });
        return res.json({ success: true, result: resultData });
      }
    }

    res.status(404).json({ success: false, message: 'النتيجة غير متوفرة' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.post('/api/open-result', authenticateAdmin, async (req, res) => {
  const { seatNumber } = req.body;
  try {
    const requestSnap = await db.collection('requests').where('seatNumber', '==', seatNumber).get();
    if (requestSnap.empty) return res.status(404).json({ success: false, message: 'لم يتم العثور على الطلب' });

    const resultSnap = await db.collection('results').where('seatNumber', '==', seatNumber).get();
    if (resultSnap.empty) return res.status(404).json({ success: false, message: 'لم يتم العثور على النتيجة' });

    await requestSnap.docs[0].ref.update({
      paid: true,
      result: resultSnap.docs[0].data(),
      openedAt: new Date().toISOString()
    });

    res.json({ success: true, message: 'تم فتح النتيجة بنجاح' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.post('/api/send-admin-message', authenticateAdmin, async (req, res) => {
  const { seatNumber, email, message } = req.body;
  if (!seatNumber || !email) {
    return res.status(400).json({ success: false, message: 'رقم الجلوس والبريد الإلكتروني مطلوبين' });
  }
  try {
    const result = await sendResultBySeatNumber(seatNumber, email, message);
    if (result.success) {
      await sendTelegramNotification(`تم إرسال نتيجة بنجاح\nرقم الجلوس: ${seatNumber}\nالبريد: ${email}`);
      res.json({ success: true, message: 'تم إرسال النتيجة بنجاح' });
    } else {
      res.status(404).json({ success: false, message: result.message });
    }
  } catch (err) {
    res.status(500).json({ success: false, error: 'حدث خطأ أثناء الإرسال' });
  }
});

app.post('/api/chat-inquiries', async (req, res) => {
  try {
    const { message, userData } = req.body;
    if (!message) return res.status(400).json({ success: false, message: 'الرسالة مطلوبة' });

    const newInquiry = {
      message,
      userData: userData || {},
      created_at: new Date().toISOString(),
      status: 'new'
    };

    const docRef = await db.collection('chat_inquiries').add(newInquiry);
    await sendTelegramNotification(`💬 استفسار جديد:\nالاسم: ${userData.name || 'غير معروف'}\nالهاتف: ${userData.phone || 'غير معروف'}\nالرسالة: ${message}`);

    res.json({ success: true, id: docRef.id, message: 'تم إرسال استفسارك بنجاح' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'حدث خطأ أثناء الإرسال' });
  }
});

app.get('/api/chat-inquiries', authenticateAdmin, async (req, res) => {
  try {
    const snap = await db.collection('chat_inquiries').orderBy('created_at', 'desc').get();
    const inquiries = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.json({ inquiries });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.delete('/api/chat-inquiries/:id', authenticateAdmin, async (req, res) => {
  try {
    await db.collection('chat_inquiries').doc(req.params.id).delete();
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.get('/api/results', authenticateAdmin, async (req, res) => {
  try {
    const snap = await db.collection('results').get();
    const results = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.json({ results });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.get('/api/reservations', authenticateAdmin, async (req, res) => {
  try {
    const snap = await db.collection('reservations').get();
    const reservations = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.json({ reservations });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.delete('/api/reservations/:id', authenticateAdmin, async (req, res) => {
  try {
    await db.collection('reservations').doc(req.params.id).delete();
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.delete('/api/requests/:id', authenticateAdmin, async (req, res) => {
  try {
    await db.collection('requests').doc(req.params.id).delete();
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.get('/dashboard', authenticateAdmin, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Server running on port ${port}`));
module.exports = app;
