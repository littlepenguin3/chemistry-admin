# Final Verification

Date: 2026-06-17
Branch: `codex/student-h5-real-learning-experience`

## Commands

- `openspec validate student-h5-real-learning-experience --strict`: passed
- `python -m pytest server\tests -q`: 131 passed
- `npm run typecheck` in `apps/student-web`: passed
- `npm run typecheck` in `apps/admin-web`: passed
- `npm test` in `apps/admin-web`: 7 passed
- `npm run build` in `apps/student-web`: passed, main JS 246.66 KB
- `npm run build` in `apps/admin-web`: passed with existing large chunk warning for `antd-vendor` and `charts-vendor`
- `python scripts\validate_production_resources.py`: passed, 19 protected resources

## Local Dev Deployment

The existing Docker Compose stack was left running on `8000`. To test the current working-tree backend without replacing that stack, a local uvicorn instance was started on `8015` and both Vite dev servers were pointed at it with `VITE_API_BASE_URL=http://127.0.0.1:8015`.

- Backend: `http://127.0.0.1:8015`
- Student H5: `http://localhost:5173/`
- Admin web: `http://localhost:5174/admin/`
- Logs: `.tmp/dev-logs/`

Smoke checks completed:

- `GET http://127.0.0.1:8015/health`: 200 OK
- Student H5 page loads and shows the student login screen
- Admin web page loads and shows the admin login screen
- Served student module contains API target `8015`
- Served admin module contains API target `8015`
- Unauthenticated `GET /api/student/app-config`: 401
- Unauthenticated `GET /api/student/learning-page`: 401

Authenticated H5 learning/chat/feedback behavior is ready for manual verification with a real local student account.

## Student H5 Mobile Contract

The student frontend is explicitly a phone-first H5 / mini-program WebView surface. Future student-web changes should be checked against phone viewports before being treated as complete:

- 360x780 CSS pixels
- 390x844 CSS pixels
- 430x932 CSS pixels

Required mobile checks:

- no horizontal scrolling on primary learning screens;
- login, initial password change, temporary pretest skip, learning, point detail, chat, feedback, and logout are touch reachable;
- bottom navigation, floating feedback, chat controls, and sticky actions do not overlap;
- desktop preview may center/constrain the phone layout but must not introduce desktop-only UI behavior.
