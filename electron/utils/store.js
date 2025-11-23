import Store from 'electron-store';

const store = new Store({
    defaults: {
        apiKey: '',
        cachedImages: {}
    }
});

export default store;
