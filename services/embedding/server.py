import asyncio
import json
import sys
import tempfile
from pathlib import Path
from fastapi import UploadFile, File, Form
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

app = FastAPI(title='RagYt BGE-M3 embedding')
gate = asyncio.Lock()
worker = None


class EmbeddingRequest(BaseModel):
    id: str = Field(min_length=1,max_length=100)
    texts: list[str] = Field(min_length=1,max_length=64)
    device: str = 'auto'
    model: str = 'bge-m3'


@app.middleware('http')
async def local_only(request: Request, call_next):
    if request.url.path.startswith('/embed') and request.headers.get('origin'):
        return JSONResponse({'detail': 'Use the authenticated application API'},status_code=403)
    return await call_next(request)


@app.get('/health')
async def health():
    import torch
    return {'status':'ok','model':'BAAI/bge-m3','models':['BAAI/bge-m3','jinaai/jina-clip-v2'],'revision':'5617a9f61b028005a4858fdac845db406aefb181',
            'dimensions':1024,'cudaAvailable':torch.cuda.is_available(),'busy':gate.locked()}


async def reset():
    global worker
    if worker is not None:
        if worker.returncode is None:
            worker.kill()
        await worker.wait()
        worker = None


@app.post('/embed')
async def embed(body: EmbeddingRequest, request: Request):
    return await run_embed(body,request)


async def run_embed(body: EmbeddingRequest, request: Request, images=None):
    global worker
    if body.model not in ('bge-m3','jina-clip-v2') or body.device not in ('auto','gpu','cpu') or any(not text.strip() or len(text)>200_000 for text in body.texts):
        raise HTTPException(400,'Invalid text or device')
    while gate.locked():
        if await request.is_disconnected():
            raise HTTPException(499,'Cancelled')
        await asyncio.sleep(0.1)
    async with gate:
        task = None
        try:
            if worker is None or worker.returncode is not None:
                worker = await asyncio.create_subprocess_exec(sys.executable,'-u','/app/worker.py',
                    stdin=asyncio.subprocess.PIPE,stdout=asyncio.subprocess.PIPE,limit=8*1024*1024)
            payload = body.model_dump()
            if images:
                payload['images'] = images
            worker.stdin.write((json.dumps(payload)+'\n').encode())
            await worker.stdin.drain()
            task = asyncio.create_task(worker.stdout.readline())
            while not task.done():
                if await request.is_disconnected():
                    raise HTTPException(499,'Cancelled')
                await asyncio.wait([task],timeout=0.2)
            raw = await task
            response = json.loads(raw)
            if response.get('id') != body.id or 'result' not in response:
                raise HTTPException(422,'Embedding inference failed; inspect container logs')
            result = response['result']
            print(f'Embedded {len(body.texts)} texts ({result["device"]}); CUDA weights released',flush=True)
            return result
        except BaseException:
            await reset()
            raise
        finally:
            if task is not None and not task.done():
                task.cancel()


@app.post('/embed-images')
async def embed_images(request: Request, files: list[UploadFile] = File(...), device: str = Form('auto')):
    if not 1 <= len(files) <= 8:
        raise HTTPException(400,'Expected 1 to 8 images')
    with tempfile.TemporaryDirectory(prefix='jina-') as directory:
        paths = []
        for index, file in enumerate(files):
            path = Path(directory)/f'{index}.png'
            total = 0
            with path.open('wb') as output:
                while block := await file.read(1024*1024):
                    total += len(block)
                    if total > 32*1024*1024:
                        raise HTTPException(413,'Image exceeds 32 MiB')
                    output.write(block)
            paths.append(str(path))
        return await run_embed(EmbeddingRequest(id=__import__('uuid').uuid4().hex,texts=['image']*len(paths),
            model='jina-clip-v2',device=device),request,paths)
