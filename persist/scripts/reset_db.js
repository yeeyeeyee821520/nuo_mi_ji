// reset_db.js - removes DB and uploaded files so server can reinitialize
const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, '..', 'persist', 'data');
const uploadDir = path.join(__dirname, '..', 'persist', 'uploads');

function rmrf(p) {
  if (!fs.existsSync(p)) return;
  const stat = fs.lstatSync(p);
  if (stat.isDirectory()) {
    fs.readdirSync(p).forEach(f => rmrf(path.join(p, f)));
    fs.rmdirSync(p);
  } else {
    fs.unlinkSync(p);
  }
}

console.log('Removing DB and uploads...');
try {
  rmrf(dataDir);
  rmrf(uploadDir);
  console.log('Done. Start the server to reinitialize DB and uploads.');
} catch (e) {
  console.error('Failed to reset:', e);
}
