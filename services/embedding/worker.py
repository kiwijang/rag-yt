"""Persistent CPU model; temporary CUDA weights are returned to CPU before every reply."""
import contextlib
import copy
import json
import sys
import traceback

MODEL = 'BAAI/bge-m3'
REVISION = '5617a9f61b028005a4858fdac845db406aefb181'
DIMENSIONS = 1024
model = None
gpu_model = None
jina_model = None
JINA = 'jinaai/jina-clip-v2'
JINA_REVISION = 'e10d47f5691d0454a0fb5d13f46f2199b74cb436'
JINA_CODE = '39e6a55ae971b59bea6e44675d237c99762e7ee2'


def encode_jina(request):
    global jina_model
    import torch
    from PIL import Image
    from transformers import AutoModel, AutoConfig, AutoTokenizer, AutoImageProcessor
    from huggingface_hub import snapshot_download
    if jina_model is None:
        # Pin the nested text tower's configuration AND executable code, not just CLIP weights.
        nested = snapshot_download('jinaai/jina-embeddings-v3',
            revision='ab036b023d30b4d1138c4c3bfa9f0c445ab455d6',
            allow_patterns=['*.json','*.py','*.txt','*.model'])
        implementation = snapshot_download('jinaai/xlm-roberta-flash-implementation',
            revision='bd55a5ec8e6c0fb1d6c26efb4b6a4a74ce8a88d3',allow_patterns=['*.py'])
        import pathlib, shutil
        original_nested = nested
        nested = '/models/jina_text_runtime_v1'
        pathlib.Path(nested).mkdir(parents=True,exist_ok=True)
        for source in pathlib.Path(original_nested).iterdir():
            if source.is_file():
                shutil.copyfile(source,pathlib.Path(nested)/source.name)
        for source in pathlib.Path(implementation).glob('*.py'):
            shutil.copyfile(source,pathlib.Path(nested)/source.name)
        config_path = pathlib.Path(nested)/'config.json'
        config_data = json.loads(config_path.read_text())
        config_data['auto_map'] = {key:value.split('--')[-1] for key,value in config_data['auto_map'].items()}
        config_path.write_text(json.dumps(config_data))
        # Transformers' local dynamic loader copies only immediate imports; preload
        # the full pinned implementation so transitive relative modules resolve too.
        from transformers.utils.hub import HF_MODULES_CACHE
        code_cache = pathlib.Path(HF_MODULES_CACHE)/'transformers_modules'/pathlib.Path(nested).name
        code_cache.mkdir(parents=True,exist_ok=True)
        (code_cache/'__init__.py').touch()
        for source in pathlib.Path(implementation).glob('*.py'):
            shutil.copyfile(source,code_cache/source.name)
        config = AutoConfig.from_pretrained(JINA,revision=JINA_REVISION,code_revision=JINA_CODE,trust_remote_code=True)
        config.text_config.hf_model_name_or_path = nested
        config.use_text_flash_attn = False
        config.use_vision_xformers = False
        config.text_config.hf_model_config_kwargs['use_flash_attn'] = False
        jina_model = AutoModel.from_pretrained(JINA,config=config,revision=JINA_REVISION,
            code_revision=JINA_CODE,trust_remote_code=True,torch_dtype=torch.float32).eval()
        jina_model.tokenizer = AutoTokenizer.from_pretrained(JINA,revision=JINA_REVISION,trust_remote_code=False)
        jina_model.preprocess = AutoImageProcessor.from_pretrained(JINA,revision=JINA_REVISION,
            code_revision=JINA_CODE,trust_remote_code=True,use_fast=False)
    requested = request.get('device','auto')
    if requested == 'gpu' and not torch.cuda.is_available():
        raise RuntimeError('CUDA requested but unavailable')
    device = 'cuda' if requested != 'cpu' and torch.cuda.is_available() else 'cpu'
    try:
        jina_model.to(device)
        with torch.inference_mode():
            if request.get('images'):
                images = []
                for path in request['images']:
                    with Image.open(path) as img:
                        images.append(img.convert('RGB'))
                values = jina_model.encode_image(images,batch_size=2,device=device,show_progress_bar=False)
            else:
                values = jina_model.encode_text(request['texts'],task='retrieval.query',batch_size=4,
                    device=device,show_progress_bar=False)
        return {'model':JINA,'revision':JINA_REVISION,'dimensions':1024,'device':device,
                'vectors':values.tolist(),'tokenCounts':[0]*len(values),'windowCounts':[1]*len(values)}
    finally:
        jina_model.to('cpu')
        torch.cuda.empty_cache()


def encode(request):
    global model, gpu_model
    if request.get('model') == 'jina-clip-v2':
        return encode_jina(request)
    import numpy as np
    import torch
    from sentence_transformers import SentenceTransformer
    requested = request.get('device', 'auto')
    if requested == 'gpu' and not torch.cuda.is_available():
        raise RuntimeError('CUDA requested but unavailable')
    device = 'cuda' if requested != 'cpu' and torch.cuda.is_available() else 'cpu'
    if model is None:
        print('Loading pinned BGE-M3 model on CPU...', file=sys.stderr, flush=True)
        model = SentenceTransformer(MODEL, revision=REVISION, device='cpu')
        model.max_seq_length = 8192
    selected = model
    try:
        if device == 'cuda':
            if gpu_model is None:
                gpu_model = copy.deepcopy(model).half()
            selected = gpu_model.to('cuda')
        windows, ranges, counts = [], [], []
        for text in request['texts']:
            tokens = model.tokenizer.encode(text, add_special_tokens=False)
            counts.append(len(tokens))
            start = len(windows)
            if len(tokens) <= 8190:
                windows.append(text)
            else:
                # Large tables remain intact in the source; all token windows contribute to one normalized vector.
                for offset in range(0, len(tokens), 7934):
                    windows.append(model.tokenizer.decode(tokens[offset:offset+8190], skip_special_tokens=True))
            ranges.append((start, len(windows)))
        values = selected.encode(windows, batch_size=8 if device == 'cuda' else 4,
                                 normalize_embeddings=True, convert_to_numpy=True, show_progress_bar=False)
        vectors = []
        for start, end in ranges:
            value = values[start:end].astype(np.float32).mean(axis=0)
            norm = np.linalg.norm(value)
            if not np.isfinite(norm) or norm == 0:
                raise RuntimeError('Invalid embedding norm')
            vectors.append((value/norm).tolist())
        return {'model': MODEL, 'revision': REVISION, 'dimensions': DIMENSIONS, 'device': device,
                'vectors': vectors, 'tokenCounts': counts, 'windowCounts': [end-start for start,end in ranges]}
    finally:
        if gpu_model is not None:
            gpu_model.to('cpu')
            torch.cuda.empty_cache()


for line in sys.stdin:
    request = {}
    try:
        request = json.loads(line)
        with contextlib.redirect_stdout(sys.stderr):
            result = encode(request)
        response = {'id': request['id'], 'result': result}
    except Exception:
        traceback.print_exc(file=sys.stderr)
        response = {'id': request.get('id'), 'error': 'Embedding inference failed; inspect container logs'}
    print(json.dumps(response), flush=True)
