# Jubi functional audit and repair

Audit date: 2026-09-05. Repository: `kautukade/JUBI`. Base commit: `d7b4892c8dbc837cbc2b972d49583b7b3aa3208c`. Repair branch: `fix/jubi-functional-audit`.

## Outcome

Concrete runtime, dashboard, persistence, privacy, workflow and installer defects were fixed. The revised code passes the available automated checks. It is **not certified as every native feature working on a Windows laptop**: this environment has no Windows runtime, Ollama installation/models, cloud credentials or authorized target LAN. The private SARA runtime source is incomplete in the public repository. The initial handoff used read-only GitHub access and a downloadable patch bundle. The GitHub connection now has write access; publication and CI status are recorded on the repair branch and its pull request.

The audit covered Jubi-owned Python modules, all 18 dashboard pages and their scripts, HTTP routes, configuration, Windows launcher/installer/updater paths, source adapters and CI. The 10 bundled upstream source families were checked as integration inputs; their thousands of individual tools/apps were not independently executed or certified. A source catalog entry does not establish that its upstream runtime is installed or that its tools executed.

## Verification evidence

| Check | Result | What it establishes |
|---|---|---|
| Python suite: 20 test files | 184 tests run; 181 passed; 3 skipped | Existing contracts plus 36 added functional/HTTP regressions |
| Live local HTTP suite | 10 tests passed | Real Jubi handler, JSON requests, temporary SQLite and actual workspace files |
| Dashboard delivery | All 18 HTML pages and all dashboard scripts served | Routes, assets and response headers |
| Read-only feature APIs | 35 endpoints returned HTTP 200 | Initialization contracts with controlled dependencies |
| DOM integration | All 18 pages initialized; 7 interaction flows passed | Shipped JavaScript against real HTTP, using jsdom |
| Python / JavaScript | Compilation and syntax checks passed | Syntax for owned runtime, tests and scripts |
| GitHub workflows | All four YAML files parsed | YAML structure; remote jobs have not run for this local branch |
| Patch review | `git diff --check` passed | No whitespace errors |
| Actual-environment full acceptance | Exit 2, not ready | Ollama service and all four configured model checks failed because they are absent |
| Windows launcher / installer | Source changed; Windows compilation and clean installation pending | No executable build or target certification is claimed from Linux |

The three skips concern Windows process inventory, DPAPI credential storage and the physical Ring0 bridge. The added inference tests use an explicitly controlled local Ollama-compatible HTTP service. They verify request/response plumbing, context, persistence and errors, not AI answer quality. Cloud-provider tests use controlled responses. Browser access to the local server was blocked by the available browser environment; jsdom is a DOM simulation, not a substitute for visual, CSP-enforcement, speech or real-browser verification.

## Defects repaired

| Area | Previous failure | Revised behavior |
|---|---|---|
| Chat | Reload lost conversation; follow-up omitted prior context | SQLite conversations, saved-history selector, bounded context, separate conversation IDs |
| Chat input | Enter could submit another message while generation was running | A send guard prevents concurrent duplicate submissions; new/history controls pause during send |
| Session recovery | Server restart left an open dashboard with a permanently stale token | Refresh token and retry once only after the server explicitly rejects before execution |
| Local Only | Explicit cloud selection could bypass the selected mode | Cloud generation is denied until a cloud-enabled mode is selected |
| Privacy | Sensitive system/context material could escape prompt-only checks | System text and complete chat context participate in privacy classification |
| Provider errors | A provider could echo a credential in its error body | Configured token is redacted from returned provider error details |
| HTTP boundary | Binding and Host checks did not cover every non-loopback address / read endpoint | Loopback-only binding; same-origin Host/Origin checks for GET, HEAD and POST |
| HTTP errors | Malformed JSON types could reach handlers; unknown APIs could fall into file serving | Typed request validation, finite JSON-number checks, JSON errors and API 404s |
| Static responses | Security headers were primarily attached to JSON | HTML, scripts and errors receive the same response protections |
| Task history | Saved tasks could not be inspected from the dashboard | Task-detail endpoint and clickable persisted task rows |
| Execution outcomes | Completely failed runs could appear merely partial | Failed/partial/completed reflect actual step results |
| Approvals | Approval state could be changed before validating resumable task state | Validate matching pending task/step before committing resolution |
| Automation | Any runner return was logged as success | Persist actual status/error/task ID; pause recurrence while approval is pending |
| Scheduler | Overlapping ticks could repeat work | Serialize ticks within the scheduler instance |
| Receipts | Concurrent stores or equal/backward timestamps could corrupt chain order | Transactional append and insertion-order verification across the complete chain |
| File operations | Move/copy with identical source and destination could damage the source | Reject identical paths before overwrite processing |
| Broker errors | Some OS failures escaped without a failure receipt | Return an explicit failed result and signed receipt |
| Broker freshness | Non-finite timestamps could pass age comparisons | Reject non-finite timestamps |
| Semantic knowledge | Different embedding models or invalid vectors could be compared | Check finite/nonzero vectors, model identity and dimensions; atomic stable-model ingestion |
| LAN health | A registered but unreachable service could still yield green aggregate health | Return unsuccessful health and show failure in the UI |
| Public-page reader | Empty-string MIME matching allowed arbitrary binary content | Accept supported text MIME types and reject unsupported content |
| Research networking | A fresh DNS answer could redirect a connection into private infrastructure | Validate resolved public numeric addresses at connection time; disable inherited proxies |
| Search failures | Search-provider challenge could look like an empty successful search | Show an explicit challenge error and offer an existing direct-URL reading flow |
| Research UI | Source URLs were plain text; page-reader API had no direct control | Clickable sources and a working public-URL reader |
| Source adapters | Direct model calls bypassed Provider Manager; prose could look like action execution | Unified provider policy and explicit `tools_executed: false` for reasoning-only results |
| SARA | Missing native computer/developer execution could fall back to apparently successful prose | Block unsupported actions with an actionable runtime error; research steps call the real research service |
| Supervisor | Invalid, unordered or circular dependencies could be executed inconsistently | Validate step IDs/tasks/dependencies, order them, and skip dependents of failed steps |
| Dashboard status | Duplicate advanced navigation and mismatched Doctor result structure | One link per feature; actual Doctor checks rendered |
| Operator approvals | UI could request a privileged operation but offered no completion flow | Display/save the exact request; paste trusted request-bound proof to execute |
| Vision input | An invalid replacement image could leave the previous image selected | Clear stale image data/preview and reject unsupported files |
| Build identity | PowerShell's UTF-8 BOM could make installed update identity unreadable | Read BOM-compatible JSON |
| Updates | Server could be stopped before a failing download | Download and verify first; recheck hash immediately before invoking the installer |
| Launcher health | Any process listening on the port could be mistaken for Jubi | Verify `/api/health` product/status before treating the app as running |
| Windows start script | Narrow Python detection missed available runtimes | Use installed private environment, `.venv`, `py -3` or Python 3.11+ |
| Native launcher | Tracked Base64 launcher is truncated and cannot decode | Build a small reviewed C# launcher from tracked source |
| Incomplete SARA bundle | Installer tried to reconstruct incomplete data or fetch an inaccessible private repository | Core profile reports missing native runtime; explicit full-native requirement still fails |
| Certification | Core installer and full-native readiness requirements were conflated | Explicit core profile; default full acceptance and public-release certification retain native requirements |
| Regression coverage | Static wiring and mocked adapters missed these failures | Real HTTP/files/database flows, DOM interactions, stronger CI gates and source-launcher compilation job |

Receipt fixes prevent new ordering/race defects; they do not rewrite or re-sign old evidence. Existing damaged receipt history must be reviewed separately. Provider privacy remains the project's classifier-based policy, not a guarantee that every possible secret format will be recognized.

## Feature-by-feature status

| Dashboard feature | Verified here | Remaining live dependency or boundary |
|---|---|---|
| Overview | Page, API aggregation, navigation | Hardware/runtime status reflects the actual host |
| AI Chat | Persistent multi-turn HTTP and DOM flow | Installed Ollama model or configured eligible cloud provider |
| Tasks & Planner | Planning/execution contracts, real task history/detail | Each selected adapter's native/tools dependencies |
| Brain / Council / Supervisor | Routing, dependency ordering, controlled model-response contracts | Real local/cloud model execution and answer quality |
| Providers | Mode enforcement, privacy and credential/error contracts | Windows DPAPI and live keys/quota for each desired cloud provider |
| Models | Discovery and generation transport via controlled Ollama service | Pull and run the four configured models on the target machine |
| Agents & Capabilities | Catalog, adapters, API/UI | Many upstream entries provide prompts; not all are executable native apps |
| Development | Planner and honest missing-runtime failure | Native SARA for natural-language execution; typed Git/file actions remain available |
| Knowledge / Experience | SQLite persistence, embedding/RAG contracts, real HTTP ingest/search/delete | Live embedding model and real RAG generation |
| Fable Lab | Capability/agenda/trace integration contracts and UI | Optional WSL/QEMU lab and its required local toolchain |
| Automation | Persistence, create/pause UI, failed/pending status behavior | Live selected task dependencies; approval-pending recurrences pause |
| Computer Operator | Actual disk write/read/delete, signed approval and replay rejection | Windows-only inventory/services/app launch and optional driver on Windows |
| Web Research | Parsing/network-boundary/error contracts and reader UI | Public internet/search availability and live synthesis model |
| Authorized LAN | Device registry, bounded health contracts and UI | User-authorized target devices and reachable registered services |
| Vision & Voice | Input validation, stale-image prevention, controlled vision contracts | Live vision model; supported real-browser STT/TTS |
| Security & Receipts | Policy/approval/replay/receipt regression and real HTTP delete | Production Windows keys and target deployment validation |
| System Health | Actual checks correctly rendered; acceptance identifies absent models | Resolve reported target-machine prerequisites |
| Activity | Event persistence and API/UI initialization | Events accumulate from actual usage |

## Exact external blockers

1. **GitHub publication:** the initial connection was read-only (`push: false`). This was resolved when the repository owner connected an account with write access. Review the repair branch and its pull request for current publication and CI status. The original green Actions runs belong to the base commit; they do not validate these changes.
2. **SARA native source:** `vendor/sara/finalparts` contains `part-000.b64` through `part-015.b64`; `part-016.b64` through `part-023.b64` are missing. The expected 24-part reconstruction cannot succeed. The referenced `kautukade/SARA-AI-OS` repository was inaccessible (404) through the available GitHub connection. Supply all verified parts or the complete authorized runtime source, then configure its local API/token. Missing source was not invented.
3. **Real AI execution:** Ollama and the configured general, coding, vision and embedding models are absent here. No cloud provider credentials were supplied. The real-environment acceptance report explicitly failed those model/service checks.
4. **Windows validation:** C# compiler, PowerShell, Windows APIs, DPAPI, scheduled tasks, UAC, clean install/update/uninstall and native driver testing are unavailable in this Linux workspace. CI now includes launcher compilation, but remote CI cannot run until these changes reach a writable GitHub branch.
5. **Target integrations:** LAN devices, browser speech, optional QEMU/WSL and upstream native apps need their actual authorized runtime environment. Readiness checks must stay visible until those dependencies are tested.

Use [VALIDATION-RUNBOOK.md](VALIDATION-RUNBOOK.md) for setup and acceptance. The downloadable patch applies only to the audited source revision; a newer branch needs a normal review/merge and verification.
