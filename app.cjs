require('fs').writeFileSync(__dirname + '/started.log', 'App started at ' + new Date().toISOString());
async function start() {
    try {
        await import('./server/index.js');
    } catch (e) {
        require('fs').writeFileSync(__dirname + '/crash.log', String(e.stack || e));
    }
}
start();
