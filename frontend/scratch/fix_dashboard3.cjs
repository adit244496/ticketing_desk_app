const fs = require('fs');
const file = 'src/pages/SolverDashboard.jsx';
let content = fs.readFileSync(file, 'utf8');

const lines = content.split('\n');

// 1. Find the start of the original action block
let startIdx = lines.findIndex(l => l.includes("<div style={{ marginTop: '25px' }}>") && l.includes("<!-- START_ACTION_BLOCK -->") === false);
// Wait, the line is just `<div style={{ marginTop: '25px' }}>`
// It happens twice now because of the failed script? No, the previous script deleted the FIRST one inside `renderActionForms` and replaced it with `{renderActionForms()}`.
// Oh wait, the previous script replaced `actionFormsContent` (which was short) with `{renderActionForms()}`.
// Let's just find the exact block from the bottom.

// To be absolutely safe, let's just find the index of `const renderActionForms = () => (`
const renderFuncStart = lines.findIndex(l => l.includes("const renderActionForms = () => ("));
const renderFuncEnd = renderFuncStart + lines.slice(renderFuncStart).findIndex(l => l.trim() === ');');

// 2. The original action block is still down below.
// Let's find it. It's the last occurrence of `<div style={{ marginTop: '25px' }}>`
let originalBlockStart = -1;
for (let i = lines.length - 1; i >= 0; i--) {
    if (lines[i].includes("<div style={{ marginTop: '25px' }}>")) {
        originalBlockStart = i;
        break;
    }
}

// 3. Find the end of the original block. It ends exactly before `</>`
let originalBlockEnd = -1;
for (let i = originalBlockStart; i < lines.length; i++) {
    if (lines[i].includes("</>") && lines[i+1] && lines[i+1].includes(") : activePanelTab === 'timeline' ? (")) {
        // The block ends 2 lines before </>
        originalBlockEnd = i - 2;
        break;
    }
}

console.log("Found original block:", originalBlockStart, originalBlockEnd);

const actionFormsLines = lines.slice(originalBlockStart, originalBlockEnd + 1);
const actionFormsContent = actionFormsLines.join('\n');

// Replace the broken renderActionForms with the correct one
const newRenderFunc = `    const renderActionForms = () => (\n${actionFormsContent}\n    );`;
lines.splice(renderFuncStart, renderFuncEnd - renderFuncStart + 1, newRenderFunc);

// Now replace the original block with {renderActionForms()}
// Note: because we changed lines above, the originalBlockStart has shifted.
// Let's re-join and replace.
let newContent = lines.join('\n');
newContent = newContent.replace(actionFormsContent, '                                            {renderActionForms()}');

fs.writeFileSync(file, newContent);
console.log('Fixed');
