module.exports = function handler(req, res) {
  if (req.method === 'GET') {
    const adobeConfigured = !!(process.env.ADOBE_CLIENT_ID && process.env.ADOBE_CLIENT_SECRET);
    
    res.status(200).json({
      status: 'healthy',
      adobe: adobeConfigured ? 'configured' : 'not configured',
      timestamp: new Date().toISOString()
    });
  } else {
    res.setHeader('Allow', ['GET']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
};