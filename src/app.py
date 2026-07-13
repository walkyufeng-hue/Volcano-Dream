import logging
from pathlib import Path

from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from src.limiter import get_real_ipaddr
from src.chatgpt_router import router as chatgpt_router
from src.user_router import router as user_router
from src.feedback_router import router as feedback_router
from src.image_router import router as image_router
from src.config import settings


_logger = logging.getLogger(__name__)

app = FastAPI(title="Volcano Dream AI API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.get_allowed_origins(),
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)

app.include_router(chatgpt_router)
app.include_router(user_router)
app.include_router(feedback_router)
app.include_router(image_router)


@app.get("/health")
async def health():
    return "ok"


@app.exception_handler(Exception)
async def exception_handler(request: Request, exc: Exception):
    """全局异常处理器"""
    # 记录详细错误日志用于调试
    _logger.error(
        "Unhandled exception: %s",
        exc,
        exc_info=True,
        extra={
            "request_path": request.url.path,
            "request_method": request.method,
            "client_ip": get_real_ipaddr(request),
        }
    )

    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"error": "服务器暂时无法处理请求，请稍后重试"},
    )


DIST_DIR = Path("dist").resolve()
if DIST_DIR.exists():
    assets_dir = DIST_DIR / "assets"
    if assets_dir.exists():
        app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")

    @app.get("/{path:path}", include_in_schema=False)
    async def serve_spa(request: Request, path: str):
        """Serve real build files and fall back to React for client routes."""
        candidate = (DIST_DIR / path).resolve()
        if candidate.is_relative_to(DIST_DIR) and candidate.is_file():
            return FileResponse(candidate)

        _logger.info("Page request from %s", get_real_ipaddr(request))
        return FileResponse(
            DIST_DIR / "index.html",
            headers={"Cache-Control": "no-cache"},
        )
