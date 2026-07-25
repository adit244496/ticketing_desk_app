const fs = require('fs');
const file = 'src/pages/SolverDashboard.jsx';
let content = fs.readFileSync(file, 'utf8');

const lines = content.split('\n');

let originalBlockStart = -1;
for (let i = lines.length - 1; i >= 0; i--) {
    if (lines[i].includes("<div style={{ marginTop: '25px' }}>")) {
        originalBlockStart = i;
        break;
    }
}

let originalBlockEnd = -1;
for (let i = originalBlockStart; i < lines.length; i++) {
    if (lines[i].includes("</>") && lines[i+1] && lines[i+1].includes(") : activePanelTab === 'timeline' ? (")) {
        originalBlockEnd = i - 2;
        break;
    }
}

const actionFormsLines = lines.slice(originalBlockStart, originalBlockEnd + 1);
const actionFormsContent = actionFormsLines.join('\n');

const renderFuncStart = lines.findIndex(l => l.includes("const renderActionForms = () => ("));
const renderFuncEnd = renderFuncStart + lines.slice(renderFuncStart).findIndex(l => l.trim() === ');');

// 1. Remove the broken renderFunc block completely
lines.splice(renderFuncStart, renderFuncEnd - renderFuncStart + 1);

// 2. Insert the correctly formatted renderFunc block
// We need to split the new text into lines before splicing it in!
const newRenderFuncLines = [
    "    const renderActionForms = () => (",
    ...actionFormsLines,
    "    );"
];
lines.splice(renderFuncStart, 0, ...newRenderFuncLines);

// 3. The original block shifted down because we replaced a 3-line block with a 160-line block.
// So originalBlockStart is now originalBlockStart - 3 + newRenderFuncLines.length
const shift = newRenderFuncLines.length - (renderFuncEnd - renderFuncStart + 1);
const newOriginalStart = originalBlockStart + shift;
const newOriginalEnd = originalBlockEnd + shift;

// 4. Replace the original block with {renderActionForms()}
lines.splice(newOriginalStart, newOriginalEnd - newOriginalStart + 1, '                                            {renderActionForms()}');

fs.writeFileSync(file, lines.join('\n'));
console.log('Fixed for real!');
