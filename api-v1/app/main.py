from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.routes.health import router as health_router
from app.api.routes.logs import router as logs_router
from app.api.routes.multi_agent import router as multi_agent_router
from app.api.routes.profiles import router as profiles_router
from app.api.routes.runs import router as runs_router
from app.api.routes.trading import router as trading_router
from app.core.config import get_settings
from app.db import init_db

settings = get_settings()


@asynccontextmanager
async def lifespan(_app: FastAPI):
    init_db()
    yield


app = FastAPI(title=settings.app_name, lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(health_router)
app.include_router(trading_router)
app.include_router(multi_agent_router)
app.include_router(profiles_router)
app.include_router(runs_router)
app.include_router(logs_router)
