# Airtable Status Editor

A simple web app to update Airtable record statuses without requiring Airtable editing licenses.

## Features

- View all records in a clean table format
- Click screenshots to enlarge
- Update status via dropdown (auto-saves)
- Optimistic updates with error recovery
- Toast notifications for feedback

## Setup

### 1. Get Your Airtable Credentials

1. **API Key**: Go to [airtable.com/create/tokens](https://airtable.com/create/tokens)
   - Create a new personal access token
   - Add scopes: `data.records:read` and `data.records:write`
   - Restrict to your specific base
   - Copy the token

2. **Base ID**: Found in the URL when viewing your base
   - URL format: `airtable.com/appXXXXXXXXX/...`
   - The `appXXXXXXXXX` part is your Base ID

3. **Table Name**: The exact name of your table as shown in Airtable

### 2. Deploy to Vercel

#### Option A: Deploy from GitHub (Recommended)

1. Push this code to a GitHub repository
2. Go to [vercel.com](https://vercel.com) and click "New Project"
3. Import your GitHub repository
4. Add environment variables:
   - `AIRTABLE_API_KEY` = your token
   - `AIRTABLE_BASE_ID` = your base ID
   - `AIRTABLE_TABLE_NAME` = your table name
5. Click Deploy

#### Option B: Deploy with Vercel CLI

```bash
# Install Vercel CLI
npm i -g vercel

# Login to Vercel
vercel login

# Deploy (follow prompts to add env variables)
vercel
```

### 3. Enable Access Protection (Optional)

If your Vercel team has SSO configured:

1. Go to your project in Vercel dashboard
2. Settings → Security → Vercel Authentication
3. Enable "Vercel Authentication"

This restricts access to your SAP Vercel team members only.

## Local Development

```bash
# Install dependencies
npm install

# Copy env example and fill in your values
cp .env.example .env.local

# Run development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the app.

## Customization

### Change Status Options

Edit the `STATUS_OPTIONS` array in `app/page.tsx`:

```typescript
const STATUS_OPTIONS = [
  'Accepted - Not Planned',
  'Accepted - Planned',
  'Completed',
  'Rejected',
] as const;
```

Also update the validation in `app/api/records/[id]/route.ts`.

### Change Visible Fields

Edit the `fields` array in `app/api/records/route.ts`:

```typescript
.select({
  fields: ['Issue', 'Description', 'Screenshot', 'Dimension', 'Theme', 'Status'],
})
```

And update the table columns in `app/page.tsx`.

### Add Sorting

Uncomment and modify the sort option in `app/api/records/route.ts`:

```typescript
sort: [{ field: 'Issue', direction: 'asc' }],
```

## Tech Stack

- Next.js 14 (App Router)
- TypeScript
- Tailwind CSS
- Airtable SDK
