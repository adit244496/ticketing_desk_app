const fs = require('fs');
const file = 'src/pages/SolverDashboard.jsx';
let content = fs.readFileSync(file, 'utf8');

// Replace the literal \n strings back to actual newlines
content = content.replace(/\\n/g, '\n');

fs.writeFileSync(file, content);
console.log('Restored actual newlines.');
