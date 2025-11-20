# NUSENSE TryON - AI-Powered Virtual Try-On App for Shopify

A Shopify app that enables virtual try-on functionality for fashion e-commerce stores using AI-powered image generation.

## 🏗️ Project Structure

```
try-this-look/
├── src/                    # React frontend source code
│   ├── components/        # React components
│   ├── pages/             # Page components
│   ├── services/          # API service functions
│   ├── store/             # Redux store and slices
│   └── utils/             # Utility functions
├── server/                # Express.js backend server
│   ├── index.js           # Main server file
│   └── utils/             # Server utilities
├── extensions/            # Shopify theme app extension
│   └── theme-app-extension/
├── api/                   # Vercel serverless function wrapper
│   └── index.js
├── public/                # Static assets
├── dist/                  # Build output (generated)
└── shopify.app.toml       # Shopify app configuration
```

## 📋 Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** (v18 or higher) - [Download](https://nodejs.org/)
- **npm** (v9 or higher) - Comes with Node.js
- **Shopify CLI** (v3.0 or higher) - [Installation Guide](https://shopify.dev/docs/apps/tools/cli/installation)
- **Git** - [Download](https://git-scm.com/)
- **A Shopify Partner account** - [Sign up](https://partners.shopify.com/)

## 🚀 Installation

### Step 1: Clone the Repository

```bash
git clone <repository-url>
cd try-this-look
```

### Step 2: Install Root Dependencies

Install all frontend dependencies:

```bash
npm install
```

### Step 3: Install Server Dependencies

Install backend server dependencies:

```bash
cd server
npm install
cd ..
```

### Step 4: Set Up Environment Variables

Create a `.env` file in the root directory:

```bash
# Shopify App Credentials
# Get these from your Shopify Partner Dashboard > Apps > Your App
VITE_SHOPIFY_API_KEY=your_api_key_here
VITE_SHOPIFY_API_SECRET=your_api_secret_here

# Shopify App URL
# For local development, use ngrok or similar tunneling service
# Example: https://your-app.ngrok.io
VITE_SHOPIFY_APP_URL=https://your-app-url.com

# Shopify API Scopes
# Required scopes for the app (comma-separated)
VITE_SCOPES=read_products,read_themes,write_products,write_themes

# Server Port (optional, defaults to 3000)
VITE_PORT=3000

# Node Environment (optional, defaults to development)
VITE_NODE_ENV=development
```

#### Getting Shopify App Credentials

1. Go to [Shopify Partner Dashboard](https://partners.shopify.com/)
2. Navigate to **Apps** > **Create app**
3. Choose **Create app manually**
4. Fill in app details and create the app
5. Go to **API credentials** tab
6. Copy the **Client ID** (API Key) and **Client secret** (API Secret)
7. Add these to your `.env` file

#### Setting Up Local Development URL

For local development, you'll need a public URL. Options:

**Option 1: Using ngrok (Recommended)**
```bash
# Install ngrok
npm install -g ngrok

# Start your local server (see Step 5)
# In another terminal, run:
ngrok http 3000

# Copy the HTTPS URL (e.g., https://abc123.ngrok.io)
# Add it to VITE_SHOPIFY_APP_URL in .env
```

**Option 2: Using Shopify CLI Tunnel**
```bash
# Shopify CLI can create a tunnel automatically
shopify app dev
```

### Step 5: Configure Shopify App Settings

Update `shopify.app.toml` with your app details:

```toml
client_id = "your_client_id_from_partner_dashboard"
name = "nusense-tryon"
application_url = "https://your-app-url.com"
embedded = false

[build]
automatically_update_urls_on_dev = true
dev_store_url = "your-dev-store.myshopify.com"
```

### Step 6: Build the Project

Build the frontend:

```bash
npm run build
```

Or for development build:

```bash
npm run build:dev
```

## 🏃 Running the Application

### Development Mode

**Option 1: Run Frontend and Backend Separately**

Terminal 1 - Start the frontend dev server:
```bash
npm run dev
```
Frontend will be available at `http://localhost:8080`

Terminal 2 - Start the backend server:
```bash
npm run server:dev
```
Backend will be available at `http://localhost:3000`

**Option 2: Use Shopify CLI (Recommended for Shopify Development)**

This automatically handles tunneling and OAuth:
```bash
shopify app dev
```

### Production Mode

**Start the production server:**
```bash
# Build first
npm run build

# Start server
npm run server:start
```

## 📦 Available Scripts

### Root Package Scripts

- `npm run dev` - Start Vite dev server (frontend only)
- `npm run build` - Build for production
- `npm run build:dev` - Build for development
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint
- `npm run shopify` - Run Shopify CLI commands
- `npm run shopify:dev` - Start Shopify app in dev mode
- `npm run shopify:deploy` - Deploy to Shopify
- `npm run server:dev` - Start backend server in dev mode
- `npm run server:start` - Start backend server in production mode
- `npm run test` - Run tests
- `npm run test:ui` - Run tests with UI
- `npm run test:coverage` - Run tests with coverage

### Server Package Scripts

- `npm run dev` - Start server with watch mode (from server directory)
- `npm start` - Start server in production mode (from server directory)

## 🌐 Deployment

### Deploying to Vercel

1. **Push your code to GitHub/GitLab/Bitbucket**

2. **Import project in Vercel:**
   - Go to [Vercel Dashboard](https://vercel.com/dashboard)
   - Click **Add New Project**
   - Import your repository

3. **Configure Environment Variables in Vercel:**
   - Go to **Settings** > **Environment Variables**
   - Add all variables from your `.env` file:
     - `VITE_SHOPIFY_API_KEY`
     - `VITE_SHOPIFY_API_SECRET`
     - `VITE_SHOPIFY_APP_URL`
     - `VITE_SCOPES`
     - `VITE_PORT` (optional)
     - `VITE_NODE_ENV` (optional)

4. **Deploy:**
   - Vercel will automatically detect the build settings from `vercel.json`
   - Build command: `npm run build`
   - Output directory: `dist`
   - Install command: `npm install`

5. **Update Shopify App URL:**
   - After deployment, update `application_url` in `shopify.app.toml` with your Vercel URL
   - Update redirect URLs in Shopify Partner Dashboard to match your Vercel domain

### Deploying Shopify Theme Extension

```bash
# Deploy the theme app extension
shopify app deploy
```

## 🔧 Configuration

### Shopify App Configuration

The app is configured via `shopify.app.toml`:

- **Client ID**: Your Shopify app's API key
- **Application URL**: Your deployed app URL
- **Scopes**: Required API permissions
- **Webhooks**: Configured for GDPR compliance and app lifecycle
- **Theme Extension**: Included for storefront integration

### Frontend Configuration

- **Vite**: Configured in `vite.config.ts`
- **TypeScript**: Configured in `tsconfig.json`
- **TailwindCSS**: Configured in `tailwind.config.ts`
- **shadcn/ui**: Configured in `components.json`

### Backend Configuration

- **Express Server**: Configured in `server/index.js`
- **Shopify API**: Initialized with credentials from environment variables
- **CORS**: Enabled for cross-origin requests
- **Webhook Verification**: HMAC signature verification for security

## 🧪 Testing

Run the test suite:

```bash
# Run all tests
npm run test

# Run tests with UI
npm run test:ui

# Run tests with coverage
npm run test:coverage
```

## 📁 Key Directories

- **`src/`** - React frontend source code
  - `components/` - Reusable React components (including shadcn/ui components)
  - `pages/` - Page-level components
  - `services/` - API service functions
  - `store/` - Redux store configuration
  - `hooks/` - Custom React hooks
  - `utils/` - Utility functions

- **`server/`** - Express.js backend
  - `index.js` - Main server file with routes and middleware
  - `utils/` - Server utilities (logger, billing, etc.)

- **`extensions/theme-app-extension/`** - Shopify theme app extension
  - Liquid templates for storefront integration
  - Widget scripts for product pages

- **`public/`** - Static assets
  - Images, icons, and widget scripts

- **`api/`** - Vercel serverless function wrapper
  - Routes Express app for Vercel deployment

## 🔐 Security Notes

- **Never commit `.env` files** - They are in `.gitignore`
- **Webhook Verification** - All webhooks are verified using HMAC signatures
- **App Proxy Verification** - App proxy requests are verified using signature parameters
- **CORS** - Configured appropriately for production use
- **Environment Variables** - Use secure storage for production secrets

## 🐛 Troubleshooting

### Common Issues

**Issue: "Missing required environment variables"**
- Solution: Ensure all required variables are set in `.env` file
- Check that variable names start with `VITE_` prefix

**Issue: "OAuth callback failed"**
- Solution: Verify redirect URLs in Shopify Partner Dashboard match your app URL
- Ensure `VITE_SHOPIFY_APP_URL` is correctly set

**Issue: "Webhook signature verification failed"**
- Solution: Verify `VITE_SHOPIFY_API_SECRET` is correct
- Ensure webhook URLs are accessible from the internet

**Issue: "Cannot find module" errors**
- Solution: Run `npm install` in both root and `server/` directories
- Clear `node_modules` and reinstall if needed

**Issue: Port already in use**
- Solution: Change `VITE_PORT` in `.env` to a different port
- Or stop the process using the port

## 📚 Additional Resources

- [Shopify App Development Docs](https://shopify.dev/docs/apps)
- [Shopify CLI Documentation](https://shopify.dev/docs/apps/tools/cli)
- [Vite Documentation](https://vitejs.dev/)
- [React Documentation](https://react.dev/)
- [TailwindCSS Documentation](https://tailwindcss.com/)
- [shadcn/ui Documentation](https://ui.shadcn.com/)

## 📝 License

[Add your license information here]

## 👥 Contributing

[Add contributing guidelines here]

## 🆘 Support

For issues and questions:
- Create an issue in the repository
- Contact the development team

---

**Note**: This is a Shopify app that requires proper Shopify Partner account setup and app credentials to function correctly.

