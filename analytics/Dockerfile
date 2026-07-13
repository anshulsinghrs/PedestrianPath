FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

# System deps for scipy/numpy/libpysal wheels are available on slim;
# add build-essential only if we ever need to compile from source.
RUN apt-get update \
    && apt-get install -y --no-install-recommends build-essential \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt ./
RUN pip install --upgrade pip && pip install -r requirements.txt

COPY main.py ./

# Render (and most PaaS hosts) inject the listen port as $PORT. Fall
# back to 8000 for local `docker run` / docker-compose where PORT isn't
# set. Shell form is required so $PORT expands at container start.
ENV PORT=8000
EXPOSE 8000

CMD uvicorn main:app --host 0.0.0.0 --port ${PORT}
