# BrewBuddy API Documentation

## Base URL
```
Production: https://brew-buddy-backend-production.up.railway.app
Development: http://localhost:3000
```

## Authentication
BrewBuddy uses token-based authentication. After registration, include your token in requests.

---

## Endpoints

### 1. Health Check

**GET** `/api/health`

Check if the API is running.

**Request:**
```bash
curl https://your-backend.railway.app/api/health
```

**Response:**
```json
{
  "status": "ok",
  "app": "brewbuddy",
  "timestamp": "2026-02-04T10:00:00.000Z",
  "uptime": 12345.67,
  "environment": "production"
}
```

**Status Codes:**
- `200` - API is healthy

---

### 2. Register User

**POST** `/api/auth/register`

Register a new user account. Limited to 10 users (beta).

**Request:**
```bash
curl -X POST https://your-backend.railway.app/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "johndoe"
  }'
```

**Request Body:**
```json
{
  "username": "johndoe"
}
```

**Success Response (201):**
```json
{
  "success": true,
  "user": {
    "id": 1,
    "username": "johndoe",
    "token": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
  },
  "spotsRemaining": 9
}
```

**Error Responses:**

**400 - Invalid Username:**
```json
{
  "success": false,
  "error": "Username must be at least 2 characters"
}
```

**403 - User Limit Reached:**
```json
{
  "success": false,
  "error": "Tester limit reached (10/10)",
  "spotsRemaining": 0
}
```

**409 - Username Taken:**
```json
{
  "success": false,
  "error": "Username already taken"
}
```

---

### 3. Validate Token

**GET** `/api/auth/validate?token={TOKEN}`

Validate a user token.

**Request:**
```bash
curl "https://your-backend.railway.app/api/auth/validate?token=YOUR_TOKEN_HERE"
```

**Success Response (200):**
```json
{
  "success": true,
  "valid": true,
  "user": {
    "id": 1,
    "username": "johndoe",
    "createdAt": "2026-02-04T10:00:00.000Z"
  }
}
```

**Error Response (401):**
```json
{
  "success": false,
  "valid": false,
  "error": "Invalid token"
}
```

---

### 4. Get User's Coffees

**GET** `/api/coffees?token={TOKEN}`

Retrieve all coffees for a user.

**Request:**
```bash
curl "https://your-backend.railway.app/api/coffees?token=YOUR_TOKEN_HERE"
```

**Success Response (200):**
```json
{
  "success": true,
  "coffees": [
    {
      "id": 1,
      "name": "Finca Milán",
      "origin": "Colombia, Calarcá",
      "process": "washed",
      "cultivar": "Caturra",
      "altitude": "1650",
      "roaster": "Local Roasters",
      "tastingNotes": "Watermelon, Lemonade",
      "addedDate": "2026-02-04T10:00:00.000Z",
      "savedAt": "2026-02-04T10:00:00.000Z"
    }
  ]
}
```

**Error Response (401):**
```json
{
  "success": false,
  "error": "Invalid token"
}
```

---

### 5. Save User's Coffees

**POST** `/api/coffees`

Save/update all coffees for a user (replaces existing).

**Request:**
```bash
curl -X POST https://your-backend.railway.app/api/coffees \
  -H "Content-Type: application/json" \
  -d '{
    "token": "YOUR_TOKEN_HERE",
    "coffees": [
      {
        "name": "Finca Milán",
        "origin": "Colombia, Calarcá",
        "process": "washed",
        "cultivar": "Caturra",
        "altitude": "1650",
        "roaster": "Local Roasters",
        "tastingNotes": "Watermelon, Lemonade",
        "addedDate": "2026-02-04T10:00:00.000Z"
      }
    ]
  }'
```

**Success Response (200):**
```json
{
  "success": true,
  "saved": 1
}
```

**Error Response (401):**
```json
{
  "success": false,
  "error": "Invalid token"
}
```

---

### 6. Analyze Coffee Image

**POST** `/api/analyze-coffee`

Analyze a coffee bag image using Claude AI.

⚠️ **Rate Limited:** 10 requests per hour per IP

**Request:**
```bash
curl -X POST https://your-backend.railway.app/api/analyze-coffee \
  -H "Content-Type: application/json" \
  -d '{
    "imageData": "BASE64_ENCODED_IMAGE_DATA",
    "mediaType": "image/jpeg"
  }'
```

**Request Body:**
```json
{
  "imageData": "/9j/4AAQSkZJRg...",
  "mediaType": "image/jpeg"
}
```

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "name": "Finca Milán",
    "origin": "Colombia, Calarcá",
    "process": "washed",
    "cultivar": "Caturra",
    "altitude": "1650",
    "roaster": "Local Roasters",
    "tastingNotes": "Watermelon, Lemonade",
    "addedDate": "2026-02-04T10:00:00.000Z"
  }
}
```

**Error Responses:**

**400 - Missing Data:**
```json
{
  "success": false,
  "error": "Image data required"
}
```

**429 - Rate Limit:**
```json
{
  "success": false,
  "error": "AI analysis limit reached. Please try again in an hour."
}
```

**500 - Analysis Failed:**
```json
{
  "success": false,
  "error": "Analysis failed. Please try again."
}
```

---

## Rate Limits

| Endpoint | Limit | Window |
|----------|-------|--------|
| General API | 100 requests | 15 minutes |
| AI Analysis | 10 requests | 1 hour |

When rate limit is exceeded, the API returns HTTP 429 with a JSON error message.

---

## Error Codes

| Code | Meaning |
|------|---------|
| 200 | Success |
| 201 | Created |
| 400 | Bad Request - Invalid input |
| 401 | Unauthorized - Invalid/missing token |
| 403 | Forbidden - User limit reached |
| 404 | Not Found - Endpoint doesn't exist |
| 409 | Conflict - Username already exists |
| 429 | Too Many Requests - Rate limit exceeded |
| 500 | Internal Server Error |

---

## Examples

### JavaScript/Fetch
```javascript
// Register user
const register = async (username) => {
  const response = await fetch('https://your-backend.railway.app/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username })
  });
  return response.json();
};

// Get coffees
const getCoffees = async (token) => {
  const response = await fetch(`https://your-backend.railway.app/api/coffees?token=${token}`);
  return response.json();
};

// Analyze coffee image
const analyzeCoffee = async (imageData, mediaType) => {
  const response = await fetch('https://your-backend.railway.app/api/analyze-coffee', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ imageData, mediaType })
  });
  return response.json();
};
```

### Python
```python
import requests

# Register user
def register_user(username):
    response = requests.post(
        'https://your-backend.railway.app/api/auth/register',
        json={'username': username}
    )
    return response.json()

# Get coffees
def get_coffees(token):
    response = requests.get(
        f'https://your-backend.railway.app/api/coffees?token={token}'
    )
    return response.json()
```

---

## Environment Variables

Required for deployment:

```env
# Required
ANTHROPIC_API_KEY=sk-ant-xxxxx

# Required for CORS
ALLOWED_ORIGINS=https://your-frontend.vercel.app,https://another-domain.com

# Optional
NODE_ENV=production
DATABASE_URL=postgresql://user:pass@host:5432/db  # For PostgreSQL
DATABASE_PATH=./brewbuddy.db                        # For SQLite
PORT=3000
```

---

## Database Schema

### Users Table
```sql
CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    token TEXT NOT NULL UNIQUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### Coffees Table
```sql
CREATE TABLE coffees (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    data TEXT NOT NULL,  -- JSON string
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
```

---

## Support

For issues or questions:
- GitHub: [Your Repository]
- Email: [Your Email]

**Version:** 1.0.0  
**Last Updated:** February 4, 2026
