from __future__ import annotations

import argparse
import hashlib
import hmac
import json
import os
import time
from pathlib import Path


def canonical_hash(parameters: dict) -> str:
    raw = json.dumps(parameters, ensure_ascii=False, sort_keys=True, separators=(',', ':')).encode('utf-8')
    return hashlib.sha256(raw).hexdigest()


def load_secret() -> str:
    secret = os.environ.get('SARUS_BROKER_APPROVAL_SECRET', '')
    if len(secret) >= 24:
        return secret
    override = os.environ.get('SARUS_BROKER_SECRET_FILE', '').strip()
    if override:
        path = Path(override).expanduser()
    else:
        local = os.environ.get('LOCALAPPDATA', '').strip()
        path = Path(local) / 'SARUS' / 'broker' / 'approval.secret' if local else None
    if path and path.is_file():
        try:
            secret = path.read_text(encoding='utf-8').strip()
        except OSError:
            secret = ''
    if len(secret) < 24:
        raise SystemExit('SARUS broker approval key is not configured. Run INSTALL-SARUS.bat first.')
    return secret


def main() -> int:
    ap = argparse.ArgumentParser(description='Create a short-lived SARUS privileged broker approval proof.')
    ap.add_argument('--request-id')
    ap.add_argument('--action-id')
    ap.add_argument('--request-file', type=Path, help='Saved request JSON from Computer Operator')
    ap.add_argument('--parameters-json', default='{}', help='Exact JSON parameters from the broker request')
    ap.add_argument('--ttl', type=int, default=120, help='Approval lifetime in seconds (1-300)')
    args = ap.parse_args()

    if args.request_file:
        if args.request_id or args.action_id or args.parameters_json != '{}':
            ap.error('Use either --request-file or explicit request fields')
        try:
            request = json.loads(args.request_file.read_text(encoding='utf-8-sig'))
            args.request_id = request['request_id']
            args.action_id = request['action_id']
            args.parameters_json = json.dumps(request['parameters'], ensure_ascii=False)
        except (OSError, ValueError, KeyError, TypeError) as exc:
            ap.error(f'Invalid request file: {exc}')
    if not args.request_id or not args.action_id:
        ap.error('--request-id and --action-id, or --request-file, are required')

    secret = load_secret()

    try:
        parameters = json.loads(args.parameters_json)
    except json.JSONDecodeError as exc:
        raise SystemExit(f'Invalid --parameters-json: {exc}') from exc
    if not isinstance(parameters, dict):
        raise SystemExit('--parameters-json must decode to a JSON object.')

    ttl = max(1, min(args.ttl, 300))
    expires = int(time.time()) + ttl
    phash = canonical_hash(parameters)
    message = f'v1|{args.request_id}|{args.action_id}|{phash}|{expires}'.encode('utf-8')
    mac = hmac.new(secret.encode('utf-8'), message, hashlib.sha256).hexdigest()
    print(f'v1:{expires}:{mac}')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
