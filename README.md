# BrewBuddy Backend API

A coffee brewing assistant backend API with AI-powered coffee bag analysis using Claude AI.

## 🚀 Features

- **Authentication**: Token-based authentication with device binding
- **Coffee Management**: Store and retrieve coffee information
- **AI Analysis**: Analyze coffee bag images using Claude AI to extract coffee information
- **Brew Tracking**: Track and manage coffee brew sessions
- **User Preferences**: 
  - Grinder preference (8 supported grinders)
  - Brew method preference (V60, Chemex, AeroPress)
  - Water hardness settings
- **Security**: Header-based authentication, CORS protection, rate limiting
- **Database**: PostgreSQL for production, SQLite for development

## 📋 Prerequisites

- Node.js >= 18.0.0
- npm or yarn
- Anthropic API key (for AI features)
- Database: PostgreSQL (for production) or SQLite (for development, default)

## 🔧 Installation

1. **Clone the repository** (already done if you're reading this!)
   ```bash
   git clone https://github.com/Meekazoid/brewbuddy-backend.git
   cd brewbuddy-backend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   ```
   
   Edit `.env` and set your configuration:
   - `ANTHROPIC_API_KEY`: Your Anthropic API key (required)
   - `NODE_ENV`: `development` or `production`
   - `DATABASE_URL`: PostgreSQL connection string (production only)
   - `ALLOWED_ORIGINS`: Comma-separated list of allowed CORS origins
   - `PORT`: Server port (default: 3000)

## 🚀 Running the Server

### Development Mode
```bash
npm run dev
```
This runs the server with hot-reload enabled using Node's `--watch` flag.

### Production Mode
```bash
npm start
```

## 🧪 Testing

Run all tests:
```bash
npm test
```

Run tests in watch mode:
```bash
npm run test:watch
```

### Current Test Status
✅ All 48 tests passing across 3 test suites:
- Database operations
- Authentication and transactions
- Input sanitization

## 📚 API Documentation

See [API_DOCUMENTATION.md](./API_DOCUMENTATION.md) for complete API reference including:
- All available endpoints
- Authentication methods
- Request/response examples
- Error codes
- Rate limits

## 🏗️ Project Structure

```
brewbuddy-backend/
├── __tests__/              # Test files
├── db/                     # Database setup and queries
├── middleware/             # Express middleware (auth)
├── routes/                 # API route handlers
│   ├── analyze.js         # AI coffee analysis
│   ├── auth.js            # Authentication
│   ├── brews.js           # Brew tracking
│   ├── coffees.js         # Coffee management
│   ├── grinder.js         # Grinder preferences
│   ├── health.js          # Health check
│   ├── method.js          # Brew method preferences
│   └── waterHardness.js   # Water hardness settings
├── utils/                  # Utility functions
├── server.js              # Main server file
├── package.json           # Dependencies and scripts
└── .env.example           # Environment variables template
```

## 🔒 Security Features

- **Header-based authentication**: Tokens sent via headers (not in URLs)
- **Device binding**: Each token is bound to a specific device
- **CORS protection**: Configurable allowed origins
- **Rate limiting**: 
  - General API: 100 requests per 15 minutes
  - AI Analysis: 10 requests per hour
- **Database transactions**: Prevents data loss during sync operations
- **Input sanitization**: All user inputs are validated and sanitized

## 🗄️ Database

### Development (SQLite)
Database file is automatically created at `./db/brewbuddy.db`

### Production (PostgreSQL)
Set `DATABASE_URL` in environment variables:
```
DATABASE_URL=postgresql://user:password@host:5432/dbname
```

## 📦 Dependencies

### Main Dependencies
- **express**: Web framework
- **cors**: CORS middleware
- **dotenv**: Environment variable management
- **pg**: PostgreSQL client (for production)
- **express-rate-limit**: API rate limiting
- **uuid**: UUID generation

### Development Dependencies
- **jest**: Testing framework

### Optional Dependencies
- **sqlite3** & **sqlite**: SQLite database support (automatically used in development mode)

## 🔄 Recent Updates (v5.0)

See [RELEASE_NOTES_v5.0.md](./RELEASE_NOTES_v5.0.md) for detailed information about:
- Header-based authentication implementation
- Database transaction support
- Production CORS warning system
- Security improvements

## 📝 Environment Variables Reference

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `ANTHROPIC_API_KEY` | Yes | - | Anthropic API key for Claude AI |
| `NODE_ENV` | No | `development` | Environment mode |
| `PORT` | No | `3000` | Server port |
| `DATABASE_URL` | Production only | - | PostgreSQL connection string |
| `DATABASE_PATH` | No | `./db/brewbuddy.db` | SQLite database path |
| `ALLOWED_ORIGINS` | Recommended | - | Comma-separated CORS origins |

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License.

## 🐛 Issues & Support

For issues or questions:
- Open an issue on GitHub
- Check the [API Documentation](./API_DOCUMENTATION.md)
- Review the [Release Notes](./RELEASE_NOTES_v5.0.md)

## 🎯 Quick Start Checklist

- [ ] Node.js 18+ installed
- [ ] Dependencies installed (`npm install`)
- [ ] `.env` file created and configured
- [ ] Anthropic API key set
- [ ] Tests passing (`npm test`)
- [ ] Server starts successfully (`npm run dev`)

## 🌟 Features Overview

### Current Version: 5.2.0
- ✅ User authentication with device binding
- ✅ Coffee inventory management
- ✅ AI-powered coffee bag analysis
- ✅ Brew session tracking
- ✅ Grinder preferences (8 grinders supported)
- ✅ Brew method preferences (V60, Chemex, AeroPress)
- ✅ Water hardness tracking
- ✅ Header-based secure authentication
- ✅ Database transactions for data integrity
- ✅ Comprehensive test coverage

---

**Built with ☕ by meekazoid**
