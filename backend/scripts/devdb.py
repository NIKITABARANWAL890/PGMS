"""Local development database, without Docker.

Docker Compose is the documented default (see docker-compose.yml). This script
is the fallback for machines with no Docker and no system PostgreSQL: it uses
the real PostgreSQL binaries shipped by the `pgserver` wheel and runs them on a
fixed port, so the connection URL is stable across restarts.

    python scripts/devdb.py start     # initdb (first run), start, create db
    python scripts/devdb.py stop
    python scripts/devdb.py status
    python scripts/devdb.py reset     # destroy the cluster and start clean

`start` writes .env.local with the resulting DATABASE_URL, which Settings reads
in preference to .env.
"""

from __future__ import annotations

import shutil
import subprocess
import sys
from pathlib import Path

import pgserver

BACKEND_DIR = Path(__file__).resolve().parent.parent
PGDATA = BACKEND_DIR / ".devdb"
LOGFILE = BACKEND_DIR / ".devdb.log"
ENV_LOCAL = BACKEND_DIR / ".env.local"

PORT = 55432
HOST = "127.0.0.1"
DB_NAME = "pgms"
DB_USER = "postgres"

BIN = Path(pgserver.__file__).parent / "pginstall" / "bin"
DATABASE_URL = f"postgresql+asyncpg://{DB_USER}@{HOST}:{PORT}/{DB_NAME}"


def _run(exe: str, *args: str, check: bool = True) -> subprocess.CompletedProcess:
    return subprocess.run(
        [str(BIN / exe), *args],
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        check=check,
    )


def is_running() -> bool:
    result = _run("pg_isready", "-h", HOST, "-p", str(PORT), check=False)
    return result.returncode == 0


def start() -> None:
    if is_running():
        print(f"Already running on port {PORT}")
    else:
        if not (PGDATA / "PG_VERSION").exists():
            print(f"Initialising a new cluster in {PGDATA} ...")
            PGDATA.mkdir(parents=True, exist_ok=True)
            # trust auth: this cluster listens on loopback only and exists
            # purely for local development.
            _run("initdb", "-D", str(PGDATA), "-U", DB_USER, "--auth=trust", "-E", "UTF8")

        print(f"Starting PostgreSQL on {HOST}:{PORT} ...")
        _run(
            "pg_ctl",
            "-D", str(PGDATA),
            "-l", str(LOGFILE),
            "-o", f"-p {PORT} -h {HOST}",
            "-w",
            "start",
        )

    # psycopg rather than the psql CLI: psql is interactive-first and blocks
    # when it has no console attached, which makes it a poor fit for a script.
    import psycopg

    admin_dsn = f"postgresql://{DB_USER}@{HOST}:{PORT}/postgres"
    with psycopg.connect(admin_dsn, autocommit=True) as conn:
        exists = conn.execute(
            "SELECT 1 FROM pg_database WHERE datname = %s", (DB_NAME,)
        ).fetchone()
        if exists is None:
            print(f"Creating database {DB_NAME} ...")
            conn.execute(f'CREATE DATABASE "{DB_NAME}"')

    ENV_LOCAL.write_text(
        "# Written by scripts/devdb.py — local dev only, safe to delete.\n"
        f"DATABASE_URL={DATABASE_URL}\n",
        encoding="utf-8",
    )
    print(f"Ready.  DATABASE_URL={DATABASE_URL}")
    print(f"Wrote {ENV_LOCAL.name}")


def stop() -> None:
    if not (PGDATA / "PG_VERSION").exists():
        print("No cluster to stop.")
        return
    _run("pg_ctl", "-D", str(PGDATA), "-m", "fast", "-w", "stop", check=False)
    print("Stopped.")


def status() -> None:
    print("running" if is_running() else "not running")


def reset() -> None:
    stop()
    if PGDATA.exists():
        shutil.rmtree(PGDATA, ignore_errors=True)
    print("Cluster destroyed.")
    start()


COMMANDS = {"start": start, "stop": stop, "status": status, "reset": reset}

if __name__ == "__main__":
    command = sys.argv[1] if len(sys.argv) > 1 else "start"
    if command not in COMMANDS:
        print(f"Usage: python scripts/devdb.py [{'|'.join(COMMANDS)}]")
        raise SystemExit(2)
    COMMANDS[command]()
