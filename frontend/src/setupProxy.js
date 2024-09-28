const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function(app) {
  app.use(
    '/api',
    createProxyMiddleware({
      target: 'http://localhost:8000',
      changeOrigin: true,
      onProxyRes: function (proxyRes, req, res) {
	proxyRes.headers['Cache-Control'] = 'no-store';
	proxyRes.headers['X-Content-Type-Options'] = 'nosniff';
      },
    })
  );
};
