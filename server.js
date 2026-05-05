const express = require('express');
const fileUpload = require('express-fileupload');
const fs = require('fs');
const path = require('path');
const nodemailer = require('nodemailer');
const axios = require('axios');
const admin = require('firebase-admin');
const jwt = require('jsonwebtoken');
require('dotenv').config();

// ✅ إضافة Cloudinary
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');

// ✅ إعداد Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// ✅ إعداد التخزين على Cloudinary
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'gizaresult',
    format: async (req, file) => {
      const ext = path.extname(file.originalname).toLowerCase();
      if (ext === '.png') return 'png';
      if (ext === '.jpg' || ext === '.jpeg') return 'jpg';
      return 'png';
    },
    public_id: (req, file) => Date.now() + '-' + Math.round(Math.random() * 1E9)
  }
});

const upload = multer({ storage: storage });

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
app.use(fileUpload());

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
    // تصميم HTML احترافي للبريد الإلكتروني
    const htmlTemplate = `
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>نتيجة الطالب - gizaresult</title>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@300;400;500;700;800&display=swap');
          
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          
          body {
            font-family: 'Tajawal', sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            padding: 20px;
          }
          
          .container {
            max-width: 600px;
            margin: 0 auto;
            background: white;
            border-radius: 20px;
            overflow: hidden;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
            animation: slideIn 0.5s ease-out;
          }
          
          @keyframes slideIn {
            from {
              opacity: 0;
              transform: translateY(-30px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }
          
          .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 40px 30px;
            text-align: center;
          }
          
          .header h1 {
            font-size: 28px;
            margin-bottom: 10px;
            font-weight: 800;
          }
          
          .header p {
            font-size: 14px;
            opacity: 0.9;
          }
          
          .content {
            padding: 40px 30px;
            background: white;
          }
          
          .result-card {
            background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
            border-radius: 15px;
            padding: 30px;
            margin: 20px 0;
            text-align: center;
          }
          
          .result-title {
            font-size: 24px;
            font-weight: 800;
            color: #667eea;
            margin-bottom: 20px;
          }
          
          .percentage {
            font-size: 48px;
            font-weight: 800;
            margin: 20px 0;
          }
          
          .percentage.high {
            color: #4CAF50;
          }
          
          .percentage.medium {
            color: #FF9800;
          }
          
          .percentage.low {
            color: #f44336;
          }
          
          .info-row {
            display: flex;
            justify-content: space-between;
            padding: 12px 0;
            border-bottom: 1px solid #e0e0e0;
            margin: 10px 0;
          }
          
          .info-label {
            font-weight: 700;
            color: #555;
          }
          
          .info-value {
            color: #333;
            font-weight: 500;
          }
          
          .status-badge {
            display: inline-block;
            padding: 8px 20px;
            border-radius: 50px;
            font-weight: 700;
            margin-top: 20px;
          }
          
          .status-pass {
            background: #4CAF50;
            color: white;
          }
          
          .status-fail {
            background: #f44336;
            color: white;
          }
          
          .notes {
            background: #fff3e0;
            padding: 15px;
            border-radius: 10px;
            margin: 20px 0;
            border-right: 4px solid #FF9800;
          }
          
          .footer {
            background: #f8f9fa;
            padding: 30px;
            text-align: center;
            border-top: 1px solid #e0e0e0;
          }
          
          .footer p {
            color: #666;
            margin: 5px 0;
          }
          
          .btn {
            display: inline-block;
            padding: 12px 30px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            text-decoration: none;
            border-radius: 50px;
            margin: 20px 0;
            font-weight: 700;
            transition: transform 0.3s;
          }
          
          .btn:hover {
            transform: translateY(-2px);
          }
          
          .custom-message {
            background: #e8f5e9;
            padding: 20px;
            border-radius: 10px;
            margin: 20px 0;
            border-right: 4px solid #4CAF50;
          }
          
          @media (max-width: 480px) {
            .content {
              padding: 20px;
            }
            
            .info-row {
              flex-direction: column;
              gap: 5px;
            }
            
            .percentage {
              font-size: 36px;
            }
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🏆 نتيجة الطالب</h1>
            <p>نظام النتائج الإلكتروني - gizaresult</p>
          </div>
          
          <div class="content">
            <div class="result-card">
              <div class="result-title">نتيجة الاختبار</div>
              
              <div class="percentage ${getPercentageClass(studentData.percentage)}">
                ${studentData.percentage}%
              </div>
              
              <div class="info-row">
                <span class="info-label">📝 رقم الجلوس:</span>
                <span class="info-value">${studentData.seatNumber}</span>
              </div>
              
              <div class="info-row">
                <span class="info-label">👤 اسم الطالب:</span>
                <span class="info-value">${studentData.name || 'غير محدد'}</span>
              </div>
              
              <div class="info-row">
                <span class="info-label">📚 الصف الدراسي:</span>
                <span class="info-value">${studentData.gradeLevel || 'غير محدد'}</span>
              </div>
              
              <div class="info-row">
                <span class="info-label">🏫 المدرسة:</span>
                <span class="info-value">${studentData.schoolName || 'غير محددة'}</span>
              </div>
              
              <div class="status-badge ${studentData.percentage >= 50 ? 'status-pass' : 'status-fail'}">
                ${studentData.percentage >= 50 ? '✓ ناجح' : '✗ غير ناجح'}
              </div>
            </div>
            
            ${studentData.notes ? `
              <div class="notes">
                <strong>📌 ملاحظات:</strong><br>
                ${studentData.notes}
              </div>
            ` : ''}
            
            ${customMessage ? `
              <div class="custom-message">
                <strong>💬 رسالة خاصة:</strong><br>
                ${customMessage}
              </div>
            ` : ''}
          </div>
          
          <div class="footer">
            <p>📧 هذا البريد إلكتروني آلي، يرجى عدم الرد عليه</p>
            <p>© ${new Date().getFullYear()} gizaresult - جميع الحقوق محفوظة</p>
            <p style="font-size: 12px; margin-top: 10px;">
              تم إرسال هذه النتيجة بشكل آمن ومشفّر
            </p>
          </div>
        </div>
      </body>
      </html>
    `;
    
    // إرسال البريد الإلكتروني
    const info = await transporter.sendMail({
      from: `"gizaresult - نظام النتائج" <${process.env.SMTP_USER}>`,
      to: to,
      subject: '🎓 نتيجة الاختبار - نظام gizaresult الإلكتروني',
      text: `السلام عليكم،\n\nهذه نتيجة الطالب:\nرقم الجلوس: ${studentData.seatNumber}\nالاسم: ${studentData.name}\nالنسبة: ${studentData.percentage}%\n\n${customMessage}\n\nمع أطيب التمنيات،\nفريق gizaresult`,
      html: htmlTemplate
    });
    
    console.log('Professional email sent successfully to:', to);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Error sending professional email:', error);
    return { success: false, error: error.message };
  }
}

async function sendResultBySeatNumber(seatNumber, email, customMessage = '') {
  try {
    // البحث عن نتيجة الطالب
    const resultsRef = db.collection('results');
    const resultSnap = await resultsRef.where('seatNumber', '==', seatNumber).get();
    
    if (resultSnap.empty) {
      return { success: false, message: 'لم يتم العثور على نتيجة لهذا الرقم' };
    }
    
    const studentData = resultSnap.docs[0].data();
    
    // إرسال البريد الإلكتروني الاحترافي
    const emailResult = await sendProfessionalEmail(email, studentData, customMessage);
    
    if (emailResult.success) {
      // تسجيل عملية الإرسال في قاعدة البيانات
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
    console.error('Error sending result by seat number:', error);
    return { success: false, message: error.message };
  }
}

// دوال إشعارات
async function sendEmailNotification(subject, text) {
  try {
    await transporter.sendMail({
      from: process.env.SMTP_USER,
      to: process.env.NOTIFICATION_EMAIL,
      subject: subject,
      text: text
    });
    console.log('Email notification sent successfully.');
  } catch (error) {
    console.error('Error sending email notification:', error);
  }
}

async function sendTelegramNotification(message) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!botToken || !chatId) return;

  const telegramApiUrl = `https://api.telegram.org/bot${botToken}/sendMessage`;
  try {
    await axios.post(telegramApiUrl, {
      chat_id: chatId,
      text: message,
      parse_mode: 'HTML'
    });
    console.log('Telegram notification sent successfully.');
  } catch (error) {
    console.error('Error sending Telegram notification:', error.message);
  }
}

// ✅ Middleware للتحقق من JWT
function authenticateAdmin(req, res, next) {
  const authHeader = req.headers['authorization'];
  
  if (!authHeader) {
    console.log('لم يتم إرسال token');
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }

  const token = authHeader.split(' ')[1];
  
  if (!token) {
    console.log('صيغة Authorization header غير صحيحة');
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) {
      console.log('Token verification failed:', err.message);
      
      if (err.name === 'TokenExpiredError') {
        return res.status(403).json({ success: false, message: 'Token منتهي الصلاحية' });
      } else if (err.name === 'JsonWebTokenError') {
        return res.status(403).json({ success: false, message: 'Token غير صالح' });
      } else {
        return res.status(403).json({ success: false, message: 'Forbidden' });
      }
    }
    
    req.admin = decoded;
    next();
  });
}

// ----------------- Routes -----------------

// ----------------- API الطلبات -----------------
app.get('/api/requests', authenticateAdmin, async (req, res) => {
  try {
    const snap = await db.collection('requests').get();
    const requests = snap.docs.map(doc => {
      const data = doc.data();
      if (data.screenshot && data.screenshot !== '') {
        data.screenshot = data.screenshot;
      } else {
        data.screenshot = null;
      }
      return { id: doc.id, ...data };
    });
    res.json({ requests });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// صفحة الدفع
app.get('/pay', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'pay.html'));
});

// ✅ رفع طلب الدفع باستخدام Cloudinary
app.post('/pay', upload.single('screenshot'), async (req, res) => {
  try {
    const { nationalId, seatNumber, phone, email } = req.body;
    
    if (!req.file) {
      return res.status(400).send('يجب رفع سكرين التحويل');
    }

    const cleanPhone = phone.replace(/\D/g, '');

    const newRequest = {
      nationalId,
      seatNumber,
      phone: cleanPhone,
      email,
      screenshot: req.file.path,
      paid: false,
      created_at: new Date().toISOString()
    };

    await db.collection('requests').add(newRequest);

    await sendEmailNotification(
      'طلب دفع جديد',
      `طلب دفع جديد:\n${JSON.stringify(newRequest, null, 2)}`
    );
    await sendTelegramNotification(
      `<b>طلب دفع جديد:</b>\nالرقم القومي: ${nationalId}\nرقم الجلوس: ${seatNumber}\nالهاتف: ${cleanPhone}\nالبريد: ${email}`
    );

    res.send('تم تسجيل طلبك، سيتم التأكد من الدفع قريبًا.');
  } catch (error) {
    console.error('Error in /pay:', error);
    res.status(500).send(`حدث خطأ في الخادم: ${error.message}`);
  }
});

// ✅ الحجز باستخدام Cloudinary
app.post('/reserve', upload.single('screenshot'), async (req, res) => {
  try {
    const { nationalId, phone, email, senderPhone } = req.body;
    if (!nationalId || !phone || !email || !senderPhone) {
      return res.status(400).send('البيانات غير مكتملة');
    }

    if (!req.file) {
      return res.status(400).send('يجب رفع سكرين التحويل');
    }

    const cleanPhone = phone.replace(/\D/g, '');
    const cleanSenderPhone = senderPhone.replace(/\D/g, '');

    const newReservation = {
      nationalId,
      phone: cleanPhone,
      email,
      senderPhone: cleanSenderPhone,
      screenshot: req.file.path,
      reserved_at: new Date().toISOString()
    };

    await db.collection('reservations').add(newReservation);

    await sendEmailNotification(
      'طلب حجز جديد',
      `طلب حجز جديد:\n${JSON.stringify(newReservation, null, 2)}`
    );
    await sendTelegramNotification(
      `<b>طلب حجز جديد:</b>\nالرقم القومي: ${nationalId}\nالهاتف: ${cleanPhone}\nالبريد: ${email}\nرقم المحول: ${cleanSenderPhone}`
    );

    res.send('تم تسجيل الحجز بنجاح.');
  } catch (error) {
    console.error('Error in /reserve:', error);
    res.status(500).send('حدث خطأ أثناء معالجة الحجز');
  }
});

// ✅ API جديدة للحجز عن طريق التليفون
app.post('/api/reserve-by-phone', upload.single('screenshot'), async (req, res) => {
  try {
    const { nationalId, phone, email, senderPhone } = req.body;
    if (!nationalId || !phone || !email || !senderPhone) {
      return res.status(400).json({ success: false, message: 'البيانات غير مكتملة' });
    }

    if (!req.file) {
      return res.status(400).json({ success: false, message: 'يجب رفع سكرين التحويل' });
    }

    const cleanPhone = phone.replace(/\D/g, '');
    const cleanSenderPhone = senderPhone.replace(/\D/g, '');

    const newReservation = {
      nationalId,
      phone: cleanPhone,
      email,
      senderPhone: cleanSenderPhone,
      screenshot: req.file.path,
      reserved_at: new Date().toISOString(),
      method: 'phone'
    };

    await db.collection('reservations').add(newReservation);

    await sendEmailNotification(
      '📞 طلب حجز جديد عن طريق التليفون',
      `طلب حجز جديد:\n${JSON.stringify(newReservation, null, 2)}`
    );
    await sendTelegramNotification(
      `<b>📞 طلب حجز جديد عن طريق التليفون:</b>\nالرقم القومي: ${nationalId}\nالهاتف: ${cleanPhone}\nالبريد: ${email}\nرقم المحول: ${cleanSenderPhone}`
    );

    res.json({ success: true, message: 'تم تسجيل الحجز بنجاح.' });
  } catch (error) {
    console.error('Error in /api/reserve-by-phone:', error);
    res.status(500).json({ success: false, message: 'حدث خطأ أثناء معالجة الحجز' });
  }
});

app.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (username === process.env.ADMIN_USER && password === process.env.ADMIN_PASS) {
    const token = jwt.sign({ username }, process.env.JWT_SECRET, { expiresIn: '24h' });
    return res.json({ 
      success: true, 
      token,
      expiresIn: '24h'
    });
  }
  res.status(401).json({ success: false, message: 'خطأ في تسجيل الدخول' });
});

app.post('/api/check-result', async (req, res) => {
  const { phone, seatNumber } = req.body;

  try {
    const requestsRef = db.collection('requests');
    let query = requestsRef.where('phone', '==', phone);
    
    if (seatNumber) {
      query = requestsRef.where('seatNumber', '==', seatNumber);
    }

    const snap = await query.get();

    if (snap.empty) {
      return res.status(404).json({
        success: false,
        message: 'لم يتم العثور على نتيجة لهذا الرقم أو لم يتم الدفع بعد'
      });
    }

    const requestDoc = snap.docs[0];
    const requestData = requestDoc.data();

    if (!requestData.paid) {
      return res.status(402).json({
        success: false,
        message: 'لم يتم الدفع بعد'
      });
    }

    if (requestData.result) {
      return res.json({
        success: true,
        result: requestData.result
      });
    }

    if (requestData.seatNumber) {
      const resultsRef = db.collection('results');
      const resultSnap = await resultsRef.where('seatNumber', '==', requestData.seatNumber).get();
      
      if (!resultSnap.empty) {
        const resultDoc = resultSnap.docs[0];
        const resultData = resultDoc.data();
        
        await requestDoc.ref.update({
          result: resultData
        });
        
        return res.json({
          success: true,
          result: resultData
        });
      }
    }

    res.status(404).json({
      success: false,
      message: 'النتيجة غير متوفرة بعد، يرجى المحاولة لاحقاً'
    });

  } catch (error) {
    console.error('Error in /api/check-result:', error);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ في الخادم: ' + error.message
    });
  }
});

app.post('/api/open-result', authenticateAdmin, async (req, res) => {
  const { seatNumber } = req.body;
  
  try {
    const requestsRef = db.collection('requests');
    const resultsRef = db.collection('results');

    const requestSnap = await requestsRef.where('seatNumber', '==', seatNumber).get();
    
    if (requestSnap.empty) {
      return res.status(404).json({ 
        success: false, 
        message: 'لم يتم العثور على طلب لهذا رقم الجلوس' 
      });
    }

    const requestDoc = requestSnap.docs[0];
    
    const resultSnap = await resultsRef.where('seatNumber', '==', seatNumber).get();
    
    if (resultSnap.empty) {
      return res.status(404).json({ 
        success: false, 
        message: 'لم يتم العثور على نتيجة لهذا رقم الجلوس' 
      });
    }

    const resultDoc = resultSnap.docs[0];
    const resultData = resultDoc.data();

    await requestDoc.ref.update({
      paid: true,
      result: resultData,
      openedAt: new Date().toISOString()
    });

    res.json({ 
      success: true,
      message: 'تم فتح النتيجة بنجاح'
    });
    
  } catch (error) {
    console.error('Error in /api/open-result:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
});

// ✅ مسار إرسال البريد الإلكتروني المحسن
app.post('/api/send-admin-message', authenticateAdmin, async (req, res) => {
  const { seatNumber, email, message } = req.body;
  
  if (!seatNumber || !email) {
    return res.status(400).json({ 
      success: false, 
      message: 'رقم الجلوس والبريد الإلكتروني مطلوبين' 
    });
  }
  
  try {
    const result = await sendResultBySeatNumber(seatNumber, email, message);
    
    if (result.success) {
      // إرسال إشعار للمشرف
      await sendTelegramNotification(
        `<b>📧 تم إرسال نتيجة بنجاح</b>\n` +
        `رقم الجلوس: ${seatNumber}\n` +
        `البريد الإلكتروني: ${email}\n` +
        `الوقت: ${new Date().toLocaleString('ar-EG')}`
      );
      
      res.json({ 
        success: true, 
        message: 'تم إرسال النتيجة إلى البريد الإلكتروني بنجاح' 
      });
    } else {
      res.status(404).json({ 
        success: false, 
        message: result.message 
      });
    }
  } catch (err) {
    console.error('خطأ في إرسال الإيميل:', err);
    res.status(500).json({ 
      success: false, 
      error: 'حدث خطأ أثناء إرسال الإيميل' 
    });
  }
});

// ✅ مسار الإرسال الجماعي للنتائج
app.post('/api/send-bulk-results', authenticateAdmin, async (req, res) => {
  const { seatNumbers, customMessage } = req.body;
  
  if (!seatNumbers || !Array.isArray(seatNumbers) || seatNumbers.length === 0) {
    return res.status(400).json({ 
      success: false, 
      message: 'يجب توفير قائمة بأرقام الجلوس' 
    });
  }
  
  const results = [];
  const errors = [];
  
  for (const item of seatNumbers) {
    try {
      // البحث عن البريد الإلكتروني للطالب من طلبات الدفع
      const requestsRef = db.collection('requests');
      const requestSnap = await requestsRef.where('seatNumber', '==', item.seatNumber).get();
      
      if (!requestSnap.empty) {
        const requestData = requestSnap.docs[0].data();
        const email = item.email || requestData.email;
        
        if (email) {
          const result = await sendResultBySeatNumber(item.seatNumber, email, customMessage);
          if (result.success) {
            results.push({ seatNumber: item.seatNumber, email, status: 'success' });
          } else {
            errors.push({ seatNumber: item.seatNumber, email, error: result.message });
          }
        } else {
          errors.push({ seatNumber: item.seatNumber, error: 'لا يوجد بريد إلكتروني' });
        }
      } else {
        errors.push({ seatNumber: item.seatNumber, error: 'لم يتم العثور على الطلب' });
      }
    } catch (error) {
      errors.push({ seatNumber: item.seatNumber, error: error.message });
    }
  }
  
  // إرسال إشعار تلغرام بنتيجة الإرسال الجماعي
  await sendTelegramNotification(
    `<b>📧 تقرير الإرسال الجماعي للنتائج</b>\n` +
    `✅ تم الإرسال بنجاح: ${results.length}\n` +
    `❌ فشل الإرسال: ${errors.length}\n` +
    `📊 المجموع: ${seatNumbers.length}`
  );
  
  res.json({
    success: true,
    total: seatNumbers.length,
    sent: results.length,
    failed: errors.length,
    results: results,
    errors: errors
  });
});

app.post('/api/chat-inquiries', async (req, res) => {
  try {
    const { message, userData } = req.body;
    
    if (!message) {
      return res.status(400).json({ 
        success: false, 
        message: 'الرسالة مطلوبة' 
      });
    }

    const newInquiry = {
      message: message,
      userData: userData || {},
      created_at: new Date().toISOString(),
      status: 'new'
    };

    const docRef = await db.collection('chat_inquiries').add(newInquiry);

    const telegramMessage = `
<b>💬 استفسار جديد من الدردشة:</b>
👤 <b>الاسم:</b> ${userData.name || "غير معروف"}
📞 <b>الهاتف:</b> ${userData.phone || "غير معروف"}
📧 <b>البريد:</b> ${userData.email || "غير معروف"}

💭 <b>الرسالة:</b>
${message}

🆔 <b>رقم الاستفسار:</b> ${docRef.id}
    `;
    
    await sendTelegramNotification(telegramMessage);

    res.json({ 
      success: true, 
      id: docRef.id,
      message: 'تم إرسال استفسارك بنجاح' 
    });

  } catch (error) {
    console.error('Error in /api/chat-inquiries:', error);
    res.status(500).json({ 
      success: false, 
      message: 'حدث خطأ أثناء إرسال الاستفسار' 
    });
  }
});

// ========== APIs إدارية (محميّة بـ JWT) ==========
app.get('/api/chat-inquiries', authenticateAdmin, async (req, res) => {
  try {
    const snap = await db.collection('chat_inquiries').orderBy('created_at', 'desc').get();
    const inquiries = snap.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        message: data.message,
        userName: data.userData?.name || 'غير معروف',
        userPhone: data.userData?.phone || 'غير معروف',
        userEmail: data.userData?.email || 'غير معروف',
        created_at: data.created_at,
        status: data.status
      };
    });
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

app.put('/api/chat-inquiries/:id/read', authenticateAdmin, async (req, res) => {
  try {
    await db.collection('chat_inquiries').doc(req.params.id).update({ status: 'read' });
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

// ✅ Serve index.html
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ✅ Serve login.html
app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// ✅ صفحة Dashboard (محمية بـ JWT)
app.get('/dashboard', authenticateAdmin, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

const port = process.env.PORT || 3000;
module.exports = app;
