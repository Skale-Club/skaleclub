# Environment Setup Guide

## Critical Issues Fixed

### 1. Zustand Deprecation Warning
**Status:** ✅ Not a code issue
  
The zustand deprecation warnings you're seeing are coming from a transitive dependency (another package using zustand), not from your code. Since zustand is not directly installed in your `package.json`, this is a cosmetic warning that will be resolved when those dependencies update.

### 2. 500 Internal Server Errors (CRITICAL - NEEDS FIXING)
**Status:** ⚠️ Missing environment configuration

All API endpoints are returning 500 errors because the `.env` file is missing. The database connection cannot be established without proper configuration.

## Quick Start

### Step 1: Create Environment File

Copy the example file and configure it:

```bash
# Copy the template
cp .env.example .env

# Edit the file with your actual values
```

### Step 2: Configure Required Variables

Open `.env` and set these **required** values:

#### Database (REQUIRED)
```env
DATABASE_URL=postgresql://user:password@host:port/database
```

Get your PostgreSQL connection string from:
- Local PostgreSQL installation
- Supabase (https://supabase.com)
- Neon (https://neon.tech)
- Vercel Postgres
- Any PostgreSQL hosting provider

#### Session Secret (REQUIRED)
```env
SESSION_SECRET=<generate-a-random-string>
```

Generate a secure secret:
```bash
# Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# PowerShell (Windows)
Add-Type -AssemblyName System.Web; [System.Web.Security.Membership]::GeneratePassword(32,0)

# Or use: https://randomkeygen.com/
```

#### Admin Account (REQUIRED)
```env
ADMIN_EMAIL=your-email@example.com
ADMIN_PASSWORD_HASH=<bcrypt-hash>
```

Generate password hash:
```bash
# Install bcrypt if needed
npm install bcrypt

# Generate hash (replace 'your-password' with your actual password)
node -e "const bcrypt = require('bcrypt'); bcrypt.hash('your-password', 10, (err, hash) => console.log(hash));"
```

### Step 3: Setup Database

```bash
# Push database schema to your PostgreSQL database
npm run db:push
```

### Step 4: Start Development Server

```bash
# Install dependencies (if not already done)
npm install

# Start the dev server
npm run dev
```

The app will be available at `http://localhost:5000`.

## Optional Integrations

### GoHighLevel CRM
```env
GHL_API_KEY=your-api-key
GHL_LOCATION_ID=your-location-id
GHL_CALENDAR_ID=your-calendar-id
```

### Twilio SMS Notifications
```env
TWILIO_ACCOUNT_SID=your-account-sid
TWILIO_AUTH_TOKEN=your-auth-token
TWILIO_PHONE_NUMBER=+1234567890
TWILIO_HOT_LEAD_RECIPIENTS=+1111111111,+2222222222
```

### OpenAI (AI Features)
```env
OPENAI_API_KEY=sk-your-api-key
```

### Supabase Storage
```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### Vercel Cron (Supabase Keep-Alive)
```env
CRON_SECRET=your-vercel-cron-secret
```

## Troubleshooting

### Still Getting 500 Errors?

1. **Check Database Connection**
   ```bash
   # Test connection string
   npm run print:db:dev
   ```

2. **Verify Environment Variables**
   - Make sure `.env` file exists in project root
   - Restart dev server after creating/editing `.env`
   - Check for typos in variable names

3. **Check Database Schema**
   ```bash
   # Reapply schema
   npm run db:push
   ```

4. **View Detailed Errors**
   - Check terminal/console for detailed error messages
   - Check browser Network tab for response bodies

### Database Connection Issues

- Ensure PostgreSQL is running
- Verify connection string format
- Check firewall/network settings
- Verify database credentials
- Ensure database exists

### Admin Login Issues

- Verify `ADMIN_EMAIL` matches what you're entering
- Ensure password hash was generated correctly
- Try regenerating the hash with your password

## Security Notes

⚠️ **NEVER commit your `.env` file to version control**

- `.env` is already in `.gitignore`
- Use `.env.example` for documentation
- Use environment variables in production (Vercel/hosting dashboard)
- Rotate secrets regularly

## Production Deployment

### Vercel
Add environment variables in your Vercel project dashboard:
1. Go to Project Settings → Environment Variables
2. Add all required variables from `.env`
3. Redeploy the application

### Other Platforms
Follow your hosting provider's documentation for setting environment variables.

## Need Help?

- Check [README.md](./README.md) for project overview
- Review [AGENTS.md](./AGENTS.md) for development guidelines
- Verify all TypeScript types: `npm run check`
