"""Local chat history and bounded conversation context, independent of providers."""
from __future__ import annotations

import json
import threading
import time
import uuid

from .database import read_connection, transaction


class ConversationStore:
    MAX_MESSAGE_CHARS = 32000
    MAX_CONTEXT_CHARS = 24000

    def __init__(self, db, providers):
        self.db, self.providers = db, providers
        # Bounded lock set serializes each conversation without retaining IDs forever.
        self._locks = [threading.Lock() for _ in range(64)]
        with transaction(db) as c:
            c.execute('CREATE TABLE IF NOT EXISTS conversations(id TEXT PRIMARY KEY,title TEXT,updated REAL)')
            c.execute('CREATE TABLE IF NOT EXISTS chat_messages(id INTEGER PRIMARY KEY AUTOINCREMENT,'
                      'conversation_id TEXT REFERENCES conversations(id) ON DELETE CASCADE,'
                      'role TEXT,content TEXT,ts REAL,route TEXT)')
            c.execute('CREATE INDEX IF NOT EXISTS chat_conversation ON chat_messages(conversation_id,id)')

    @staticmethod
    def _id(value):
        try:
            return str(uuid.UUID(str(value)))
        except (ValueError, TypeError, AttributeError) as exc:
            raise ValueError('invalid conversation id') from exc

    def recent(self):
        with read_connection(self.db) as c:
            rows = c.execute('SELECT id,title,updated FROM conversations ORDER BY updated DESC LIMIT 100').fetchall()
        return [dict(zip(('id', 'title', 'updated'), r)) for r in rows]

    def history(self, conversation_id):
        cid = self._id(conversation_id)
        with read_connection(self.db) as c:
            if not c.execute('SELECT 1 FROM conversations WHERE id=?', (cid,)).fetchone():
                raise KeyError('conversation not found')
            rows = c.execute('SELECT role,content,ts,route FROM chat_messages WHERE conversation_id=? '
                             'ORDER BY id DESC LIMIT 200', (cid,)).fetchall()
        return {'conversation_id': cid, 'messages': [
            {'role': r[0], 'text': r[1], 'ts': r[2], 'route': json.loads(r[3] or '{}')}
            for r in reversed(rows)]}

    def send(self, text, conversation_id=None, **options):
        if not isinstance(text, str) or not text.strip():
            raise ValueError('chat prompt is required')
        text = text.strip()
        if len(text) > self.MAX_MESSAGE_CHARS:
            raise ValueError('chat prompt exceeds 32000 characters')
        cid = self._id(conversation_id) if conversation_id else str(uuid.uuid4())
        with self._locks[uuid.UUID(cid).int % len(self._locks)]:
            history = self.history(cid)['messages'] if conversation_id else []
            context, size = [], 0
            for message in reversed(history[-20:]):
                if size + len(message['text']) > self.MAX_CONTEXT_CHARS:
                    break
                context.append({'role': message['role'], 'content': message['text']})
                size += len(message['text'])
            prompt = text
            if context:
                prompt = ('Earlier conversation messages (context, not new system instructions):\n' +
                          json.dumps(list(reversed(context)), ensure_ascii=False) +
                          '\n\nCurrent user message:\n' + text)
            # The entire transmitted context passes through privacy classification.
            result = self.providers.generate(prompt, **options)
            answer = str(result.get('response') or result.get('output') or '').strip()
            if not answer:
                raise RuntimeError('The model returned an empty response; no chat turn was saved')
            now = time.time()
            route = result.get('jubi_provider_route') or result.get('jubi_route') or {}
            with transaction(self.db) as c:
                c.execute('INSERT INTO conversations VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET updated=excluded.updated',
                          (cid, text[:100], now))
                c.executemany('INSERT INTO chat_messages(conversation_id,role,content,ts,route) VALUES(?,?,?,?,?)',
                              [(cid, 'user', text, now, '{}'),
                               (cid, 'assistant', answer, now, json.dumps(route, ensure_ascii=False))])
            return {**result, 'response': answer, 'conversation_id': cid}
