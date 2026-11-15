"""Loopback-only MinerU adapter; each job exits its inference process to release CUDA memory."""
import asyncio
import importlib.metadata
import json
import shutil
import sys
import tempfile
from pathlib import Path

from fastapi import FastAPI, File, Form, HTTPException, Request, UploadFile
from fastapi.responses import FileResponse, JSONResponse
from starlette.background import BackgroundTask

app = FastAPI(title='RagYt MinerU', version='1')
parse_lock = asyncio.Lock()


@app.middleware('http')
async def local_adapter_only(request: Request, call_next):
    # Browser requests go through the authenticated .NET API, never directly to this local adapter.
    if request.url.path == '/parse' and request.headers.get('origin'):
        return JSONResponse({'detail': 'Use the authenticated application API'}, status_code=403)
    return await call_next(request)


@app.get('/health')
async def health():
    import torch
    return {'status': 'ok', 'engine': 'MinerU', 'version': importlib.metadata.version('mineru'),
            'cudaAvailable': torch.cuda.is_available(), 'busy': parse_lock.locked()}


@app.post('/parse')
async def parse(request: Request, file: UploadFile = File(...), pages: str = Form(...), device: str = Form('auto')):
    try:
        numbers = json.loads(pages)
        if not isinstance(numbers, list) or not numbers or len(numbers) > 2000 or any(type(p) is not int or p < 1 for p in numbers) or len(set(numbers)) != len(numbers):
            raise ValueError()
        if device not in ('auto', 'gpu', 'cpu'):
            raise ValueError()
    except (ValueError, TypeError):
        raise HTTPException(400, 'Invalid pages or device')
    job = Path(tempfile.mkdtemp(prefix='ragyt-mineru-'))
    success = False
    process = None
    acquired = False
    try:
        size = 0
        with (job / 'input.pdf').open('wb') as stream:
            while chunk := await file.read(1024 * 1024):
                size += len(chunk)
                if size > 200_000_000:
                    raise HTTPException(413, 'PDF exceeds 200 MB')
                stream.write(chunk)
        while parse_lock.locked():
            if await request.is_disconnected():
                raise HTTPException(499, 'Request cancelled')
            await asyncio.sleep(0.2)
        await parse_lock.acquire()
        acquired = True
        (job / 'request.json').write_text(json.dumps({'pages': numbers, 'device': device}), encoding='utf-8')
        process = await asyncio.create_subprocess_exec(sys.executable, '-u', '/app/worker.py', str(job))
        while process.returncode is None:
            if await request.is_disconnected():
                raise HTTPException(499, 'Request cancelled')
            try:
                await asyncio.wait_for(process.wait(), 0.5)
            except asyncio.TimeoutError:
                pass
        if process.returncode != 0:
            raise HTTPException(422, 'MinerU parsing failed. See docker compose logs mineru.')
        success = True
        return FileResponse(job / 'result.zip', media_type='application/zip',
                            background=BackgroundTask(shutil.rmtree, job))
    finally:
        if process is not None and process.returncode is None:
            process.kill()
            await process.wait()
        if acquired:
            parse_lock.release()
        await file.close()
        if not success:
            shutil.rmtree(job)
