"""Persistent GPU inference only. JSON-lines stdin/stdout is owned by the C# service."""
import argparse
import ctypes
import json
import os
import sys
import traceback
import wave
from importlib.metadata import version
from pathlib import Path
from time import perf_counter

TRANSLATION_MODEL = 'facebook/nllb-200-distilled-600M'
TRANSLATION_REVISION = 'a3e77be725cf30383f1faeb8d2f0b0ea98ac554e'
SOURCE_LANGUAGES = {'ja': 'jpn_Jpan', 'en': 'eng_Latn'}
_dll_directories = []


def prepare_device(device):
    if device != 'cuda':
        return
    import torch
    if not torch.cuda.is_available():
        raise RuntimeError('CUDA unavailable. Install requirements-gpu.txt and check the NVIDIA driver.')
    if os.name == 'nt' and not _dll_directories:
        directory = Path(torch.__file__).parent / 'lib'
        _dll_directories.append(os.add_dll_directory(str(directory)))
        os.environ['PATH'] = str(directory) + os.pathsep + os.environ.get('PATH', '')
        for name in ('cublas64_12.dll', 'cudnn64_9.dll'):
            ctypes.WinDLL(str(directory / name))
    torch.cuda.init()


class InferenceEngine:
    def __init__(self, args):
        self.args = args
        self.whisper = None
        self.translator = None
        self.tokenizers = {}
        self.whisper_loads = 0
        self.translation_loads = 0
        self.convert = None
        for device in {args.device, args.translation_device}:
            prepare_device(device)

    def load_whisper(self):
        if self.whisper is None:
            from faster_whisper import WhisperModel
            self.whisper = WhisperModel(self.args.model, device=self.args.device,
                                        compute_type=self.args.compute_type, cpu_threads=self.args.cpu_threads)
            self.whisper_loads += 1
        return self.whisper

    def load_translation(self, language):
        import torch
        from transformers import AutoModelForSeq2SeqLM, AutoTokenizer
        torch.set_num_threads(self.args.cpu_threads)
        dtype = torch.float16 if self.args.translation_device == 'cuda' else torch.float32
        if self.translator is None:
            model = AutoModelForSeq2SeqLM.from_pretrained(
                TRANSLATION_MODEL, revision=TRANSLATION_REVISION,
                use_safetensors=True, torch_dtype=dtype)
            # This pinned safetensors checkpoint stores tied embeddings as aliases
            # of lm_head.weight. Some Transformers versions leave the shared alias
            # on meta. Restore the actual checkpoint tensor, never empty weights.
            if model.model.shared.weight.is_meta:
                from huggingface_hub import hf_hub_download
                from safetensors import safe_open
                checkpoint = hf_hub_download(TRANSLATION_MODEL, 'model.safetensors', revision=TRANSLATION_REVISION)
                with safe_open(checkpoint, framework='pt', device='cpu') as tensors:
                    alias = (tensors.metadata() or {}).get('model.shared.weight', 'model.shared.weight')
                    weight = tensors.get_tensor(alias)
                if tuple(weight.shape) != tuple(model.model.shared.weight.shape):
                    raise RuntimeError('NLLB shared embedding checkpoint shape mismatch.')
                model.model.shared.weight = torch.nn.Parameter(weight.to(dtype=dtype), requires_grad=False)
                model.tie_weights()
            if any(parameter.is_meta for parameter in model.parameters()):
                raise RuntimeError('NLLB still contains unloaded parameters; refusing inference.')
            self.translator = model.to(self.args.translation_device).eval()
            self.translation_loads += 1
        if language not in self.tokenizers:
            self.tokenizers[language] = AutoTokenizer.from_pretrained(
                TRANSLATION_MODEL, revision=TRANSLATION_REVISION, src_lang=SOURCE_LANGUAGES[language])
        return self.translator, self.tokenizers[language]

    def translate(self, language, segments):
        if self.convert is None:
            from opencc import OpenCC
            self.convert = OpenCC('s2twp').convert
        if language == 'zh':
            for segment in segments:
                segment['traditionalChineseText'] = self.convert(segment['text'])
            return
        if language not in SOURCE_LANGUAGES:
            raise ValueError(f'Unsupported detected language: {language}. Supported: zh, ja, en.')
        import torch
        model, tokenizer = self.load_translation(language)
        target = tokenizer.convert_tokens_to_ids('zho_Hant')
        with torch.inference_mode():
            for offset in range(0, len(segments), self.args.translation_batch_size):
                batch = segments[offset:offset + self.args.translation_batch_size]
                inputs = tokenizer([s['text'] for s in batch], padding=True, return_tensors='pt').to(model.device)
                translated = model.generate(**inputs, forced_bos_token_id=target, max_new_tokens=512)
                texts = tokenizer.batch_decode(translated, skip_special_tokens=True)
                for segment, text in zip(batch, texts, strict=True):
                    if not text.strip():
                        raise ValueError('NLLB returned an empty translation.')
                    segment['traditionalChineseText'] = self.convert(text.strip())

    def infer(self, request, report):
        language = request.get('language')
        if language not in (None, 'zh', 'ja', 'en'):
            raise ValueError('Language must be zh, ja, en, or null.')
        audio = Path(request['audioPath'])
        if not audio.is_file():
            raise ValueError('Audio file does not exist.')
        report('model')
        started = perf_counter()
        model = self.load_whisper()
        report('transcription')
        import numpy as np
        with wave.open(str(audio), 'rb') as wav:
            if wav.getnchannels() != 1 or wav.getsampwidth() != 2 or wav.getframerate() != 16000:
                raise ValueError('C# media service must supply mono 16 kHz PCM16 WAV.')
            samples = np.frombuffer(wav.readframes(wav.getnframes()), dtype='<i2').astype(np.float32) / 32768.0
        generated, info = model.transcribe(samples, language=language, task='transcribe', vad_filter=True)
        segments = [{'startSeconds': s.start, 'endSeconds': s.end, 'text': s.text.strip()}
                    for s in generated if s.text.strip()]
        transcription_seconds = perf_counter() - started
        if not segments:
            raise ValueError('No speech was detected.')
        report('translation')
        started = perf_counter()
        self.translate(info.language, segments)
        translation_seconds = perf_counter() - started
        return {'language': info.language, 'engineVersion': version('faster-whisper'), 'segments': segments,
                'transcriptionSeconds': transcription_seconds, 'translationSeconds': translation_seconds,
                'whisperDevice': model.model.device, 'translationDevice':
                str(self.translator.device) if info.language != 'zh' else 'opencc-cpu',
                'whisperLoads': self.whisper_loads, 'translationLoads': self.translation_loads}


def emit(message):
    print(json.dumps(message, ensure_ascii=True), flush=True)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--model', default='large-v2')
    parser.add_argument('--device', choices=('cpu', 'cuda'), default='cuda')
    parser.add_argument('--compute-type', default='float16')
    parser.add_argument('--translation-device', choices=('cpu', 'cuda'), default='cuda')
    parser.add_argument('--translation-batch-size', type=int, default=8)
    parser.add_argument('--cpu-threads', type=int, default=4)
    args = parser.parse_args()
    if not 1 <= args.translation_batch_size <= 32 or args.cpu_threads < 1:
        parser.error('Invalid batch size or CPU thread count.')
    try:
        engine = InferenceEngine(args)
    except Exception as error:
        traceback.print_exc(file=sys.stderr)
        emit({'type': 'startupError', 'message': str(error)})
        return 1
    emit({'type': 'ready', 'whisperDevice': args.device, 'translationDevice': args.translation_device})
    for line in sys.stdin:
        request_id = None
        stage = 'setup'
        try:
            request = json.loads(line)
            request_id = request['id']
            def report(value):
                nonlocal stage
                stage = value
                emit({'id': request_id, 'type': 'stage', 'stage': value})
            result = engine.infer(request, report)
            emit({'id': request_id, 'type': 'result', 'result': result})
        except Exception as error:
            traceback.print_exc(file=sys.stderr)
            emit({'id': request_id, 'type': 'error', 'stage': stage, 'message': str(error)})
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
