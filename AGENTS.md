# Repository Guidelines

## Project Structure
- `src/`: FastAPI backend (routers, config, divination logic).
- `frontend/`: React + Vite UI (pages, hooks, components, Tailwind).
- Root: `main.py`, `Dockerfile`, `docker-compose.yaml`.

## Build, Test, and Development Commands
- Backend: `python3 -m venv ./venv` → `./venv/bin/python3 -m pip install -r requirements.txt` → `./venv/bin/python3 main.py`.
- Frontend: `cd frontend && pnpm install` → `pnpm dev` | `pnpm build` | `pnpm lint`.
- Docker: `docker-compose up -d`.

## Coding Style & Naming
- Python: PEP 8, 4 spaces, snake_case.
- TypeScript/React: 2 spaces, PascalCase components, camelCase vars.
- Tailwind is the primary styling approach.

## Testing Guidelines
No dedicated test framework. If adding tests, place them near code (e.g., `frontend/src/**/__tests__` or `tests/`) and document how to run.

## Commit & Pull Request Guidelines
- Commit style: `feat:`, `fix:`, `refactor:`, `style:`; issue refs like `(#95)` appear.
- PRs: summary + affected areas; add screenshots/GIFs for UI changes.

## Security & Configuration Tips
- Configure `.env` with an OpenRouter `api_key` and optional `api_base`.
- Avoid exposing secrets; backend excludes sensitive settings in logs.
- Never expose the server API key in frontend code or logs.
