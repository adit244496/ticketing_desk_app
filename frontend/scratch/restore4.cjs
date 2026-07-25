const fs = require('fs');
const file = 'src/pages/SolverDashboard.jsx';
let content = fs.readFileSync(file, 'utf8');

const targetStr = `                                            </div>
                                        </div>
    );

    return (`;

const replaceStr = `                                            </div>
    );

    return (`;

content = content.replace(targetStr, replaceStr);
fs.writeFileSync(file, content);
console.log('Removed extra div correctly!');
