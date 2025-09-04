# Steep.gg Waitlist Automation Tool

An advanced automation tool for creating verified accounts on steep.gg with referral code support.

## Features

- 🤖 **Automated Account Creation**: Random username/password generation
- 📧 **Email Verification**: Automatic temporary email handling with GuerrillaMail
- 🎯 **Referral System**: Built-in "Cook" referral code support
- 📊 **Real-time Monitoring**: Live status updates and detailed logging
- ⚙️ **Configurable Batching**: Rate limiting with cooldown periods
- 🎨 **Professional UI**: Modern React interface with shadcn/ui components

## Tech Stack

- **Backend**: FastAPI + Python
- **Frontend**: React + Tailwind CSS + shadcn/ui  
- **Database**: MongoDB
- **APIs**: GuerrillaMail for temporary emails

## Local Development

### Backend Setup
```bash
cd backend
pip install -r requirements.txt
uvicorn server:app --reload --port 8001
```

### Frontend Setup
```bash
cd frontend
yarn install
yarn start
```

## Railway Deployment

### 1. Backend Deployment
1. Fork this repository
2. Sign up at [railway.app](https://railway.app)
3. Click "New Project" → "Deploy from GitHub"
4. Select your forked repository
5. Choose the backend folder as root
6. Set environment variables:
   - `MONGO_URL`: Your MongoDB connection string
   - `CORS_ORIGINS`: Your frontend URL
   - `DB_NAME`: Your database name

### 2. Frontend Deployment (Vercel)
1. Deploy to [Vercel](https://vercel.com)
2. Set `REACT_APP_BACKEND_URL` to your Railway backend URL
3. Build command: `yarn build`
4. Output directory: `build`

## Environment Variables

### Backend (.env)
```
MONGO_URL=mongodb+srv://username:password@cluster.mongodb.net/
DB_NAME=automation_db
CORS_ORIGINS=https://your-frontend.vercel.app
```

### Frontend (.env)
```
REACT_APP_BACKEND_URL=https://your-railway-app.railway.app
```

## Usage

1. Open the web interface
2. Configure automation settings (batch size, cooldown, etc.)
3. Click "Start Automation"
4. Monitor progress in real-time via logs and status cards
5. Accounts will be automatically created and verified

## Configuration Options

- **Batch Size**: 1-50 accounts per batch
- **Total Batches**: 1-10 batches to run
- **Cooldown Period**: 1-120 minutes between batches
- **Email Check Interval**: 5-60 seconds for verification emails
- **Referral Code**: Custom referral code (default: "Cook")

## API Endpoints

- `GET /api/automation/status` - Get automation status
- `POST /api/automation/start` - Start automation
- `POST /api/automation/stop` - Stop automation  
- `GET /api/automation/logs` - Get activity logs
- `DELETE /api/automation/logs` - Clear logs

## License

MIT License - Feel free to use and modify as needed.

## Disclaimer

This tool is for educational and testing purposes only. Use responsibly and in accordance with steep.gg's terms of service.