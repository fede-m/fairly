FROM python:3.12-slim
# Install uv as package manager
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/
# Set working directory
WORKDIR /app

# Copy dependency files
COPY pyproject.toml uv.lock* /app/

# Install dependencies
RUN uv sync

# Copy application code
COPY . /app/

EXPOSE 8000

# Store cached models in a tmp file (does not end up in the image layer)
ENV HF_HOME=/tmp/hf_cache
RUN useradd -m app
USER app

CMD ["uv", "run", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]