const Store = require('electron-store');
const store = new Store();

console.log('Clearing all playtime sessions...');
store.delete('playtime_sessions');
console.log('Done! All sessions cleared.');
console.log('Please restart the launcher to see changes.');
