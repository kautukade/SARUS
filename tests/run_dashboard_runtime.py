"""Run real dashboard JS against an isolated HTTP server (DOM, not a browser)."""
import os
from pathlib import Path
import subprocess
from runtime_fixture import RuntimeFixture


if __name__ == '__main__':
    with RuntimeFixture() as fixture:
        result = subprocess.run(
            ['node', str(Path(__file__).with_name('dashboard_runtime_test.cjs'))],
            env={**os.environ, 'JUBI_TEST_URL': fixture.base},
            timeout=120,
        )
    raise SystemExit(result.returncode)
