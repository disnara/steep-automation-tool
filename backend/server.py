from fastapi import FastAPI, APIRouter, HTTPException, BackgroundTasks
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone
import asyncio
import aiohttp
import random
import string
import re
import json
import time
from urllib.parse import parse_qs
import zipfile
import tempfile
from fastapi.responses import FileResponse

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app without a prefix
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Global automation state
automation_state = {
    "is_running": False,
    "accounts_created": 0,
    "total_accounts": 0,
    "current_batch": 0,
    "last_batch_time": None,
    "logs": [],
    "stats": {
        "successful_signups": 0,
        "verified_accounts": 0,
        "failed_attempts": 0
    }
}

# Define Models
class AutomationConfig(BaseModel):
    batch_size: int = Field(default=15, ge=1, le=50)
    cooldown_minutes: int = Field(default=15, ge=1, le=120)
    email_check_interval: int = Field(default=10, ge=5, le=60)
    referral_code: str = Field(default="Cook")
    continuous_mode: bool = Field(default=True)  # New field for continuous operation

class AutomationStatus(BaseModel):
    is_running: bool
    accounts_created: int
    total_accounts: int
    current_batch: int
    last_batch_time: Optional[datetime]
    stats: Dict[str, int]

class LogEntry(BaseModel):
    timestamp: datetime
    level: str
    message: str
    account_data: Optional[Dict[str, Any]] = None

class GuerrillaMailSession:
    def __init__(self):
        self.session_id = None
        self.email_addr = None
        self.email_timestamp = None
        
    async def get_email_address(self):
        """Initialize guerrilla mail session and get email address"""
        try:
            async with aiohttp.ClientSession() as session:
                params = {
                    'f': 'get_email_address',
                    'ip': '127.0.0.1',
                    'agent': 'Automation-Tool',
                    'lang': 'en'
                }
                
                headers = {}
                if self.session_id:
                    headers['Cookie'] = f'PHPSESSID={self.session_id}'
                
                async with session.get('http://api.guerrillamail.com/ajax.php', params=params, headers=headers) as resp:
                    # Extract session ID from response headers
                    if 'Set-Cookie' in resp.headers:
                        cookie_header = resp.headers['Set-Cookie']
                        if 'PHPSESSID=' in cookie_header:
                            self.session_id = cookie_header.split('PHPSESSID=')[1].split(';')[0]
                    
                    data = await resp.json()
                    self.email_addr = data.get('email_addr')
                    self.email_timestamp = data.get('email_timestamp')
                    
                    return self.email_addr
                    
        except Exception as e:
            log_message(f"Error getting guerrilla mail address: {str(e)}", "ERROR")
            return None
    
    async def check_email(self, seq=0):
        """Check for new emails"""
        try:
            async with aiohttp.ClientSession() as session:
                params = {
                    'f': 'check_email',
                    'ip': '127.0.0.1',
                    'agent': 'Automation-Tool',
                    'seq': seq
                }
                
                headers = {}
                if self.session_id:
                    headers['Cookie'] = f'PHPSESSID={self.session_id}'
                
                async with session.get('http://api.guerrillamail.com/ajax.php', params=params, headers=headers) as resp:
                    data = await resp.json()
                    return data.get('list', [])
                    
        except Exception as e:
            log_message(f"Error checking email: {str(e)}", "ERROR")
            return []
    
    async def fetch_email(self, email_id):
        """Fetch email content by ID"""
        try:
            async with aiohttp.ClientSession() as session:
                params = {
                    'f': 'fetch_email',
                    'ip': '127.0.0.1',
                    'agent': 'Automation-Tool',
                    'email_id': email_id
                }
                
                headers = {}
                if self.session_id:
                    headers['Cookie'] = f'PHPSESSID={self.session_id}'
                
                async with session.get('http://api.guerrillamail.com/ajax.php', params=params, headers=headers) as resp:
                    data = await resp.json()
                    return data
                    
        except Exception as e:
            log_message(f"Error fetching email: {str(e)}", "ERROR")
            return None

def log_message(message: str, level: str = "INFO", account_data: Dict = None):
    """Add log entry to automation state"""
    log_entry = {
        "timestamp": datetime.now(timezone.utc),
        "level": level,
        "message": message,
        "account_data": account_data
    }
    automation_state["logs"].append(log_entry)
    
    # Keep only last 100 logs
    if len(automation_state["logs"]) > 100:
        automation_state["logs"] = automation_state["logs"][-100:]
    
    print(f"[{level}] {message}")

def generate_random_username():
    """Generate random username"""
    prefixes = ["user", "test", "player", "gamer", "cool", "pro", "epic", "legend", "ninja", "beast"]
    numbers = ''.join(random.choices(string.digits, k=random.randint(2, 4)))
    return f"{random.choice(prefixes)}{numbers}"

def generate_random_password():
    """Generate random password (8+ characters)"""
    chars = string.ascii_letters + string.digits + "!@#$%"
    password = ''.join(random.choices(chars, k=random.randint(8, 12)))
    # Ensure it has at least one letter and one number
    if not any(c.isalpha() for c in password):
        password = password[:-1] + random.choice(string.ascii_letters)
    if not any(c.isdigit() for c in password):
        password = password[:-1] + random.choice(string.digits)
    return password

async def submit_signup_form(username: str, email: str, password: str, referral_code: str):
    """Submit signup form to steep.gg using the correct API endpoint"""
    try:
        async with aiohttp.ClientSession() as session:
            # Prepare the form data as JSON (matching the JavaScript submission)
            form_data = {
                'username': username,
                'email': email,
                'password': password,
                'confirm-password': password,  # Required by the form
                'referral': referral_code
            }
            
            headers = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Content-Type': 'application/json',
                'Origin': 'https://steep.gg',
                'Referer': 'https://steep.gg/',
                'Accept': 'application/json, text/plain, */*',
                'Accept-Language': 'en-US,en;q=0.9',
                'Accept-Encoding': 'gzip, deflate, br',
                'Connection': 'keep-alive',
                'Sec-Fetch-Dest': 'empty',
                'Sec-Fetch-Mode': 'cors',
                'Sec-Fetch-Site': 'same-origin'
            }
            
            # Submit to the actual API endpoint used by the form
            async with session.post('https://steep.gg/api/join-waitlist', json=form_data, headers=headers) as resp:
                # Handle different response types
                try:
                    response_json = await resp.json()
                    
                    if resp.status == 200:
                        return True, response_json.get('message', 'Account created successfully')
                    elif resp.status == 400:
                        error_msg = response_json.get('error', 'Bad request')
                        return False, f"Signup failed: {error_msg}"
                    else:
                        error_msg = response_json.get('error', f'HTTP {resp.status}')
                        return False, f"Form submission failed: {error_msg}"
                        
                except Exception as json_error:
                    # If JSON parsing fails, try to get text response
                    try:
                        response_text = await resp.text()
                        if resp.status == 200:
                            return True, "Account created successfully"
                        else:
                            return False, f"Form submission failed with status {resp.status}: {response_text[:200]}"
                    except Exception as text_error:
                        return False, f"Error processing response (Status {resp.status}): {str(text_error)}"
                    
    except Exception as e:
        return False, f"Error submitting form: {str(e)}"

async def wait_for_verification_email(gmail_session: GuerrillaMailSession, timeout_minutes: int = 5):
    """Wait for verification email and extract verification link"""
    timeout_seconds = timeout_minutes * 60
    start_time = time.time()
    
    while time.time() - start_time < timeout_seconds:
        emails = await gmail_session.check_email()
        
        for email in emails:
            # Look for verification email from steep.gg
            if 'steep.gg' in email.get('mail_from', '').lower() or 'verif' in email.get('mail_subject', '').lower():
                # Fetch full email content
                email_content = await gmail_session.fetch_email(email['mail_id'])
                
                if email_content:
                    body = email_content.get('mail_body', '')
                    
                    # Extract verification link
                    verify_pattern = r'https://steep\.gg/verify-email\?token=([a-zA-Z0-9]+)'
                    match = re.search(verify_pattern, body)
                    
                    if match:
                        verification_url = match.group(0)
                        return verification_url
        
        await asyncio.sleep(10)  # Check every 10 seconds
    
    return None

async def verify_email(verification_url: str):
    """Click verification link"""
    try:
        async with aiohttp.ClientSession() as session:
            headers = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
            
            async with session.get(verification_url, headers=headers) as resp:
                if resp.status == 200:
                    return True, "Email verified successfully"
                else:
                    return False, f"Verification failed with status {resp.status}"
                    
    except Exception as e:
        return False, f"Error verifying email: {str(e)}"

async def create_single_account(config: AutomationConfig):
    """Create a single account with full verification flow"""
    try:
        # Generate account data
        username = generate_random_username()
        password = generate_random_password()
        
        # Get temporary email
        gmail_session = GuerrillaMailSession()
        email = await gmail_session.get_email_address()
        
        if not email:
            raise Exception("Failed to get temporary email")
        
        account_data = {
            "username": username,
            "email": email,
            "password": password,
            "referral_code": config.referral_code
        }
        
        log_message(f"Creating account for {username} ({email})", "INFO", account_data)
        
        # Submit signup form
        success, message = await submit_signup_form(
            username, email, password, config.referral_code
        )
        
        if not success:
            automation_state["stats"]["failed_attempts"] += 1
            log_message(f"Signup failed for {username}: {message}", "ERROR", account_data)
            return False
        
        automation_state["stats"]["successful_signups"] += 1
        log_message(f"Signup successful for {username}, waiting for verification email...", "INFO", account_data)
        
        # Wait for verification email
        verification_url = await wait_for_verification_email(gmail_session)
        
        if not verification_url:
            log_message(f"No verification email received for {username}", "WARNING", account_data)
            return False
        
        log_message(f"Verification email received for {username}: {verification_url}", "INFO", account_data)
        
        # Verify email
        verify_success, verify_message = await verify_email(verification_url)
        
        if verify_success:
            automation_state["stats"]["verified_accounts"] += 1
            log_message(f"Email verified successfully for {username}", "SUCCESS", account_data)
            return True
        else:
            log_message(f"Email verification failed for {username}: {verify_message}", "ERROR", account_data)
            return False
            
    except Exception as e:
        automation_state["stats"]["failed_attempts"] += 1
        log_message(f"Account creation failed: {str(e)}", "ERROR")
        return False

async def automation_worker(config: AutomationConfig):
    """Main automation worker function - runs continuously"""
    try:
        automation_state["is_running"] = True
        automation_state["accounts_created"] = 0
        automation_state["current_batch"] = 0
        
        if config.continuous_mode:
            automation_state["total_accounts"] = 999999  # Infinite for continuous mode
            log_message(f"Starting continuous automation: {config.batch_size} accounts per batch, {config.cooldown_minutes}min cooldown", "INFO")
        else:
            automation_state["total_accounts"] = config.batch_size
            log_message(f"Starting single batch automation: {config.batch_size} accounts", "INFO")
        
        batch_number = 0
        
        while automation_state["is_running"]:
            batch_number += 1
            automation_state["current_batch"] = batch_number
            automation_state["last_batch_time"] = datetime.now(timezone.utc)
            
            log_message(f"Starting batch {batch_number} - Creating {config.batch_size} accounts", "INFO")
            
            batch_success_count = 0
            
            # Create accounts in current batch
            for i in range(config.batch_size):
                if not automation_state["is_running"]:
                    log_message("Automation stopped by user", "INFO")
                    break
                    
                success = await create_single_account(config)
                if success:
                    automation_state["accounts_created"] += 1
                    batch_success_count += 1
                
                # Small delay between accounts within a batch
                await asyncio.sleep(random.uniform(2, 5))
            
            log_message(f"Batch {batch_number} completed: {batch_success_count}/{config.batch_size} accounts successful", "INFO")
            
            # If not in continuous mode, stop after one batch
            if not config.continuous_mode:
                break
            
            # In continuous mode, wait cooldown period before next batch
            if automation_state["is_running"]:
                log_message(f"Cooldown period: Waiting {config.cooldown_minutes} minutes before next batch...", "INFO")
                
                # Wait cooldown period (check every minute if we should stop)
                for minute in range(config.cooldown_minutes):
                    if not automation_state["is_running"]:
                        log_message("Automation stopped during cooldown period", "INFO")
                        break
                    
                    remaining_minutes = config.cooldown_minutes - minute
                    if minute % 5 == 0 or remaining_minutes <= 5:  # Log every 5 minutes or when <5 mins left
                        log_message(f"Cooldown: {remaining_minutes} minutes remaining...", "INFO")
                    
                    await asyncio.sleep(60)  # Wait 1 minute
        
        if config.continuous_mode and automation_state["is_running"]:
            log_message("Continuous automation completed all cycles!", "SUCCESS")
        else:
            log_message("Automation completed!", "SUCCESS")
        
    except Exception as e:
        log_message(f"Automation error: {str(e)}", "ERROR")
    finally:
        automation_state["is_running"] = False

# API Routes
@api_router.post("/automation/start")
async def start_automation(config: AutomationConfig, background_tasks: BackgroundTasks):
    if automation_state["is_running"]:
        raise HTTPException(status_code=400, detail="Automation is already running")
    
    # Reset stats
    automation_state["stats"] = {
        "successful_signups": 0,
        "verified_accounts": 0,
        "failed_attempts": 0
    }
    automation_state["logs"] = []
    
    background_tasks.add_task(automation_worker, config)
    
    return {"message": "Automation started", "config": config.dict()}

@api_router.post("/automation/stop")
async def stop_automation():
    if not automation_state["is_running"]:
        raise HTTPException(status_code=400, detail="Automation is not running")
    
    automation_state["is_running"] = False
    log_message("Automation stopped by user", "INFO")
    
    return {"message": "Automation stopped"}

@api_router.get("/automation/status")
async def get_automation_status():
    return AutomationStatus(
        is_running=automation_state["is_running"],
        accounts_created=automation_state["accounts_created"],
        total_accounts=automation_state["total_accounts"],
        current_batch=automation_state["current_batch"],
        last_batch_time=automation_state["last_batch_time"],
        stats=automation_state["stats"]
    )

@api_router.get("/automation/logs")
async def get_automation_logs(limit: int = 50):
    logs = automation_state["logs"][-limit:]
    return {"logs": logs}

@api_router.delete("/automation/logs")
async def clear_logs():
    automation_state["logs"] = []
    return {"message": "Logs cleared"}

@api_router.get("/download-source")
async def download_source_code():
    """Create and download a zip file of the complete source code"""
    try:
        # Create a temporary zip file
        temp_dir = tempfile.mkdtemp()
        zip_path = os.path.join(temp_dir, "steep-automation-tool.zip")
        
        with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
            # Define the project root (parent of backend directory)
            project_root = Path(__file__).parent.parent
            
            # Files and directories to include
            include_patterns = [
                "backend/**/*.py",
                "backend/requirements.txt",
                "backend/.env.example",
                "frontend/src/**/*",
                "frontend/public/**/*",
                "frontend/package.json",
                "frontend/tailwind.config.js",
                "frontend/postcss.config.js",
                "frontend/.env.example",
                "README.md",
                "railway.json",
                "Procfile",
                ".gitignore"
            ]
            
            # Add files to zip
            for pattern in include_patterns:
                for file_path in project_root.glob(pattern):
                    if file_path.is_file():
                        # Calculate relative path from project root
                        relative_path = file_path.relative_to(project_root)
                        zipf.write(file_path, relative_path)
            
            # Add example environment files
            backend_env_example = """MONGO_URL=mongodb+srv://username:password@cluster.mongodb.net/
DB_NAME=automation_db
CORS_ORIGINS=https://your-frontend-url.vercel.app"""
            
            frontend_env_example = """REACT_APP_BACKEND_URL=https://your-railway-app.railway.app"""
            
            zipf.writestr("backend/.env.example", backend_env_example)
            zipf.writestr("frontend/.env.example", frontend_env_example)
            
            # Add deployment instructions
            deployment_guide = """# Deployment Guide

## Railway Deployment Steps

### 1. Backend Deployment on Railway
1. Fork this repository to your GitHub
2. Sign up at https://railway.app
3. Click "New Project" → "Deploy from GitHub" 
4. Select your forked repository
5. Set environment variables:
   - MONGO_URL: Your MongoDB Atlas connection string
   - DB_NAME: Your database name
   - CORS_ORIGINS: Your frontend URL

### 2. Frontend Deployment on Vercel
1. Sign up at https://vercel.com
2. Import your GitHub repository
3. Set build settings:
   - Framework: Create React App
   - Build Command: `cd frontend && yarn build`
   - Output Directory: `frontend/build`
4. Set environment variable:
   - REACT_APP_BACKEND_URL: Your Railway backend URL

### 3. Database Setup (MongoDB Atlas)
1. Sign up at https://cloud.mongodb.com
2. Create a free cluster
3. Create database user
4. Whitelist IP addresses (or use 0.0.0.0/0 for simplicity)
5. Copy connection string to MONGO_URL

### 4. Test Deployment
1. Visit your Vercel frontend URL
2. Test automation functionality
3. Monitor Railway logs for any issues

## Cost Breakdown
- Railway: ~$0-5/month (free tier with credits)
- Vercel: Free for personal projects
- MongoDB Atlas: Free tier (512MB storage)

Total: ~$0-5/month for 24/7 operation!
"""
            
            zipf.writestr("DEPLOYMENT_GUIDE.md", deployment_guide)
        
        return FileResponse(
            zip_path,
            media_type="application/zip",
            filename="steep-automation-tool.zip"
        )
        
    except Exception as e:
        log_message(f"Error creating source code download: {str(e)}", "ERROR")
        raise HTTPException(status_code=500, detail="Failed to create download")

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()