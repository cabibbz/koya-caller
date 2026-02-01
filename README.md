# Koya Caller

AI-powered phone receptionist for small businesses. Koya handles incoming calls, books appointments, answers questions, and takes messages - all powered by conversational AI.

## Features

- **AI Phone Receptionist**: Natural voice conversations powered by Retell.ai
- **Appointment Booking**: Automated scheduling with calendar integration
- **Multi-language Support**: Handle calls in multiple languages
- **Call Analytics**: Track call outcomes, durations, and transcripts
- **Knowledge Base**: Train the AI on your business information
- **SMS Follow-ups**: Automatic text confirmations and reminders
- **Dashboard**: Real-time monitoring and management

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Database**: Supabase (PostgreSQL with RLS)
- **Authentication**: Supabase Auth
- **Voice AI**: Retell.ai
- **Telephony**: Twilio
- **Payments**: Stripe
- **AI/LLM**: Anthropic Claude
- **Styling**: Tailwind CSS
- **State Management**: React Query

## Getting Started

### Prerequisites

- Node.js 20+
- npm or yarn
- Supabase account
- Retell.ai account
- Twilio account
- Stripe account

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/cabibbz/koya-caller.git
   cd koya-caller
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Copy environment variables:
   ```bash
   cp .env.example .env.local
   ```

4. Configure environment variables (see [Configuration](#configuration))

5. Run database migrations:
   ```bash
   npx supabase db push
   ```

6. Start the development server:
   ```bash
   npm run dev
   ```

7. Open [http://localhost:3000](http://localhost:3000)

## Configuration

### Required Environment Variables

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Retell.ai
RETELL_API_KEY=your-retell-api-key
RETELL_WEBHOOK_SECRET=your-webhook-secret

# Twilio
TWILIO_ACCOUNT_SID=your-account-sid
TWILIO_AUTH_TOKEN=your-auth-token

# Stripe
STRIPE_SECRET_KEY=your-secret-key
STRIPE_WEBHOOK_SECRET=your-webhook-secret
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=your-publishable-key

# Anthropic
ANTHROPIC_API_KEY=your-api-key

# App
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

See `.env.example` for the complete list of environment variables.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |
| `npm run type-check` | Run TypeScript compiler check |
| `npm run test` | Run tests in watch mode |
| `npm run test:run` | Run tests once |
| `npm run test:coverage` | Run tests with coverage report |

## Project Structure

```
koya-caller/
├── app/                    # Next.js App Router pages
│   ├── (auth)/            # Authentication routes
│   ├── (dashboard)/       # Dashboard routes
│   ├── (marketing)/       # Public marketing pages
│   ├── admin/             # Admin panel
│   └── api/               # API routes
├── components/            # React components
│   ├── ui/               # Base UI components
│   └── providers/        # Context providers
├── hooks/                 # Custom React hooks
├── lib/                   # Utility libraries
│   ├── api/              # API utilities
│   ├── auth/             # Authentication utilities
│   ├── config/           # Configuration
│   ├── db/               # Database utilities
│   ├── retell/           # Retell.ai integration
│   ├── security/         # Security utilities
│   ├── stripe/           # Stripe integration
│   └── twilio/           # Twilio integration
├── tests/                 # Test files
├── types/                 # TypeScript type definitions
└── supabase/             # Supabase configuration
    └── migrations/       # Database migrations
```

## API Documentation

### Dashboard APIs

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/dashboard/calls` | GET | List calls with filters |
| `/api/dashboard/calls` | PATCH | Update call (flag/notes) |
| `/api/dashboard/appointments` | GET | List appointments |
| `/api/dashboard/appointments` | POST | Create appointment |
| `/api/dashboard/settings` | GET/POST | Business settings |
| `/api/dashboard/stats` | GET | Dashboard statistics |

### Webhook Endpoints

| Endpoint | Provider | Description |
|----------|----------|-------------|
| `/api/retell/webhook` | Retell.ai | Call events |
| `/api/stripe/webhook` | Stripe | Payment events |
| `/api/twilio/webhook` | Twilio | SMS/Voice events |

## Security

- **Authentication**: JWT-based with Supabase Auth
- **Authorization**: Row-Level Security (RLS) policies
- **Rate Limiting**: Per-user and per-IP limits
- **Input Validation**: Zod schemas and sanitization
- **Security Headers**: CSP, HSTS, X-Frame-Options
- **Webhook Verification**: HMAC signature validation

## Testing

```bash
# Run all tests
npm run test:run

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode
npm run test
```

## Deployment

### Vercel (Recommended)

1. Push to GitHub
2. Import to Vercel
3. Configure environment variables
4. Deploy

### Docker

```bash
docker build -t koya-caller .
docker run -p 3000:3000 --env-file .env.local koya-caller
```

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is proprietary software. All rights reserved.

## Support

For support, email support@koya.ai or open an issue on GitHub.
