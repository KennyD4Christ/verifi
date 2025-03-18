import io from 'socket.io-client';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000';
const socket = io(BACKEND_URL, {
    path: '/ws/socket.io/',
    transports: ['websocket']
});

export const subscribeToUpdates = (callback) => {
    socket.on('message', (data) => {
        callback(data);
    });

    return () => {
        socket.off('message');
    };
};

export const sendMessage = (message) => {
    socket.emit('message', { data: message });
};
