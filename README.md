# Slack Clone Socket.IO Server

This is a standalone Socket.IO server for the Slack Clone application. It handles real-time communication between users including messaging, typing indicators, and video/audio calls.

## Deployment on Render.com

### Manual Deployment

1. Create a new Web Service on Render
2. Link your GitHub repository
3. Use the following settings:
   - **Name:** slack-clone-socket (or any name you prefer)
   - **Runtime:** Node
   - **Build Command:** `./build.sh`
   - **Start Command:** `node server.js`
4. Add environment variables:
   - `NODE_ENV=production`
5. Deploy

### Using render.yaml (Blueprint)

If you have forked this repository, you can deploy directly using the render.yaml file:

1. Go to your Render dashboard
2. Click "Blueprint"
3. Select this repository
4. Follow the prompts to deploy

## Getting the Socket Server URL

After deployment, Render will provide a URL like:
```
https://slack-clone-socket.onrender.com
```

Use this URL as the value for `NEXT_PUBLIC_SOCKET_URL` in your Next.js application's environment variables.

## Local Development

To run the socket server locally:

```bash
npm install
npm start
```

The server will be available at http://localhost:4000
