module.exports = function handler(req, res) {
  const { id } = req.query;
  
  if (req.method === 'GET') {
    // Mock job data for now
    res.status(200).json({
      id: parseInt(id),
      status: 'completed',
      filename: 'sample.pdf',
      createdAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      results: {
        totalPages: 5,
        extractedImages: 3,
        extractedText: 'Sample extracted text'
      }
    });
  } else {
    res.setHeader('Allow', ['GET']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
};