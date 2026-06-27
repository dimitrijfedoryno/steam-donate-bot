const fs = require('fs');

function push(filePath, data) {
    let queue = [];
    try { queue = JSON.parse(fs.readFileSync(filePath, 'utf8')); } catch {}
    data._id = Date.now() + '_' + Math.random().toString(36).slice(2, 8);
    queue.push(data);
    if (queue.length > 50) queue = queue.slice(-50);
    fs.writeFileSync(filePath, JSON.stringify(queue, null, 2), 'utf8');
}

function next(filePath) {
    let queue = [];
    try { queue = JSON.parse(fs.readFileSync(filePath, 'utf8')); } catch {}
    if (queue.length === 0) return null;
    const item = queue.shift();
    fs.writeFileSync(filePath, JSON.stringify(queue, null, 2), 'utf8');
    return item;
}

module.exports = { push, next };
