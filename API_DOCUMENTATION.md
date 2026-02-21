# Dripmate API Documentation v5.0

## Base URL
```
Production: https://dripmate-backend-production.up.railway.app
Development: http://localhost:3000
```

## Authentication

Dripmate uses token-based authentication with device binding. After registration, include your token and deviceId in requests.

### Authentication Methods (v5.0+)

**Recommended (Secure):** Use HTTP headers
```
Authorization: Bearer YOUR_TOKEN
X-Device-ID: YOUR_DEVICE_ID
```

**Backward Compatible:** Query parameters or request body
- Query: `?token=YOUR_TOKEN&deviceId=YOUR_DEVICE_ID`
- Body: `{ "token": "YOUR_TOKEN", "deviceId": "YOUR_DEVICE_ID" }`

**Note:** Headers are preferred as they prevent token exposure in server logs, browser history, and proxy logs. The API will check headers first, then fall back to body/query parameters for backward compatibility.

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
  "app": "dripmate",
  "version": "5.0.0-water-hardness",
  "timestamp": "2026-02-10T10:00:00.000Z",
  "uptime": 12345.67,
  "environment": "production"
}
```

**Status Codes:**
- `200` - API is healthy

---

### 2. Validate Token

**GET** `/api/auth/validate`

Validate a user token and device binding.

**Request (Headers - Recommended):**
```bash
curl -X GET https://your-backend.railway.app/api/auth/validate \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "X-Device-ID: YOUR_DEVICE_ID"
```

**Request (Query Parameters - Backward Compatible):**
```bash
curl "https://your-backend.railway.app/api/auth/validate?token=YOUR_TOKEN&deviceId=YOUR_DEVICE_ID"
```

**Success Response (200):**
```json
{
  "success": true,
  "valid": true,
  "user": {
    "id": 1,
    "username": "johndoe",
    "deviceId": "device-abc123",
    "grinderPreference": "fellow",
    "createdAt": "2026-02-06T10:00:00.000Z"
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

### 3. Get Grinder Preference

**GET** `/api/user/grinder`

Retrieve the user's preferred grinder setting.

**Request (Headers - Recommended):**
```bash
curl -X GET https://your-backend.railway.app/api/user/grinder \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "X-Device-ID: YOUR_DEVICE_ID"
```

**Request (Query Parameters - Backward Compatible):**
```bash
curl "https://your-backend.railway.app/api/user/grinder?token=YOUR_TOKEN&deviceId=YOUR_DEVICE_ID"
```

**Success Response (200):**
```json
{
  "success": true,
  "grinder": "fellow"
}
```

**Possible Values:**
- `"fellow"` - Fellow Ode Gen 2
- `"comandante"` - Comandante C40 MK3

**Error Response (401):**
```json
{
  "success": false,
  "error": "Invalid token"
}
```

---

### 4. Update Grinder Preference

**POST** `/api/user/grinder`

Update the user's preferred grinder setting.

**Request (Headers - Recommended):**
```bash
curl -X POST https://your-backend.railway.app/api/user/grinder \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "X-Device-ID: YOUR_DEVICE_ID" \
  -d '{
    "grinder": "comandante"
  }'
```

**Request (Body - Backward Compatible):**
```bash
curl -X POST https://your-backend.railway.app/api/user/grinder \
  -H "Content-Type: application/json" \
  -d '{
    "token": "YOUR_TOKEN",
    "deviceId": "YOUR_DEVICE_ID",
    "grinder": "comandante"
  }'
```

**Request Body (Headers):**
```json
{
  "grinder": "fellow"
}
```

**Request Body (Backward Compatible):**
```json
{
  "token": "YOUR_TOKEN",
  "deviceId": "YOUR_DEVICE_ID",
  "grinder": "fellow"
}
```

**Success Response (200):**
```json
{
  "success": true,
  "grinder": "fellow"
}
```

**Error Responses:**

**400 - Invalid Grinder:**
```json
{
  "success": false,
  "error": "Valid grinder required (fellow, comandante, or timemore)"
}
```

**401 - Invalid Token:**
```json
{
  "success": false,
  "error": "Invalid token"
}
```

**403 - Device Mismatch:**
```json
{
  "success": false,
  "error": "This token is already bound to another device"
}
```

---

### 5. Get Water Hardness

**GET** `/api/user/water-hardness`

Retrieve the user's water hardness setting.

**Request (Headers - Recommended):**
```bash
curl -X GET https://your-backend.railway.app/api/user/water-hardness \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "X-Device-ID: YOUR_DEVICE_ID"
```

**Request (Query Parameters - Backward Compatible):**
```bash
curl "https://your-backend.railway.app/api/user/water-hardness?token=YOUR_TOKEN&deviceId=YOUR_DEVICE_ID"
```

**Success Response (200):**
```json
{
  "success": true,
  "waterHardness": 12.5
}
```

**Note:** Returns `null` if not set.

---

### 6. Update Water Hardness

**POST** `/api/user/water-hardness`

Update the user's water hardness setting (in °dH - German degrees of hardness).

**Request (Headers - Recommended):**
```bash
curl -X POST https://your-backend.railway.app/api/user/water-hardness \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "X-Device-ID: YOUR_DEVICE_ID" \
  -d '{
    "waterHardness": 12.5
  }'
```

**Request (Body - Backward Compatible):**
```bash
curl -X POST https://your-backend.railway.app/api/user/water-hardness \
  -H "Content-Type: application/json" \
  -d '{
    "token": "YOUR_TOKEN",
    "deviceId": "YOUR_DEVICE_ID",
    "waterHardness": 12.5
  }'
```

**Request Body (Headers):**
```json
{
  "waterHardness": 12.5
}
```

**Request Body (Backward Compatible):**
```json
{
  "token": "YOUR_TOKEN",
  "deviceId": "YOUR_DEVICE_ID",
  "waterHardness": 12.5
}
```

**Success Response (200):**
```json
{
  "success": true,
  "waterHardness": 12.5
}
```

**Error Responses:**

**400 - Invalid Water Hardness:**
```json
{
  "success": false,
  "error": "Valid water hardness required (0-50 °dH)"
}
```

**401 - Invalid Token:**
```json
{
  "success": false,
  "error": "Invalid token"
}
```

**403 - Device Mismatch:**
```json
{
  "success": false,
  "error": "This token is already bound to another device"
}
```

---

### 7. Get User's Coffees

**GET** `/api/coffees`

Retrieve all coffees for a user.

**Request (Headers - Recommended):**
```bash
curl -X GET https://your-backend.railway.app/api/coffees \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "X-Device-ID: YOUR_DEVICE_ID"
```

**Request (Query Parameters - Backward Compatible):**
```bash
curl "https://your-backend.railway.app/api/coffees?token=YOUR_TOKEN&deviceId=YOUR_DEVICE_ID"
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
      "addedDate": "2026-02-06T10:00:00.000Z",
      "savedAt": "2026-02-06T10:00:00.000Z"
    }
  ]
}
```

---

### 8. Save User's Coffees

**POST** `/api/coffees`

Save/update all coffees for a user (replaces existing). **Now uses database transactions** to prevent data loss if save operation fails.

**Request (Headers - Recommended):**
```bash
curl -X POST https://your-backend.railway.app/api/coffees \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "X-Device-ID: YOUR_DEVICE_ID" \
  -d '{
    "coffees": [
      {
        "name": "Finca Milán",
        "origin": "Colombia, Calarcá",
        "process": "washed",
        "cultivar": "Caturra",
        "altitude": "1650",
        "roaster": "Local Roasters",
        "tastingNotes": "Watermelon, Lemonade",
        "addedDate": "2026-02-06T10:00:00.000Z"
      }
    ]
  }'
```

**Request (Body - Backward Compatible):**
```bash
curl -X POST https://your-backend.railway.app/api/coffees \
  -H "Content-Type: application/json" \
  -d '{
    "token": "YOUR_TOKEN",
    "deviceId": "YOUR_DEVICE_ID",
    "coffees": [
      {
        "name": "Finca Milán",
        "origin": "Colombia, Calarcá",
        "process": "washed",
        "cultivar": "Caturra",
        "altitude": "1650",
        "roaster": "Local Roasters",
        "tastingNotes": "Watermelon, Lemonade",
        "addedDate": "2026-02-06T10:00:00.000Z"
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

**Note:** This endpoint now uses database transactions. If any save operation fails, all changes are rolled back to prevent data loss.

---

### 9. Analyze Coffee Image

**POST** `/api/analyze-coffee`

Analyze a coffee bag image using Claude AI.

⚠️ **Rate Limited:** 10 requests per hour per IP

**Request (Headers - Recommended):**
```bash
curl -X POST https://your-backend.railway.app/api/analyze-coffee \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "X-Device-ID: YOUR_DEVICE_ID" \
  -d '{
    "imageData": "BASE64_ENCODED_IMAGE_DATA",
    "mediaType": "image/jpeg"
  }'
```

**Request (Body - Backward Compatible):**
```bash
curl -X POST https://your-backend.railway.app/api/analyze-coffee \
  -H "Content-Type: application/json" \
  -d '{
    "token": "YOUR_TOKEN",
    "deviceId": "YOUR_DEVICE_ID",
    "imageData": "BASE64_ENCODED_IMAGE_DATA",
    "mediaType": "image/jpeg"
  }'
```

**Request Body (Headers):**
```json
{
  "imageData": "/9j/4AAQSkZJRg...",
  "mediaType": "image/jpeg"
}
```

**Request Body (Backward Compatible):**
```json
{
  "token": "YOUR_TOKEN",
  "deviceId": "YOUR_DEVICE_ID",
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
    "addedDate": "2026-02-06T10:00:00.000Z"
  }
}
```

---

## Rate Limits

| Endpoint | Limit | Window |
|----------|-------|--------|
| General API | 100 requests | 15 minutes |
| AI Analysis | 10 requests | 1 hour |

---

## Error Codes

| Code | Meaning |
|------|---------|
| 200 | Success |
| 201 | Created |
| 400 | Bad Request - Invalid input |
| 401 | Unauthorized - Invalid/missing token |
| 403 | Forbidden - Device mismatch or limit reached |
| 404 | Not Found - Endpoint doesn't exist |
| 409 | Conflict - Username already exists |
| 429 | Too Many Requests - Rate limit exceeded |
| 500 | Internal Server Error |

---

## Examples

### JavaScript/Fetch

```javascript
// Get grinder preference
const getGrinderPreference = async (token, deviceId) => {
  const response = await fetch(
    `https://your-backend.railway.app/api/user/grinder?token=${token}&deviceId=${deviceId}`
  );
  return response.json();
};

// Update grinder preference
const updateGrinderPreference = async (token, deviceId, grinder) => {
  const response = await fetch('https://your-backend.railway.app/api/user/grinder', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, deviceId, grinder })
  });
  return response.json();
};

// Get coffees
const getCoffees = async (token, deviceId) => {
  const response = await fetch(
    `https://your-backend.railway.app/api/coffees?token=${token}&deviceId=${deviceId}`
  );
  return response.json();
};
```

### Python

```python
import requests

# Get grinder preference
def get_grinder_preference(token, device_id):
    response = requests.get(
        f'https://your-backend.railway.app/api/user/grinder',
        params={'token': token, 'deviceId': device_id}
    )
    return response.json()

# Update grinder preference
def update_grinder_preference(token, device_id, grinder):
    response = requests.post(
        'https://your-backend.railway.app/api/user/grinder',
        json={'token': token, 'deviceId': device_id, 'grinder': grinder}
    )
    return response.json()
```

---

## Database Schema

### Users Table
```sql
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    token TEXT NOT NULL UNIQUE,
    device_id TEXT UNIQUE,
    device_info TEXT,
    grinder_preference TEXT DEFAULT 'fellow',  -- ⭐ NEW
    last_login_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Coffees Table
```sql
CREATE TABLE coffees (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    data TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
```

---

## Grinder Values

The `grinder_preference` field accepts two values:

| Value | Description | Grind Format |
|-------|-------------|--------------|
| `fellow` | Fellow Ode Gen 2 | Decimal (e.g., "3.5") |
| `comandante` | Comandante C40 MK3 | Clicks (e.g., "22 clicks") |

Default value is `fellow`.

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
DATABASE_PATH=./dripmate.db                        # For SQLite
PORT=3000
```

---

## Migration Guide (v3.0 → v4.0)

### Database Migration

For existing databases, add the grinder preference column:

**PostgreSQL:**
```sql
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS grinder_preference TEXT DEFAULT 'fellow';
```

**SQLite:**
```sql
ALTER TABLE users 
ADD COLUMN grinder_preference TEXT DEFAULT 'fellow';
```

### Frontend Changes

Update your frontend to:
1. Fetch grinder preference on login
2. Sync grinder changes to backend
3. Use global grinder state instead of per-coffee state

---

## Support

For issues or questions:
- GitHub: [Your Repository]
- Email: [Your Email]

**Version:** 4.0.0  
**Last Updated:** February 6, 2026
