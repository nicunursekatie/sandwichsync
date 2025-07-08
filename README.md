# The Sandwich Project Platform

A web-based platform for managing sandwich collection, distribution, and volunteer coordination for The Sandwich Project.

## Getting Started

### Prerequisites

- Node.js 20.x or higher
- PostgreSQL database
- npm or yarn package manager

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd sandwichsync
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
Create a `.env` file in the root directory with the following:
```
DATABASE_URL=your_postgresql_connection_string
SESSION_SECRET=your_secure_session_secret
NODE_ENV=development
```

4. Initialize the database:
```bash
npm run db:push
```

### Running the Application

For development:
```bash
npm run dev
```

For production:
```bash
npm run build
npm start
```

The application will be available at `http://localhost:5000`

## Features

- **User Authentication**: Role-based access control for administrators, volunteers, and viewers
- **Sandwich Collection Tracking**: Track collections from hosts with detailed statistics
- **Driver Management**: Manage driver agreements and assignments
- **Project Management**: Track tasks, assignments, and progress
- **Real-time Messaging**: Committee and group messaging with WebSocket support
- **Analytics Dashboard**: Visualize collection data and generate reports
- **Meeting Management**: Upload and manage meeting minutes and agendas
- **Phone Directory**: Comprehensive contact management for hosts, drivers, and recipients

## Tech Stack

- **Frontend**: React, TypeScript, Vite, TailwindCSS
- **Backend**: Node.js, Express, TypeScript
- **Database**: PostgreSQL with Drizzle ORM
- **Real-time**: WebSockets for notifications
- **Authentication**: Session-based authentication with role management

## Project Structure

```
sandwichsync/
├── client/          # React frontend application
├── server/          # Express backend server
├── shared/          # Shared types and schemas
├── uploads/         # File upload storage
└── attached_assets/ # Static assets and documents
```

## Contributing

Please refer to the MAINTENANCE_GUIDE.md for detailed information about system maintenance and development practices.

## License

This project is proprietary software for The Sandwich Project organization.