from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from server.app.infrastructure.database import apply_migrations


def main() -> None:
    applied = apply_migrations()
    if applied:
        print("Applied migrations:")
        for version in applied:
            print(f"- {version}")
        return
    print("No pending migrations.")


if __name__ == "__main__":
    main()
