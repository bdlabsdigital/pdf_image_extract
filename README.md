# PDF Image Extract Tool

A modern web application that extracts text, images, and tables from PDF documents using Adobe PDF Services. Built with React, TypeScript, and Node.js.

## 🚀 Features

- **PDF Processing**: Upload and process PDF documents with Adobe PDF Services
- **Image Extraction**: Automatically extract and optimize images from PDFs
- **Text Extraction**: Extract structured text content from PDF documents
- **Table Conversion**: Convert tables to HTML format
- **Real-time Processing**: Live status updates during document processing
- **Download Results**: Get processed results as ZIP files with JSON data and WebP images
- **Modern UI**: Beautiful, responsive interface built with Tailwind CSS and shadcn/ui

## 🛠️ Tech Stack

### Frontend
- **React 18** with TypeScript
- **Vite** for fast development and optimized builds
- **Tailwind CSS** with shadcn/ui components
- **TanStack Query** for server state management
- **Wouter** for lightweight routing

### Backend
- **Node.js** with Express.js
- **TypeScript** with ES modules
- **PostgreSQL** with Drizzle ORM
- **Adobe PDF Services SDK** for PDF processing
- **Sharp** for image optimization and WebP conversion

### External Services
- **Adobe PDF Services**: PDF content extraction (500 free documents/month)
- **Neon PostgreSQL**: Serverless database hosting

## 📋 Prerequisites

- Node.js 18+ 
- npm or yarn
- PostgreSQL database (Neon recommended for free tier)
- Adobe PDF Services account

## 🚀 Quick Start

### 1. Clone the Repository
```bash
git clone https://github.com/bdlabsdigital/pdf_image_extract.git
cd pdf_image_extract
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Environment Setup
Create a `.env` file in the root directory:

```bash
# Database Configuration
DATABASE_URL=postgresql://username:password@host:port/database_name

# Adobe PDF Services Configuration
ADOBE_CLIENT_ID=your_adobe_client_id_here
ADOBE_CLIENT_SECRET=your_adobe_client_secret_here

# Session Management
SESSION_SECRET=your_session_secret_here

# Adobe Organization ID (optional)
organization_id=your_org_id@AdobeOrg
```

### 4. Get Adobe PDF Services Credentials
1. Visit [Adobe PDF Services](https://developer.adobe.com/document-services/docs/overview/)
2. Create a free account
3. Get your Client ID and Client Secret
4. Update your `.env` file with the credentials

### 5. Set Up Database
1. Create a PostgreSQL database (Neon recommended: https://neon.tech/)
2. Update the `DATABASE_URL` in your `.env` file
3. Run database migrations:
```bash
npm run db:push
```

### 6. Start Development Server
```bash
npm run dev
```

The application will be available at: **http://localhost:3000**

## 📖 Usage

### Upload PDF Documents
1. Open the application in your browser
2. Drag and drop a PDF file or click to select
3. Configure processing options (page range, output format)
4. Click "Process PDF Document"
5. Monitor the processing status in real-time
6. Download results as a ZIP file when complete

### Processing Options
- **Page Range**: Specify which pages to process (e.g., "1-5,10,15-20")
- **Output Format**: JSON with WebP images
- **Image Optimization**: Automatic upscaling and quality enhancement
- **Table Extraction**: Convert tables to HTML format

## 🏗️ Project Structure

```
pdf_image_extract/
├── client/                 # React frontend
│   ├── src/
│   │   ├── components/     # UI components
│   │   ├── pages/         # Page components
│   │   ├── hooks/         # Custom React hooks
│   │   └── lib/           # Utilities and types
├── server/                 # Node.js backend
│   ├── index.ts           # Express server entry
│   ├── routes.ts          # API routes and Adobe integration
│   └── storage.ts         # Database operations
├── shared/                 # Shared types and schemas
│   └── schema.ts          # Database schema and validation
├── temp/                   # Temporary files
└── attached_assets/        # Uploaded files
```

## 🔧 Development

### Available Scripts
- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run check` - TypeScript type checking
- `npm run db:push` - Push database schema changes

### API Endpoints
- `GET /api/health` - Check service status
- `GET /api/jobs` - Get recent processing jobs
- `GET /api/jobs/:id` - Get specific job details
- `POST /api/process` - Upload and process PDF
- `GET /api/jobs/:id/download` - Download results

## 🔒 Security

- Environment variables are stored in `.env` file (not committed to Git)
- Adobe credentials are kept secure
- File uploads are validated and sanitized
- Session management with secure secrets

## 🚀 Deployment

### Environment Variables
Ensure all required environment variables are set:
- `DATABASE_URL`: PostgreSQL connection string
- `ADOBE_CLIENT_ID`: Adobe PDF Services Client ID
- `ADOBE_CLIENT_SECRET`: Adobe PDF Services Client Secret
- `SESSION_SECRET`: Random string for session security

### Production Build
```bash
npm run build
npm start
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License.

## 🆘 Troubleshooting

### Adobe Services Not Configured
- Verify your `.env` file has correct Adobe credentials
- Check that the server is loading environment variables
- Restart the server after updating `.env`

### Database Connection Issues
- Verify your `DATABASE_URL` is correct
- Ensure the database is accessible
- Run `npm run db:push` to sync schema

### Port Conflicts
- The app runs on port 3000 by default
- If port 3000 is in use, update the port in `server/index.ts`

## 📞 Support

For issues and questions:
- Create an issue on GitHub
- Check the troubleshooting section above
- Verify your environment setup

---

**Built with ❤️ using modern web technologies** 