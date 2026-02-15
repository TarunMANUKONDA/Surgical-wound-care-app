from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from config import config
from database import init_db
import os

# Import routers
from routes import upload, classify, recommend, history, comparison, auth

# Initialize FastAPI app
app = FastAPI(
    title="Surgical Wound Care API",
    description="AI-powered wound assessment and care recommendations",
    version="2.0.0"
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=".*", # Allow ALL origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Create uploads directory if it doesn't exist
os.makedirs(config.UPLOAD_DIR, exist_ok=True)

# Mount static files for serving uploaded images
app.mount("/uploads", StaticFiles(directory=config.UPLOAD_DIR), name="uploads")

# Register routers
app.include_router(upload.router, prefix="/api", tags=["Upload"])
app.include_router(classify.router, prefix="/api", tags=["Classification"])
app.include_router(recommend.router, prefix="/api", tags=["Recommendations"])
app.include_router(history.router, prefix="/api", tags=["History"])
app.include_router(comparison.router, prefix="/api", tags=["Comparison"])
app.include_router(auth.router, prefix="/api", tags=["Authentication"])

@app.on_event("startup")
async def startup_event():
    """Initialize database on startup"""
    init_db()
    print(f"🚀 Server started on http://{config.HOST}:{config.PORT}")
    print(f"📚 API Documentation: http://{config.HOST}:{config.PORT}/docs")

@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "message": "Surgical Wound Care API",
        "version": "2.0.0",
        "status": "running",
        "docs": "/docs"
    }

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "database": "connected",
        "gemini_api": "configured" if config.GEMINI_API_KEY else "not configured"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host=config.HOST,
        port=config.PORT,
        reload=True
    )
