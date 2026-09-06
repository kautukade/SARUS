# Run and validate the repaired Jubi

## Apply the delivered changes

The fix bundle includes a Git patch, updated-file copies and this audit. It is not a prebuilt Windows installer. Start with a clean checkout at the audited revision:

```powershell
git clone https://github.com/kautukade/JUBI.git
cd JUBI
git switch -c fix/jubi-functional-audit d7b4892c8dbc837cbc2b972d49583b7b3aa3208c
git apply --check C:\path\to\JUBI-Fixes.patch
git apply C:\path\to\JUBI-Fixes.patch
```

For an existing checkout, preserve local changes and review `git status` first. `git apply --check` verifies compatibility without changing files. Do not overwrite a newer checkout with the updated-file copies; use the patch and resolve conflicts normally.

## Start the core application

Use Python 3.11 or newer. The core Jubi server uses the Python standard library; Node is needed only for DOM development tests and selected optional upstream tools.

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m jubi.server
```

Alternatively run `START_JUBI.bat`. Open `http://127.0.0.1:8877` on the same computer. Source startup does not install Ollama, upstream native applications or Windows broker secrets for you.

With Ollama installed and serving locally, provision the models already specified in `config/production.json`:

```powershell
ollama pull qwen2.5:7b
ollama pull qwen2.5-coder:7b
ollama pull qwen2.5vl:3b
ollama pull nomic-embed-text-v2-moe:latest
ollama list
```

Default endpoint: `http://127.0.0.1:11434`. For another local port, set `JUBI_OLLAMA_URL` before starting Jubi. Configure optional cloud credentials in Providers on Windows and explicitly select Hybrid Auto or Cloud Boost to permit cloud generation. Local Only rejects cloud generation, including explicit provider overrides.

## Windows launcher and installation

`installer/BUILD-LAUNCHER.ps1` compiles `JubiLauncher.cs` with the Windows .NET Framework compiler. It replaces the damaged encoded launcher; no replacement binary was fabricated in this audit. `scripts/VERIFY-SARUS-REPO.ps1` compiles it to a temporary executable and checks the core payload.

```powershell
powershell -NoProfile -File scripts\VERIFY-SARUS-REPO.ps1
```

The repaired installer completes a core profile when SARA native source is absent and records that native feature as unavailable. Full native verification remains explicit:

```powershell
powershell -NoProfile -File scripts\VERIFY-SARUS-REPO.ps1 -RequireSaraRuntime
python -m jubi.acceptance --full
```

The first command fails until the 24-part native bundle is restored. Full acceptance remains subject to `config/production.json` native requirements. To evaluate core installation separately, run `python -m jubi.acceptance --full --core-only`; its report says `profile: core` and does not certify SARA native actions. Existing downloaded release EXEs do not include these local fixes until a new build is published.

## Complete an approval-protected file action

On Windows, run the existing `installer/SETUP-BROKER.ps1` during trusted local setup. In Computer Operator, request the action and save the exact displayed request as `jubi-approval-request.json`. Review its path/action, then use the local helper with the Windows profile that owns the broker secret:

```powershell
python scripts\create_broker_approval.py --request-file C:\path\to\jubi-approval-request.json
```

Paste the returned proof into the matching dashboard approval panel and execute. Proof generation is not exposed over HTTP. The proof binds the exact request ID, action and parameters; a changed request or replay must be denied. For testing, use files inside Jubi's configured `workspace` directory. Test secrets from the regression fixture are not production credentials.

## Automated development checks

Run these in a development checkout:

```powershell
python -m compileall -q jubi sarus tests scripts
python tests/jubi_functional_regression_test.py
python tests/jubi_http_functional_test.py
npm ci --ignore-scripts --no-audit --no-fund
npm test
```

For all existing Python regression files in PowerShell:

```powershell
Get-ChildItem tests\*_test.py | ForEach-Object {
    python $_.FullName
    if ($LASTEXITCODE -ne 0) { throw "Failed: $($_.Name)" }
}
```

The old foundation tests may write test records to the development checkout's local database. The new HTTP/DOM fixture uses a temporary directory and an explicit controlled model service. Use a development clone for the full suite.

## Target-machine acceptance

| Flow | Evidence to retain |
|---|---|
| Clean installer launch | Installation log, launcher opened, expected `/api/health` response |
| Chat | Live model answer, second-turn context, page reload and process restart preserve conversation |
| Models | Real generation for general/coding; a real image for vision; semantic ingest/search for embeddings |
| Providers | Each desired provider validates and answers; Local Only denies explicit cloud selection |
| Tasks / development | Inspect step results; native runtime absent must be visibly blocked; verify real files for executed work |
| File permissions | Write/read a test file; request delete, approve exact request, verify deletion and replay rejection |
| Knowledge | Ingest a document, search it, ask a grounded question, reopen app, delete the document |
| Automation | Observe real completion/failure; pause; confirm approval-required run does not recur |
| LAN | Register only authorized devices/services; verify reachable and deliberately unavailable service states |
| Browser UI | Desktop/mobile layout, reload, image replacement, supported speech controls, console/network errors |
| Native services | Complete SARA source/token, desired optional native runtimes, Windows-only broker functions |
| Lifecycle | Login background startup, repair, update between two built revisions, uninstall |
| Release | Full certification plus configured application/driver signing requirements |

Run `python -m jubi.acceptance --full` after target setup. Treat a nonzero exit or failed required check as incomplete readiness. Keep the JSON report together with installer logs when assessing deployment.
