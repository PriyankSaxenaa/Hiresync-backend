const multer = require('multer');

// file disk pe save nahi hogi, memory mein buffer rahegi
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
        cb(null, true);
    } else {
        cb(new Error('Only PDF files are allowed'), false);
    }
};

const upload = multer({
    storage,
    fileFilter,
    limits: { fileSize: 5 * 1024 * 1024 } // 5mb
});

// ── Excel / CSV uploader (TPO student import) ───────────────────────────────────
// accepts .xlsx / .xls / .csv — browsers send a few different mimetypes for these
const EXCEL_MIMETYPES = [
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
    'application/vnd.ms-excel',                                          // .xls
    'application/octet-stream',                                          // some browsers
    'text/csv',                                                          // .csv
    'application/csv'
];

const excelFileFilter = (req, file, cb) => {
    const okMime = EXCEL_MIMETYPES.includes(file.mimetype);
    const okExt = /\.(xlsx|xls|csv)$/i.test(file.originalname || '');
    if (okMime || okExt) {
        cb(null, true);
    } else {
        cb(new Error('Only Excel (.xlsx/.xls) or CSV files are allowed'), false);
    }
};

const uploadExcel = multer({
    storage,
    fileFilter: excelFileFilter,
    limits: { fileSize: 10 * 1024 * 1024 } // 10mb — sheets can be large
});

// keep the default export as the PDF uploader (resume route relies on it),
// and hang the excel uploader off it so tpo route can do upload.excel.single('file')
upload.excel = uploadExcel;

module.exports = upload;