module.exports = function handler(req, res) {
  const { id } = req.query;
  
  if (req.method === 'POST') {
    // Mock status check response
    res.status(200).json({
      id: parseInt(id),
      status: 'completed',
      message: 'Job completed successfully'
    });
  } else {
    res.setHeader('Allow', ['POST']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
};