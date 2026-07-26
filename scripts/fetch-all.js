const m = require('../src/fetchMarketItems');
console.log(`[fetch] Start: ${m.getStatus().totalItems} items, resumeFrom: ${m.getStatus().resumeFrom}`);
m.fetchAllItems((f, t) => {
    if (f % 1000 === 0) console.log(`[fetch] ${f}/${t}`);
}).then(d => console.log(`[fetch] DONE: ${d.totalItems} items`)).catch(e => console.log(`[fetch] ERR: ${e.message}`));
