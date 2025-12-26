Auth Setup (better-auth)

- Installed dependency: better-auth
- Server config at `lib/auth/server.ts`
- Client helpers at `lib/auth/client.ts`
- Frontend hook at `lib/auth/useAuth.ts`
- API route at `app/api/auth/[...all]/route.ts`

Environment variables to add to `.env.local` (or prod env):

AUTH_SECRET=...  # openssl rand -base64 32
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
# Optional if your auth API runs on a different origin:
# AUTH_URL=https://your-app.example.com
# NEXT_PUBLIC_AUTH_URL=https://your-app.example.com

Note

- No UI added yet. Use the hook:

```ts
import { useAuth } from '@/lib/auth/useAuth';

const { user, isAuthenticated, signInWithGoogle, signOut } = useAuth();
```

