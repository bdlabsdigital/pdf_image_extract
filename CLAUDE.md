# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

- `npm run dev` - Start development server (runs client + server with HMR at localhost:5000)
- `npm run build` - Build for production (Vite frontend + esbuild backend)
- `npm start` - Run production server 
- `npm run check` - TypeScript type checking across entire codebase
- `npm run db:push` - Push database schema changes to PostgreSQL

## Environment Variables Required

Create a `.env` file in the root directory with:

```bash
DATABASE_URL=postgresql://... # Neon PostgreSQL connection string
ADOBE_CLIENT_ID=your_adobe_client_id # Adobe PDF Services credentials
ADOBE_CLIENT_SECRET=your_adobe_client_secret
SESSION_SECRET=your_session_secret # Session management
organization_id=your_org_id@AdobeOrg # Adobe organization ID
```

## Architecture Overview

This is a PDF processing application that extracts questions, images, and tables from educational PDFs using Adobe PDF Services. The codebase follows a monorepo structure with shared type definitions.

### Key Directories
- `/client/` - React frontend with Vite, TypeScript, Tailwind CSS
- `/server/` - Express.js backend with TypeScript (ES modules)
- `/shared/` - Database schema and validation types using Drizzle ORM + Zod

### Database Design
Single table `processing_jobs` in PostgreSQL stores all job metadata:
- Job status tracking (pending → processing → completed/failed)
- Processing options (page range, output format, OCR settings)
- Results storage (JSON data, extracted images, statistics)
- Uses JSON columns for storing extracted questions and image data

### Frontend Architecture
- **Router**: Wouter for lightweight routing
- **State**: TanStack Query for server state management
- **UI**: shadcn/ui components (40+ Radix UI primitives)
- **Forms**: React Hook Form with Zod validation
- **Styling**: Tailwind CSS with CSS variables for theming

### Backend Architecture
- **API**: Express.js with TypeScript, ES module format
- **File Processing**: Multer uploads → Adobe PDF Services → Sharp image optimization
- **Database**: Drizzle ORM with PostgreSQL (Neon serverless)
- **External API**: Adobe PDF Services SDK (500 free extractions/month)

### Path Aliases
- `@/` maps to `client/src/`
- `@shared/` maps to `shared/`
- `@assets/` maps to `attached_assets/`

### Important File Locations
- **Main App**: `/client/src/pages/home.tsx` - Single-page application entry
- **Server Entry**: `/server/index.ts` - Express server with middleware
- **API Routes**: `/server/routes.ts` - All REST endpoints and Adobe integration  
- **Database Schema**: `/shared/schema.ts` - Drizzle ORM types and Zod validators
- **Storage Layer**: `/server/storage.ts` - In-memory storage (production uses PostgreSQL)
- **UI Components**: `/client/src/components/ui/` - shadcn/ui component library
- **Type Definitions**: `/client/src/lib/types.ts` - Frontend-specific types

## External Services

- **Adobe PDF Services**: Primary PDF extraction API (replaced Datalab API)
- **Neon PostgreSQL**: Serverless database hosting
- **Replit**: Hosting platform (development plugins configured)

## Processing Flow

1. PDF upload via drag-and-drop interface
2. Job creation with processing options stored in database
3. Adobe PDF Services extraction with image optimization
4. Results stored as JSON with ZIP download capability
5. Real-time status updates via polling (reduced frequency for API credit management)

## Development Workflow & Best Practices

### Adding New Features
1. **API Changes**: Update schema in `/shared/schema.ts` first
2. **Database**: Run `npm run db:push` to sync schema changes
3. **Backend**: Add routes in `/server/routes.ts` with proper error handling
4. **Frontend**: Create components in `/client/src/components/` using shadcn/ui patterns
5. **Types**: Update `/client/src/lib/types.ts` for frontend-specific interfaces

### Key Patterns to Follow
- **Error Handling**: Use try/catch with meaningful error messages
- **API Responses**: Return consistent JSON with status/error fields
- **State Management**: Use TanStack Query for server state, React state for UI
- **Validation**: Zod schemas for runtime validation + TypeScript for compile-time
- **Image Processing**: Sharp.js with WebP output for optimal performance
- **File Organization**: Group related components, avoid deep nesting

### Common Debugging Tips
- **Port**: Application runs on port 5000 (hardcoded for Replit compatibility)
- **API Health**: Check `/api/health` endpoint for Adobe services status
- **Database**: Uses in-memory storage in development, PostgreSQL in production
- **Logs**: Server logs all API requests with timing and response data
- **Credits**: Adobe provides 500 free extractions/month, polling optimized to conserve

## Recent Changes

The application migrated from Datalab API to Adobe PDF Services for improved reliability and extraction quality. Enhanced image processing includes smart upscaling and quality optimization specifically for educational content.