# PDF Processing Application

## Overview

This is a full-stack application that processes PDF files to extract questions, images, and tables using the Datalab API. The application features a React frontend with a Node.js/Express backend, built with modern web technologies and styled with Tailwind CSS and shadcn/ui components.

## User Preferences

Preferred communication style: Simple, everyday language.

## Recent Changes

- 2025-01-13: **Migrated to Adobe PDF Services**: Replaced Datalab API with Adobe PDF Extract API for better reliability
- 2025-01-13: **Fixed Adobe PDF Services Integration**: Resolved "elementsToExtract not supported" error by using correct SDK parameters
- 2025-01-13: **Enhanced Image Quality**: Implemented intelligent upscaling with minimum 2x resolution boost and advanced Sharp.js processing
- 2025-01-13: **Smart Resolution Detection**: Added automatic detection of low-resolution images and adaptive upscaling to minimum 800x600px
- 2025-01-13: **Advanced Image Processing**: Applied Lanczos3 kernel for high-quality resizing, sharpening, and gamma correction
- 2025-01-13: **Free API Alternative**: Adobe provides 500 free document extractions per month
- 2025-01-13: **Updated Frontend**: Removed Datalab API references and updated UI to show Adobe PDF Services
- 2025-01-13: **Synchronous Processing**: Adobe PDF Services processes documents synchronously (no polling needed)
- 2025-01-13: **Enhanced Extraction**: Adobe provides better text, table, and image extraction capabilities
- 2025-01-13: **API Credit Conservation**: Removed continuous server-side polling to prevent credit wastage
- 2025-01-13: **Manual Result Checking**: Added "Check Results" button for on-demand status updates
- 2025-01-13: **Reduced Frontend Polling**: Changed from 2-second to 10-second intervals
- 2025-01-13: **Smart Result Fetching**: Results only checked when explicitly requested
- 2025-01-13: Fixed Datalab API schema validation errors by making nullable fields optional
- 2025-01-13: Implemented exponential backoff polling to handle API rate limits (429 errors)
- 2025-01-13: Added better error handling and logging for API responses
- 2025-01-13: Simplified output format to single option: "JSON Questions + WebP Images"
- 2025-01-13: Updated question parsing to match Singapore math paper JSON structure
- 2025-01-13: Fixed TypeScript compilation errors for multer and archiver
- 2025-01-13: Enhanced question structure to support MCQ options, explanations, and topic IDs

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite for fast development and optimized builds
- **Routing**: Wouter for lightweight client-side routing
- **State Management**: TanStack Query (React Query) for server state management
- **Styling**: Tailwind CSS with shadcn/ui component library
- **Form Handling**: React Hook Form with Zod validation

### Backend Architecture
- **Runtime**: Node.js with Express.js framework
- **Language**: TypeScript with ESM modules
- **Database**: PostgreSQL with Drizzle ORM
- **File Processing**: Multer for file uploads, Sharp for image processing
- **External API**: Datalab API for PDF processing

## Key Components

### Data Layer
- **Database Schema**: Single table `processing_jobs` storing job metadata, status, and results
- **ORM**: Drizzle ORM with PostgreSQL dialect
- **Storage Interface**: Abstracted storage layer with in-memory implementation for development

### API Layer
- **REST Endpoints**: 
  - `GET /api/jobs` - Fetch recent processing jobs
  - `GET /api/jobs/:id` - Get specific job details
  - `POST /api/process` - Upload PDF and start processing
- **External Integration**: Adobe PDF Extract API for PDF analysis and content extraction

### Frontend Components
- **File Upload**: Drag-and-drop interface with file validation
- **Processing Options**: Configuration panel for output format and processing parameters
- **Status Tracking**: Real-time progress display with polling
- **Results Display**: Tabbed interface showing JSON, images, and tables
- **Sidebar**: API configuration and recent jobs history

## Data Flow

1. **File Upload**: User selects PDF file through drag-and-drop or file picker
2. **Processing Configuration**: User sets options (page range, output format, LLM usage)
3. **Job Creation**: Form data and file are sent to backend, job record created
4. **External Processing**: File forwarded to Datalab API for analysis
5. **Status Polling**: Frontend polls job status every 2 seconds during processing
6. **Results Display**: Completed job results shown in tabbed interface
7. **Download**: Processed results available as ZIP download

## External Dependencies

### Backend Dependencies
- **Database**: Neon PostgreSQL serverless database
- **File Processing**: Archiver for ZIP creation, Sharp for image manipulation
- **API Integration**: Axios for HTTP requests to Datalab API
- **Validation**: Zod for schema validation

### Frontend Dependencies
- **UI Components**: Extensive use of Radix UI primitives via shadcn/ui
- **Icons**: Lucide React for consistent iconography
- **HTTP Client**: Axios for API requests
- **Date Handling**: date-fns for date formatting

### Third-Party Services
- **Adobe PDF Extract API**: External service for PDF content extraction (500 free documents/month)
- **Neon Database**: Serverless PostgreSQL hosting

## Deployment Strategy

### Development
- **Hot Reloading**: Vite dev server with HMR
- **Database**: Local PostgreSQL or Neon development database
- **Environment**: Development mode with debugging enabled

### Production
- **Build Process**: 
  - Frontend: Vite build with optimizations
  - Backend: esbuild compilation to ESM format
- **Static Assets**: Frontend served from Express with fallback routing
- **Database**: Neon PostgreSQL with connection pooling
- **Environment Variables**: DATABASE_URL, ADOBE_CLIENT_ID, and ADOBE_CLIENT_SECRET required

### Architecture Decisions

**Monorepo Structure**: Client and server code in same repository with shared schema definitions for type safety across the stack.

**Database Choice**: PostgreSQL chosen for reliability and JSON support. Drizzle ORM provides type-safe database operations without excessive abstraction.

**State Management**: TanStack Query handles server state with built-in caching and polling capabilities, eliminating need for complex client-side state management.

**Component Library**: shadcn/ui provides pre-built accessible components while maintaining customization flexibility through Tailwind CSS.

**File Processing**: Server-side processing ensures security and handles large files efficiently without client-side limitations.

**Real-time Updates**: Polling strategy chosen over WebSockets for simplicity and reliability in serverless environments.