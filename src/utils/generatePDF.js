const PDFDocument = require('pdfkit');

// Streams a campus-drive response report straight to the HTTP response as a PDF.
// Columns: Name | Roll No | Branch | CGPA | Skills | Response
//
// Usage (controller): streamDriveReport(res, { drive, rows })
//   drive = { company, title, deadline, ... }
//   rows  = [{ name, rollNo, branch, cgpa, skills:[], response }]
function streamDriveReport(res, { drive, rows }) {
    const doc = new PDFDocument({ margin: 40, size: 'A4', layout: 'landscape' });

    const safeTitle = `${drive.company}-${drive.title}`.replace(/[^a-z0-9]+/gi, '_');
    res.setHeader('Content-Type', 'application/pdf');   //browser ko btayega pdf h
    res.setHeader('Content-Disposition', `attachment; filename="drive-report-${safeTitle}.pdf"`);   //downoad krne ke liye

    doc.pipe(res);

    // ── Header ──────────────────────────────────────────────────────────────────
    doc.fontSize(18).font('Helvetica-Bold').text('Campus Drive Report', { align: 'center' });
    doc.moveDown(0.3);
    doc.fontSize(12).font('Helvetica')
        .text(`${drive.title}  —  ${drive.company}`, { align: 'center' });
    if (drive.deadline) {
        doc.fontSize(9).fillColor('#555')
            .text(`Deadline: ${new Date(drive.deadline).toLocaleString()}`, { align: 'center' });
    }
    doc.fillColor('#000').moveDown(1);

    // ── Table layout ────────────────────────────────────────────────────────────
    const startX = doc.page.margins.left;
    const usableWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    // proportional column widths
    const cols = [
        { key: 'name', label: 'Name', w: 0.20 },
        { key: 'rollNo', label: 'Roll No', w: 0.13 },
        { key: 'branch', label: 'Branch', w: 0.13 },
        { key: 'cgpa', label: 'CGPA', w: 0.08 },
        { key: 'skills', label: 'Skills', w: 0.28 },
        { key: 'response', label: 'Response', w: 0.18 },
    ].map(c => ({ ...c, width: c.w * usableWidth }));

    const rowHeight = 22;

    function drawRow(y, cells, { bold = false, fill = null } = {}) {
        if (fill) {
            doc.rect(startX, y, usableWidth, rowHeight).fill(fill);
            doc.fillColor('#000');
        }
        doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(9);
        let x = startX;
        cols.forEach((col) => {
            doc.text(String(cells[col.key] ?? ''), x + 4, y + 6, {
                width: col.width - 8,
                height: rowHeight,
                ellipsis: true,
                lineBreak: false
            });
            x += col.width;
        });
        // row border
        doc.strokeColor('#ddd').lineWidth(0.5)
            .moveTo(startX, y + rowHeight).lineTo(startX + usableWidth, y + rowHeight).stroke();
    }

    // header row
    let y = doc.y;
    drawRow(y, cols.reduce((o, c) => ({ ...o, [c.key]: c.label }), {}), { bold: true, fill: '#f0f0f0' });
    y += rowHeight;

    // data rows (with page breaks)
    if (!rows || rows.length === 0) {
        doc.font('Helvetica-Oblique').fontSize(10).fillColor('#888')
            .text('No responses yet.', startX, y + 8);
    } else {
        rows.forEach((r) => {
            if (y + rowHeight > doc.page.height - doc.page.margins.bottom) {
                doc.addPage({ margin: 40, size: 'A4', layout: 'landscape' });
                y = doc.page.margins.top;
                drawRow(y, cols.reduce((o, c) => ({ ...o, [c.key]: c.label }), {}), { bold: true, fill: '#f0f0f0' });
                y += rowHeight;
            }
            drawRow(y, {
                name: r.name,
                rollNo: r.rollNo,
                branch: r.branch,
                cgpa: r.cgpa ?? '',
                skills: Array.isArray(r.skills) ? r.skills.join(', ') : (r.skills || ''),
                response: r.response === 'interested' ? 'Interested'
                    : r.response === 'not_interested' ? 'Not Interested'
                        : 'No Response'
            });
            y += rowHeight;
        });
    }

    doc.end();
}

module.exports = { streamDriveReport };
