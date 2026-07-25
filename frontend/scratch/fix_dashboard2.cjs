const fs = require('fs');
const file = 'src/pages/SolverDashboard.jsx';
let content = fs.readFileSync(file, 'utf8');

const lines = content.split('\n');
// Let's find the exact block to extract.
// It starts with "<div style={{ marginTop: '25px' }}>"
// and ends with ")}</div>" or something similar around line 740.
let startIdx = lines.findIndex((l, i) => i > 400 && l.includes("<div style={{ marginTop: '25px' }}>"));
let endIdx = -1;

for (let i = startIdx; i < lines.length; i++) {
    if (lines[i].includes("                                            </div>") && lines[i+1].includes("                                        </div>") && lines[i+2].includes("                                    )}")) {
        endIdx = i;
        break;
    }
}

if (startIdx === -1 || endIdx === -1) {
    console.error("Could not find the action block.", startIdx, endIdx);
    process.exit(1);
}

const actionFormsLines = lines.slice(startIdx, endIdx + 1);
const actionFormsContent = actionFormsLines.join('\n');

const renderFuncSearch = `    const renderActionForms = () => (
                                            {renderActionForms()}
    );`;

const renderFuncReplace = `    const renderActionForms = () => (
${actionFormsContent}
    );`;

content = content.replace(renderFuncSearch, renderFuncReplace);

// Now we need to replace the original block with {renderActionForms()} as well.
content = content.replace(actionFormsContent, '                                            {renderActionForms()}');

fs.writeFileSync(file, content);
console.log('Success!', startIdx, endIdx);
