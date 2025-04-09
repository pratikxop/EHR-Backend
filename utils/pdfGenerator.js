const PDFDocument = require('pdfkit');
const path = require('path');
const fs = require('fs');
const QRCode = require('qrcode');
const Doctor = require('../models/Doctor');

async function generateHealthReport(data) {
  return new Promise(async (resolve, reject) => {
    const doc = new PDFDocument({ 
      margin: 50, 
      size: 'A4',
      bufferPages: true
    });
    const buffers = [];

    doc.on('data', chunk => buffers.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.on('error', reject);

    // Logo paths with fallbacks
    const logoPaths = {
      hospital: path.join(__dirname, 'utils/logoHospital.png'),
      record: path.join(__dirname, 'utils/logoRecord.png'),
      doctor: path.join(__dirname, 'utils/logoDoctor.png')
    };

    // Header Section
    try {
      if (fs.existsSync(logoPaths.hospital)) {
        doc.image(logoPaths.hospital, 50, 35, { width: 80 });
      }
      if (fs.existsSync(logoPaths.record)) {
        doc.image(logoPaths.record, doc.page.width - 130, 35, { width: 80 });
      }
    } catch (e) {
      console.error('Logo loading error:', e.message);
    }

    // Title
    doc.font('Helvetica-Bold')
      .fontSize(20)
      .fillColor('#003366')
      .text('XOP HOSPITAL', { align: 'center' });

    doc.font('Helvetica')
      .fontSize(14)
      .fillColor('#555555')
      .text('Electronic Health Record System', { align: 'center' });

    // Metadata
    const metaY = 120;
    doc.font('Helvetica')
      .fontSize(10)
      .fillColor('#666666')
      .text(`Generated: ${new Date().toLocaleString()}`, 50, metaY)
      .text(`Document ID: EHR-${Date.now()}`, { 
        align: 'right',
        width: doc.page.width - 100
      });

    // PATIENT INFO SECTION
    doc.moveTo(50, metaY + 30)
      .lineTo(doc.page.width - 50, metaY + 30)
      .stroke('#cccccc');

    doc.font('Helvetica-Bold')
      .fontSize(14)
      .fillColor('#1a1a1a')
      .text('PATIENT INFORMATION', { paragraphGap: 10 });

    const patientTable = {
      headers: ['Field', 'Details'],
      rows: [
        ['Patient ID', data.patientId],
        ['Full Name', data.name],
        ['Age/Gender', `${data.age} / ${data.gender}`],
        ['Contact', `${data.phoneNumber || 'N/A'}\n${data.email || 'N/A'}`],
        ['Address', data.address || 'Not provided']
      ]
    };
    drawTable(doc, patientTable);

    // MEDICAL DETAILS
    checkPageBreak(doc, 150);
    
    doc.font('Helvetica-Bold')
      .fontSize(14)
      .fillColor('#1a1a1a')
      .text('MEDICAL DETAILS', { paragraphGap: 10 });

    const medicalTable = {
      headers: ['Category', 'Information'],
      rows: [
        ['Primary Diagnosis', data.diagnosis || 'Not specified'],
        ['Symptoms', data.symptoms || 'Not specified'],
        ['Treatment Plan', data.treatmentPlan || 'Not specified'],
        ['Medications', data.medications || 'Not specified'],
        ['Allergies', data.allergies || 'None reported'],
        ['Last Consultation', new Date(data.lastConsultation || Date.now()).toLocaleDateString()]
      ]
    };
    drawTable(doc, medicalTable);

    // DOCTOR INFO
    let doctorInfo = null;
    try {
      doctorInfo = await Doctor.findOne({ doctorId: data.doctorId }).lean(); // Use doctorId field for lookup
    } catch (err) {
      console.error('Doctor fetch error:', err.message);
    }

    checkPageBreak(doc, 200);
    
    doc.font('Helvetica-Bold')
      .fontSize(14)
      .fillColor('#1a1a1a')
      .text('ATTENDING PHYSICIAN', { paragraphGap: 10 });

    const doctorTable = {
      headers: ['Detail', 'Information'],
      rows: doctorInfo ? [
        ['Name', doctorInfo.name],
        ['ID', doctorInfo.doctorId],
        ['Department', doctorInfo.department || 'Not specified'],
        ['Specialization', doctorInfo.specialization || 'Not specified'],
        ['Experience', doctorInfo.experience || 'Not specified'],
        ['Contact', doctorInfo.phoneNumber || 'Not provided'],
        ['Email', doctorInfo.email || 'Not provided']
      ] : [
        ['Name', data.doctorName || 'Not specified'],
        ['Note', 'Doctor details not found in system.']
      ]
    };
    drawTable(doc, doctorTable);

    // Doctor logo
    try {
      if (fs.existsSync(logoPaths.doctor)) {
        doc.image(logoPaths.doctor, doc.page.width - 110, doc.y, { width: 60 });
      }
    } catch (e) {
      console.error('Doctor logo error:', e.message);
    }

    // QR Code
    checkPageBreak(doc, 150);
    
    const qrCodeData = `https://xophospital.com/verify?patientId=${data.patientId}&docId=EHR-${Date.now()}`;
    try {
      const qrCodeImage = await QRCode.toBuffer(qrCodeData, {
        errorCorrectionLevel: 'H',
        margin: 2,
        scale: 6
      });
      
      doc.font('Helvetica-Bold')
         .fontSize(14)
         .fillColor('#003366')
         .text('DOCUMENT VERIFICATION', { align: 'center', paragraphGap: 10 });

      doc.image(qrCodeImage, doc.page.width / 2 - 75, doc.y, { width: 150 });

      doc.font('Helvetica')
         .fontSize(10)
         .fillColor('#666666')
         .text('Scan to verify document authenticity', { align: 'center', paragraphGap: 20 });
    } catch (err) {
      console.error('QR Code generation error:', err.message);
      doc.text('Verification QR code could not be generated', { align: 'center' });
    }

    // Footer
    const footerText = 'CONFIDENTIAL DOCUMENT - UNAUTHORIZED ACCESS PROHIBITED';
    doc.font('Helvetica')
       .fontSize(9)
       .fillColor('#990000')
       .text(footerText, {
         align: 'center',
         characterSpacing: 0.5,
         paragraphGap: 0,
         y: doc.page.height - 40
       });

    doc.end();
  });
}

function drawTable(doc, tableData) {
  const startY = doc.y + 10;
  const colWidth = (doc.page.width - 100) / 2;
  const rowHeight = 20;
  const padding = 5;

  // Header row
  doc.font('Helvetica-Bold')
     .fontSize(10)
     .fillColor('#003366')
     .text(tableData.headers[0], 50, startY)
     .text(tableData.headers[1], 50 + colWidth, startY);

  // Content rows
  let currentY = startY + rowHeight;
  tableData.rows.forEach(row => {
    // Left column
    doc.font('Helvetica')
       .fontSize(10)
       .fillColor('#333333')
       .text(row[0], 50 + padding, currentY + padding, {
         width: colWidth - padding * 2,
         align: 'left'
       });

    // Right column
    const textHeight = doc.heightOfString(row[1], {
      width: colWidth - padding * 2
    });
    
    doc.text(row[1], 50 + colWidth + padding, currentY + padding, {
      width: colWidth - padding * 2,
      align: 'left'
    });

    // Draw row border
    doc.strokeColor('#cccccc')
       .lineWidth(0.5)
       .moveTo(50, currentY)
       .lineTo(50 + colWidth * 2, currentY)
       .stroke();

    currentY += Math.max(rowHeight, textHeight + padding * 2);
  });

  // Vertical borders
  doc.strokeColor('#cccccc')
     .lineWidth(0.5)
     .moveTo(50, startY)
     .lineTo(50, currentY)
     .stroke()
     .moveTo(50 + colWidth, startY)
     .lineTo(50 + colWidth, currentY)
     .stroke()
     .moveTo(50 + colWidth * 2, startY)
     .lineTo(50 + colWidth * 2, currentY)
     .stroke();

  // Header bottom border
  doc.moveTo(50, startY + rowHeight)
     .lineTo(50 + colWidth * 2, startY + rowHeight)
     .stroke();

  doc.y = currentY + 10;
}

function checkPageBreak(doc, requiredHeight) {
  if (doc.y + requiredHeight > doc.page.height - 50) {
    doc.addPage();
    doc.y = 50;
  }
}

module.exports = { generateHealthReport };