FROM pytorch/pytorch:2.7.1-cuda12.8-cudnn9-runtime
ENV PYTHONUNBUFFERED=1 PYTHONDONTWRITEBYTECODE=1 HF_HOME=/models/huggingface \
    PYTORCH_NVML_BASED_CUDA_CHECK=1 TOKENIZERS_PARALLELISM=false
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY server.py worker.py ./
EXPOSE 8000
CMD ["uvicorn", "server:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]
