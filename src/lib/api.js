// src/lib/api.js — Axios helper terpusat untuk akses Endpoint MT5
const axios = require('axios');

const api = () => axios.create({
    baseURL: global.endpointUrl,
    timeout: 6000,
    headers: {
        'x-api-key'   : global.endpointKey,
        'Content-Type': 'application/json',
    },
});

const getData     = async () => (await api().get('/api/mt5')).data;
const sendCommand = async (payload) => (await api().post('/api/commands', payload)).data;
const getCmdLog   = async () => (await api().get('/api/commands')).data;

const isFresh = (data) => {
    if (!data?.lastUpdated) return false;
    return (Date.now() - new Date(data.lastUpdated).getTime()) / 1000 < 60;
};

module.exports = { getData, sendCommand, getCmdLog, isFresh };
