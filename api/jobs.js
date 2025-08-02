module.exports = function handler(req, res) {
  if (req.method === 'GET') {
    // For now, return empty array since we need to implement storage
    res.status(200).json([]);
  } else {
    res.setHeader('Allow', ['GET']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
};