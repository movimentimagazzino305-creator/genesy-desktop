
const XLSX = require('xlsx');
const path = require('path');

const filePath = 'g:\\Il mio Drive\\drive\\Antigravity\\Preventivi\\Preventivi_v2.5\\prodotti\\Prodotti_e_Servizi-parquetromagna-FULVIO-1766005376071.xlsx';

try {
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1 }); // Array of arrays

    if (data.length > 0) {
        console.log("Headers:", data[0]);
        if (data.length > 1) {
            console.log("First Row:", data[1]);
        }
    } else {
        console.log("File is empty or could not be read properly.");
    }
} catch (e) {
    console.error("Error reading file:", e.message);
}
